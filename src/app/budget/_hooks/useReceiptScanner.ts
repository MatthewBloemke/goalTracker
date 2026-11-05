'use client';

import { useCallback, useRef, useState } from 'react';
import { useSupabase } from '@/components/providers/SupabaseProvider';
import {
  getReceiptDocumentError,
  getReceiptDocumentType,
  getReceiptCategories,
  getReceiptTextError,
  parseReceiptAnalysis,
  type PreparedReceiptImage,
  type ReceiptAnalysis,
} from '@/app/budget/_lib/receipt';
import { receiptBlobToBase64 } from '@/app/budget/_lib/receipt-image';
import type { BudgetCategory } from '@/types';

interface UseReceiptScannerOptions {
  familyId?: string | null;
  categories: BudgetCategory[];
}

type ReceiptSource =
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'document'; data: string; mimeType: string; fileName: string }
  | { type: 'text'; text: string };

export function useReceiptScanner({
  familyId,
  categories,
}: UseReceiptScannerOptions) {
  const { supabase } = useSupabase();
  const [analysis, setAnalysis] = useState<ReceiptAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const rejectInput = useCallback((message: string) => {
    requestId.current += 1;
    setAnalysis(null);
    setAnalyzing(false);
    setError(message);
  }, []);

  const analyzeSource = useCallback(async (
    prepareSource: () => Promise<ReceiptSource>,
  ) => {
    const currentRequest = ++requestId.current;
    setAnalysis(null);
    setError(null);
    setAnalyzing(false);
    const receiptCategories = getReceiptCategories(categories);
    if (receiptCategories.length === 0) {
      setError('Enable at least one spending category for receipt scans in Edit groups.');
      return;
    }
    if (!familyId) {
      setError('Create or join a family before scanning a receipt.');
      return;
    }

    setAnalyzing(true);
    try {
      const receipt = await prepareSource();
      if (currentRequest !== requestId.current) return;
      const { data, error: functionError } = await supabase.functions.invoke(
        'analyze-receipt',
        {
          body: {
            familyId,
            categoryIds: receiptCategories.map(({ id }) => id),
            receipt,
          },
        },
      );
      if (functionError) throw new Error(await readFunctionError(functionError));

      const result = parseReceiptAnalysis(data);
      if (currentRequest === requestId.current) setAnalysis(result);
    } catch (analysisError) {
      if (currentRequest === requestId.current) {
        setError(
          analysisError instanceof Error
            ? analysisError.message
            : 'Receipt analysis failed. Please try again.',
        );
      }
    } finally {
      if (currentRequest === requestId.current) setAnalyzing(false);
    }
  }, [categories, familyId, supabase]);

  const analyze = useCallback(async (image: PreparedReceiptImage) => {
    await analyzeSource(async () => ({
      type: 'image',
      data: image.data,
      mimeType: image.mimeType,
    }));
  }, [analyzeSource]);

  const analyzeDocument = useCallback(async (file: File) => {
    const fileError = getReceiptDocumentError(file);
    const mimeType = getReceiptDocumentType(file);
    if (fileError || !mimeType) {
      rejectInput(fileError ?? 'Choose a PDF or exported email (.eml) file.');
      return;
    }
    await analyzeSource(async () => ({
      type: 'document',
      data: await receiptBlobToBase64(file),
      mimeType,
      fileName: file.name,
    }));
  }, [analyzeSource, rejectInput]);

  const analyzeText = useCallback(async (text: string) => {
    const textError = getReceiptTextError(text);
    if (textError) {
      rejectInput(textError);
      return;
    }
    await analyzeSource(async () => ({ type: 'text', text: text.trim() }));
  }, [analyzeSource, rejectInput]);

  const reset = useCallback(() => {
    requestId.current += 1;
    setAnalysis(null);
    setError(null);
    setAnalyzing(false);
  }, []);

  return {
    analysis,
    analyzing,
    error,
    analyze,
    analyzeDocument,
    analyzeText,
    reset,
  };
}

async function readFunctionError(error: unknown) {
  if (typeof error === 'object' && error !== null && 'context' in error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const payload = await context.clone().json() as { error?: unknown };
        if (typeof payload.error === 'string') return payload.error;
      } catch {
        // Fall back to the client error below.
      }
    }
  }
  return error instanceof Error ? error.message : 'Receipt analysis failed. Please try again.';
}

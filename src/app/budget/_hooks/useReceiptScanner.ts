'use client';

import { useCallback, useRef, useState } from 'react';
import { useSupabase } from '@/components/providers/SupabaseProvider';
import {
  getReceiptDocumentError,
  getReceiptDocumentType,
  getReceiptFileError,
  getReceiptResizeDimensions,
  getReceiptTextError,
  MAX_RECEIPT_PROCESSED_BYTES,
  parseReceiptAnalysis,
  type ReceiptAnalysis,
} from '@/app/budget/_lib/receipt';
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
    if (categories.length === 0) {
      setError('Create at least one budget category before scanning a receipt.');
      return;
    }
    if (!familyId) {
      setError('Create or join a family before scanning a receipt.');
      return;
    }

    setAnalyzing(true);
    try {
      const receipt = await prepareSource();
      const { data, error: functionError } = await supabase.functions.invoke(
        'analyze-receipt',
        {
          body: {
            familyId,
            categoryIds: categories.map(({ id }) => id),
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

  const analyze = useCallback(async (file: File) => {
    const fileError = getReceiptFileError(file);
    if (fileError) {
      rejectInput(fileError);
      return;
    }
    await analyzeSource(async () => ({
      type: 'image',
      ...await prepareReceiptImage(file),
    }));
  }, [analyzeSource, rejectInput]);

  const analyzeDocument = useCallback(async (file: File) => {
    const fileError = getReceiptDocumentError(file);
    const mimeType = getReceiptDocumentType(file);
    if (fileError || !mimeType) {
      rejectInput(fileError ?? 'Choose a PDF or exported email (.eml) file.');
      return;
    }
    await analyzeSource(async () => ({
      type: 'document',
      data: await blobToBase64(file),
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

async function prepareReceiptImage(file: File) {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('This image could not be opened. Try a JPEG, PNG, or WebP image.');
  }

  try {
    for (const attempt of [
      { maxDimension: 2400, quality: 0.88 },
      { maxDimension: 2200, quality: 0.76 },
      { maxDimension: 1800, quality: 0.68 },
    ]) {
      const blob = await renderReceipt(bitmap, attempt.maxDimension, attempt.quality);
      if (blob.size <= MAX_RECEIPT_PROCESSED_BYTES) {
        return { data: await blobToBase64(blob), mimeType: 'image/jpeg' };
      }
    }
    throw new Error('The receipt is still too large after compression. Try a lower-resolution photo.');
  } finally {
    bitmap.close();
  }
}

function renderReceipt(bitmap: ImageBitmap, maxDimension: number, quality: number) {
  const { width, height } = getReceiptResizeDimensions(
    bitmap.width,
    bitmap.height,
    maxDimension,
  );
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser could not prepare the receipt image.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob
        ? resolve(blob)
        : reject(new Error('Your browser could not compress the receipt image.')),
      'image/jpeg',
      quality,
    );
  });
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Your browser could not read the receipt file.'));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIndex = result.indexOf(',');
      if (commaIndex < 0) reject(new Error('Your browser returned an invalid receipt file.'));
      else resolve(result.slice(commaIndex + 1));
    };
    reader.readAsDataURL(blob);
  });
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

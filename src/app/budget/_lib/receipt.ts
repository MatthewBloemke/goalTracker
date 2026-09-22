export const RECEIPT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_RECEIPT_SOURCE_BYTES = 10 * 1024 * 1024;
export const MAX_RECEIPT_PROCESSED_BYTES = 5 * 1024 * 1024;

export interface ReceiptItem {
  description: string;
  amount: number;
  categoryId: string | null;
  confidence: number;
  requiresReview: boolean;
}

export interface ReceiptAllocation {
  categoryId: string;
  amount: number;
}

export interface ReceiptAnalysis {
  merchant: string | null;
  transactionDate: string | null;
  subtotal: number | null;
  tax: number | null;
  discounts: number | null;
  tip: number | null;
  fees: number | null;
  total: number | null;
  requiresReview: boolean;
  reviewReasons: string[];
  items: ReceiptItem[];
  allocations: ReceiptAllocation[];
}

export interface ReceiptTransactionDraft {
  merchant: string;
  date: string;
  amount: string;
  splits: Array<{ categoryId: string; amount: string }>;
}

export function getReceiptFileError(file: Pick<File, 'size' | 'type'>) {
  if (!RECEIPT_IMAGE_TYPES.includes(file.type as (typeof RECEIPT_IMAGE_TYPES)[number])) {
    return 'Choose a JPEG, PNG, or WebP image.';
  }
  if (file.size <= 0) return 'The selected image is empty.';
  if (file.size > MAX_RECEIPT_SOURCE_BYTES) {
    return 'The original image must be 10 MB or smaller.';
  }
  return null;
}

export function getReceiptResizeDimensions(
  width: number,
  height: number,
  maxDimension: number,
) {
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function parseReceiptAnalysis(value: unknown): ReceiptAnalysis {
  if (!isRecord(value)) throw new Error('Receipt analysis returned an invalid response.');

  const nullableMoneyKeys = [
    'subtotal',
    'tax',
    'discounts',
    'tip',
    'fees',
    'total',
  ] as const;
  for (const key of nullableMoneyKeys) {
    if (value[key] !== null && !isNonNegativeNumber(value[key])) {
      throw new Error('Receipt analysis returned invalid amounts.');
    }
  }
  if (value.merchant !== null && typeof value.merchant !== 'string') {
    throw new Error('Receipt analysis returned an invalid merchant.');
  }
  if (value.transactionDate !== null && typeof value.transactionDate !== 'string') {
    throw new Error('Receipt analysis returned an invalid date.');
  }
  if (typeof value.requiresReview !== 'boolean' || !isStringArray(value.reviewReasons)) {
    throw new Error('Receipt analysis returned invalid review information.');
  }
  if (!Array.isArray(value.items) || !value.items.every(isReceiptItem)) {
    throw new Error('Receipt analysis returned invalid receipt items.');
  }
  if (!Array.isArray(value.allocations) || !value.allocations.every(isReceiptAllocation)) {
    throw new Error('Receipt analysis returned invalid category allocations.');
  }

  return value as unknown as ReceiptAnalysis;
}

export function receiptAnalysisToTransactionDraft(
  analysis: ReceiptAnalysis,
  fallbackDate: string,
  availableCategoryIds: ReadonlySet<string>,
): ReceiptTransactionDraft {
  const splits = analysis.allocations
    .filter(({ categoryId, amount }) => availableCategoryIds.has(categoryId) && amount > 0)
    .map(({ categoryId, amount }) => ({
      categoryId,
      amount: amount.toFixed(2),
    }));

  return {
    merchant: analysis.merchant ?? '',
    date: analysis.transactionDate ?? fallbackDate,
    amount: analysis.total === null ? '' : analysis.total.toFixed(2),
    splits: splits.length > 0
      ? splits
      : [{ categoryId: '', amount: analysis.total === null ? '' : analysis.total.toFixed(2) }],
  };
}

function isReceiptItem(value: unknown) {
  return isRecord(value)
    && typeof value.description === 'string'
    && isNonNegativeNumber(value.amount)
    && (value.categoryId === null || typeof value.categoryId === 'string')
    && isNonNegativeNumber(value.confidence)
    && value.confidence <= 1
    && typeof value.requiresReview === 'boolean';
}

function isReceiptAllocation(value: unknown) {
  return isRecord(value)
    && typeof value.categoryId === 'string'
    && isNonNegativeNumber(value.amount);
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

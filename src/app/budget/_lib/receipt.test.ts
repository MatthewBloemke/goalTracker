import {
  getReceiptFileError,
  getReceiptResizeDimensions,
  MAX_RECEIPT_SOURCE_BYTES,
  parseReceiptAnalysis,
  receiptAnalysisToTransactionDraft,
  type ReceiptAnalysis,
} from './receipt';

const analysis = (overrides: Partial<ReceiptAnalysis> = {}): ReceiptAnalysis => ({
  merchant: 'Walmart',
  transactionDate: '2026-08-05',
  subtotal: 73.5,
  tax: 5.32,
  discounts: 0,
  tip: null,
  fees: null,
  total: 78.82,
  requiresReview: false,
  reviewReasons: [],
  items: [{
    description: 'Whole Milk',
    amount: 3.48,
    categoryId: 'groceries',
    confidence: 0.98,
    requiresReview: false,
  }],
  allocations: [
    { categoryId: 'groceries', amount: 42.17 },
    { categoryId: 'household', amount: 36.65 },
  ],
  ...overrides,
});

describe('receipt image validation', () => {
  test('accepts supported non-empty images under the source limit', () => {
    expect(getReceiptFileError({ type: 'image/jpeg', size: 1024 })).toBeNull();
    expect(getReceiptFileError({ type: 'image/png', size: 1024 })).toBeNull();
    expect(getReceiptFileError({ type: 'image/webp', size: 1024 })).toBeNull();
  });

  test('rejects unsupported, empty, and oversized images', () => {
    expect(getReceiptFileError({ type: 'application/pdf', size: 1024 })).toMatch(/JPEG/);
    expect(getReceiptFileError({ type: 'image/jpeg', size: 0 })).toMatch(/empty/);
    expect(getReceiptFileError({
      type: 'image/jpeg',
      size: MAX_RECEIPT_SOURCE_BYTES + 1,
    })).toMatch(/10 MB/);
  });

  test('preserves aspect ratio, shrinks large photos, and never upscales small ones', () => {
    expect(getReceiptResizeDimensions(4000, 3000, 2400)).toEqual({
      width: 2400,
      height: 1800,
    });
    expect(getReceiptResizeDimensions(1200, 800, 2400)).toEqual({
      width: 1200,
      height: 800,
    });
  });
});

describe('receipt response parsing', () => {
  test('accepts the strict receipt response shape', () => {
    expect(parseReceiptAnalysis(analysis())).toEqual(analysis());
  });

  test.each([
    null,
    { ...analysis(), total: -1 },
    { ...analysis(), merchant: 4 },
    { ...analysis(), transactionDate: 4 },
    { ...analysis(), requiresReview: 'no' },
    { ...analysis(), items: [{ amount: 1 }] },
    { ...analysis(), allocations: [{ categoryId: 'groceries', amount: Number.NaN }] },
  ])('rejects an invalid response', (value) => {
    expect(() => parseReceiptAnalysis(value)).toThrow(/Receipt analysis/);
  });
});

describe('receipt transaction drafts', () => {
  test('maps verified allocations into the existing split transaction shape', () => {
    expect(receiptAnalysisToTransactionDraft(
      analysis(),
      '2026-08-01',
      new Set(['groceries', 'household']),
    )).toEqual({
      merchant: 'Walmart',
      date: '2026-08-05',
      amount: '78.82',
      splits: [
        { categoryId: 'groceries', amount: '42.17' },
        { categoryId: 'household', amount: '36.65' },
      ],
    });
  });

  test('uses editable blanks and ignores unavailable categories when extraction is incomplete', () => {
    expect(receiptAnalysisToTransactionDraft(
      analysis({
        merchant: null,
        transactionDate: null,
        total: null,
        allocations: [{ categoryId: 'unavailable', amount: 10 }],
      }),
      '2026-08-01',
      new Set(['groceries']),
    )).toEqual({
      merchant: '',
      date: '2026-08-01',
      amount: '',
      splits: [{ categoryId: '', amount: '' }],
    });
  });
});

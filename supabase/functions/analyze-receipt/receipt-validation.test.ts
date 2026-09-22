import {
  buildReceiptSchema,
  validateReceiptAnalysis,
} from './receipt-validation'

const groceries = '11111111-1111-4111-8111-111111111111'
const household = '22222222-2222-4222-8222-222222222222'

const validResult = () => ({
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
  items: [
    {
      description: 'Whole Milk',
      amount: 3.48,
      categoryId: groceries,
      confidence: 0.98,
      requiresReview: false,
    },
  ],
  allocations: [
    { categoryId: groceries, amount: 42.17 },
    { categoryId: household, amount: 36.65 },
  ],
})

describe('receipt structured output schema', () => {
  test('constrains category IDs at item and allocation level', () => {
    const schema = buildReceiptSchema([groceries, household]) as {
      properties: {
        items: { items: { properties: { categoryId: { anyOf: Array<{ enum?: string[] }> } } } }
        allocations: { items: { properties: { categoryId: { enum: string[] } } } }
      }
    }
    expect(schema.properties.items.items.properties.categoryId.anyOf[0].enum)
      .toEqual([groceries, household])
    expect(schema.properties.allocations.items.properties.categoryId.enum)
      .toEqual([groceries, household])
  })
})

describe('server receipt validation', () => {
  test('accepts a reconciled, category-scoped result', () => {
    expect(validateReceiptAnalysis(
      validResult(),
      new Set([groceries, household]),
    )).toMatchObject({
      merchant: 'Walmart',
      transactionDate: '2026-08-05',
      total: 78.82,
      requiresReview: false,
    })
  })

  test('drops invented category allocations and requires review', () => {
    const result = validateReceiptAnalysis({
      ...validResult(),
      allocations: [{ categoryId: '33333333-3333-4333-8333-333333333333', amount: 78.82 }],
    }, new Set([groceries, household]))

    expect(result.allocations).toEqual([])
    expect(result.requiresReview).toBe(true)
    expect(result.reviewReasons.join(' ')).toMatch(/not available|No reasonable/)
  })

  test('flags allocation, arithmetic, date, and confidence problems', () => {
    const result = validateReceiptAnalysis({
      ...validResult(),
      transactionDate: '2026-02-31',
      tax: 9,
      items: [{
        description: 'Mystery item',
        amount: 5,
        categoryId: null,
        confidence: 0.25,
        requiresReview: true,
      }],
      allocations: [{ categoryId: groceries, amount: 70 }],
    }, new Set([groceries, household]))

    expect(result.transactionDate).toBeNull()
    expect(result.requiresReview).toBe(true)
    expect(result.reviewReasons.join(' ')).toMatch(/date|allocations|reconcile|Mystery item/)
  })

  test('merges duplicate valid allocations to match transaction split constraints', () => {
    const result = validateReceiptAnalysis({
      ...validResult(),
      allocations: [
        { categoryId: groceries, amount: 40 },
        { categoryId: groceries, amount: 38.82 },
      ],
    }, new Set([groceries]))

    expect(result.allocations).toEqual([{ categoryId: groceries, amount: 78.82 }])
  })

  test('removes a tiny stray allocation when the model is seven cents over', () => {
    const result = validateReceiptAnalysis({
      ...validResult(),
      total: 59.54,
      subtotal: 58.5,
      tax: 1.04,
      transactionDate: null,
      reviewReasons: [
        'Transaction date not visible.',
        'Category allocations total 59.61, not 59.54.',
      ],
      allocations: [
        { categoryId: groceries, amount: 59.54 },
        { categoryId: household, amount: 0.07 },
      ],
    }, new Set([groceries, household]))

    expect(result.allocations).toEqual([{ categoryId: groceries, amount: 59.54 }])
    expect(result.requiresReview).toBe(true)
    expect(result.reviewReasons.join(' ')).toMatch(/adjusted by \$0\.07/)
    expect(result.reviewReasons).toContain('Transaction date could not be read.')
    expect(result.reviewReasons).not.toContain('Transaction date not visible.')
    expect(result.reviewReasons).not.toContain('Category allocations total 59.61, not 59.54.')
  })

  test('adds a small unallocated remainder to the largest allocation', () => {
    const result = validateReceiptAnalysis({
      ...validResult(),
      total: 59.54,
      subtotal: 58.5,
      tax: 1.04,
      allocations: [
        { categoryId: groceries, amount: 49.47 },
        { categoryId: household, amount: 10 },
      ],
    }, new Set([groceries, household]))

    expect(result.allocations).toEqual([
      { categoryId: groceries, amount: 49.54 },
      { categoryId: household, amount: 10 },
    ])
    expect(result.reviewReasons.join(' ')).toMatch(/adjusted by \$0\.07/)
  })

  test('does not silently reconcile a material allocation mismatch', () => {
    const result = validateReceiptAnalysis({
      ...validResult(),
      allocations: [{ categoryId: groceries, amount: 78.7 }],
    }, new Set([groceries]))

    expect(result.allocations).toEqual([{ categoryId: groceries, amount: 78.7 }])
    expect(result.reviewReasons.join(' ')).toMatch(/total 78\.70, not 78\.82/)
  })

  test('discards noisy item analysis for a consistent single-category receipt', () => {
    const result = validateReceiptAnalysis({
      ...validResult(),
      requiresReview: true,
      reviewReasons: ['Product names were hard to read.'],
      items: [
        {
          description: 'Chocwy Barss (Organic Chewy Bars)',
          amount: 3.99,
          categoryId: groceries,
          confidence: 0.42,
          requiresReview: true,
        },
        {
          description: 'Choc Butter Bisc (continuation/duplicate line)',
          amount: 2.99,
          categoryId: groceries,
          confidence: 0.35,
          requiresReview: true,
        },
      ],
      allocations: [{ categoryId: groceries, amount: 78.82 }],
    }, new Set([groceries, household]))

    expect(result.items).toEqual([])
    expect(result.reviewReasons).toEqual([])
    expect(result.requiresReview).toBe(false)
  })

  test('keeps item review details when a receipt has a real category split', () => {
    const result = validateReceiptAnalysis({
      ...validResult(),
      requiresReview: true,
      items: [
        {
          description: 'Unclear household item',
          amount: 5,
          categoryId: household,
          confidence: 0.4,
          requiresReview: true,
        },
      ],
    }, new Set([groceries, household]))

    expect(result.items).toHaveLength(1)
    expect(result.reviewReasons.join(' ')).toMatch(/Unclear household item/)
    expect(result.requiresReview).toBe(true)
  })
})

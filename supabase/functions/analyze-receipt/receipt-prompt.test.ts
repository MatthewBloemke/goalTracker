import {
  getReceiptCategoryDescription,
  RECEIPT_SYSTEM_PROMPT,
} from './receipt-prompt'

describe('receipt classification guidance', () => {
  test('gives common household category names useful classification semantics', () => {
    expect(getReceiptCategoryDescription('Groceries', 'Food')).toMatch(/water.*gum.*baby food/i)
    expect(getReceiptCategoryDescription('Restaurants', 'Food')).toMatch(/not packaged or frozen food/i)
    expect(getReceiptCategoryDescription('Hygenics', 'Household')).toMatch(/hand wash.*diaper balm/i)
    expect(getReceiptCategoryDescription('Miscellaneous', 'Other')).toMatch(/Fallback only/i)
  })

  test('directs the model to use reasonable broad matches and exact allocations', () => {
    expect(RECEIPT_SYSTEM_PROMPT).toMatch(/imperfectly specific category is not by itself uncertain/i)
    expect(RECEIPT_SYSTEM_PROMPT).toMatch(/determine the receipt's purchase channel/i)
    expect(RECEIPT_SYSTEM_PROMPT).toMatch(/retail receipt, default all take-home food and beverages to Groceries/i)
    expect(RECEIPT_SYSTEM_PROMPT).toMatch(/Aldi grocery receipt should normally be one Groceries allocation with no items/i)
    expect(RECEIPT_SYSTEM_PROMPT).toMatch(/Never invent a duplicate, continuation, or corrected item/i)
    expect(RECEIPT_SYSTEM_PROMPT).toMatch(/make them sum exactly to the receipt total/i)
    expect(RECEIPT_SYSTEM_PROMPT).toMatch(/spelling variations/i)
  })
})

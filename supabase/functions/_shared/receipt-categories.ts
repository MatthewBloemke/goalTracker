// Loan payments have their own workflow. They are never a retail receipt split.
export function getReceiptCategories<T extends {
  loan_id: string | null
  include_in_receipt_scans?: boolean
}>(
  categories: readonly T[],
): T[] {
  return categories.filter((category) =>
    category.loan_id === null && category.include_in_receipt_scans !== false,
  )
}

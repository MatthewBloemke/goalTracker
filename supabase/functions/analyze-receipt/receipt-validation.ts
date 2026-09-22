export interface ReceiptItem {
  description: string
  amount: number
  categoryId: string | null
  confidence: number
  requiresReview: boolean
}

export interface ReceiptAllocation {
  categoryId: string
  amount: number
}

export interface ReceiptAnalysis {
  merchant: string | null
  transactionDate: string | null
  subtotal: number | null
  tax: number | null
  discounts: number | null
  tip: number | null
  fees: number | null
  total: number | null
  requiresReview: boolean
  reviewReasons: string[]
  items: ReceiptItem[]
  allocations: ReceiptAllocation[]
}

const MAX_AUTOMATIC_ALLOCATION_ADJUSTMENT_CENTS = 10

export function buildReceiptSchema(categoryIds: string[]) {
  const nullableMoney = {
    anyOf: [{ type: 'number', minimum: 0 }, { type: 'null' }],
  }
  const nullableText = {
    anyOf: [{ type: 'string' }, { type: 'null' }],
  }
  const nullableCategoryId = {
    anyOf: [{ type: 'string', enum: categoryIds }, { type: 'null' }],
  }

  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      merchant: nullableText,
      transactionDate: nullableText,
      subtotal: nullableMoney,
      tax: nullableMoney,
      discounts: nullableMoney,
      tip: nullableMoney,
      fees: nullableMoney,
      total: nullableMoney,
      requiresReview: { type: 'boolean' },
      reviewReasons: { type: 'array', items: { type: 'string' } },
      items: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            description: { type: 'string' },
            amount: { type: 'number', minimum: 0 },
            categoryId: nullableCategoryId,
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            requiresReview: { type: 'boolean' },
          },
          required: [
            'description',
            'amount',
            'categoryId',
            'confidence',
            'requiresReview',
          ],
        },
      },
      allocations: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            categoryId: { type: 'string', enum: categoryIds },
            amount: { type: 'number', exclusiveMinimum: 0 },
          },
          required: ['categoryId', 'amount'],
        },
      },
    },
    required: [
      'merchant',
      'transactionDate',
      'subtotal',
      'tax',
      'discounts',
      'tip',
      'fees',
      'total',
      'requiresReview',
      'reviewReasons',
      'items',
      'allocations',
    ],
  }
}

export function validateReceiptAnalysis(
  value: unknown,
  allowedCategoryIds: ReadonlySet<string>,
): ReceiptAnalysis {
  const input = isRecord(value) ? value : {}
  const modelReviewReasons = readStringArray(input.reviewReasons).filter(
    (reason) => !isServerValidatedReviewReason(reason),
  )
  const reasons = new Set<string>()

  if (!isRecord(value)) reasons.add('The model returned an invalid result.')

  const merchant = readNullableText(input.merchant)
  if (!merchant) reasons.add('Merchant could not be read.')

  const transactionDate = readDate(input.transactionDate)
  if (!transactionDate) reasons.add('Transaction date could not be read.')

  const subtotal = readMoney(input.subtotal, 'subtotal', reasons)
  const tax = readMoney(input.tax, 'tax', reasons)
  const discounts = readMoney(input.discounts, 'discounts', reasons)
  const tip = readMoney(input.tip, 'tip', reasons)
  const fees = readMoney(input.fees, 'fees', reasons)
  const total = readMoney(input.total, 'total', reasons)
  if (total === null || total <= 0) reasons.add('Receipt total could not be read.')

  const itemReasons = new Set<string>()
  let items = readItems(input.items, allowedCategoryIds, itemReasons)
  const rawItemCount = Array.isArray(input.items) ? input.items.length : -1
  let allocations = readAllocations(
    input.allocations,
    allowedCategoryIds,
    reasons,
  )

  if (total !== null && total > 0 && allocations.length > 0) {
    const reconciliation = reconcileAllocationsToTotal(allocations, total)
    allocations = reconciliation.allocations
    if (reconciliation.adjustedByCents > 0) {
      reasons.add(
        `Category allocations were adjusted by $${(reconciliation.adjustedByCents / 100).toFixed(2)} to match the receipt total. Review the adjusted split.`,
      )
    }
  }

  const suppressedSingleCategoryItems = allocations.length === 1
    && items.length > 0
    && items.length === rawItemCount
    && items.every(({ categoryId }) => categoryId === allocations[0].categoryId)

  if (suppressedSingleCategoryItems) {
    items = []
  } else {
    for (const reason of modelReviewReasons) reasons.add(reason)
    for (const reason of itemReasons) reasons.add(reason)
  }

  if (allocations.length === 0) {
    reasons.add('No reasonable budget category match was found.')
  }

  if (total !== null && allocations.length > 0) {
    const allocated = roundMoney(
      allocations.reduce((sum, allocation) => sum + allocation.amount, 0),
    )
    if (allocated !== total) {
      reasons.add(
        `Category allocations total ${allocated.toFixed(2)}, not ${total.toFixed(2)}.`,
      )
    }
  }

  if (subtotal !== null && total !== null) {
    const calculatedTotal = roundMoney(
      subtotal - (discounts ?? 0) + (tax ?? 0) + (tip ?? 0) + (fees ?? 0),
    )
    if (Math.abs(calculatedTotal - total) > 0.05) {
      reasons.add('Subtotal, discounts, tax, tip, and fees do not reconcile to the total.')
    }
  }

  const reviewReasons = [...reasons]
  return {
    merchant,
    transactionDate,
    subtotal,
    tax,
    discounts,
    tip,
    fees,
    total,
    requiresReview: (!suppressedSingleCategoryItems && input.requiresReview === true)
      || reviewReasons.length > 0,
    reviewReasons,
    items,
    allocations,
  }
}

function readItems(
  value: unknown,
  allowedCategoryIds: ReadonlySet<string>,
  reasons: Set<string>,
) {
  if (!Array.isArray(value)) {
    reasons.add('Receipt items could not be read.')
    return []
  }

  const items: ReceiptItem[] = []
  for (const rawItem of value) {
    if (!isRecord(rawItem)) {
      reasons.add('One or more receipt items were invalid.')
      continue
    }

    const description = readNullableText(rawItem.description) ?? 'Unreadable item'
    const amount = readMoney(rawItem.amount, `item ${description}`, reasons)
    if (amount === null) continue

    const proposedCategoryId = readNullableText(rawItem.categoryId)
    const categoryId = proposedCategoryId && allowedCategoryIds.has(proposedCategoryId)
      ? proposedCategoryId
      : null
    if (proposedCategoryId && !categoryId) {
      reasons.add(`Item “${description}” used an unavailable category.`)
    }

    const confidence = typeof rawItem.confidence === 'number'
      && Number.isFinite(rawItem.confidence)
      && rawItem.confidence >= 0
      && rawItem.confidence <= 1
      ? rawItem.confidence
      : 0
    const requiresReview = rawItem.requiresReview === true
      || categoryId === null
      || confidence < 0.7
    if (requiresReview) reasons.add(`Review the classification for “${description}”.`)

    items.push({ description, amount, categoryId, confidence, requiresReview })
  }

  return items
}

function readAllocations(
  value: unknown,
  allowedCategoryIds: ReadonlySet<string>,
  reasons: Set<string>,
) {
  if (!Array.isArray(value)) {
    reasons.add('Category allocations could not be read.')
    return []
  }

  const merged = new Map<string, number>()
  for (const rawAllocation of value) {
    if (!isRecord(rawAllocation)) {
      reasons.add('One or more category allocations were invalid.')
      continue
    }

    const categoryId = readNullableText(rawAllocation.categoryId)
    if (!categoryId || !allowedCategoryIds.has(categoryId)) {
      reasons.add('The model returned a category that is not available in this budget.')
      continue
    }

    const amount = readMoney(rawAllocation.amount, 'allocation', reasons)
    if (amount === null || amount <= 0) {
      reasons.add('Every category allocation must be greater than zero.')
      continue
    }
    merged.set(categoryId, roundMoney((merged.get(categoryId) ?? 0) + amount))
  }

  return [...merged].map(([categoryId, amount]) => ({ categoryId, amount }))
}

function reconcileAllocationsToTotal(
  allocations: ReceiptAllocation[],
  total: number,
) {
  const totalCents = toCents(total)
  const allocationCents = allocations.map((allocation) => ({
    ...allocation,
    amountCents: toCents(allocation.amount),
  }))
  const allocatedCents = allocationCents.reduce(
    (sum, allocation) => sum + allocation.amountCents,
    0,
  )
  const differenceCents = totalCents - allocatedCents

  if (
    differenceCents === 0
    || Math.abs(differenceCents) > MAX_AUTOMATIC_ALLOCATION_ADJUSTMENT_CENTS
  ) {
    return { allocations, adjustedByCents: 0 }
  }

  if (differenceCents > 0) {
    const largestIndex = allocationCents.reduce(
      (largest, allocation, index, values) =>
        allocation.amountCents > values[largest].amountCents ? index : largest,
      0,
    )
    allocationCents[largestIndex].amountCents += differenceCents
  } else {
    let centsToRemove = -differenceCents
    const smallestFirst = allocationCents
      .map((allocation, index) => ({ index, amountCents: allocation.amountCents }))
      .sort((a, b) => a.amountCents - b.amountCents)

    for (const { index } of smallestFirst) {
      if (centsToRemove === 0) break
      const removed = Math.min(allocationCents[index].amountCents, centsToRemove)
      allocationCents[index].amountCents -= removed
      centsToRemove -= removed
    }
  }

  return {
    allocations: allocationCents
      .filter(({ amountCents }) => amountCents > 0)
      .map(({ categoryId, amountCents }) => ({
        categoryId,
        amount: amountCents / 100,
      })),
    adjustedByCents: Math.abs(differenceCents),
  }
}

function readMoney(value: unknown, label: string, reasons: Set<string>) {
  if (value === null || value === undefined) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    reasons.add(`The extracted ${label} was invalid.`)
    return null
  }
  return roundMoney(value)
}

function readDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value
    ? null
    : value
}

function readNullableText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim())
    : []
}

function isServerValidatedReviewReason(reason: string) {
  const normalized = reason.toLowerCase()
  return (
    /transaction date.*(not visible|not shown|missing|could not|unreadable|unclear)/.test(normalized)
    || /merchant.*(not visible|not shown|missing|could not be read|unreadable)/.test(normalized)
    || /(receipt |transaction )?total.*(not visible|not shown|missing|could not|unreadable)/.test(normalized)
    || /(category )?allocations?.*(total|sum|add up|match|reconcil)/.test(normalized)
    || /(subtotal|tax|discounts?|tip|fees?).*(does not|do not|doesn't|don't).*(match|reconcil|total)/.test(normalized)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function toCents(value: number) {
  return Math.round((value + Number.EPSILON) * 100)
}

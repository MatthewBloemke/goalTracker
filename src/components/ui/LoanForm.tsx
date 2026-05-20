'use client'

import { useState } from 'react'
import { useSupabase } from '@/components/providers/SupabaseProvider'
import { parseRate, formatRate } from '@/lib/snowball'
import type { Loan, LoanFormValues, InsertLoan, UpdateLoan } from '@/types'

interface LoanFormProps {
  loan?: Loan               // if provided, we're editing
  familyId?: string | null
  onSuccess: () => void
  onCancel: () => void
}

const emptyForm: LoanFormValues = {
  name: '',
  lender: '',
  original_amount: '',
  current_balance: '',
  interest_rate: '',
  min_payment: '',
  family_id: null,
}

export function LoanForm({ loan, familyId, onSuccess, onCancel }: LoanFormProps) {
  const { supabase, user } = useSupabase()
  const [form, setForm] = useState<LoanFormValues>(
    loan
      ? {
          name: loan.name,
          lender: loan.lender ?? '',
          original_amount: String(loan.original_amount),
          current_balance: String(loan.current_balance),
          interest_rate: String((loan.interest_rate * 100).toFixed(4)),
          min_payment: String(loan.min_payment),
          family_id: loan.family_id,
        }
      : { ...emptyForm, family_id: familyId ?? null }
  )
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Partial<LoanFormValues>>({})

  const set = (field: keyof LoanFormValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  const validate = (): boolean => {
    const e: Partial<LoanFormValues> = {}
    if (!form.name.trim()) e.name = 'Required'
    if (!form.original_amount || isNaN(Number(form.original_amount)) || Number(form.original_amount) <= 0)
      e.original_amount = 'Must be > 0'
    if (!form.current_balance || isNaN(Number(form.current_balance)) || Number(form.current_balance) < 0)
      e.current_balance = 'Must be ≥ 0'
    if (!form.interest_rate || isNaN(Number(form.interest_rate)) || Number(form.interest_rate) < 0)
      e.interest_rate = 'Must be ≥ 0'
    if (!form.min_payment || isNaN(Number(form.min_payment)) || Number(form.min_payment) <= 0)
      e.min_payment = 'Must be > 0'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!user || !validate()) return
    setSubmitting(true)

    const payload = {
      name: form.name.trim(),
      lender: form.lender.trim() || null,
      original_amount: Number(form.original_amount),
      current_balance: Number(form.current_balance),
      interest_rate: parseRate(form.interest_rate),
      min_payment: Number(form.min_payment),
      family_id: form.family_id,
    }

    if (loan) {
      const update: UpdateLoan = payload
      await supabase.from('loans').update(update).eq('id', loan.id)
    } else {
      const insert: InsertLoan = { ...payload, user_id: user.id }
      await supabase.from('loans').insert(insert)
    }

    setSubmitting(false)
    onSuccess()
  }

  return (
    <div className="flex flex-col gap-5">
      <Field label="Loan Name *" error={errors.name}>
        <input value={form.name} onChange={set('name')} placeholder="e.g. Student Loan" {...inputProps} />
      </Field>

      <Field label="Lender">
        <input value={form.lender} onChange={set('lender')} placeholder="e.g. Sallie Mae" {...inputProps} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Original Amount *" error={errors.original_amount}>
          <CurrencyInput value={form.original_amount} onChange={set('original_amount')} placeholder="10,000" />
        </Field>
        <Field label="Current Balance *" error={errors.current_balance}>
          <CurrencyInput value={form.current_balance} onChange={set('current_balance')} placeholder="8,500" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Interest Rate (APR) *" error={errors.interest_rate}>
          <div className="relative">
            <input
              value={form.interest_rate}
              onChange={set('interest_rate')}
              placeholder="5.25"
              type="number"
              step="0.01"
              min="0"
              {...inputProps}
              className={`${inputProps.className} pr-8`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-secondary)' }}>%</span>
          </div>
        </Field>
        <Field label="Min Monthly Payment *" error={errors.min_payment}>
          <CurrencyInput value={form.min_payment} onChange={set('min_payment')} placeholder="150" />
        </Field>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="flex-1 py-3 rounded-xl font-medium text-sm transition-all hover:scale-[1.02] active:scale-[0.97] disabled:opacity-50"
          style={{ background: 'var(--accent-green)', color: 'white' }}
        >
          {submitting ? 'Saving...' : loan ? 'Save Changes' : 'Add Loan'}
        </button>
        <button
          onClick={onCancel}
          className="px-5 py-3 rounded-xl text-sm"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ---- Sub-components ----

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium tracking-wide" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </label>
      {children}
      {error && <p className="text-xs" style={{ color: 'var(--accent-red)' }}>{error}</p>}
    </div>
  )
}

function CurrencyInput({ value, onChange, placeholder }: { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder: string }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-secondary)' }}>$</span>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        type="number"
        step="0.01"
        min="0"
        {...inputProps}
        className={`${inputProps.className} pl-7`}
      />
    </div>
  )
}

const inputProps = {
  className: 'w-full px-3 py-2.5 rounded-lg text-sm outline-none focus:ring-1',
  style: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  } as React.CSSProperties,
}

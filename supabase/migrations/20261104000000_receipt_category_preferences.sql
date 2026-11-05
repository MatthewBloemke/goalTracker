alter table public.budget_categories
  add column include_in_receipt_scans boolean not null default true;

comment on column public.budget_categories.include_in_receipt_scans is
  'Whether AI receipt analysis may use this category. Loan-linked categories are always excluded.';

# AI receipt scanning

Receipt images are resized in the browser, sent directly to the authenticated `analyze-receipt` Supabase Edge Function, analyzed, and discarded. Images are not uploaded to Supabase Storage and no image path is written to a transaction.

The browser rejects source images larger than 10 MB. Accepted phone photos are converted to JPEG and progressively resized/compressed to at most 5 MB while preserving their aspect ratio; images smaller than the current resize target are never upscaled. OpenAI vision is explicitly requested with `detail: "high"` so small receipt text remains readable.

The Edge Function uses the calling user's JWT, verifies their active family membership, and uses the existing RLS policies to load the requested categories in that family budget. It then atomically verifies an active `receipt_analysis` feature grant and reserves a per-user quota slot before contacting OpenAI. Only verified category IDs and their names/group names are sent to OpenAI. The strict response schema limits category assignments to those IDs, and server validation checks the response again before returning an editable transaction draft.

Common category names receive concise classification guidance. Retail food, drinks, gum, and baby food prefer Groceries; restaurant-prepared meals prefer Restaurants; and hand wash or diaper-care products prefer an available hygiene/personal-care category. A broader but reasonable available category should not be flagged merely because a more specific category does not exist.

Obvious single-category receipts, such as Aldi groceries, use one allocation and omit temporary item-level output. If the model nevertheless returns items and every valid item agrees with the single allocation, the server discards those items and their OCR-confidence warnings. Item review remains available for genuine splits or unresolved categories. Wrapped text, coupons, and repeated receipt text must not be invented as duplicate purchased items.

Category allocations must equal the receipt total exactly. The server deterministically reconciles discrepancies of up to 10 cents and flags the adjustment for review, removing tiny overage allocations first or adding a shortfall to the largest allocation. Larger discrepancies remain unreconciled and require manual correction.

## Required secret

`OPENAI_API_KEY` is required only in the Supabase Edge Function environment. Never use a `NEXT_PUBLIC_` prefix and never add it to the browser app.

The optional `OPENAI_RECEIPT_MODEL` setting defaults to `gpt-4o-mini`. Recipe import uses this same setting and shared model resolver, so both features use the receipt scanner's configured model. The legacy `OPENAI_RECIPE_MODEL` override is ignored.

Every OpenAI request is capped at 2,000 output tokens. Models known to support non-reasoning mode receive `reasoning.effort: "none"`; the setting is omitted for the default non-reasoning `gpt-4o-mini` model and incompatible models. If OpenAI reports an incomplete response because that cap was reached, the function returns an error instead of parsing partial data, and the user can retry.

The Edge Function logs the approved user ID, internal request ID, remaining hourly/daily quota, OpenAI request ID, resolved model, input tokens, output tokens, and total tokens. These values are available in the `analyze-receipt` function logs and do not include receipt content. The database quota ledger also contains only user ID, request ID, and timestamp—never receipt images or extracted data.

## Access grants and rate limits

Receipt scanning is deny-by-default. A user needs an active row in `feature_access_grants` for the `receipt_analysis` feature. Users can read their own grant but cannot create, change, or revoke grants. The `receipt_analysis_requests` quota ledger has no client policies; it is written only through the security-definer quota function.

Default limits are 10 scans in a sliding one-hour window and 30 scans in a sliding 24-hour window. Limits can be lowered per user. Concurrent calls are serialized per user in Postgres so they cannot race past the limit. Invalid or unauthorized quota responses fail closed, and a limited request returns HTTP 429 with a `Retry-After` header.

Grant an existing user from the Supabase SQL Editor, replacing the email:

```sql
insert into public.feature_access_grants (user_id, feature)
select id, 'receipt_analysis'
from auth.users
where lower(email) = lower('approved-user@example.com')
on conflict (user_id, feature) do update
set revoked_at = null,
    granted_at = now();
```

Confirm that exactly one row was inserted or updated. To use smaller limits, include `hourly_limit` and `daily_limit` in the insert and update clauses.

Revoke access immediately without deleting audit history:

```sql
update public.feature_access_grants
set revoked_at = now()
where user_id = (
  select id from auth.users
  where lower(email) = lower('approved-user@example.com')
)
and feature = 'receipt_analysis';
```

Public signup is disabled in `supabase/config.toml` for local development. For production, also turn off **Allow new users to sign up** under Supabase **Authentication → General Configuration**; Auth configuration is not applied by `supabase db push`. Existing users can still sign in, and new approved users can be invited from **Authentication → Users**.

For local function development, add these values to an ignored `supabase/functions/.env` file:

```dotenv
OPENAI_API_KEY=sk-...
OPENAI_RECEIPT_MODEL=gpt-4o-mini
```

For the linked hosted Supabase project, use this safe rollout order so the new function never locks out every user:

```powershell
npx supabase db push
# Grant your own existing Auth user with the SQL above.
npx supabase secrets set OPENAI_API_KEY=sk-...
npx supabase secrets set OPENAI_RECEIPT_MODEL=gpt-4o-mini
npx supabase functions deploy analyze-receipt
```

The access-control migration is required. No transaction-schema migration is needed; the existing `budget_transactions` and `budget_transaction_splits` tables already represent single- and multi-category receipts.

## Receipt access-check 503 repair

If the function logs `Receipt analysis access check failed` with code `42883`, apply `20261027000000_fix_receipt_analysis_quota_clock.sql` with `npx supabase db push`. The original quota function used `current_time` as a timestamp variable, but SQL interprets it as the built-in time-only expression. The repair renames it to `quota_checked_at` throughout the quota function.

This database-only repair preserves existing grants, limits and request history. It does not require an Edge Function redeployment, frontend deployment, or OpenAI secret change.

The isolated PostgreSQL regression test reproduces the original failure, applies the repair, and checks approved scans, hourly/daily limits, retry delays, expired windows, permissions, and denied access. It uses the same optional PGlite setup as `scripts/test-recipes-db.mjs` and never connects to Supabase or OpenAI:

```powershell
node scripts/test-receipt-access-db.mjs <path-to-pglite-dist/index.js>
```

## Manual testing

### Restaurant receipt

1. Open Budget and select **Scan receipt** or **Upload receipt**.
2. Use a clear McDonald's or other restaurant receipt.
3. Confirm that merchant, date, and total are populated and that one Restaurants allocation covers the total.
4. Confirm that nothing appears in the transaction list before selecting **Save transaction**.
5. Save and confirm the transaction appears in the selected month.

### Walmart or mixed-category receipt

1. Use a readable receipt containing grocery and household items.
2. Confirm the review draft contains two or more allocations using categories already present in the budget.
3. Confirm the allocation amounts add up to the displayed total.
4. Adjust any split if needed, save, and confirm category spending updates.

### Unreadable receipt

1. Use a blurred, cropped, dark, or otherwise unreadable receipt image.
2. Confirm the app either shows a useful analysis error or a warning that identifies missing/uncertain fields.
3. Confirm missing required fields or unreconciled allocations prevent saving until they are manually corrected.

### Incorrect classification

1. Analyze a valid receipt, then intentionally choose a receipt whose item classification is ambiguous.
2. In the draft, change the category dropdown and allocation amount to the correct values.
3. If there are multiple allocations, add/remove splits as needed and ensure they equal the total.
4. Save and confirm the edited values—not the original AI suggestion—are persisted.

### Access and quota controls

1. With no active grant, attempt a scan and confirm the function returns `403` without an OpenAI usage log.
2. Grant the user, scan once, and confirm the function log shows the internal request ID and decreased remaining quotas.
3. Temporarily set that user's hourly limit to `1`, scan again, and confirm the function returns `429` with no second OpenAI call.
4. Revoke the grant and confirm the next scan immediately returns `403` even if the user's existing session remains active.

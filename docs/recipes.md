# Recipe library

Meal Planning now contains a shared family recipe library (or a personal library when outside a family). Personal recipes are preserved when joining a family. Recipes have UUIDs, separate ordered ingredient and instruction records, numeric cooking quantities, separate numeric shopping quantities/units, servings, notes, a source link and normalized tag arrays. They are not stored as one text field.

## Deploy

1. Apply `supabase/migrations/20261012000000_recipes.sql` using `npx supabase db push`. It depends on the existing receipt-access and task-planner migrations. No storage bucket is needed.
2. Configure the **Supabase Edge Function** secret `OPENAI_API_KEY` (reuse the receipt scanner's existing secret if configured; never put it in a `NEXT_PUBLIC_*` variable).
3. Recipe import uses the receipt scanner's existing `OPENAI_RECEIPT_MODEL` setting (default: `gpt-4o-mini`). Both functions use one shared model resolver. `OPENAI_RECIPE_MODEL` is no longer read, even if the old secret is still set; no new model secret is needed.
4. Deploy with `npx supabase functions deploy analyze-recipe`.
5. Approve each user separately in the Supabase SQL editor (replace the UUID):

```sql
insert into public.feature_access_grants
  (user_id, feature, hourly_limit, daily_limit)
values ('USER_UUID_HERE'::uuid, 'recipe_import', 3, 10)
on conflict (user_id, feature) do update
set hourly_limit = excluded.hourly_limit,
    daily_limit = excluded.daily_limit,
    revoked_at = null;
```

Revoke with `update public.feature_access_grants set revoked_at = now() where user_id = 'USER_UUID_HERE'::uuid and feature = 'recipe_import';`. Grants are per user, not inherited from a family or from receipt access. Manual entry, file import/export and shopping lists do not require an AI grant.

`verify_jwt = true` follows the existing receipt function configuration; the handler also verifies the user with Supabase Auth. If the project uses a publishable key/new asymmetric JWT setup that rejects requests at the legacy gateway, follow the same tested gateway configuration as the receipt scanner; never remove the handler's `getUser()` verification or grant/quota checks.

## Website and Facebook support

Direct website import can try **any public recipe website**, preferring Recipe JSON-LD. There is no domain allowlist or administrator-maintained list of enabled sites. Public subdomains, international domains, HTTP/HTTPS links and public cross-site redirects are supported. A site can still reject automated requests, require a login or depend on JavaScript; the fallback is pasting its ingredients and instructions.

`RECIPE_IMPORT_ALLOWED_HOSTS` is no longer used; no replacement secret or database migration is needed. Redeploy `analyze-recipe` to apply this change. Server-safety checks still reject non-web protocols, embedded credentials, nonstandard ports and private/internal/special-use IP addresses, including DNS answers and redirect destinations. Each connection is pinned to a verified public IP while preserving the original hostname for HTTP and TLS certificate verification; a second DNS lookup cannot redirect the socket to an internal address. The server sends no user cookies or authorization headers, does not execute JavaScript, and does not bypass logins/paywalls. The pinned transport uses [Undici's custom connector](https://github.com/nodejs/undici/blob/v6.29.1/docs/docs/api/Connector.md), not an unguarded fallback fetch. Undici is pinned in the Edge Function import and installed as a development dependency for regression tests; it is not bundled into the browser.

Facebook URLs are not blocked by domain, but videos are **not downloaded, watched or transcribed** in this version. A link can only work if its public HTML exposes enough recipe text. Otherwise paste a caption or transcript containing ingredients and instructions, and optionally keep the Facebook link as the recipe source. Pasted text always takes priority over fetching a link. A link alone cannot provide missing video content.

Imports use the Responses API with strict Structured Outputs, `store: false`, a **2,000 output-token cap**, and no reasoning where supported by the existing model guardrail. Source text is capped at 16,000 characters; HTML at 2 MB and fetch duration at 12 seconds; at most three redirects are followed. Incomplete, refused or invalid responses are rejected without a save. No automatic paid retries. Usage logs contain request ID/model/token counts only, not recipe text or credentials. OpenAI's own API data-retention terms still apply; `store: false` is not a promise of zero provider retention.

Each approved attempt consumes an atomic per-user sliding hourly/daily quota, including failed fetches or model calls. These limits and token caps bound usage, but are not an account-wide dollar hard stop. Use low grants and a dedicated API project/key if desired. The request ledger stores metadata only; old rows can be pruned administratively after 24 hours if needed.

## Troubleshooting AI import

If the browser shows a CORS error with HTTP 503 and function logs show `BrotliDecompress` / `Failed to decompress`, deploy the compression-handling fix with `npx supabase functions deploy analyze-recipe`. This is a website-response runtime failure, not missing user approval. Website requests now use Undici's raw `Client.request` with `Accept-Encoding: identity`, avoiding its automatic Node/zlib decoders. Unexpected gzip/deflate is decoded with native Web Streams; Brotli/unknown encodings and corrupt compressed data return a handled error instead of crashing the worker. Unread-body cleanup also handles asynchronous abort errors. A descriptive User-Agent is sent because some sites close connections when it is absent. Both downloaded and decompressed HTML are capped at 2 MB: the reported butter-chicken page exceeds the former 1 MB limit, although its isolated recipe fits within the unchanged 16,000-character AI cap. DNS pinning, TLS verification, redirect checks, authentication and quotas are unchanged. No new secret, migration, or Vercel redeploy is needed for this function-only fix.

After deploying changes with `npx supabase functions deploy analyze-recipe`, retry the import once. OpenAI failures now show a more specific message and a **Reference** ID in the app. In Supabase, open **Edge Functions → analyze-recipe → Logs**, then search for that reference or `recipe_import_openai_error`.

The HTTP client keeps its single connection alive until the full response is read, then explicitly destroys it. This avoids premature TLS-close errors seen with `Connection: close` on Deno 2.1.4; certificate verification stays enabled and incomplete responses are still rejected. Fetch-only verification of `https://www.indianhealthyrecipes.com/butter-chicken/` on Deno 2.1.4 extracted a 9,618-character recipe with ingredients and instructions (page size approximately 1.15 MB). This does not verify the hosted deployment or call OpenAI.

The log includes `upstreamStatus` (OpenAI's actual HTTP status, not our function's wrapper status), `errorCode`, `errorType`, `errorParam`, `openaiRequestId` and `referenceId`. The reference is also sent as `X-Client-Request-Id`, allowing correlation if a timeout occurs before OpenAI returns its own ID. This follows the [official OpenAI request-debugging guidance](https://developers.openai.com/api/reference/overview#debugging-requests).

- `401`: check the shared `OPENAI_API_KEY` and project access/IP restrictions.
- `403`: check key permissions, model access and project restrictions.
- `404` / `model_not_found` / `unallowed_model`: check `OPENAI_RECEIPT_MODEL` (default `gpt-4o-mini`) and model access. This is the same setting used by receipt scanning; an old `OPENAI_RECIPE_MODEL` value is ignored. Redeploy `analyze-recipe` to adopt the shared setting. No new secret, migration, or Vercel deployment is required.
- `400` / `422`: the model/request configuration was rejected; inspect the code/type/parameter, e.g. `invalid_json_schema` with `text.format.schema`.
- `429` with `insufficient_quota`, `credit_balance_exhausted` or a spend/usage-limit code: check billing and configured limits; repeated retries will not fix this. Other `429` errors generally indicate throttling.
- `5xx`: upstream service failure; retry later.
- `failureKind: timeout` or `network_error`: no upstream HTTP response was received. The reference still identifies the attempt.

Only allowlisted error codes/types/parameter names are logged; unfamiliar values become `unrecognized`. Missing values are `null`. Non-JSON, oversized or unreadable error bodies produce `errorBodyState: unreadable` while retaining status/request-ID metadata where available. **Raw OpenAI error messages, full response bodies, request headers, recipe input and API keys are never included in these diagnostic logs or public errors.** Raw messages are intentionally excluded because they can echo credentials or input. Share the reference and safe diagnostic entry when reporting an issue, never your API key. See [OpenAI error codes](https://developers.openai.com/api/docs/guides/error-codes#api-errors) for the upstream meanings.

These diagnostics do not save a recipe, change grants/quotas, increase limits or automatically retry a paid call. No database migration or new secret is required for this logging update.

## Review, shopping and sharing

- AI and recipe-file imports open the same editable recipe form as manual entry. Nothing is saved before **Save recipe**. Unknown cooking quantities remain empty, not invented. Review temperatures, timings, amounts, dietary claims and shopping suggestions.
- Cooking quantities appear on the recipe. **Shopping quantities (advanced)** stays collapsed in the editor. For example, 1 tsp paprika can map to 1 container. Package sizes vary; verify enough is purchased. This is not a package-size/product catalog.
- **Shop** lets you skip pantry items and choose an existing Task Planner list or create one. It adds ordinary tasks with shopping quantities and the recipe/cooking amount in their notes. Task Planner supplies realtime updates, sorting and completion. No separate shopping-task database is created.
- Additions are atomic and require matching recipe/list scopes. Old ingredient IDs are rejected after a recipe edit. Repeating an addition intentionally adds another set; ingredients are not automatically merged across recipes because package/unit conversions can be unsafe.
- **Share recipe** uses the native file share sheet when supported, otherwise downloads a versioned `.recipe.json` file. It includes the recipe's notes/source/tags but no user/family/database IDs. Send it through your preferred channel. The recipient uses **Import recipe → Choose recipe file**, reviews and saves a new copy in their current collection. No public link or cross-family read access is created. Editing/deleting the source does not change an imported copy or existing shopping tasks.
- Saving an edit checks the revision timestamp; concurrent edits cannot silently overwrite the version opened by another person. Reopen the editor when a conflict occurs.

## Verification

Run `npx tsc --noEmit`, `npm run lint`, `npm test -- --runInBand` and `npm run build`. Tests cover shared-file validation, recipe mapping/filtering, URL/redirect/input limits, AI truncation/refusal, editable review and shopping confirmation. Coverage includes existing business-logic files plus recipe validation/import helpers; it does not claim whole-app UI coverage.

Run `deno run --allow-net=127.0.0.1 --allow-env scripts/test-recipe-http.mjs` with Deno 2.1.4 to exercise real local HTTP responses through the raw client and decoder (including unsupported Brotli, valid/corrupt/truncated gzip, and successful requests after failures). The test does not call Supabase or OpenAI.

An optional isolated SQL integration test is available at `scripts/test-recipes-db.mjs`. Install `@electric-sql/pglite` into a temporary directory, then run `node scripts/test-recipes-db.mjs <temp>/node_modules/@electric-sql/pglite/dist/index.js`. It executes the real migrations with minimal auth/family fixtures and checks RLS, rollback, stale edits, shopping scope and quotas without connecting to Supabase. It does not test hosted Realtime delivery.

Manual acceptance checks after deployment:

1. Create a recipe with two tags, cooking amount `1 tsp paprika`, shopping amount `1 container`; save, search/filter, edit and reopen. Check numeric text in light/dark themes and on a narrow phone viewport.
2. Add it to a new shopping list, unchecking one pantry item. Open Task Planner; verify purchasing amounts, recipe notes, drag ordering and completion. Add another recipe to the same list; verify existing tasks remain.
3. Open the family on another device. Create/edit a recipe and verify it updates. Open the same recipe editor on both devices; the second stale save should show a conflict, preserving its draft.
4. Share/download a file; import as a user in a different family. Edit the copy and verify the original stays unchanged. Try an invalid file and an unsupported version; neither should save anything.
5. Import a recipe from a public website outside the old eight-site list. Review the ingredients, source and steps, correct one amount/tag and save. Try a Facebook link alone (it may fail if its recipe text is inaccessible), then paste its recipe caption (expect an editable draft). No site-enablement error should appear.
6. Try text with no recipe, an overlong input, `http://127.0.0.1/` and a private-address redirect. Verify clear errors and no saved recipe. Tests also cover private/mixed DNS answers and DNS rebinding. Mock an incomplete model response to verify no partial output is used.
7. Use an unapproved user and a user at the configured quota: AI should fail while manual entry and file import still work. Confirm one family cannot read/write another's recipes or shopping lists.

Useful next additions: serving scaling, a weekly meal calendar, favorites, and pantry-aware consolidation. Those are deliberately outside this first recipe-library implementation.

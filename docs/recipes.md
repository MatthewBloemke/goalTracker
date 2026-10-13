# Recipe library

Meal Planning now contains a shared family recipe library (or a personal library when outside a family). Personal recipes are preserved when joining a family. Recipes have UUIDs, separate ordered ingredient and instruction records, numeric cooking quantities, separate numeric shopping quantities/units, servings, notes, a source link and normalized tag arrays. They are not stored as one text field.

## Deploy

1. Apply `supabase/migrations/20261012000000_recipes.sql` using `npx supabase db push`. It depends on the existing receipt-access and task-planner migrations. No storage bucket is needed.
2. Configure the **Supabase Edge Function** secret `OPENAI_API_KEY` (reuse the receipt scanner's existing secret if configured; never put it in a `NEXT_PUBLIC_*` variable).
3. Optionally configure `OPENAI_RECIPE_MODEL`. Default: `gpt-4o-mini`, matching the cost-conscious receipt setup.
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

Direct website import fetches HTML, preferring Recipe JSON-LD. Initially enabled sites (including their `www` variants): Allrecipes, Food Network, Budget Bytes, Spend With Pennies, Natasha's Kitchen, Serious Eats, BBC Good Food and RecipeTin Eats. A site can still reject automated requests; the fallback is pasting its ingredients and instructions.

Optional secret `RECIPE_IMPORT_ALLOWED_HOSTS` adds comma-separated **exact hostnames**, for example `sallysbakingaddiction.com`. Only add trusted public recipe sites under administrator control. No wildcard subdomains, custom ports, credentials, HTTP fetching, IP literals or unapproved redirects are allowed. The server fetches no cookies and does not execute JavaScript or bypass logins/paywalls. Treat extending the allowlist as granting server egress access to that site.

Facebook videos are **not downloaded, watched or transcribed** in this version. Paste a caption or transcript containing ingredients and instructions, and optionally keep the Facebook link as the recipe source. Pasted text always takes priority over fetching a link. A link alone cannot provide missing video content.

Imports use the Responses API with strict Structured Outputs, `store: false`, a **2,000 output-token cap**, and no reasoning where supported by the existing model guardrail. Source text is capped at 16,000 characters; HTML at 1 MB and fetch duration at 12 seconds; at most three redirects are followed. Incomplete, refused or invalid responses are rejected without a save. No automatic paid retries. Usage logs contain request ID/model/token counts only, not recipe text or credentials. OpenAI's own API data-retention terms still apply; `store: false` is not a promise of zero provider retention.

Each approved attempt consumes an atomic per-user sliding hourly/daily quota, including failed fetches or model calls. These limits and token caps bound usage, but are not an account-wide dollar hard stop. Use low grants and a dedicated API project/key if desired. The request ledger stores metadata only; old rows can be pruned administratively after 24 hours if needed.

## Review, shopping and sharing

- AI and recipe-file imports open the same editable recipe form as manual entry. Nothing is saved before **Save recipe**. Unknown cooking quantities remain empty, not invented. Review temperatures, timings, amounts, dietary claims and shopping suggestions.
- Cooking quantities appear on the recipe. **Shopping quantities (advanced)** stays collapsed in the editor. For example, 1 tsp paprika can map to 1 container. Package sizes vary; verify enough is purchased. This is not a package-size/product catalog.
- **Shop** lets you skip pantry items and choose an existing Task Planner list or create one. It adds ordinary tasks with shopping quantities and the recipe/cooking amount in their notes. Task Planner supplies realtime updates, sorting and completion. No separate shopping-task database is created.
- Additions are atomic and require matching recipe/list scopes. Old ingredient IDs are rejected after a recipe edit. Repeating an addition intentionally adds another set; ingredients are not automatically merged across recipes because package/unit conversions can be unsafe.
- **Share recipe** uses the native file share sheet when supported, otherwise downloads a versioned `.recipe.json` file. It includes the recipe's notes/source/tags but no user/family/database IDs. Send it through your preferred channel. The recipient uses **Import recipe → Choose recipe file**, reviews and saves a new copy in their current collection. No public link or cross-family read access is created. Editing/deleting the source does not change an imported copy or existing shopping tasks.
- Saving an edit checks the revision timestamp; concurrent edits cannot silently overwrite the version opened by another person. Reopen the editor when a conflict occurs.

## Verification

Run `npx tsc --noEmit`, `npm run lint`, `npm test -- --runInBand` and `npm run build`. Tests cover shared-file validation, recipe mapping/filtering, URL/redirect/input limits, AI truncation/refusal, editable review and shopping confirmation. Coverage includes existing business-logic files plus recipe validation/import helpers; it does not claim whole-app UI coverage.

An optional isolated SQL integration test is available at `scripts/test-recipes-db.mjs`. Install `@electric-sql/pglite` into a temporary directory, then run `node scripts/test-recipes-db.mjs <temp>/node_modules/@electric-sql/pglite/dist/index.js`. It executes the real migrations with minimal auth/family fixtures and checks RLS, rollback, stale edits, shopping scope and quotas without connecting to Supabase. It does not test hosted Realtime delivery.

Manual acceptance checks after deployment:

1. Create a recipe with two tags, cooking amount `1 tsp paprika`, shopping amount `1 container`; save, search/filter, edit and reopen. Check numeric text in light/dark themes and on a narrow phone viewport.
2. Add it to a new shopping list, unchecking one pantry item. Open Task Planner; verify purchasing amounts, recipe notes, drag ordering and completion. Add another recipe to the same list; verify existing tasks remain.
3. Open the family on another device. Create/edit a recipe and verify it updates. Open the same recipe editor on both devices; the second stale save should show a conflict, preserving its draft.
4. Share/download a file; import as a user in a different family. Edit the copy and verify the original stays unchanged. Try an invalid file and an unsupported version; neither should save anything.
5. Import an enabled site's recipe. Review the ingredients, source and steps, correct one amount/tag and save. Try a Facebook link alone (expect caption/transcript guidance), then paste its recipe caption (expect an editable draft).
6. Try text with no recipe, an overlong input and an unapproved website. Verify clear errors and no saved recipe. Mock an incomplete model response in tests to verify no partial output is used.
7. Use an unapproved user and a user at the configured quota: AI should fail while manual entry and file import still work. Confirm one family cannot read/write another's recipes or shopping lists.

Useful next additions: serving scaling, a weekly meal calendar, favorites, and pantry-aware consolidation. Those are deliberately outside this first recipe-library implementation.

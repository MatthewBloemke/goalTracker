# Family Library

Family Library lets nearby households share a searchable list of movies they physically own. It does not combine families or widen access to budgets, debts, meals, recipes, or tasks.

## Sharing model

- Each app family can belong to one Library Circle.
- A family admin creates a circle or joins one with its eight-character invite code.
- Circle members can see connected family names and movie holdings only.
- The main family invite code is never exposed to connected families. Connected family names are returned through a narrow database function.
- Any member of a family can add or remove movies owned by that family.
- Leaving a circle keeps the family’s saved movie collection but immediately stops sharing it.

## Physical copies and lending

- Every movie copy must be saved as **DVD**, **Blu-ray**, or **4K**.
- A family can own more than one format of the same title. Each format is tracked as a separate physical copy.
- Select a copy’s format/availability chip below its poster to see its status and loan history.
- Only the owning family can mark a copy as borrowed or returned.
- Borrowers must be another family in the same Library Circle.
- Each loan records when the copy was borrowed and, once returned, when it came back. Returning a copy closes the active loan without deleting its history.
- Removing a copy also removes its loan history, so the action is kept inside the copy details dialog and requires confirmation.

## TMDB setup

Create a TMDB account, open account settings, and request API access. Copy the **API Read Access Token** (the long bearer token, not the short v3 API key), then add it to Supabase:

```powershell
npx supabase secrets set TMDB_API_READ_TOKEN="YOUR_TMDB_API_READ_ACCESS_TOKEN"
```

The `tmdb-movies` Edge Function owns all TMDB calls, so this token is never sent to the browser.

The Family Library page includes TMDB attribution and the required notice. Review TMDB’s current attribution and logo requirements before a public launch.

## Movie-case AI setup

Case scanning reuses the same OpenAI configuration as receipt and recipe analysis:

- `OPENAI_API_KEY`
- `OPENAI_RECEIPT_MODEL` (optional; defaults to `gpt-4o-mini`)

No new OpenAI key is needed. The image is resized in the browser, sent directly to the Edge Function as a temporary request body, and never stored.

Case scanning is deny-by-default. Grant it to an approved user with conservative hourly/daily limits:

```sql
insert into public.feature_access_grants (
  user_id,
  feature,
  hourly_limit,
  daily_limit,
  revoked_at
)
values (
  'USER_UUID_HERE'::uuid,
  'movie_case_analysis',
  5,
  15,
  null
)
on conflict (user_id, feature) do update
set hourly_limit = excluded.hourly_limit,
    daily_limit = excluded.daily_limit,
    revoked_at = null;
```

Revoke it with:

```sql
update public.feature_access_grants
set revoked_at = now()
where user_id = 'USER_UUID_HERE'::uuid
  and feature = 'movie_case_analysis';
```

## Deploy

```powershell
npx supabase db push
npx supabase functions deploy tmdb-movies
npx supabase functions deploy identify-movie-case
```

Then deploy the web application so the new page and TMDB image configuration are live.

## Manual checks

1. In Family A, open Family Library and create a Library Circle.
2. Copy its code. Sign in as an admin of Family B and join the circle.
3. In Family A, search TMDB for `Jurassic Park`, choose **Blu-ray**, select the 1993 result, and add it.
4. Add the same title again as **4K**. Verify one poster displays two separate available copies.
5. In Family B, verify the poster appears with Family A as the owner. Search `Jurassic Park` and filter to Family A.
6. In Family A, open the Blu-ray copy, choose Family B, and mark it borrowed. Verify its chip says it is with Family B and the borrowed date appears in its history.
7. In Family B, verify the borrowed status is visible but the lending controls are not.
8. In Family A, mark the Blu-ray returned. Verify it is available again and the history keeps both borrowed and returned dates.
9. In Family B, add the same movie. Verify one poster lists both families and their individual formats/statuses.
10. Verify Family A still cannot see Family B’s budget, meals, recipes, tasks, debts, or main family invite code.
11. With an approved AI grant, use **Scan case** on a phone. Confirm the rear camera opens, a likely title is found, and the user must choose a TMDB result and format before saving.
12. Scan a blurry or unrelated image. Confirm it returns an actionable error or uncertain match and saves nothing.
13. Use **Upload photo** with a file over 10 MB or an unsupported type. Confirm it is rejected before the OpenAI request.
14. Leave the circle as Family B. Confirm Family B’s own movies remain, while Family A’s movies disappear.

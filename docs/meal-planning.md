# Meal planning

`/meal-planning` now opens the meal calendar. The **Recipes** tab links to `/meal-planning/recipes`, preserving manual entry, AI import, tags, sharing and shopping lists.

## Included

- Week view (default) and month view, previous/next period, Today and a date jump. Weeks run Sunday–Saturday. Week view stacks into cards on phones; month view can be scrolled horizontally without squeezing meal names into tiny columns.
- Breakfast, lunch, dinner and snacks. A day/meal slot can contain more than one entry, for example a main dish and a side.
- Choose a saved recipe or a custom meal such as leftovers, takeout or dinner with friends. Names and notes remain editable. Change the date or meal type to reschedule.
- Open a planned recipe's ingredients/instructions and reuse the existing shopping-list review. Planning never automatically creates shopping tasks. Shopping quantities are the recipe's saved purchase quantities, not automatically scaled servings.
- Confirm before removing a meal. Removing a meal never deletes a recipe or shopping tasks. Deleting a recipe clears its link but preserves the planned meal title, date and notes.
- Family members share the plan with Supabase Realtime. A refresh button and refetch on browser focus provide recovery; disconnected live updates show a warning. Stale saves/deletions fail instead of overwriting a family member's newer change.
- Personal and family plans remain separate. Joining a family switches the UI to the family plan; leaving reveals the personal plan again. No data is moved between them.

Dates are stored as PostgreSQL `date`, not timestamps. Calendar arithmetic uses date-only UTC operations to avoid daylight-saving shifts; Today uses the browser's local calendar. View/date selection is local UI state, not a database preference. A linked recipe opens its current contents; only its calendar title is retained as a snapshot.

## Deploy

1. Apply `supabase/migrations/20261025000000_meal_planning.sql` after the existing recipe and task-planner migrations:

   ```powershell
   npx supabase db push --dry-run
   npx supabase db push
   ```

2. Deploy the updated Next.js application through the normal Vercel workflow.

No new secrets, storage buckets, Edge Functions or AI access grants are needed. Manual meal planning makes no OpenAI calls. The migration adds one UUID-keyed table, RLS, same-collection recipe validation, immutable ownership, indexes and a Realtime publication entry. It does not change recipe data or existing access grants.

## Verification

Run `npm test -- --runInBand`, `npx tsc --noEmit`, `npm run lint` and `npm run build`. Tests cover calendar boundaries/DST, validation, week/month controls, custom and recipe meals, explicit review/save/delete, stale edits, scoped queries and realtime refetch.

The isolated database script `node scripts/test-recipes-db.mjs <path-to-pglite-dist/index.js>` now tests the actual meal-plan migration as well as recipes. It never reads application secrets or connects to Supabase. It checks family isolation, cross-scope recipe rejection, membership changes, invalid inputs, stale updates/deletes, and retention after recipe deletion. It does not simulate hosted Realtime delivery.

Manual acceptance checks after deployment:

1. Open Meal Planning: week view appears first. Switch to month, change month, jump to a date and return to Today. Test a narrow phone viewport and light/dark themes.
2. Add a saved recipe for dinner. Reopen it, read the instructions and add selected ingredients to a task list. Confirm no tasks were created just by scheduling it.
3. Add a custom "Leftovers" meal with a prep note. Change its date and meal type, and verify it moves. Remove it with confirmation; verify recipes remain.
4. Open the same family on two devices. Add/edit/remove meals on one and verify the other updates. Open the same meal on both, save on one, then attempt to save/delete the stale editor on the other; expect a conflict message.
5. Delete a recipe used in a plan. Verify the meal's title/notes/date remain as a custom meal. A previously open editor should require reopening or explicitly selecting a replacement/custom entry.
6. Create a personal plan, join a family, then leave: family and personal calendars should switch without copying or merging. Another family must not see or edit those entries.

Useful next steps: copy a week forward with a preview, one consolidated shopping list for the selected week with pantry exclusions, and planned-serving scaling. These are deliberately not automatic in this version.

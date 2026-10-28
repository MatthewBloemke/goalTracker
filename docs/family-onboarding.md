# Required family onboarding

Every authenticated user must create or join a family before accessing Family Portal modules. The global navigation shell blocks module content until the shared family lookup succeeds and redirects users without a membership to `/family`.

Family creation and invite-code joining use the database RPCs `create_family_for_current_user` and `join_family_with_invite`. These operations are atomic, and direct client inserts into `families` or `family_members` are no longer allowed by RLS.

Budget, debt, task, recipe, and meal-plan records require a family ID. The migration keeps any historical personal rows in place to avoid destructive data loss, but family-only scope helpers hide them and `NOT VALID` check constraints prevent new personal rows. Leaving or being removed from a family returns the user to onboarding; no personal feature scope becomes active.

AI receipt analysis and recipe import also verify family membership server-side before checking feature grants or calling OpenAI.

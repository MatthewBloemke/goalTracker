// Optional isolated SQL integration test. Uses PGlite (PostgreSQL in WASM),
// never reads .env files and never connects to your Supabase project.
// node scripts/test-recipes-db.mjs <path-to-pglite-dist/index.js>
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { PGlite } = await import(
  process.argv[2]
    ? pathToFileURL(resolve(process.argv[2])).href
    : '@electric-sql/pglite'
);
const db = new PGlite();
const alice = '00000000-0000-4000-8000-000000000001';
const bob = '00000000-0000-4000-8000-000000000002';
const outsider = '00000000-0000-4000-8000-000000000003';
const family = '00000000-0000-4000-8000-000000000010';
const otherFamily = '00000000-0000-4000-8000-000000000020';

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to authenticated;
    create table public.families(id uuid primary key);
    create table public.family_members(user_id uuid, family_id uuid);
    create function public.is_family_member(fam uuid) returns boolean
      language sql security definer stable set search_path = '' as
      $$ select exists(select 1 from public.family_members where user_id = auth.uid() and family_id = fam) $$;
    create function public.handle_updated_at() returns trigger language plpgsql as
      $$ begin new.updated_at = clock_timestamp(); return new; end; $$;
    create publication supabase_realtime;
    insert into auth.users values('${alice}'), ('${bob}'), ('${outsider}');
    insert into public.families values('${family}'), ('${otherFamily}');
    insert into public.family_members values('${alice}', '${family}'), ('${bob}', '${family}'), ('${outsider}', '${otherFamily}');
  `);
  for (const file of [
    '20260824000000_secure_receipt_analysis_access.sql',
    '20261009000000_task_planner.sql',
    '20261012000000_recipes.sql',
    '20261025000000_meal_planning.sql',
  ]) {
    await db.exec(
      readFileSync(
        new URL(`../supabase/migrations/${file}`, import.meta.url),
        'utf8',
      ),
    );
  }
  const login = async (id) => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
      id,
    ]);
    await db.exec('set role authenticated');
  };
  const draft = {
    title: 'Soup',
    servings: 4,
    sourceUrl: '',
    notes: '',
    tags: ['Quick'],
    ingredients: [
      {
        name: 'salt',
        quantity: 1,
        unit: 'tsp',
        preparation: '',
        shoppingQuantity: 1,
        shoppingUnit: 'container',
      },
    ],
    instructions: ['Stir.'],
  };
  const save = async (data, id = null, scope = family, revision = null) =>
    (
      await db.query(
        'select public.save_recipe($1::jsonb, $2::uuid, $3::uuid, $4::timestamptz) as id',
        [JSON.stringify(data), id, scope, revision],
      )
    ).rows[0].id;
  const shopping = async (id, ingredientIds, target = null) =>
    (
      await db.query(
        "select public.add_recipe_to_task_list($1::uuid, $2::uuid[], $3::uuid, 'Shopping') as id",
        [id, ingredientIds, target],
      )
    ).rows[0].id;

  await login(alice);
  const recipeId = await save(draft);
  const personalId = await save(
    { ...draft, title: 'Personal soup' },
    null,
    null,
  );
  const plan = async (recipe, scope = family, title = 'Soup night') =>
    (
      await db.query(
        `insert into public.meal_plan_entries(user_id, family_id, recipe_id, meal_date, meal_type, title)
      values(auth.uid(), $1, $2, '2026-10-25', 'dinner', $3) returning id`,
        [scope, recipe, title],
      )
    ).rows[0].id;
  const familyMeal = await plan(recipeId);
  const personalMeal = await plan(personalId, null, 'Personal soup night');
  const customMeal = await plan(null, family, 'Leftovers');
  await assert.rejects(plan(personalId, family), /same personal or family/);
  await assert.rejects(plan(recipeId, null), /same personal or family/);
  for (const invalid of [
    "meal_type = 'brunch'",
    "title = ' '",
    "notes = repeat('x', 4001)",
    "meal_date = 'infinity'",
  ]) {
    await assert.rejects(
      db.query(`update public.meal_plan_entries set ${invalid} where id = $1`, [
        familyMeal,
      ]),
    );
  }
  await assert.rejects(
    db.query(
      "update public.meal_plan_entries set meal_date = '2026-02-30' where id = $1",
      [familyMeal],
    ),
  );
  assert.equal(
    (
      await db.query(
        'select id from public.meal_plan_entries where family_id = $1',
        [family],
      )
    ).rows.length,
    2,
  );
  assert.equal(
    (
      await db.query(
        'select id from public.meal_plan_entries where family_id is null and user_id = auth.uid()',
      )
    ).rows.length,
    1,
  );
  const ingredients = (
    await db.query(
      'select id from public.recipe_ingredients where recipe_id = $1',
      [recipeId],
    )
  ).rows.map((row) => row.id);
  assert.equal(ingredients.length, 1);
  const shoppingId = await shopping(recipeId, ingredients);
  const task = (
    await db.query('select * from public.task_items where list_id = $1', [
      shoppingId,
    ])
  ).rows[0];
  assert.equal(task.name, '1 container salt');
  assert.match(task.notes, /Recipe amount: 1 tsp salt/);
  assert.equal(task.completed_at, null);
  await assert.rejects(
    shopping(recipeId, [ingredients[0], ingredients[0]]),
    /valid ingredients/,
  );
  const personalList = (
    await db.query(
      "insert into public.task_lists(user_id, name) values(auth.uid(), 'Personal') returning id",
    )
  ).rows[0].id;
  await assert.rejects(
    shopping(recipeId, ingredients, personalList),
    /same personal or family/,
  );

  await login(bob);
  assert.equal(
    (await db.query('select id from public.meal_plan_entries')).rows.length,
    2,
  );
  const revision = (
    await db.query(
      'select updated_at::text from public.meal_plan_entries where id = $1',
      [familyMeal],
    )
  ).rows[0].updated_at;
  assert.equal(
    (
      await db.query(
        `update public.meal_plan_entries set meal_date = '2026-10-26', notes = 'Bob is cooking'
    where id = $1 and updated_at = $2::timestamptz returning id`,
        [familyMeal, revision],
      )
    ).rows.length,
    1,
  );
  assert.equal(
    (
      await db.query(
        `update public.meal_plan_entries set title = 'Stale overwrite'
    where id = $1 and updated_at = $2::timestamptz returning id`,
        [familyMeal, revision],
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await db.query(
        'delete from public.meal_plan_entries where id = $1 and updated_at = $2::timestamptz returning id',
        [familyMeal, revision],
      )
    ).rows.length,
    0,
  );
  await assert.rejects(
    db.query(
      'update public.meal_plan_entries set family_id = null where id = $1',
      [familyMeal],
    ),
    /cannot be moved/,
  );
  await assert.rejects(
    db.query(
      'update public.meal_plan_entries set user_id = auth.uid() where id = $1',
      [familyMeal],
    ),
    /cannot be moved/,
  );
  await assert.rejects(plan(personalId), /same personal or family/);
  const bobMeal = await plan(recipeId, family, 'Bob’s soup');
  const bobPersonal = await plan(null, null, 'My personal plan');
  await db.exec('reset role');
  await db.query('delete from public.family_members where user_id = $1', [bob]);
  await login(bob);
  assert.deepEqual(
    (await db.query('select id from public.meal_plan_entries')).rows.map(
      (row) => row.id,
    ),
    [bobPersonal],
  );
  assert.equal(
    (
      await db.query(
        'delete from public.meal_plan_entries where id = $1 returning id',
        [bobMeal],
      )
    ).rows.length,
    0,
  );
  await assert.rejects(plan(null, family), /row-level security/);
  await db.exec('reset role');
  await db.query('insert into public.family_members values($1, $2)', [
    bob,
    family,
  ]);
  await login(bob);
  assert.equal(
    (
      await db.query(
        'select id from public.meal_plan_entries where family_id = $1',
        [family],
      )
    ).rows.length,
    3,
  );
  assert.equal(
    (await db.query('select id from public.recipes')).rows.length,
    1,
  );
  const original = (
    await db.query(
      'select updated_at::text from public.recipes where id = $1',
      [recipeId],
    )
  ).rows[0];
  await save(
    { ...draft, title: 'Shared soup' },
    recipeId,
    family,
    original.updated_at,
  );
  await assert.rejects(
    save(draft, recipeId, family, original.updated_at),
    /changed since/,
  );
  await assert.rejects(shopping(recipeId, ingredients), /valid ingredients/); // IDs from a stale editor.
  const current = (
    await db.query(
      'select updated_at::text from public.recipes where id = $1',
      [recipeId],
    )
  ).rows[0];
  await assert.rejects(
    save(
      {
        ...draft,
        title: 'Must roll back',
        ingredients: [{ ...draft.ingredients[0], shoppingQuantity: -1 }],
      },
      recipeId,
      family,
      current.updated_at,
    ),
  );
  assert.equal(
    (
      await db.query('select title from public.recipes where id = $1', [
        recipeId,
      ])
    ).rows[0].title,
    'Shared soup',
  );
  assert.equal(
    (
      await db.query(
        'select id from public.recipe_ingredients where recipe_id = $1',
        [recipeId],
      )
    ).rows.length,
    1,
  );
  await assert.rejects(
    db.query('update public.recipes set family_id = $1 where id = $2', [
      otherFamily,
      recipeId,
    ]),
    /cannot be moved/,
  );

  await login(outsider);
  assert.equal(
    (await db.query('select * from public.meal_plan_entries')).rows.length,
    0,
  );
  await assert.rejects(plan(null, family), /row-level security/);
  await assert.rejects(plan(recipeId, otherFamily), /same personal or family/);
  assert.equal(
    (
      await db.query(
        "update public.meal_plan_entries set title = 'Attack' where id = $1 returning id",
        [familyMeal],
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await db.query(
        'delete from public.meal_plan_entries where id = $1 returning id',
        [personalMeal],
      )
    ).rows.length,
    0,
  );
  assert.equal((await db.query('select * from public.recipes')).rows.length, 0);
  assert.equal(
    (await db.query('select * from public.recipe_ingredients')).rows.length,
    0,
  );
  assert.equal(
    (await db.query('select * from public.recipe_steps')).rows.length,
    0,
  );
  await assert.rejects(save(draft, null, family), /row-level security/);
  await assert.rejects(shopping(recipeId, ingredients), /access denied/);
  await assert.rejects(
    save(draft, personalId, null, current.updated_at),
    /not found/,
  );
  assert.deepEqual(
    (await db.query('select public.consume_recipe_import_quota() as result'))
      .rows[0].result,
    { allowed: false, reason: 'not_approved' },
  );
  await assert.rejects(
    db.query(
      "insert into public.feature_access_grants(user_id, feature) values(auth.uid(), 'recipe_import')",
    ),
    /permission denied/,
  );
  await assert.rejects(
    db.query('select * from public.recipe_import_requests'),
    /permission denied/,
  );

  await db.exec('reset role');
  await db.query(
    "insert into public.feature_access_grants(user_id, feature, hourly_limit, daily_limit) values($1, 'recipe_import', 1, 2)",
    [alice],
  );
  await login(alice);
  assert.equal(
    (await db.query('select public.consume_recipe_import_quota() as result'))
      .rows[0].result.allowed,
    true,
  );
  assert.deepEqual(
    (await db.query('select public.consume_recipe_import_quota() as result'))
      .rows[0].result,
    { allowed: false, reason: 'hourly_limit' },
  );
  await db.exec('reset role');
  await db.query(
    "update public.recipe_import_requests set created_at = now() - interval '2 hours' where user_id = $1",
    [alice],
  );
  await login(alice);
  assert.equal(
    (await db.query('select public.consume_recipe_import_quota() as result'))
      .rows[0].result.allowed,
    true,
  );
  assert.deepEqual(
    (await db.query('select public.consume_recipe_import_quota() as result'))
      .rows[0].result,
    { allowed: false, reason: 'daily_limit' },
  );
  await db.exec('reset role');
  await db.query(
    "update public.feature_access_grants set revoked_at = now() where user_id = $1 and feature = 'recipe_import'",
    [alice],
  );
  await login(alice);
  assert.deepEqual(
    (await db.query('select public.consume_recipe_import_quota() as result'))
      .rows[0].result,
    { allowed: false, reason: 'not_approved' },
  );
  await db.query('delete from public.recipes where id = $1', [recipeId]);
  const retained = (
    await db.query(
      'select title, recipe_id, meal_date::text from public.meal_plan_entries where id = $1',
      [familyMeal],
    )
  ).rows[0];
  assert.deepEqual(retained, {
    title: 'Soup night',
    recipe_id: null,
    meal_date: '2026-10-26',
  });
  assert.equal(
    (
      await db.query(
        'select recipe_id from public.meal_plan_entries where id = $1',
        [bobMeal],
      )
    ).rows[0].recipe_id,
    null,
  );
  await db.query('delete from public.meal_plan_entries where id = $1', [
    customMeal,
  ]);
  assert.equal(
    (
      await db.query('select id from public.meal_plan_entries where id = $1', [
        customMeal,
      ])
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await db.query(
        'select id from public.recipe_ingredients where recipe_id = $1',
        [recipeId],
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await db.query('select id from public.task_items where list_id = $1', [
        shoppingId,
      ])
    ).rows.length,
    1,
  );
  console.log(
    'PASS: recipe and meal-plan migrations, scoped RLS, personal/family separation, membership changes, stale edit/delete protection, recipe deletion retention, validation, atomic save/rollback, shopping integration and AI quotas.',
  );
} finally {
  await db.close();
}

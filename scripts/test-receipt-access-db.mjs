// Isolated PostgreSQL regression test; never reads .env or contacts Supabase/OpenAI.
// Like test-recipes-db.mjs, accepts an optional path to PGlite's dist/index.js.
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
const applyMigration = (name) =>
  db.exec(
    readFileSync(
      new URL(`../supabase/migrations/${name}`, import.meta.url),
      'utf8',
    ),
  );
const login = async (id) => {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  await db.exec('set role authenticated');
};
const consume = async () =>
  (await db.query('select public.consume_receipt_analysis_quota() as result'))
    .rows[0].result;
const ledgerCount = async (id) => {
  await db.exec('reset role');
  return (
    await db.query(
      'select count(*)::integer as count from public.receipt_analysis_requests where user_id = $1',
      [id],
    )
  ).rows[0].count;
};

try {
  await db.exec(`
    set timezone = 'America/Chicago';
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to authenticated;
    insert into auth.users values('${alice}'), ('${bob}');
  `);
  await applyMigration('20260824000000_secure_receipt_analysis_access.sql');
  await db.query(
    "insert into public.feature_access_grants(user_id, feature, hourly_limit, daily_limit) values($1, 'receipt_analysis', 1, 2)",
    [alice],
  );
  await db.query(
    "insert into public.receipt_analysis_requests(user_id, created_at) values($1, clock_timestamp() - interval '2 days')",
    [alice],
  );
  const originalGrants = (
    await db.query('select * from public.feature_access_grants')
  ).rows;
  const originalLedger = (
    await db.query('select * from public.receipt_analysis_requests')
  ).rows;

  // Reproduce the production failure before applying the forward-only repair.
  await login(alice);
  await assert.rejects(
    consume(),
    (error) =>
      error.code === '42883' &&
      /timestamp with time zone >= time with time zone/.test(error.message),
  );
  await db.exec('reset role');
  await applyMigration('20261027000000_fix_receipt_analysis_quota_clock.sql');
  assert.deepEqual(
    (await db.query('select * from public.feature_access_grants')).rows,
    originalGrants,
  );
  assert.deepEqual(
    (await db.query('select * from public.receipt_analysis_requests')).rows,
    originalLedger,
  );

  await login('');
  assert.deepEqual(await consume(), {
    allowed: false,
    reason: 'unauthenticated',
  });
  await login(bob);
  assert.deepEqual(await consume(), { allowed: false, reason: 'not_approved' });
  assert.deepEqual(
    (await db.query('select * from public.feature_access_grants')).rows,
    [],
  );
  for (const statement of [
    "insert into public.feature_access_grants(user_id, feature) values(auth.uid(), 'receipt_analysis')",
    'update public.feature_access_grants set revoked_at = null',
    'delete from public.feature_access_grants',
    'select * from public.receipt_analysis_requests',
    'insert into public.receipt_analysis_requests(user_id) values(auth.uid())',
    'update public.receipt_analysis_requests set created_at = now()',
    'delete from public.receipt_analysis_requests',
  ]) {
    await assert.rejects(db.query(statement), /permission denied/);
  }
  assert.equal(await ledgerCount(bob), 0);

  await login(alice);
  const first = await consume();
  assert.equal(first.allowed, true);
  assert.match(
    first.requestId,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  assert.equal(first.remainingHour, 0);
  assert.equal(first.remainingDay, 1); // The pre-existing, expired entry is ignored.
  const hourlyDenial = await consume();
  assert.equal(hourlyDenial.allowed, false);
  assert.equal(hourlyDenial.reason, 'hourly_limit');
  assert.ok(Number.isInteger(hourlyDenial.retryAfterSeconds));
  assert.ok(
    hourlyDenial.retryAfterSeconds > 3500 &&
      hourlyDenial.retryAfterSeconds <= 3600,
  );
  assert.equal(await ledgerCount(alice), 2); // Denials never reserve another slot.
  const recorded = (
    await db.query(
      `select user_id, created_at > clock_timestamp() - interval '1 minute'
      and created_at <= clock_timestamp() as recent
     from public.receipt_analysis_requests where id = $1`,
      [first.requestId],
    )
  ).rows[0];
  assert.deepEqual(recorded, { user_id: alice, recent: true });

  // Move the first reservation outside the hourly window, but keep it in the day.
  await db.query(
    "update public.receipt_analysis_requests set created_at = clock_timestamp() - interval '2 hours' where id = $1",
    [first.requestId],
  );
  await login(alice);
  const second = await consume();
  assert.equal(second.allowed, true);
  assert.notEqual(second.requestId, first.requestId);
  assert.equal(second.remainingHour, 0);
  assert.equal(second.remainingDay, 0);
  const dailyDenial = await consume();
  assert.equal(dailyDenial.allowed, false);
  assert.equal(dailyDenial.reason, 'daily_limit');
  assert.ok(Number.isInteger(dailyDenial.retryAfterSeconds));
  assert.ok(
    dailyDenial.retryAfterSeconds > 79100 &&
      dailyDenial.retryAfterSeconds <= 79200,
  );
  assert.equal(await ledgerCount(alice), 3);

  // Another user's quota is independent; a revoked grant remains denied.
  await db.query(
    "insert into public.feature_access_grants(user_id, feature) values($1, 'receipt_analysis')",
    [bob],
  );
  await login(bob);
  const otherUser = await consume();
  assert.equal(otherUser.allowed, true);
  assert.equal(otherUser.remainingHour, 9);
  assert.equal(otherUser.remainingDay, 29);
  await db.exec('reset role');
  await db.query(
    "update public.feature_access_grants set revoked_at = now() where user_id = $1 and feature = 'receipt_analysis'",
    [bob],
  );
  await login(bob);
  assert.deepEqual(await consume(), { allowed: false, reason: 'not_approved' });
  assert.equal(await ledgerCount(bob), 1);

  // Quota becomes available once the 24-hour window expires.
  await db.query(
    "update public.receipt_analysis_requests set created_at = clock_timestamp() - interval '25 hours' where user_id = $1",
    [alice],
  );
  await login(alice);
  const reset = await consume();
  assert.equal(reset.allowed, true);
  assert.equal(reset.remainingHour, 0);
  assert.equal(reset.remainingDay, 1);
  assert.equal(await ledgerCount(alice), 4);

  await db.exec('set role anon');
  await assert.rejects(consume(), /permission denied/);
  console.log(
    'PASS: reproduced 42883, repaired quota timestamp, preserved grants/history, approved scans, hourly/daily limits and retry delays, expired windows, user isolation, revoked/unapproved/unauthenticated access, and ledger permissions.',
  );
} finally {
  await db.close();
}

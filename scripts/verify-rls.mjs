#!/usr/bin/env node
/**
 * RLS isolation smoke test for the Ultralight Gear Tracker.
 *
 * Boots two anon Supabase clients (alice, bob), inserts a row as alice,
 * then attempts SELECT / UPDATE / DELETE as bob and asserts each returns
 * an empty result set. Exits non-zero on any leak.
 *
 * Pre-req: local or hosted Supabase running with the init migration applied
 * AND two users created in auth (alice@test.local, bob@test.local, password
 * 'password'). For hosted, supply SUPABASE_URL + SUPABASE_KEY env vars.
 *
 * Usage:
 *   SUPABASE_URL=http://localhost:54321 \
 *   SUPABASE_KEY=<anon-key> \
 *   ALICE_CATEGORY_ID=<uuid of Alice's 'shelter' category> \
 *   node scripts/verify-rls.mjs
 */

import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_KEY;
const ALICE_CAT_ID = process.env.ALICE_CATEGORY_ID;

if (!URL || !KEY) {
  console.error('SUPABASE_URL and SUPABASE_KEY are required.');
  process.exit(2);
}
if (!ALICE_CAT_ID) {
  console.error('ALICE_CATEGORY_ID is required (id of Alice shelter category).');
  process.exit(2);
}

const a = createClient(URL, KEY, { auth: { storageKey: 'a' } });
const b = createClient(URL, KEY, { auth: { storageKey: 'b' } });

const signin = async (client, email) => {
  const { error } = await client.auth.signInWithPassword({ email, password: 'password' });
  if (error) throw new Error(`sign-in ${email} failed: ${error.message}`);
};

const assertEmpty = (label, data) => {
  if (!data || data.length !== 0) {
    throw new Error(`RLS LEAK on ${label}: expected [], got ${JSON.stringify(data)}`);
  }
};

(async () => {
  try {
    await signin(a, 'alice@test.local');
    await signin(b, 'bob@test.local');

    const ins = await a
      .from('gear_items')
      .insert({ name: 'rls-probe-' + Date.now(), category_id: ALICE_CAT_ID, weight_g: 1 })
      .select()
      .single();

    if (ins.error) throw new Error('alice insert failed: ' + ins.error.message);
    const id = ins.data.id;
    console.log('inserted row id:', id);

    const read = await b.from('gear_items').select('*').eq('id', id);
    assertEmpty('SELECT', read.data);

    const upd = await b.from('gear_items').update({ name: 'hacked' }).eq('id', id).select();
    assertEmpty('UPDATE', upd.data);

    const del = await b.from('gear_items').delete().eq('id', id).select();
    assertEmpty('DELETE', del.data);

    // Cleanup: alice removes her probe row.
    await a.from('gear_items').delete().eq('id', id);

    console.log('RLS OK');
    process.exit(0);
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
})();
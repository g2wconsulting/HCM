// One-time setup script: creates a company and its first admin login.
// Run this from the server (NOT in the browser) because it needs the
// Supabase *service role* key, which must never be shipped to the client.
//
// Usage:
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//   node scripts/bootstrap-admin.mjs \
//     --company "Northbank Studio" \
//     --state OR \
//     --email admin@northbankstudio.com \
//     --password "TempPassword123!"

import { createClient } from '@supabase/supabase-js';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables first.');
  process.exit(1);
}

const companyName = arg('company');
const state = arg('state', 'OR');
const email = arg('email');
const password = arg('password');

if (!companyName || !email || !password) {
  console.error('Usage: node scripts/bootstrap-admin.mjs --company "Acme Inc" --state OR --email you@acme.com --password "SomePassword123!"');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  const { data: company, error: companyErr } = await supabase
    .from('companies')
    .insert({ name: companyName, state })
    .select()
    .single();
  if (companyErr) throw companyErr;
  console.log(`Created company "${company.name}" (${company.id})`);

  const { data: userRes, error: userErr } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (userErr) throw userErr;
  const userId = userRes.user.id;
  console.log(`Created auth user ${email} (${userId})`);

  const { error: profileErr } = await supabase.from('profiles').insert({
    id: userId, company_id: company.id, role: 'admin', email,
  });
  if (profileErr) throw profileErr;

  console.log('\nDone. Log in at your app URL with:');
  console.log(`  email:    ${email}`);
  console.log(`  password: ${password}`);
  console.log('\n(Have them change the password after first login.)');
}

main().catch(err => { console.error(err); process.exit(1); });

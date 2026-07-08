// Creates a login for a client (sub-company) so their team can access the
// client portal. Run server-side with the service role key.
//
// Usage:
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//   node scripts/create-client-login.mjs \
//     --client-id <uuid from the clients table> \
//     --email contact@theirclientcompany.com \
//     --password "TempPassword123!"
//
// Find the client's id in Supabase Table Editor -> clients, or from the
// app URL when an admin opens that client's page.

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

const clientId = arg('client-id');
const email = arg('email');
const password = arg('password');

if (!clientId || !email || !password) {
  console.error('Usage: node scripts/create-client-login.mjs --client-id <uuid> --email you@theirco.com --password "SomePassword123!"');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  const { data: clientRow, error: clientErr } = await supabase
    .from('clients')
    .select('id, company_id, name')
    .eq('id', clientId)
    .single();
  if (clientErr) throw clientErr;

  const { data: userRes, error: userErr } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (userErr) throw userErr;
  const userId = userRes.user.id;

  const { error: profileErr } = await supabase.from('profiles').insert({
    id: userId, company_id: clientRow.company_id, role: 'client', client_id: clientRow.id, email,
  });
  if (profileErr) throw profileErr;

  console.log(`Client portal login created for ${clientRow.name}.`);
  console.log(`  email:    ${email}`);
  console.log(`  password: ${password}`);
}

main().catch(err => { console.error(err); process.exit(1); });

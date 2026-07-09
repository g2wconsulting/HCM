// Creates a login for a client (sub-company) and sends them a real email
// invite to set their own password. Run server-side with the service
// role key — never in the browser.
//
// Usage:
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//   SITE_URL=https://your-app.vercel.app \
//   node scripts/create-client-login.mjs \
//     --client-id <uuid from the clients table> \
//     --email contact@theirclientcompany.com
//
// Find the client's id in Supabase Table Editor -> clients, or from the
// app URL when an admin opens that client's page.
//
// SITE_URL defaults to http://localhost:5180 if not set — set it to your
// real deployed URL (e.g. your Vercel URL) so the invite email links
// somewhere the client can actually reach.

import { createClient } from '@supabase/supabase-js';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const siteUrl = process.env.SITE_URL || 'http://localhost:5180';
if (!url || !serviceKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables first.');
  process.exit(1);
}

const clientId = arg('client-id');
const email = arg('email');

if (!clientId || !email) {
  console.error('Usage: node scripts/create-client-login.mjs --client-id <uuid> --email you@theirco.com');
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

  const { data: userRes, error: userErr } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/reset-password`,
  });
  if (userErr) throw userErr;
  const userId = userRes.user.id;

  const { error: profileErr } = await supabase.from('profiles').insert({
    id: userId, company_id: clientRow.company_id, role: 'client', client_id: clientRow.id, email,
  });
  if (profileErr) throw profileErr;

  console.log(`Invite sent to ${clientRow.name} at ${email}.`);
  console.log(`They'll get an email with a link to set their own password.`);
}

main().catch(err => { console.error(err); process.exit(1); });

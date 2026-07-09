// Creates a login for an existing employee record and sends them a real
// email invite to set their own password. Run server-side with the
// service role key — never in the browser.
//
// Usage:
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//   SITE_URL=https://your-app.vercel.app \
//   node scripts/create-employee-login.mjs \
//     --employee-id <uuid from the employees table> \
//     --email maya@northbankstudio.com
//
// Find the employee's id in the Supabase table editor, or by asking an
// admin to open the employee's page in the app (the URL contains it).
//
// SITE_URL defaults to http://localhost:5180 if not set — set it to your
// real deployed URL (e.g. your Vercel URL) so the invite email links
// somewhere the employee can actually reach.

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

const employeeId = arg('employee-id');
const email = arg('email');

if (!employeeId || !email) {
  console.error('Usage: node scripts/create-employee-login.mjs --employee-id <uuid> --email you@company.com');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  const { data: employee, error: empErr } = await supabase
    .from('employees')
    .select('id, company_id, first_name, last_name')
    .eq('id', employeeId)
    .single();
  if (empErr) throw empErr;

  const { data: userRes, error: userErr } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/reset-password`,
  });
  if (userErr) throw userErr;
  const userId = userRes.user.id;

  const { error: profileErr } = await supabase.from('profiles').insert({
    id: userId, company_id: employee.company_id, role: 'employee', employee_id: employee.id, email,
  });
  if (profileErr) throw profileErr;

  console.log(`Invite sent to ${employee.first_name} ${employee.last_name} at ${email}.`);
  console.log(`They'll get an email with a link to set their own password.`);
}

main().catch(err => { console.error(err); process.exit(1); });

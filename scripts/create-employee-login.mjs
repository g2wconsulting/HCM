// Creates a login for an existing employee record so they can access the
// app. Run server-side with the service role key — never in the browser.
//
// Usage:
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//   node scripts/create-employee-login.mjs \
//     --employee-id <uuid from the employees table> \
//     --email maya@northbankstudio.com \
//     --password "TempPassword123!"
//
// Find the employee's id in the Supabase table editor, or by asking an
// admin to open the employee's page in the app (the URL contains it).

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

const employeeId = arg('employee-id');
const email = arg('email');
const password = arg('password');

if (!employeeId || !email || !password) {
  console.error('Usage: node scripts/create-employee-login.mjs --employee-id <uuid> --email you@company.com --password "SomePassword123!"');
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

  const { data: userRes, error: userErr } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (userErr) throw userErr;
  const userId = userRes.user.id;

  const { error: profileErr } = await supabase.from('profiles').insert({
    id: userId, company_id: employee.company_id, role: 'employee', employee_id: employee.id, email,
  });
  if (profileErr) throw profileErr;

  console.log(`Login created for ${employee.first_name} ${employee.last_name}.`);
  console.log(`  email:    ${email}`);
  console.log(`  password: ${password}`);
}

main().catch(err => { console.error(err); process.exit(1); });

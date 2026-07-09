// Adds another admin login to your EXISTING company — unlike
// bootstrap-admin.mjs, this does not create a new company. Use this any
// time you want to give a coworker full admin access alongside you.
//
// Run server-side with the service role key — never in the browser.
//
// Usage:
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//   node scripts/create-admin-login.mjs \
//     --email newadmin@g2wconsulting.com
//
// This sends a real invite email (like the employee/client scripts) —
// the new admin sets their own password on first login. If you'd rather
// set a temporary password yourself instead, add --password "Temp123!".

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

const email = arg('email');
const password = arg('password'); // optional

if (!email) {
  console.error('Usage: node scripts/create-admin-login.mjs --email newadmin@yourcompany.com [--password "Temp123!"]');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  // Find your existing company. If you ever run more than one company
  // through this project, this grabs the first — pass --company-id to
  // be explicit if that ever applies to you.
  const companyId = arg('company-id');
  let company;
  if (companyId) {
    const { data, error } = await supabase.from('companies').select('id, name').eq('id', companyId).single();
    if (error) throw error;
    company = data;
  } else {
    const { data, error } = await supabase.from('companies').select('id, name').limit(1).single();
    if (error) throw error;
    company = data;
  }

  let userId;
  if (password) {
    const { data: userRes, error: userErr } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    if (userErr) throw userErr;
    userId = userRes.user.id;
  } else {
    const { data: userRes, error: userErr } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}/reset-password`,
    });
    if (userErr) throw userErr;
    userId = userRes.user.id;
  }

  const { error: profileErr } = await supabase.from('profiles').insert({
    id: userId, company_id: company.id, role: 'admin', email,
  });
  if (profileErr) throw profileErr;

  console.log(`Admin access granted to ${email} for ${company.name}.`);
  if (password) {
    console.log(`  password: ${password}`);
  } else {
    console.log(`  They'll get an email with a link to set their own password.`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });

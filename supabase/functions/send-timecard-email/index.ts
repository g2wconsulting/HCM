// Supabase Edge Function: send-timecard-email
//
// Sends an individual, single-recipient secure link to either the
// employee or the supervisor for one uploaded timecard (a `timesheets`
// row with daily_entries). Each recipient gets a link built from their
// own unique token column (employee_link_token / supervisor_link_token)
// — never a shared or bulk token — so a link can only ever open its own
// timecard.
//
// Deploy with:
//   supabase functions deploy send-timecard-email
//
// Requires the same secrets as send-signature-request, plus SITE_URL:
//   supabase secrets set RESEND_API_KEY=re_xxx
//   supabase secrets set RESEND_FROM="G2W Consulting <timesheets@yourdomain.com>"
//   supabase secrets set SITE_URL=https://hcm-beige.vercel.app
//
// SITE_URL is the fix for the "wrong link" bug: it is the sole source of
// truth for links this function emails — the caller's origin is never
// trusted, so a send triggered from a preview deployment or localhost
// still emails a link to your real production URL.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const RESEND_FROM = Deno.env.get('RESEND_FROM') ?? 'onboarding@resend.dev';
const SITE_URL = Deno.env.get('SITE_URL');

function randomToken(): string {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
}

Deno.serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401, cors);

    const { timesheetId, role, action } = await req.json();
    if (!timesheetId || !['employee', 'supervisor'].includes(role) || !['send', 'resend'].includes(action)) {
      return json({ error: 'timesheetId, role (employee|supervisor), and action (send|resend) are required' }, 400, cors);
    }

    const callerClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await callerClient.auth.getUser();
    if (!userRes?.user) return json({ error: 'Not authenticated' }, 401, cors);

    const { data: profile } = await callerClient
      .from('profiles')
      .select('id, role, company_id')
      .eq('id', userRes.user.id)
      .single();
    if (!profile || profile.role !== 'admin') return json({ error: 'Admins only' }, 403, cors);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: ts, error: tsErr } = await admin
      .from('timesheets')
      .select('id, company_id, employee_id, employee_link_token, supervisor_link_token, supervisor_name, supervisor_email, send_log, status, employee_name_snapshot, week_start_date, week_end_date')
      .eq('id', timesheetId)
      .single();
    if (tsErr || !ts) return json({ error: 'Timecard not found' }, 404, cors);
    if (ts.company_id !== profile.company_id) return json({ error: 'Not your company' }, 403, cors);

    const { data: employee } = await admin.from('employees').select('first_name, last_name, email').eq('id', ts.employee_id).single();
    const { data: company } = await admin.from('companies').select('name').eq('id', ts.company_id).single();
    const employeeName = ts.employee_name_snapshot || (employee ? `${employee.first_name} ${employee.last_name}` : 'an employee');
    const companyName = company?.name ?? 'G2W Consulting';

    const recipientEmail = role === 'employee' ? employee?.email : ts.supervisor_email;
    const recipientLabel = role === 'employee' ? employeeName : (ts.supervisor_name || 'Supervisor');
    if (!recipientEmail) {
      return json({ error: role === 'employee' ? 'This employee has no email on file.' : 'No supervisor email is set on this timecard yet.' }, 400, cors);
    }

    let tokenColumn = role === 'employee' ? 'employee_link_token' : 'supervisor_link_token';
    let token: string = (ts as any)[tokenColumn];
    if (!token) {
      token = randomToken();
      const { error: tokenErr } = await admin.from('timesheets').update({ [tokenColumn]: token }).eq('id', ts.id);
      if (tokenErr) return json({ error: `Could not generate link: ${tokenErr.message}` }, 500, cors);
    }

    if (!SITE_URL) {
      return json({ error: 'SITE_URL secret is not set on the Supabase project — run: supabase secrets set SITE_URL=https://your-production-domain' }, 500, cors);
    }
    const link = `${SITE_URL}/timecard/${token}`;

    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="margin-bottom: 4px;">${companyName}</h2>
        <p>Hi ${recipientLabel},</p>
        <p>${employeeName}'s timecard for ${ts.week_start_date} through ${ts.week_end_date} is ready for your ${role === 'employee' ? 'review and signature' : 'approval'}.</p>
        <p style="margin: 24px 0;">
          <a href="${link}" style="background:#A8611F;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
            ${role === 'employee' ? 'Review & sign your timecard' : 'Review & approve'}
          </a>
        </p>
        <p style="color:#888;font-size:13px;">If the button doesn't work, copy this link: ${link}</p>
      </div>
    `;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: recipientEmail,
        subject: `${employeeName}'s timecard — ${role === 'employee' ? 'please review & sign' : 'ready for your approval'}`,
        html,
      }),
    });
    if (!resendRes.ok) {
      const errText = await resendRes.text();
      return json({ error: `Resend API error: ${errText}` }, 502, cors);
    }

    const nextStatus = action === 'send'
      ? (role === 'employee' ? 'sent_to_employee' : 'sent_to_supervisor')
      : ts.status;
    const logEntry = { type: role, action, at: new Date().toISOString(), byProfileId: profile.id };
    const nextLog = [...(ts.send_log ?? []), logEntry];

    const { error: updateErr } = await admin.from('timesheets').update({ status: nextStatus, send_log: nextLog }).eq('id', ts.id);
    if (updateErr) return json({ error: `Sent, but could not update status: ${updateErr.message}` }, 500, cors);

    return json({ success: true, link }, 200, cors);
  } catch (e) {
    return json({ error: String(e) }, 500, cors);
  }
});

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}

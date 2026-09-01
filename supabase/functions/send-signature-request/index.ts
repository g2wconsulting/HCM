// Supabase Edge Function: send-signature-request
//
// Sends an email to an external recipient (e.g. a client hiring manager)
// with a link to review and sign a date range of an employee's
// timesheets — no login required on their end.
//
// Deploy with:
//   supabase functions deploy send-signature-request
//
// Requires these secrets set on the Supabase project:
//   supabase secrets set RESEND_API_KEY=re_xxx
//   supabase secrets set RESEND_FROM="Ledgerline <timesheets@yourdomain.com>"
//
// RESEND_FROM must be an address on a domain you've verified in Resend
// (resend.com/domains) — Resend will reject sends from unverified domains.
// For quick testing before you verify a domain, Resend provides a
// onboarding@resend.dev sender that works without verification.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const RESEND_FROM = Deno.env.get('RESEND_FROM') ?? 'onboarding@resend.dev';
// Canonical site URL, set once as a Supabase secret:
//   supabase secrets set SITE_URL=https://your-production-domain
// Fixes the "wrong link" bug: previously this function trusted whatever
// origin the browser sent, so a send triggered from a preview deployment
// or localhost would email a link to that ephemeral origin. When set,
// SITE_URL always wins over the client-supplied siteUrl.
const SITE_URL = Deno.env.get('SITE_URL');

Deno.serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  console.log('send-signature-request: invoked');

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('send-signature-request: missing Authorization header');
      return json({ error: 'Missing Authorization header' }, 401, cors);
    }

    const { requestId, siteUrl: clientSiteUrl } = await req.json();
    const siteUrl = SITE_URL || clientSiteUrl;
    console.log('send-signature-request: payload', { requestId, siteUrl, usedSecret: !!SITE_URL });
    if (!requestId || !siteUrl) return json({ error: 'requestId and siteUrl are required' }, 400, cors);

    // Verify the caller is a logged-in admin, using their own JWT (not the
    // service role) so normal RLS applies to this check.
    const callerClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await callerClient.auth.getUser();
    if (userErr) console.log('send-signature-request: auth.getUser error', userErr.message);
    if (!userRes?.user) {
      console.log('send-signature-request: not authenticated');
      return json({ error: 'Not authenticated' }, 401, cors);
    }
    console.log('send-signature-request: caller user id', userRes.user.id);

    const { data: profile, error: profileErr } = await callerClient
      .from('profiles')
      .select('role, company_id')
      .eq('id', userRes.user.id)
      .single();
    if (profileErr) console.log('send-signature-request: profile lookup error', profileErr.message);
    if (!profile || profile.role !== 'admin') {
      console.log('send-signature-request: caller is not an admin', profile);
      return json({ error: 'Admins only' }, 403, cors);
    }
    console.log('send-signature-request: caller is admin for company', profile.company_id);

    // Now use the service role to read the request and send the email —
    // this bypasses RLS deliberately, scoped to exactly this one row.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: sigReq, error: sigErr } = await admin
      .from('signature_requests')
      .select('id, company_id, employee_id, recipient_name, recipient_email, token, range_start, range_end')
      .eq('id', requestId)
      .single();
    if (sigErr) console.log('send-signature-request: signature_requests lookup error', sigErr.message);
    if (sigErr || !sigReq) return json({ error: 'Signature request not found' }, 404, cors);
    if (sigReq.company_id !== profile.company_id) {
      console.log('send-signature-request: company mismatch', sigReq.company_id, profile.company_id);
      return json({ error: 'Not your company' }, 403, cors);
    }

    const { data: employee } = await admin.from('employees').select('first_name, last_name').eq('id', sigReq.employee_id).single();
    const { data: company } = await admin.from('companies').select('name').eq('id', sigReq.company_id).single();

    const signLink = `${siteUrl}/sign/${sigReq.token}`;
    const employeeName = employee ? `${employee.first_name} ${employee.last_name}` : 'an employee';
    const companyName = company?.name ?? 'Ledgerline';

    console.log('send-signature-request: sending via Resend to', sigReq.recipient_email, 'from', RESEND_FROM);

    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="margin-bottom: 4px;">${companyName}</h2>
        <p>Hi ${sigReq.recipient_name},</p>
        <p>${employeeName}'s timesheets for ${sigReq.range_start} through ${sigReq.range_end} are ready for your review and signature.</p>
        <p style="margin: 24px 0;">
          <a href="${signLink}" style="background:#A8611F;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
            Review &amp; sign
          </a>
        </p>
        <p style="color:#888;font-size:13px;">If the button doesn't work, copy this link: ${signLink}</p>
      </div>
    `;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: sigReq.recipient_email,
        subject: `${employeeName}'s timesheets — signature requested`,
        html,
      }),
    });

    console.log('send-signature-request: Resend response status', resendRes.status);

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.log('send-signature-request: Resend error body', errText);
      return json({ error: `Resend API error: ${errText}` }, 502, cors);
    }

    const resendJson = await resendRes.json();
    console.log('send-signature-request: Resend success', resendJson);

    return json({ success: true }, 200, cors);
  } catch (e) {
    console.log('send-signature-request: unhandled exception', String(e));
    return json({ error: String(e) }, 500, cors);
  }
});

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}

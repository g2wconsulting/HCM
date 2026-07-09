// Supabase Edge Function: invite-user
//
// Lets an admin click a button in the app to invite an employee or
// client to their portal — no CLI script needed. Replaces the manual
// create-employee-login.mjs / create-client-login.mjs scripts for
// day-to-day use (those still work and are handy for bulk/manual setup).
//
// Deploy with:
//   supabase functions deploy invite-user
//
// Uses the same RESEND_API_KEY / RESEND_FROM secrets as
// send-signature-request — no additional secrets needed if that's
// already set up.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  console.log('invite-user: invoked');

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401, cors);

    const { type, targetId, email, siteUrl } = await req.json();
    console.log('invite-user: payload', { type, targetId, email, siteUrl });
    if (!type || !targetId || !email || !siteUrl) {
      return json({ error: 'type, targetId, email, and siteUrl are required' }, 400, cors);
    }
    if (type !== 'employee' && type !== 'client') {
      return json({ error: 'type must be "employee" or "client"' }, 400, cors);
    }

    // Verify the caller is a logged-in admin, using their own JWT.
    const callerClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userRes?.user) {
      console.log('invite-user: not authenticated', userErr?.message);
      return json({ error: 'Not authenticated' }, 401, cors);
    }

    const { data: profile, error: profileErr } = await callerClient
      .from('profiles')
      .select('role, company_id')
      .eq('id', userRes.user.id)
      .single();
    if (profileErr || !profile || profile.role !== 'admin') {
      console.log('invite-user: caller is not an admin', profileErr?.message, profile);
      return json({ error: 'Admins only' }, 403, cors);
    }
    console.log('invite-user: caller is admin for company', profile.company_id);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Confirm the target record exists and belongs to the caller's company.
    const table = type === 'employee' ? 'employees' : 'clients';
    const { data: target, error: targetErr } = await admin
      .from(table)
      .select('id, company_id' + (type === 'employee' ? ', first_name, last_name' : ', name'))
      .eq('id', targetId)
      .single();
    if (targetErr || !target) {
      console.log('invite-user: target not found', targetErr?.message);
      return json({ error: `${type} not found` }, 404, cors);
    }
    if (target.company_id !== profile.company_id) {
      console.log('invite-user: company mismatch');
      return json({ error: 'Not your company' }, 403, cors);
    }

    // Check for an existing profile tied to this target already.
    const linkColumn = type === 'employee' ? 'employee_id' : 'client_id';
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id')
      .eq(linkColumn, targetId)
      .maybeSingle();
    if (existingProfile) {
      console.log('invite-user: already has a login');
      return json({ error: 'This person already has a login. Use password reset if they need help signing in.' }, 409, cors);
    }

    console.log('invite-user: sending invite to', email);
    const { data: userInvite, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}/reset-password`,
    });
    if (inviteErr) {
      console.log('invite-user: invite error', inviteErr.message);
      return json({ error: `Could not send invite: ${inviteErr.message}` }, 502, cors);
    }

    const profileRow: Record<string, unknown> = {
      id: userInvite.user.id,
      company_id: profile.company_id,
      role: type,
      email,
    };
    profileRow[linkColumn] = targetId;

    const { error: insertErr } = await admin.from('profiles').insert(profileRow);
    if (insertErr) {
      console.log('invite-user: profile insert error', insertErr.message);
      return json({ error: `Invite sent, but profile setup failed: ${insertErr.message}` }, 500, cors);
    }

    console.log('invite-user: success');
    return json({ success: true }, 200, cors);
  } catch (e) {
    console.log('invite-user: unhandled exception', String(e));
    return json({ error: String(e) }, 500, cors);
  }
});

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}

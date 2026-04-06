import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── SEND EMAIL via Resend ──
async function sendEmail(to: string, subject: string, htmlBody: string, config: any, attachments?: any[]) {
  try {
    console.log("Sending email to:", to, "subject:", subject, "body_length:", (htmlBody || "").length, "key_length:", (config.resend_key || "").length);
    const payload: any = {
      from: `${config.from_name} <${config.from_email}>`,
      to: [to],
      subject,
      html: htmlBody,
    };
    if (attachments && attachments.length > 0) payload.attachments = attachments;

    let res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.resend_key}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    let data = await res.json();
    console.log("Resend response:", JSON.stringify(data).substring(0, 200));
    if (data.id) return { success: true, id: data.id };

    // Fallback to resend.dev domain
    if (data.statusCode === 403 || (data.message && data.message.includes("domain"))) {
      payload.from = `${config.from_name} <${config.fallback_email}>`;
      res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${config.resend_key}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      data = await res.json();
      console.log("Resend fallback response:", JSON.stringify(data).substring(0, 200));
      return data.id ? { success: true, id: data.id } : { success: false, error: data.message };
    }

    return { success: false, error: data.message || "Unknown error" };
  } catch (e) {
    console.error("sendEmail caught error:", (e as Error).message);
    return { success: false, error: (e as Error).message };
  }
}

// ── SEND SMS via Twilio ──
async function sendSMS(to: string, body: string, config: any) {
  if (!config.twilio_sid || !config.twilio_auth) {
    return { success: false, error: "Twilio SID or Auth Token not configured" };
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.twilio_sid}/Messages.json`;
  const credentials = `${config.twilio_sid}:${config.twilio_auth}`;
  const encoder = new TextEncoder();
  const encoded = encoder.encode(credentials);
  let auth = "";
  for (let i = 0; i < encoded.length; i++) {
    auth += String.fromCharCode(encoded[i]);
  }
  auth = btoa(auth);

  const params = new URLSearchParams();
  if (config.messaging_service_sid) {
    params.append("MessagingServiceSid", config.messaging_service_sid);
  } else {
    params.append("From", config.twilio_phone);
  }
  params.append("To", to);
  params.append("Body", body);

  console.log("Twilio request:", { url, to, sid_length: config.twilio_sid.length, auth_length: config.twilio_auth.length });

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const data = await res.json();
  console.log("Twilio response:", JSON.stringify(data));
  return data.sid ? { success: true, sid: data.sid } : { success: false, error: data.message || "Failed" };
}

// ── PROCESS A SINGLE MESSAGE ──
async function processMessage(msg: any, supabase: any, config: any) {
  let result: any;
  if (msg.channel === "email") {
    result = await sendEmail(msg.lead_email, msg.subject, msg.body, config);
  } else if (msg.channel === "sms" && msg.lead_phone) {
    result = await sendSMS(msg.lead_phone, msg.body, config);
  } else {
    result = { success: false, error: `No phone or unsupported channel: ${msg.channel}` };
  }

  await supabase.from("message_queue").update({
    status: result.success ? "sent" : "failed",
    sent_at: result.success ? new Date().toISOString() : null,
    error: result.error || null,
    external_id: result.id || result.sid || null,
  }).eq("id", msg.id);

  return result;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const config = {
      resend_key: Deno.env.get("RESEND_KEY") || "",
      twilio_sid: Deno.env.get("TWILIO_SID") || "",
      twilio_auth: Deno.env.get("TWILIO_AUTH") || "",
      twilio_phone: Deno.env.get("TWILIO_PHONE") || "",
      messaging_service_sid: Deno.env.get("TWILIO_MESSAGING_SID") || "",
      from_email: Deno.env.get("FROM_EMAIL") || "coach@reshape.fit",
      from_name: Deno.env.get("FROM_NAME") || "Coach Jaime | ReShape",
      fallback_email: Deno.env.get("FALLBACK_EMAIL") || "onboarding@resend.dev",
    };

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let body: any = {};
    const rawBody = await req.text();
    if (rawBody && rawBody.length > 0) {
      try { body = JSON.parse(rawBody); } catch (_e) { /* not JSON */ }
    }

    const action = body.action || "process_queue";

    // ── Send a single message immediately ──
    if (action === "send_message") {
      const { channel, to_email, to_phone, subject, html_body, text_body, lead_name, sequence, step_index, attachments } = body;
      const msgData: any = {
        lead_email: to_email || "",
        lead_phone: to_phone || null,
        lead_name: lead_name || "",
        sequence: sequence || "direct",
        step_index: step_index ?? 0,
        channel: channel || "email",
        subject: subject || "",
        body: html_body || text_body || "",
        send_at: new Date().toISOString(),
        status: "sending",
      };

      const { data: inserted, error: insertErr } = await supabase.from("message_queue").insert([msgData]).select();
      if (insertErr) return jsonResponse({ success: false, error: insertErr.message }, 400);

      const msg = inserted[0];
      let result: any;
      if (channel === "email") {
        result = await sendEmail(to_email, subject || "", html_body || "", config, attachments);
      } else if (channel === "sms" && to_phone) {
        result = await sendSMS(to_phone, text_body || "", config);
      } else {
        result = { success: false, error: "Invalid channel or missing recipient" };
      }

      await supabase.from("message_queue").update({
        status: result.success ? "sent" : "failed",
        sent_at: result.success ? new Date().toISOString() : null,
        error: result.error || null,
        external_id: result.id || result.sid || null,
      }).eq("id", msg.id);

      return jsonResponse({ success: result.success, id: msg.id, error: result.error });
    }

    // ── Queue messages (insert + send immediates) ──
    if (action === "queue_messages") {
      const { messages } = body;
      if (!messages || messages.length === 0) {
        return jsonResponse({ success: true, queued: 0, sent: 0 });
      }

      const { data: inserted, error: insertErr } = await supabase.from("message_queue").insert(messages).select();
      if (insertErr) return jsonResponse({ success: false, error: insertErr.message }, 400);

      let sent = 0;
      for (const msg of inserted || []) {
        if (msg.status === "sending") {
          await processMessage(msg, supabase, config);
          sent++;
          await new Promise((r) => setTimeout(r, 300));
        }
      }

      return jsonResponse({ success: true, queued: (inserted || []).length, sent });
    }

    // ── Process queue (send due messages) ──
    if (action === "process_queue") {
      const now = new Date().toISOString();
      const { data: messages, error: fetchErr } = await supabase
        .from("message_queue")
        .select("*")
        .eq("status", "queued")
        .lte("send_at", now)
        .order("send_at", { ascending: true })
        .limit(20);

      if (fetchErr) return jsonResponse({ success: false, error: fetchErr.message }, 400);

      let processed = 0;
      for (const msg of messages || []) {
        await processMessage(msg, supabase, config);
        processed++;
        await new Promise((r) => setTimeout(r, 300));
      }

      return jsonResponse({ success: true, processed });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err) {
    return jsonResponse({ success: false, error: (err as Error).message }, 500);
  }
});

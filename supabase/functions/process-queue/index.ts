import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── SEND EMAIL via Resend ──
async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string,
  config: any,
  attachments?: any[]
) {
  const payload: any = {
    from: `${config.from_name} <${config.from_email}>`,
    to: [to],
    subject,
    html: htmlBody,
  };
  if (attachments && attachments.length > 0) payload.attachments = attachments;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resend_key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (data.id) return { success: true, id: data.id };

  // Fallback to resend.dev domain if custom domain not verified
  if (data.statusCode === 403 || (data.message && data.message.includes("domain"))) {
    const fallbackPayload: any = {
      from: `${config.from_name} <${config.fallback_email}>`,
      to: [to],
      subject,
      html: htmlBody,
    };
    if (attachments && attachments.length > 0) fallbackPayload.attachments = attachments;
    const res2 = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.resend_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(fallbackPayload),
    });
    const data2 = await res2.json();
    return data2.id
      ? { success: true, id: data2.id }
      : { success: false, error: data2.message };
  }

  return { success: false, error: data.message || "Unknown error" };
}

// ── SEND SMS via Twilio ──
async function sendSMS(to: string, body: string, config: any) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.twilio_sid}/Messages.json`;
  const auth = btoa(`${config.twilio_sid}:${config.twilio_auth}`);
  const params = new URLSearchParams();
  if (config.messaging_service_sid) {
    params.append("MessagingServiceSid", config.messaging_service_sid);
  } else {
    params.append("From", config.twilio_phone);
  }
  params.append("To", to);
  params.append("Body", body);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const data = await res.json();
  return data.sid
    ? { success: true, sid: data.sid }
    : { success: false, error: data.message || "Failed" };
}

// ── PROCESS A SINGLE MESSAGE ──
async function processMessage(msg: any, supabase: any, config: any) {
  let result: any;

  if (msg.channel === "email") {
    result = await sendEmail(msg.lead_email, msg.subject, msg.body, config);
  } else if (msg.channel === "sms" && msg.lead_phone) {
    result = await sendSMS(msg.lead_phone, msg.body, config);
  } else {
    result = { success: false, error: `No phone number for ${msg.channel}` };
  }

  // Update status in database
  await supabase
    .from("message_queue")
    .update({
      status: result.success ? "sent" : "failed",
      sent_at: result.success ? new Date().toISOString() : null,
      error: result.error || null,
      external_id: result.id || result.sid || null,
    })
    .eq("id", msg.id);

  return result;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Config from environment variables
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
    try {
      body = await req.json();
    } catch {
      // No body = cron/queue processing mode
    }

    const action = body.action || "process_queue";

    // ── ACTION: Send a single message immediately ──
    if (action === "send_message") {
      const { channel, to_email, to_phone, subject, html_body, text_body, lead_name, sequence, step_index, attachments } = body;

      // Insert into message_queue
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

      const { data: inserted, error: insertErr } = await supabase
        .from("message_queue")
        .insert([msgData])
        .select();

      if (insertErr) {
        return new Response(JSON.stringify({ success: false, error: insertErr.message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      const msg = inserted[0];
      let result: any;

      if (channel === "email") {
        result = await sendEmail(to_email, subject || "", html_body || "", config, attachments);
      } else if (channel === "sms" && to_phone) {
        result = await sendSMS(to_phone, text_body || "", config);
      } else {
        result = { success: false, error: "Invalid channel or missing recipient" };
      }

      // Update status
      await supabase
        .from("message_queue")
        .update({
          status: result.success ? "sent" : "failed",
          sent_at: result.success ? new Date().toISOString() : null,
          error: result.error || null,
          external_id: result.id || result.sid || null,
        })
        .eq("id", msg.id);

      return new Response(JSON.stringify({ success: result.success, id: msg.id, error: result.error }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: Queue messages (insert only, send immediates) ──
    if (action === "queue_messages") {
      const { messages } = body;
      if (!messages || messages.length === 0) {
        return new Response(JSON.stringify({ success: true, queued: 0, sent: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: inserted, error: insertErr } = await supabase
        .from("message_queue")
        .insert(messages)
        .select();

      if (insertErr) {
        return new Response(JSON.stringify({ success: false, error: insertErr.message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      // Process immediate messages (status === 'sending')
      let sent = 0;
      for (const msg of inserted || []) {
        if (msg.status === "sending") {
          await processMessage(msg, supabase, config);
          sent++;
          // Small delay between messages
          await new Promise((r) => setTimeout(r, 300));
        }
      }

      return new Response(
        JSON.stringify({ success: true, queued: (inserted || []).length, sent }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── ACTION: Process queue (send pending messages that are due) ──
    if (action === "process_queue") {
      const now = new Date().toISOString();
      const { data: messages, error: fetchErr } = await supabase
        .from("message_queue")
        .select("*")
        .eq("status", "queued")
        .lte("send_at", now)
        .order("send_at", { ascending: true })
        .limit(20);

      if (fetchErr) {
        return new Response(JSON.stringify({ success: false, error: fetchErr.message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      let processed = 0;
      for (const msg of messages || []) {
        await processMessage(msg, supabase, config);
        processed++;
        await new Promise((r) => setTimeout(r, 300));
      }

      return new Response(
        JSON.stringify({ success: true, processed }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: (err as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

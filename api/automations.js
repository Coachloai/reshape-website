/* ══════════════════════════════════════
   ReShape — Nurture Automation Engine
   Email (Resend) + SMS (Twilio) + WhatsApp (Twilio)
══════════════════════════════════════ */

// Config loaded from api/config.js (not committed to git)
var AUTOMATION_CONFIG = window.__AUTOMATION_CONFIG || {
  resend_key: '',
  twilio_sid: '',
  twilio_auth: '',
  twilio_phone: '',
  from_email: 'coach@reshape.fit',
  from_name: 'Coach Jaime | ReShape',
  fallback_email: 'onboarding@resend.dev',
  booking_url: 'https://reshape.fit/#apply',
};

/* ── VERIFY PHONE via Twilio Lookup ── */
async function verifyPhone(phone) {
  try {
    var cleaned = phone.replace(/\s/g, '');
    var url = 'https://lookups.twilio.com/v2/PhoneNumbers/' + encodeURIComponent(cleaned);
    var auth = btoa(AUTOMATION_CONFIG.twilio_sid + ':' + AUTOMATION_CONFIG.twilio_auth);
    var res = await fetch(url, {
      headers: { 'Authorization': 'Basic ' + auth }
    });
    var data = await res.json();
    if (data.valid === true) return { valid: true };
    if (data.valid === false) return { valid: false, error: 'This phone number is not valid' };
    if (data.status === 404 || data.code) return { valid: false, error: 'Phone number not recognised' };
    return { valid: true }; // If API doesn't return valid field, assume ok
  } catch (e) { return { valid: true }; } // On error, don't block the user
}

/* ── VERIFY EMAIL DOMAIN (MX record check) ── */
async function verifyEmail(email) {
  try {
    var domain = email.split('@')[1];
    if (!domain) return { valid: false, error: 'Invalid email format' };
    // Use a free DNS lookup API to check MX records
    var res = await fetch('https://dns.google/resolve?name=' + domain + '&type=MX');
    var data = await res.json();
    if (data.Answer && data.Answer.length > 0) return { valid: true };
    if (data.Status === 3 || !data.Answer) return { valid: false, error: 'Email domain does not exist' };
    return { valid: true };
  } catch (e) { return { valid: true }; } // On error, don't block
}

/* ── SEND EMAIL via Resend ── */
async function sendEmail(to, subject, htmlBody) {
  try {
    var res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + AUTOMATION_CONFIG.resend_key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: AUTOMATION_CONFIG.from_name + ' <' + AUTOMATION_CONFIG.from_email + '>',
        to: [to],
        subject: subject,
        html: htmlBody
      })
    });
    var data = await res.json();
    if (data.id) return { success: true, id: data.id };
    // Fallback to resend.dev domain if domain not verified
    if (data.statusCode === 403 || (data.message && data.message.includes('domain'))) {
      var res2 = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + AUTOMATION_CONFIG.resend_key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: AUTOMATION_CONFIG.from_name + ' <' + AUTOMATION_CONFIG.fallback_email + '>',
          to: [to], subject: subject, html: htmlBody
        })
      });
      var data2 = await res2.json();
      return data2.id ? { success: true, id: data2.id } : { success: false, error: data2.message };
    }
    return { success: false, error: data.message || 'Unknown error' };
  } catch (e) { return { success: false, error: e.message }; }
}

/* ── SEND SMS via Twilio Messaging Service ── */
async function sendSMS(to, body) {
  try {
    var url = 'https://api.twilio.com/2010-04-01/Accounts/' + AUTOMATION_CONFIG.twilio_sid + '/Messages.json';
    var auth = btoa(AUTOMATION_CONFIG.twilio_sid + ':' + AUTOMATION_CONFIG.twilio_auth);
    var params = new URLSearchParams();
    if (AUTOMATION_CONFIG.messaging_service_sid) {
      params.append('MessagingServiceSid', AUTOMATION_CONFIG.messaging_service_sid);
    } else {
      params.append('From', AUTOMATION_CONFIG.twilio_phone);
    }
    params.append('To', to);
    params.append('Body', body);
    var res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    var data = await res.json();
    return data.sid ? { success: true, sid: data.sid } : { success: false, error: data.message || 'Failed' };
  } catch (e) { return { success: false, error: e.message }; }
}

/* ── SEND WHATSAPP via Twilio Sandbox ── */
async function sendWhatsApp(to, body) {
  try {
    var url = 'https://api.twilio.com/2010-04-01/Accounts/' + AUTOMATION_CONFIG.twilio_sid + '/Messages.json';
    var auth = btoa(AUTOMATION_CONFIG.twilio_sid + ':' + AUTOMATION_CONFIG.twilio_auth);
    var whatsappFrom = AUTOMATION_CONFIG.twilio_whatsapp || AUTOMATION_CONFIG.twilio_phone;
    var params = new URLSearchParams();
    params.append('From', 'whatsapp:' + whatsappFrom);
    params.append('To', 'whatsapp:' + to);
    params.append('Body', body);
    var res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    var data = await res.json();
    return data.sid ? { success: true, sid: data.sid } : { success: false, error: data.message || 'Failed' };
  } catch (e) { return { success: false, error: e.message }; }
}

/* ══════════════════════════════════════
   EMAIL TEMPLATES
══════════════════════════════════════ */
function emailTemplate(title, body, ctaText, ctaUrl) {
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;padding:0;background:#0B0B0B;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">' +
    '<div style="max-width:560px;margin:0 auto;padding:40px 24px">' +
    '<div style="text-align:center;margin-bottom:32px"><span style="font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px">Re<span style="color:#ED5C25">Shape</span></span></div>' +
    '<div style="background:#111213;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px 28px">' +
    '<h1 style="font-size:22px;font-weight:800;color:#fff;margin:0 0 16px;line-height:1.3">' + title + '</h1>' +
    '<div style="font-size:15px;color:rgba(255,255,255,0.7);line-height:1.7;margin-bottom:28px">' + body + '</div>' +
    (ctaText ? '<a href="' + ctaUrl + '" style="display:inline-block;background:#ED5C25;color:#fff;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:700;text-decoration:none">' + ctaText + '</a>' : '') +
    '</div>' +
    '<div style="text-align:center;margin-top:24px;font-size:12px;color:rgba(255,255,255,0.3)">ReShape Body Transformation &middot; Ipswich &amp; Colchester</div>' +
    '</div></body></html>';
}

/* ══════════════════════════════════════
   NURTURE SEQUENCES
══════════════════════════════════════ */
var SEQUENCES = {
  // After form submission (no booking)
  form_submitted: [
    { delay: 0,        channel: 'email',    subject: 'Application received \u2014 here\'s what happens next',
      body: function(lead) { return emailTemplate(
        'Hey ' + lead.first_name + ', we got your application! \uD83D\uDC4A',
        '<p>Thanks for applying to ReShape. We\'re reviewing your details now.</p><p>In the meantime, why not book your in-person visit? Spots fill up fast.</p>',
        'Book Your Visit', AUTOMATION_CONFIG.booking_url
      ); }
    },
    { delay: 0,        channel: 'whatsapp',
      body: function(lead) { return 'Hey ' + lead.first_name + '! \uD83D\uDC4A This is Jaime from ReShape. We\'ve received your application \u2014 thanks for taking the first step!\n\nWe\'ll review your details and get back to you within 24 hours.\n\nIn the meantime, book your visit here: ' + AUTOMATION_CONFIG.booking_url; }
    },
    { delay: 3600,     channel: 'sms',
      body: function(lead) { return 'Hey ' + lead.first_name + ', it\'s Jaime from ReShape. We got your application! Book your in-person visit before spots fill up: ' + AUTOMATION_CONFIG.booking_url; }
    },
    { delay: 86400,    channel: 'email',    subject: 'People like you are getting results',
      body: function(lead) { return emailTemplate(
        lead.first_name + ', people just like you are transforming',
        '<p>Since you applied, 3 more people have started their journey with us.</p><p>Our members lose an average of 8\u201312kg in 12 weeks. And if they don\'t? We coach them for free until they do.</p><p>Don\'t let this opportunity pass \u2014 book your visit now.</p>',
        'Book Your Visit', AUTOMATION_CONFIG.booking_url
      ); }
    },
    { delay: 259200,   channel: 'whatsapp',
      body: function(lead) { return 'Hi ' + lead.first_name + ' \uD83D\uDC4B Just checking in! Have you had a chance to book your visit yet?\n\nWe\'d love to show you around and discuss your goals in person.\n\nBook here: ' + AUTOMATION_CONFIG.booking_url; }
    },
    { delay: 604800,   channel: 'email',    subject: 'Last chance \u2014 your spot won\'t wait forever',
      body: function(lead) { return emailTemplate(
        lead.first_name + ', your spot is still open \u2014 but not for long',
        '<p>It\'s been a week since you applied. We\'d love to help you start your transformation, but we can only hold spots for so long.</p><p>This is your final reminder \u2014 book your visit and let\'s make it happen.</p>',
        'Book Now', AUTOMATION_CONFIG.booking_url
      ); }
    },
  ],

  // After booking confirmed
  booking_confirmed: [
    { delay: 0,        channel: 'email',    subject: 'You\'re booked! \uD83C\uDF89 See you soon',
      body: function(lead, booking) { return emailTemplate(
        'You\'re booked, ' + lead.first_name + '! \uD83C\uDF89',
        '<p>We can\'t wait to meet you. Here are your visit details:</p>' +
        '<div style="background:rgba(237,92,37,0.08);border:1px solid rgba(237,92,37,0.2);border-radius:12px;padding:16px 20px;margin:16px 0">' +
        '<p style="margin:4px 0"><strong>Date:</strong> ' + (booking.date || '') + '</p>' +
        '<p style="margin:4px 0"><strong>Time:</strong> ' + (booking.time || '') + '</p>' +
        '<p style="margin:4px 0"><strong>Location:</strong> ' + (booking.location || '') + '</p></div>' +
        '<p>Wear something comfortable. We\'ll handle the rest.</p>',
        '', ''
      ); }
    },
    { delay: 0,        channel: 'whatsapp',
      body: function(lead, booking) { return 'You\'re booked! \uD83C\uDF89\n\n\uD83D\uDCC5 ' + (booking.date || '') + '\n\u23F0 ' + (booking.time || '') + '\n\uD83D\uDCCD ' + (booking.location || '') + '\n\nWear something comfortable \u2014 we\'ll handle the rest. See you there, ' + lead.first_name + '!'; }
    },
    { delay: -86400,   channel: 'sms',      is_reminder: true,
      body: function(lead, booking) { return 'Hey ' + lead.first_name + '! Quick reminder: your ReShape visit is TOMORROW at ' + (booking.time || '') + ' at ' + (booking.location || '') + '. See you there! \uD83D\uDCAA'; }
    },
    { delay: -7200,    channel: 'whatsapp', is_reminder: true,
      body: function(lead, booking) { return 'Hey ' + lead.first_name + '! \uD83D\uDC4B Your ReShape visit is in 2 hours at ' + (booking.location || '') + '. Can\'t wait to meet you! \uD83D\uDCAA'; }
    },
  ],
};

/* ══════════════════════════════════════
   QUEUE MANAGER
══════════════════════════════════════ */

// Queue a full nurture sequence for a lead
async function queueSequence(sequenceName, lead, booking, supabaseClient) {
  var seq = SEQUENCES[sequenceName];
  if (!seq) return;
  var now = Date.now();
  var messages = [];

  for (var i = 0; i < seq.length; i++) {
    var step = seq[i];
    var sendAt;
    if (step.is_reminder && booking && booking.datetime) {
      // Reminders: schedule relative to booking time (negative delay = before)
      sendAt = new Date(new Date(booking.datetime).getTime() + (step.delay * 1000)).toISOString();
    } else {
      sendAt = new Date(now + (step.delay * 1000)).toISOString();
    }

    var msgBody = typeof step.body === 'function' ? step.body(lead, booking || {}) : step.body;
    var subject = typeof step.subject === 'function' ? step.subject(lead) : (step.subject || '');

    messages.push({
      lead_email: lead.email,
      lead_phone: lead.phone || null,
      lead_name: lead.first_name + ' ' + (lead.last_name || ''),
      sequence: sequenceName,
      step_index: i,
      channel: step.channel,
      subject: subject,
      body: msgBody,
      send_at: sendAt,
      status: step.delay === 0 ? 'sending' : 'queued',
    });
  }

  // Insert all messages into queue and get IDs back
  if (supabaseClient && messages.length > 0) {
    var insertRes = await supabaseClient.from('message_queue').insert(messages).select();
    var inserted = (insertRes.data || []);
    // Send immediate messages (delay === 0)
    for (var j = 0; j < inserted.length; j++) {
      if (inserted[j].status === 'sending') {
        await processMessage(inserted[j], supabaseClient);
      }
    }
  }
}

// Process a single message from the queue
async function processMessage(msg, supabaseClient) {
  var result;
  if (msg.channel === 'email') {
    result = await sendEmail(msg.lead_email, msg.subject, msg.body);
  } else if (msg.channel === 'sms' && msg.lead_phone) {
    result = await sendSMS(msg.lead_phone, msg.body);
  } else if (msg.channel === 'whatsapp' && msg.lead_phone) {
    result = await sendWhatsApp(msg.lead_phone, msg.body);
  } else {
    result = { success: false, error: 'No phone number for ' + msg.channel };
  }

  // Update status in database
  if (supabaseClient && msg.id) {
    await supabaseClient.from('message_queue').update({
      status: result.success ? 'sent' : 'failed',
      sent_at: result.success ? new Date().toISOString() : null,
      error: result.error || null,
      external_id: result.id || result.sid || null
    }).eq('id', msg.id);
  }

  return result;
}

// Process all pending messages that are due
async function processQueue(supabaseClient) {
  var now = new Date().toISOString();
  var res = await supabaseClient.from('message_queue')
    .select('*')
    .eq('status', 'queued')
    .lte('send_at', now)
    .order('send_at', { ascending: true })
    .limit(20);

  var messages = res.data || [];
  var processed = 0;

  for (var i = 0; i < messages.length; i++) {
    await processMessage(messages[i], supabaseClient);
    processed++;
    // Small delay between messages to avoid rate limits
    await new Promise(function(r) { setTimeout(r, 500); });
  }

  return processed;
}

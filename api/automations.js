/* ══════════════════════════════════════
   ReShape — Nurture Automation Engine
   Email (Resend) + SMS (Twilio)
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

/* ── VERIFY PHONE (format + auto-convert UK numbers) ── */
async function verifyPhone(phone, inputEl) {
  var cleaned = phone.replace(/[\s\-\(\)]/g, '');
  // Auto-convert UK local numbers to international format
  if (/^0[1-9]\d{8,10}$/.test(cleaned)) {
    cleaned = '+44' + cleaned.substring(1);
    // Update the input field with the converted number
    if (inputEl) inputEl.value = cleaned;
  }
  // Also handle 44 without the +
  if (/^44\d{10,11}$/.test(cleaned)) {
    cleaned = '+' + cleaned;
    if (inputEl) inputEl.value = cleaned;
  }
  if (!/^\+\d{10,15}$/.test(cleaned)) return { valid: false, error: 'Enter a valid phone number (e.g. 07700 000000 or +44 7700 000000)' };
  // Country-specific length validation
  var rules = {
    '+44': { min: 12, max: 13, label: 'UK' },
    '+1': { min: 11, max: 11, label: 'US/CA' },
    '+353': { min: 12, max: 13, label: 'Ireland' },
    '+61': { min: 11, max: 12, label: 'Australia' },
    '+91': { min: 12, max: 13, label: 'India' },
  };
  for (var prefix in rules) {
    if (cleaned.startsWith(prefix)) {
      var r = rules[prefix];
      if (cleaned.length < r.min || cleaned.length > r.max) {
        return { valid: false, error: r.label + ' numbers should be ' + r.min + '-' + r.max + ' digits' };
      }
      return { valid: true, cleaned: cleaned };
    }
  }
  if (cleaned.length < 10 || cleaned.length > 15) return { valid: false, error: 'Phone number length doesn\'t look right' };
  return { valid: true, cleaned: cleaned };
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
async function sendEmail(to, subject, htmlBody, attachments) {
  try {
    var payload = {
      from: AUTOMATION_CONFIG.from_name + ' <' + AUTOMATION_CONFIG.from_email + '>',
      to: [to],
      subject: subject,
      html: htmlBody
    };
    if (attachments && attachments.length > 0) payload.attachments = attachments;
    var res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + AUTOMATION_CONFIG.resend_key, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    var data = await res.json();
    if (data.id) return { success: true, id: data.id };
    // Fallback to resend.dev domain if domain not verified
    if (data.statusCode === 403 || (data.message && data.message.includes('domain'))) {
      var fallbackPayload = {
        from: AUTOMATION_CONFIG.from_name + ' <' + AUTOMATION_CONFIG.fallback_email + '>',
        to: [to], subject: subject, html: htmlBody
      };
      if (attachments && attachments.length > 0) fallbackPayload.attachments = attachments;
      var res2 = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + AUTOMATION_CONFIG.resend_key, 'Content-Type': 'application/json' },
        body: JSON.stringify(fallbackPayload)
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

/* ── GENERATE .ICS CALENDAR FILE ── */
function generateICS(booking, leadName) {
  var dt = new Date(booking.datetime);
  var endDt = new Date(dt.getTime() + 3600000); // 1 hour duration
  function icsDate(d) {
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }
  var location = booking.location === 'Ipswich' ? 'ReShape, Ipswich' : booking.location === 'Colchester' ? 'ReShape, Colchester' : 'ReShape, ' + (booking.location || '');
  return 'BEGIN:VCALENDAR\r\n' +
    'VERSION:2.0\r\n' +
    'PRODID:-//ReShape//Booking//EN\r\n' +
    'CALSCALE:GREGORIAN\r\n' +
    'METHOD:PUBLISH\r\n' +
    'BEGIN:VEVENT\r\n' +
    'DTSTART:' + icsDate(dt) + '\r\n' +
    'DTEND:' + icsDate(endDt) + '\r\n' +
    'SUMMARY:ReShape Visit\r\n' +
    'DESCRIPTION:Your in-person visit with Coach Jaime at ReShape. Wear something comfortable!\r\n' +
    'LOCATION:' + location + '\r\n' +
    'STATUS:CONFIRMED\r\n' +
    'UID:reshape-' + dt.getTime() + '@reshape.fit\r\n' +
    'END:VEVENT\r\n' +
    'END:VCALENDAR';
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
    { delay: 259200,   channel: 'sms',
      body: function(lead) { return 'Hi ' + lead.first_name + ', just checking in! Have you had a chance to book your ReShape visit yet? We\'d love to show you around: ' + AUTOMATION_CONFIG.booking_url; }
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
      attach_ics: true,
      body: function(lead, booking) { return emailTemplate(
        'You\'re booked, ' + lead.first_name + '! \uD83C\uDF89',
        '<p>We can\'t wait to meet you. Here are your visit details:</p>' +
        '<div style="background:rgba(237,92,37,0.08);border:1px solid rgba(237,92,37,0.2);border-radius:12px;padding:16px 20px;margin:16px 0">' +
        '<p style="margin:4px 0"><strong>Date:</strong> ' + (booking.date || '') + '</p>' +
        '<p style="margin:4px 0"><strong>Time:</strong> ' + (booking.time || '') + '</p>' +
        '<p style="margin:4px 0"><strong>Location:</strong> ' + (booking.location || '') + '</p></div>' +
        '<p>Wear something comfortable. We\'ll handle the rest.</p>' +
        '<p style="margin-top:16px;font-size:14px;color:rgba(255,255,255,0.5)">A calendar invite (.ics) is attached to this email.</p>',
        '', ''
      ); }
    },
    { delay: 0,        channel: 'sms',
      body: function(lead, booking) { return 'You\'re booked, ' + lead.first_name + '! ' + (booking.date || '') + ' at ' + (booking.time || '') + ', ' + (booking.location || '') + '. Wear something comfortable - see you there!'; }
    },
    { delay: -86400,   channel: 'sms',      is_reminder: true,
      body: function(lead, booking) { return 'Hey ' + lead.first_name + '! Quick reminder: your ReShape visit is TOMORROW at ' + (booking.time || '') + ' at ' + (booking.location || '') + '. See you there! \uD83D\uDCAA'; }
    },
    { delay: -7200,    channel: 'email',    is_reminder: true, subject: 'Your ReShape visit is in 2 hours!',
      body: function(lead, booking) { return emailTemplate(
        'See you in 2 hours, ' + lead.first_name + '! \uD83D\uDCAA',
        '<p>Your ReShape visit is coming up at <strong>' + (booking.time || '') + '</strong> at <strong>' + (booking.location || '') + '</strong>.</p><p>Wear something comfortable. We\'ll handle the rest. Can\'t wait to meet you!</p>',
        '', ''
      ); }
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
  var icsMap = {}; // Track which steps need .ics attachment

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

    // Generate .ics for booking confirmation emails
    if (step.attach_ics && booking && booking.datetime) {
      icsMap[i] = generateICS(booking, lead.first_name);
    }

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
        var icsContent = icsMap[inserted[j].step_index] || null;
        await processMessage(inserted[j], supabaseClient, icsContent);
      }
    }
  }
}

// Process a single message from the queue
async function processMessage(msg, supabaseClient, icsContent) {
  var result;
  if (msg.channel === 'email') {
    var attachments = null;
    if (icsContent) {
      attachments = [{ filename: 'reshape-visit.ics', content: btoa(icsContent) }];
    }
    result = await sendEmail(msg.lead_email, msg.subject, msg.body, attachments);
  } else if (msg.channel === 'sms' && msg.lead_phone) {
    result = await sendSMS(msg.lead_phone, msg.body);
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

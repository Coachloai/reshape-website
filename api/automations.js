/* ══════════════════════════════════════
   ReShape — Nurture Automation Engine
   Email (Resend) + SMS (Twilio) via Edge Function
══════════════════════════════════════ */

// Config loaded from api/config.js
var AUTOMATION_CONFIG = window.__AUTOMATION_CONFIG || {
  coach_email: 'coach@reshape.fit',
  google_calendar_id: '',
  google_client_id: '',
  google_client_secret: '',
  google_refresh_token: '',
  from_email: 'coach@reshape.fit',
  from_name: 'Coach Jaime | ReShape',
  booking_url: 'https://reshape.fit/#apply',
};

// Edge Function URL (Supabase)
var EDGE_FUNCTION_URL = 'https://lvizldmdficsfpgegehp.supabase.co/functions/v1/process-queue';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2aXpsZG1kZmljc2ZwZ2VnZWhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2OTk4NDQsImV4cCI6MjA4OTI3NTg0NH0.72wHbZaTvqNzW6DTb6Ae1vi9QpOg_-KiEO-Jjm9mn0k';

/* ── Call Edge Function ── */
async function callEdgeFunction(body) {
  try {
    var res = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body)
    });
    return await res.json();
  } catch (e) {
    console.error('Edge function error:', e.message);
    return { success: false, error: e.message };
  }
}

/* ── VERIFY PHONE (format + auto-convert UK numbers) ── */
async function verifyPhone(phone, inputEl) {
  var cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (/^0[1-9]\d{8,10}$/.test(cleaned)) {
    cleaned = '+44' + cleaned.substring(1);
    if (inputEl) inputEl.value = cleaned;
  }
  if (/^44\d{10,11}$/.test(cleaned)) {
    cleaned = '+' + cleaned;
    if (inputEl) inputEl.value = cleaned;
  }
  if (!/^\+\d{10,15}$/.test(cleaned)) return { valid: false, error: 'Enter a valid phone number (e.g. 07700 000000 or +44 7700 000000)' };
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
    var res = await fetch('https://dns.google/resolve?name=' + domain + '&type=MX');
    var data = await res.json();
    if (data.Answer && data.Answer.length > 0) return { valid: true };
    if (data.Status === 3 || !data.Answer) return { valid: false, error: 'Email domain does not exist' };
    return { valid: true };
  } catch (e) { return { valid: true }; }
}

/* ── GENERATE .ICS CALENDAR FILE ── */
function generateICS(booking, leadName, opts) {
  var o = opts || {};
  var dt = new Date(booking.datetime);
  var dur = (parseInt((JSON.parse(localStorage.getItem('gcal_settings') || '{}').duration) || '60')) * 60000;
  var endDt = new Date(dt.getTime() + dur);
  function icsDate(d) {
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }
  var location = booking.location === 'Ipswich' ? 'ReShape, Ipswich' : booking.location === 'Colchester' ? 'ReShape, Colchester' : 'ReShape, ' + (booking.location || '');
  var isCoach = o.forCoach;
  var summary = isCoach ? 'Visit: ' + (leadName || 'New Lead') : 'ReShape Visit';
  var description = isCoach
    ? 'Booking visit with ' + (leadName || 'Lead') + (o.leadEmail ? ' (' + o.leadEmail + ')' : '') + (o.leadPhone ? ' | Phone: ' + o.leadPhone : '')
    : 'Your in-person visit with Coach Jaime at ReShape. Wear something comfortable!';
  return 'BEGIN:VCALENDAR\r\n' +
    'VERSION:2.0\r\n' +
    'PRODID:-//ReShape//Booking//EN\r\n' +
    'CALSCALE:GREGORIAN\r\n' +
    'METHOD:' + (isCoach ? 'REQUEST' : 'PUBLISH') + '\r\n' +
    'BEGIN:VEVENT\r\n' +
    'DTSTART:' + icsDate(dt) + '\r\n' +
    'DTEND:' + icsDate(endDt) + '\r\n' +
    'SUMMARY:' + summary + '\r\n' +
    'DESCRIPTION:' + description + '\r\n' +
    'LOCATION:' + location + '\r\n' +
    'STATUS:CONFIRMED\r\n' +
    'UID:reshape-' + dt.getTime() + '-' + (isCoach ? 'coach' : 'lead') + '@reshape.fit\r\n' +
    (isCoach && AUTOMATION_CONFIG.from_email ? 'ORGANIZER:mailto:' + AUTOMATION_CONFIG.from_email + '\r\n' : '') +
    'END:VEVENT\r\n' +
    'END:VCALENDAR';
}

/* ── GOOGLE CALENDAR — GET ACCESS TOKEN ── */
async function getGoogleAccessToken() {
  var res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: AUTOMATION_CONFIG.google_client_id,
      client_secret: AUTOMATION_CONFIG.google_client_secret,
      refresh_token: AUTOMATION_CONFIG.google_refresh_token,
      grant_type: 'refresh_token'
    }).toString()
  });
  var data = await res.json();
  return data.access_token || null;
}

/* ── GOOGLE CALENDAR — CREATE EVENT ── */
async function addToGoogleCalendar(lead, booking, durationMins) {
  var token = await getGoogleAccessToken();
  if (!token) return { success: false, error: 'No access token' };
  var calendarId = AUTOMATION_CONFIG.google_calendar_id || 'primary';
  var leadName = ((lead.first_name || '') + ' ' + (lead.last_name || '')).trim();
  var dt = new Date(booking.datetime);
  var dur = (durationMins || parseInt((JSON.parse(localStorage.getItem('gcal_settings') || '{}').duration) || '60')) * 60000;
  var endDt = new Date(dt.getTime() + dur);
  var location = booking.location === 'Ipswich' ? 'ReShape, Ipswich' : booking.location === 'Colchester' ? 'ReShape, Colchester' : 'ReShape, ' + (booking.location || '');
  var event = {
    summary: 'Visit: ' + (leadName || 'New Lead'),
    description: 'Booking visit with ' + leadName +
      '\nEmail: ' + (lead.email || '') +
      '\nPhone: ' + (lead.phone || '') +
      '\nLocation: ' + (booking.location || ''),
    location: location,
    start: { dateTime: dt.toISOString(), timeZone: 'Europe/London' },
    end: { dateTime: endDt.toISOString(), timeZone: 'Europe/London' },
    reminders: { useDefault: false, overrides: [
      { method: 'popup', minutes: 60 },
      { method: 'popup', minutes: 15 }
    ]}
  };
  var res = await fetch('https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(calendarId) + '/events', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(event)
  });
  var data = await res.json();
  return data.id ? { success: true, id: data.id } : { success: false, error: data.error ? data.error.message : 'Unknown error' };
}

/* ── SEND COACH CALENDAR INVITE ── */
async function sendCoachCalendarInvite(lead, booking) {
  if (!booking || !booking.datetime) return;

  // Try Google Calendar API first (from dashboard localStorage)
  var gcalSettings = JSON.parse(localStorage.getItem('gcal_settings') || '{}');
  var clientId = AUTOMATION_CONFIG.google_client_id || gcalSettings.client_id;
  var refreshToken = AUTOMATION_CONFIG.google_refresh_token || gcalSettings.refresh_token;

  if (clientId && refreshToken) {
    AUTOMATION_CONFIG.google_client_id = clientId;
    AUTOMATION_CONFIG.google_client_secret = AUTOMATION_CONFIG.google_client_secret || gcalSettings.client_secret;
    AUTOMATION_CONFIG.google_refresh_token = refreshToken;
    AUTOMATION_CONFIG.google_calendar_id = AUTOMATION_CONFIG.google_calendar_id || gcalSettings.calendar_id || 'primary';
    try {
      var gcResult = await addToGoogleCalendar(lead, booking);
      if (gcResult.success) {
        console.log('Google Calendar event created:', gcResult.id);
        return;
      }
      console.warn('Google Calendar failed, falling back to email:', gcResult.error);
    } catch (e) {
      console.warn('Google Calendar error, falling back to email:', e.message);
    }
  }

  // Fallback: send .ics email invite via Edge Function
  var coachEmail = AUTOMATION_CONFIG.coach_email || AUTOMATION_CONFIG.from_email;
  var leadName = ((lead.first_name || '') + ' ' + (lead.last_name || '')).trim();
  var icsContent = generateICS(booking, leadName, {
    forCoach: true,
    leadEmail: lead.email,
    leadPhone: lead.phone
  });
  var htmlBody = emailTemplate(
    'New Booking: ' + leadName,
    '<p>A new visit has been booked:</p>' +
    '<div style="background:rgba(237,92,37,0.08);border:1px solid rgba(237,92,37,0.2);border-radius:12px;padding:16px 20px;margin:16px 0">' +
    '<p style="margin:4px 0"><strong>Name:</strong> ' + leadName + '</p>' +
    '<p style="margin:4px 0"><strong>Email:</strong> ' + (lead.email || '') + '</p>' +
    '<p style="margin:4px 0"><strong>Phone:</strong> ' + (lead.phone || '') + '</p>' +
    '<p style="margin:4px 0"><strong>Date:</strong> ' + (booking.date || '') + '</p>' +
    '<p style="margin:4px 0"><strong>Time:</strong> ' + (booking.time || '') + '</p>' +
    '<p style="margin:4px 0"><strong>Location:</strong> ' + (booking.location || '') + '</p></div>' +
    '<p style="font-size:14px;color:rgba(255,255,255,0.5)">This event has been added to your calendar automatically.</p>',
    '', ''
  );
  await callEdgeFunction({
    action: 'send_message',
    channel: 'email',
    to_email: coachEmail,
    subject: 'New Booking: ' + leadName + ' \u2014 ' + (booking.date || ''),
    html_body: htmlBody,
    lead_name: 'Coach Notification',
    sequence: 'coach_notify',
    attachments: [{ filename: 'invite.ics', content: btoa(icsContent) }]
  });
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
   QUEUE MANAGER — via Edge Function
══════════════════════════════════════ */

// Queue a full nurture sequence — sends all messages to Edge Function for processing
async function queueSequence(sequenceName, lead, booking, supabaseClient) {
  var seq = SEQUENCES[sequenceName];
  if (!seq) return;
  var now = Date.now();
  var messages = [];

  for (var i = 0; i < seq.length; i++) {
    var step = seq[i];
    var sendAt;
    if (step.is_reminder && booking && booking.datetime) {
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

  // Send all messages to Edge Function — it handles DB insert + immediate sending
  if (messages.length > 0) {
    var result = await callEdgeFunction({ action: 'queue_messages', messages: messages });
    console.log('Queue result:', result);
  }

  // Send coach calendar invite for new bookings
  if (sequenceName === 'booking_confirmed' && booking && booking.datetime) {
    sendCoachCalendarInvite(lead, booking);
  }
}

// Process pending messages via Edge Function (called from dashboard)
async function processQueue() {
  var result = await callEdgeFunction({ action: 'process_queue' });
  return result.processed || 0;
}

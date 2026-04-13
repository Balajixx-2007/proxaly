/**
 * Agent Email: Send emails via Brevo (Phase 2)
 */

const axios = require('axios');
const nodemailer = require('nodemailer');
const { supabase } = require('../services/supabase');
const { captureException } = require('../services/monitoring');

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_API_URL = 'https://api.brevo.com/v3';
const BREVO_SMTP_KEY = process.env.BREVO_SMTP_KEY;
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_FROM;
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'Proxaly Marketing Agent';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

function isGmailSender(email) {
  return typeof email === 'string' && email.toLowerCase().endsWith('@gmail.com');
}

async function sendViaGmailSMTP({ email, leadName, subjectLine, emailBody }) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: BREVO_SENDER_EMAIL,
      pass: GMAIL_APP_PASSWORD,
    },
    connectionTimeout: 10000,
    socketTimeout: 10000,
  });

  await transporter.verify();

  const info = await transporter.sendMail({
    from: `${BREVO_SENDER_NAME} <${BREVO_SENDER_EMAIL}>`,
    to: `${leadName || ''} <${email}>`,
    replyTo: BREVO_SENDER_EMAIL,
    subject: subjectLine,
    text: emailBody,
    html: `<p>${emailBody.replace(/\n/g, '<br>')}</p>`,
  });

  return { messageId: info.messageId, provider: 'gmail-smtp' };
}

async function sendViaBrevoSMTP({ email, leadName, subjectLine, emailBody }) {
  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: {
      user: BREVO_SENDER_EMAIL,
      pass: BREVO_SMTP_KEY,
    },
    connectionTimeout: 10000,
    socketTimeout: 10000,
  });

  await transporter.verify();

  const info = await transporter.sendMail({
    from: `${BREVO_SENDER_NAME} <${BREVO_SENDER_EMAIL}>`,
    to: `${leadName || ''} <${email}>`,
    replyTo: BREVO_SENDER_EMAIL,
    subject: subjectLine,
    text: emailBody,
    html: `<p>${emailBody.replace(/\n/g, '<br>')}</p>`,
  });

  return { messageId: info.messageId, provider: 'brevo-smtp' };
}

async function sendViaBrevoAPI({ email, leadName, subjectLine, emailBody }) {
  const payload = {
    sender: {
      name: BREVO_SENDER_NAME,
      email: BREVO_SENDER_EMAIL,
    },
    to: [{ email, name: leadName }],
    subject: subjectLine,
    htmlContent: `<p>${emailBody.replace(/\n/g, '<br>')}</p>`,
    textContent: emailBody,
    replyTo: { email: BREVO_SENDER_EMAIL },
  };

  const response = await axios.post(
    `${BREVO_API_URL}/smtp/email`,
    payload,
    {
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    }
  );

  return { messageId: response.data?.messageId, provider: 'brevo-api' };
}

async function initialize() {
  if (!BREVO_SENDER_EMAIL) {
    console.warn('[Email] Warning: BREVO_SENDER_EMAIL/EMAIL_FROM not set');
  }
  if (!BREVO_API_KEY && !BREVO_SMTP_KEY && !GMAIL_APP_PASSWORD) {
    console.warn('[Email] Warning: No email provider credential configured');
  }
  console.log('[Email] Email service initialized');
}

async function isReady() {
  return !!(BREVO_SENDER_EMAIL && (GMAIL_APP_PASSWORD || BREVO_SMTP_KEY || BREVO_API_KEY));
}

async function send(lead, emailTemplate = {}) {
  try {
    if (!BREVO_SENDER_EMAIL) {
      throw new Error('Sender email not configured (BREVO_SENDER_EMAIL or EMAIL_FROM)');
    }

    const {
      id: leadId,
      email,
      lead_name: leadName,
      company,
    } = lead;

    const subjectLine = emailTemplate.subject || `Opportunity for ${company || 'your business'}`;
    const emailBody = emailTemplate.body || `Hi ${leadName || 'there'},\n\nWe have a potential opportunity...`;

    let sendResult;
    const gmailSender = isGmailSender(BREVO_SENDER_EMAIL);

    if (gmailSender) {
      if (!GMAIL_APP_PASSWORD) {
        throw new Error('Gmail sender is configured but GMAIL_APP_PASSWORD is missing. Blocking spam-prone Brevo routing.');
      }
      sendResult = await sendViaGmailSMTP({ email, leadName, subjectLine, emailBody });
    } else if (BREVO_SMTP_KEY) {
      sendResult = await sendViaBrevoSMTP({ email, leadName, subjectLine, emailBody });
    } else if (BREVO_API_KEY) {
      sendResult = await sendViaBrevoAPI({ email, leadName, subjectLine, emailBody });
    } else {
      throw new Error('No valid email provider credentials configured');
    }

    const messageId = sendResult.messageId;

    // Record in database
    await supabase
      .from('agent_leads')
      .update({
        status: 'sent',
        sent_at: new Date(),
        brevo_message_id: messageId,
        email_subject: subjectLine,
        email_body_preview: emailBody.substring(0, 100),
      })
      .eq('id', leadId);

    await supabase.from('agent_logs').insert({
      event_type: 'email_sent',
      agent_lead_id: leadId,
      message: `Email sent to ${email}`,
      metadata: { messageId, subject: subjectLine, provider: sendResult.provider },
    });

    console.log(`[Email] Email sent to ${email} (msg: ${messageId}, provider: ${sendResult.provider})`);
    return { success: true, messageId, provider: sendResult.provider };

  } catch (err) {
    console.error('[Email] Send failed:', err);
    captureException(err, { context: 'email_send', leadEmail: lead.email });

    // Log failure
    await supabase
      .from('agent_leads')
      .update({
        status: 'failed',
        failed_at: new Date(),
        failure_reason: err.message,
        failure_attempt_count: (((await supabase.from('agent_leads').select('failure_attempt_count').eq('id', lead.id)).data?.[0]?.failure_attempt_count) || 0) + 1,
      })
      .eq('id', lead.id);

    throw err;
  }
}

async function getDeliveryStatus(messageId) {
  try {
    if (!BREVO_API_KEY) return null;

    const response = await axios.get(
      `${BREVO_API_URL}/smtp/statistics`,
      {
        headers: { 'api-key': BREVO_API_KEY },
        params: { messageId },
      }
    );

    return response.data;
  } catch (err) {
    console.error('[Email] Get status failed:', err);
    return null;
  }
}

module.exports = { initialize, isReady, send, getDeliveryStatus };

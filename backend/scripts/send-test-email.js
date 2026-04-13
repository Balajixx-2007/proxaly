#!/usr/bin/env node
/**
 * Send a test email to Balaji
 * Usage: node send-test-email.js
 */

require('dotenv').config();
const axios = require('axios');
const nodemailer = require('nodemailer');

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_API_URL = 'https://api.brevo.com/v3';
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL;
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'Proxaly Marketing Agent';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const BREVO_SMTP_KEY = process.env.BREVO_SMTP_KEY;

const RECIPIENT_EMAIL = 'bb6010757@gmail.com';
const RECIPIENT_NAME = 'Balaji';

function isGmailSender(email) {
  return typeof email === 'string' && email.toLowerCase().endsWith('@gmail.com');
}

function buildSubject() {
  const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
  return `Checking in ${stamp}`;
}

function buildTextBody() {
  return [
    `Hi ${RECIPIENT_NAME},`,
    '',
    'Just checking in with a quick test message.',
    'Please ignore this email.',
    '',
    `Sent at: ${new Date().toISOString()}`,
    '',
    'Thanks,',
    BREVO_SENDER_NAME,
  ].join('\n');
}

async function sendViaGmailSMTP(subject, textBody) {
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
    to: `${RECIPIENT_NAME} <${RECIPIENT_EMAIL}>`,
    subject,
    text: textBody,
  });

  return { messageId: info.messageId, provider: 'gmail-smtp' };
}

async function sendViaBrevoSMTP(subject, textBody) {
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
    to: `${RECIPIENT_NAME} <${RECIPIENT_EMAIL}>`,
    subject,
    text: textBody,
  });

  return { messageId: info.messageId, provider: 'brevo-smtp' };
}

async function sendViaBrevoAPI(subject, textBody) {
  const payload = {
    sender: {
      name: BREVO_SENDER_NAME,
      email: BREVO_SENDER_EMAIL,
    },
    to: [{
      email: RECIPIENT_EMAIL,
      name: RECIPIENT_NAME,
    }],
    subject,
    replyTo: { email: BREVO_SENDER_EMAIL },
    textContent: textBody,
  };

  const response = await axios.post(
    `${BREVO_API_URL}/smtp/email`,
    payload,
    {
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );

  return { messageId: response.data?.messageId, provider: 'brevo-api' };
}

async function sendTestEmail() {
  console.log('🚀 Sending test email to Balaji...');

  if (!BREVO_SENDER_EMAIL) {
    console.error('❌ Error: BREVO_SENDER_EMAIL environment variable is not set');
    process.exit(1);
  }

  const subject = buildSubject();
  const textBody = buildTextBody();

  console.log(`📧 Sender: ${BREVO_SENDER_EMAIL}`);
  console.log(`📮 Recipient: ${RECIPIENT_EMAIL} (${RECIPIENT_NAME})`);
  console.log(`📝 Subject: ${subject}\n`);

  try {
    let result;
    const gmailSender = isGmailSender(BREVO_SENDER_EMAIL);

    if (gmailSender && !GMAIL_APP_PASSWORD) {
      console.error('❌ Spam-risk config blocked: Gmail sender via Brevo routes is disabled.');
      console.error('Set GMAIL_APP_PASSWORD in backend/.env to send via Gmail SMTP.');
      process.exit(1);
    }

    if (GMAIL_APP_PASSWORD) {
      console.log('📤 Sending via Gmail SMTP (preferred)...');
      result = await sendViaGmailSMTP(subject, textBody);
    } else if (BREVO_SMTP_KEY) {
      console.log('📤 Sending via Brevo SMTP...');
      result = await sendViaBrevoSMTP(subject, textBody);
    } else if (BREVO_API_KEY) {
      console.log('📤 Sending via Brevo API...');
      result = await sendViaBrevoAPI(subject, textBody);
    } else {
      console.error('❌ No email provider credentials configured.');
      console.error('Set one of: GMAIL_APP_PASSWORD, BREVO_SMTP_KEY, or BREVO_API_KEY.');
      process.exit(1);
    }

    console.log('\n✅ Email sent successfully!');
    console.log(`📨 Message ID: ${result.messageId}`);
    console.log(`📡 Provider: ${result.provider}`);
    console.log(`📧 From: ${BREVO_SENDER_EMAIL}`);
    console.log(`📮 To: ${RECIPIENT_NAME} <${RECIPIENT_EMAIL}>`);
    console.log(`⏰ Sent at: ${new Date().toISOString()}`);

    if (result.provider === 'brevo-api') {
      console.log('⚠️ Provider is brevo-api with Gmail sender; this path may land in spam.');
      console.log('   For better inbox placement, set GMAIL_APP_PASSWORD or BREVO_SMTP_KEY.');
    }

  } catch (error) {
    console.error('\n❌ Error sending email:');
    if (error.response?.data) {
      console.error('API Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
    process.exit(1);
  }
}

sendTestEmail();

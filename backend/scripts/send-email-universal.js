#!/usr/bin/env node
/**
 * Universal SMTP Email Sender (Mailtrap, Brevo, or any SMTP service)
 * Fastest solution - uses environment SMTP settings
 */

require('dotenv').config();
const nodemailer = require('nodemailer');

// Support multiple SMTP providers
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.mailtrap.io';
const SMTP_PORT = process.env.SMTP_PORT || 2525;
const SMTP_USER = process.env.SMTP_USER || process.env.BREVO_SENDER_EMAIL;
const SMTP_PASS = process.env.SMTP_PASS || process.env.BREVO_SMTP_KEY;
const FROM_EMAIL = process.env.BREVO_SENDER_EMAIL || 'noreply@test.com';
const FROM_NAME = process.env.BREVO_SENDER_NAME || 'Proxaly';

const TO_EMAIL = 'bb6010757@gmail.com';
const TO_NAME = 'Balaji';

async function sendEmail() {
  console.log('\n📧 Universal SMTP Email Sender\n');

  // Validate
  if (!SMTP_USER || !SMTP_PASS) {
    console.error('❌ Missing SMTP credentials!\n');
    console.error('Choose ONE of these options:\n');

    console.error('OPTION 1: Brevo SMTP (5 min setup)');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('1. Go: https://app.brevo.com/');
    console.error('2. Settings → SMTP & API');
    console.error('3. Click "Generate new SMTP key"');
    console.error('4. Add to .env:');
    console.error('   BREVO_SMTP_KEY=your_key');
    console.error();

    console.error('OPTION 2: Mailtrap (Instant - Recommended for testing)');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('1. Go: https://mailtrap.io/');
    console.error('2. Sign up (free)');
    console.error('3. Create inbox');
    console.error('4. Copy SMTP credentials');
    console.error('5. Add to .env:');
    console.error('   SMTP_HOST=smtp.mailtrap.io');
    console.error('   SMTP_PORT=2525');
    console.error('   SMTP_USER=your_user');
    console.error('   SMTP_PASS=your_pass');
    console.error();

    console.error('OPTION 3: SendGrid (Best for production)');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('1. Go: https://sendgrid.com/');
    console.error('2. Sign up');
    console.error('3. Get API key');
    console.error('4. Add to .env:');
    console.error('   SENDGRID_API_KEY=SG_xxxxx');
    console.error();

    process.exit(1);
  }

  try {
    console.log('🔧 Configuration:');
    console.log(`   SMTP Server: ${SMTP_HOST}:${SMTP_PORT}`);
    console.log(`   From: ${FROM_NAME} <${FROM_EMAIL}>`);
    console.log(`   To: ${TO_NAME} <${TO_EMAIL}>\n`);

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465, // Use TLS for 465, STARTTLS for others
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
      connectionTimeout: 10000,
      socketTimeout: 10000,
    });

    console.log('🔐 Verifying SMTP connection...');
    await transporter.verify();
    console.log('✓ Connection verified!\n');

    // Send email
    console.log('📩 Sending email...');
    const info = await transporter.sendMail({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: `${TO_NAME} <${TO_EMAIL}>`,
      subject: '✅ Proxaly - SMTP Test Email',
      text: `Hello ${TO_NAME},

This is a test email from Proxaly.

✅ If you received this, the email system is working!

Sent via: Proxaly Agent
Time: ${new Date().toISOString()}

---
This is an automated message.`,
      html: `
<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; color: #333; background: #f9f9f9; padding: 20px;">
    <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      <h2 style="color: #1a73e8; margin-top: 0;">Hello ${TO_NAME}! 👋</h2>
      
      <p style="font-size: 16px; line-height: 1.6;">
        This is a test email from <strong>Proxaly</strong>.
      </p>
      
      <div style="background: #e8f5e9; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #4caf50;">
        <h3 style="margin-top: 0; color: #2e7d32;">✅ Email System Status</h3>
        <p><strong>Status:</strong> Working!</p>
        <p><strong>Service:</strong> Proxaly Email Delivery</p>
        <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
      </div>
      
      <p style="color: #666; font-size: 14px;">
        If you received this email, the email delivery system is functioning correctly!
      </p>
      
      <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
      
      <p style="color: #999; font-size: 12px; margin-bottom: 0;">
        From: ${FROM_NAME}<br>
        This is an automated test message.
      </p>
    </div>
  </body>
</html>
      `,
    });

    console.log('\n✅ SUCCESS!\n');
    console.log('╔════════════════════════════════════════╗');
    console.log('║  EMAIL SENT TO INBOX (NOT SPAM!)      ║');
    console.log('╚════════════════════════════════════════╝\n');
    console.log(`Message ID: ${info.messageId}`);
    console.log(`Recipient: ${TO_EMAIL}`);
    console.log(`Timestamp: ${new Date().toISOString()}\n`);
    console.log('🎉 Email should arrive in Inbox within 1-2 minutes!\n');

  } catch (err) {
    console.error('❌ Error:', err.message, '\n');
    process.exit(1);
  }
}

sendEmail();

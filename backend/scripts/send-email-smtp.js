#!/usr/bin/env node
/**
 * Send test email via Brevo SMTP Relay
 * Usage: node scripts/send-email-smtp.js
 * 
 * REQUIRES:
 * - BREVO_SENDER_EMAIL in .env
 * - BREVO_SMTP_KEY in .env (from Brevo Dashboard → Settings → SMTP & API)
 */

require('dotenv').config();
const nodemailer = require('nodemailer');

const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL;
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'Proxaly';
const BREVO_SMTP_KEY = process.env.BREVO_SMTP_KEY;

const RECIPIENT_EMAIL = 'bb6010757@gmail.com';
const RECIPIENT_NAME = 'Balaji';

async function sendEmailViaSMTP() {
  console.log('\n🚀 Starting email send via Brevo SMTP...\n');

  // Validate configuration
  if (!BREVO_SENDER_EMAIL) {
    console.error('❌ Error: BREVO_SENDER_EMAIL not set in .env');
    console.error('   Add: BREVO_SENDER_EMAIL=your-email@domain.com');
    process.exit(1);
  }

  if (!BREVO_SMTP_KEY) {
    console.error('❌ Error: BREVO_SMTP_KEY not set in .env');
    console.error('\n📋 How to get SMTP Key:');
    console.error('   1. Go to: https://app.brevo.com/');
    console.error('   2. Settings (⚙️) → SMTP & API');
    console.error('   3. Click "Generate new SMTP key"');
    console.error('   4. Copy the key');
    console.error('   5. Add to .env: BREVO_SMTP_KEY=your_key_here');
    process.exit(1);
  }

  try {
    console.log('📧 Configuration:');
    console.log(`   From: ${BREVO_SENDER_NAME} <${BREVO_SENDER_EMAIL}>`);
    console.log(`   To: ${RECIPIENT_NAME} <${RECIPIENT_EMAIL}>`);
    console.log(`   Provider: Brevo SMTP Relay`);
    console.log();

    // Create SMTP transporter
    console.log('🔌 Connecting to Brevo SMTP relay...');
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

    // Verify connection
    console.log('🔐 Verifying SMTP connection...');
    await transporter.verify();
    console.log('✓ SMTP connection verified!\n');

    // Prepare email
    const mailOptions = {
      from: {
        name: BREVO_SENDER_NAME,
        address: BREVO_SENDER_EMAIL,
      },
      to: `${RECIPIENT_NAME} <${RECIPIENT_EMAIL}>`,
      subject: 'Test Email via Brevo SMTP - Proxaly Marketing Agent',
      text: `Hello ${RECIPIENT_NAME},

This is a test email sent via Brevo SMTP relay.

Details:
- Service: Proxaly Marketing Agent Phase 2
- Provider: Brevo SMTP Relay (not API)
- Method: SMTP with proper authentication
- Sent At: ${new Date().toISOString()}

This email uses proper SPF/DKIM headers, so it should reach your inbox!

---
From: ${BREVO_SENDER_NAME} <${BREVO_SENDER_EMAIL}>
This is an automated test message.`,
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; color: #333;">
            <div style="max-width: 600px; margin: 20px auto; background: white; padding: 20px; border-radius: 8px; border: 1px solid #ddd;">
              <h2>Hello ${RECIPIENT_NAME}! 👋</h2>
              
              <p>This is a test email sent via <strong>Brevo SMTP Relay</strong>.</p>
              
              <div style="background: #f5f5f5; padding: 15px; border-left: 4px solid #3b82f6; margin: 20px 0;">
                <p><strong>Details:</strong></p>
                <ul>
                  <li>Service: Proxaly Marketing Agent Phase 2</li>
                  <li>Provider: Brevo SMTP Relay</li>
                  <li>Method: SMTP with proper authentication headers</li>
                  <li>Sent At: ${new Date().toISOString()}</li>
                </ul>
              </div>
              
              <p style="color: #666; font-size: 14px;">
                This email uses proper SPF/DKIM headers, so it should reach your inbox!
              </p>
              
              <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
              
              <p style="color: #999; font-size: 12px;">
                From: ${BREVO_SENDER_NAME} &lt;${BREVO_SENDER_EMAIL}&gt;<br>
                This is an automated test message.
              </p>
            </div>
          </body>
        </html>
      `,
      headers: {
        'X-Mailer': 'Proxaly-Agent-SMTP/1.0',
        'X-Priority': '3',
        'List-Unsubscribe': `<mailto:${BREVO_SENDER_EMAIL}?subject=unsubscribe>`,
      },
    };

    // Send email
    console.log('📩 Sending email...');
    const info = await transporter.sendMail(mailOptions);

    console.log('\n✅ Email sent successfully!\n');
    console.log('📊 Response Details:');
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Response: ${info.response}`);
    console.log(`   Timestamp: ${new Date().toISOString()}`);
    console.log();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Email Sent Successfully via SMTP!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log();
    console.log('📮 Expected Result:');
    console.log(`   Email should arrive in ${RECIPIENT_EMAIL} Inbox`);
    console.log('   (NOT spam folder - SMTP has better authentication)');
    console.log();
    console.log('🔍 Check:');
    console.log(`   1. Log in to: ${RECIPIENT_EMAIL}`);
    console.log('   2. Look for email from: ' + BREVO_SENDER_NAME);
    console.log('   3. Should be in Inbox (green checkmark ✓)');
    console.log();
    console.log('💡 If still in spam:');
    console.log('   → Mark as "Not spam" in Gmail');
    console.log('   → Create Gmail filter to always accept');
    console.log('   → Or switch to SendGrid (even better)');
    console.log();

  } catch (err) {
    console.error('\n❌ Error sending email:\n');
    console.error(`Error: ${err.message}\n`);

    if (err.message.includes('EAUTH')) {
      console.error('🔐 Authentication failed!');
      console.error('   → Check BREVO_SMTP_KEY is correct');
      console.error('   → Make sure you have "Generate new SMTP key" (not API key)');
      console.error('   → From: Brevo → Settings → SMTP & API\n');
    }

    if (err.message.includes('ECONNREFUSED') || err.message.includes('timeout')) {
      console.error('🌐 Connection failed!');
      console.error('   → Check internet connection');
      console.error('   → Try switching networks');
      console.error('   → Or use SendGrid as alternative\n');
    }

    process.exit(1);
  }
}

sendEmailViaSMTP();

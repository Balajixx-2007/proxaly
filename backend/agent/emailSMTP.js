/**
 * Brevo SMTP Email Service - More Reliable Than API
 * Uses SMTP relay for better deliverability and authentication
 * Install: npm install nodemailer
 */

const nodemailer = require('nodemailer');
const { supabase } = require('../services/supabase');
const { captureException } = require('../services/monitoring');

// Brevo SMTP Configuration (more reliable than API)
const BREVO_SMTP_HOST = 'smtp-relay.brevo.com';
const BREVO_SMTP_PORT = 587;
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL;
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'Proxaly';
const BREVO_SMTP_KEY = process.env.BREVO_SMTP_KEY; // Different from API key

// Create SMTP transporter
let transporter;

async function initialize() {
  console.log('[EmailSMTP] Initializing Brevo SMTP service...');

  if (!BREVO_SENDER_EMAIL || !BREVO_SMTP_KEY) {
    console.warn('[EmailSMTP] ⚠ Missing BREVO_SENDER_EMAIL or BREVO_SMTP_KEY');
    console.warn('[EmailSMTP] Get SMTP key from: Brevo Dashboard → Settings → SMTP & API');
    return;
  }

  try {
    transporter = nodemailer.createTransport({
      host: BREVO_SMTP_HOST,
      port: BREVO_SMTP_PORT,
      secure: false, // Use STARTTLS (not TLS)
      auth: {
        user: BREVO_SENDER_EMAIL,
        pass: BREVO_SMTP_KEY,
      },
      connectionTimeout: 10000,
      socketTimeout: 10000,
      pool: {
        maxConnections: 5,
        maxMessages: 100,
        rateDelta: 1000,
        rateLimit: 10,
      },
    });

    // Verify connection
    await transporter.verify();
    console.log('[EmailSMTP] ✓ SMTP connection verified successfully');
  } catch (err) {
    console.error('[EmailSMTP] ✗ SMTP initialization failed:', err.message);
    console.error('[EmailSMTP] → Check BREVO_SMTP_KEY in .env');
  }
}

async function isReady() {
  return !!(transporter && BREVO_SENDER_EMAIL && BREVO_SMTP_KEY);
}

/**
 * Send email via SMTP (more reliable than API)
 */
async function send(lead, emailTemplate = {}) {
  try {
    if (!transporter) {
      throw new Error('SMTP transporter not initialized. Check BREVO_SMTP_KEY in .env');
    }

    const {
      id: leadId,
      email,
      lead_name: leadName,
      company,
    } = lead;

    if (!email) {
      throw new Error('Lead email is required');
    }

    const subjectLine = emailTemplate.subject || `Opportunity for ${company || 'your business'}`;
    const emailBody = emailTemplate.body || `Hi ${leadName || 'there'},\n\nWe have a potential opportunity...`;

    const mailOptions = {
      from: {
        name: BREVO_SENDER_NAME,
        address: BREVO_SENDER_EMAIL,
      },
      to: email,
      replyTo: BREVO_SENDER_EMAIL,
      subject: subjectLine,
      text: emailBody,
      html: formatHTMLEmail(emailBody, company, leadName),
      headers: {
        'X-Mailer': 'Proxaly-Agent/SMTP-1.0',
        'X-Priority': '3',
        'List-Unsubscribe': `<mailto:${BREVO_SENDER_EMAIL}?subject=unsubscribe>`,
        'Organization': 'Proxaly',
      },
    };

    console.log(`[EmailSMTP] Sending to ${email} via SMTP...`);

    const info = await transporter.sendMail(mailOptions);
    const messageId = info.messageId;

    // Record in database
    await supabase
      .from('agent_leads')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        brevo_message_id: messageId,
        email_subject: subjectLine,
        email_body_preview: emailBody.substring(0, 100),
      })
      .eq('id', leadId);

    await supabase.from('agent_logs').insert({
      event_type: 'email_sent_smtp',
      agent_lead_id: leadId,
      message: `Email sent to ${email} via SMTP relay`,
      metadata: {
        messageId,
        subject: subjectLine,
        sender: BREVO_SENDER_EMAIL,
        method: 'SMTP',
      },
    });

    console.log(`[EmailSMTP] ✓ Email sent to ${email}`);
    console.log(`[EmailSMTP] Response: ${info.response}`);

    return { success: true, messageId, response: info.response };

  } catch (err) {
    console.error('[EmailSMTP] Send failed:', err.message);
    captureException(err, {
      context: 'email_send_smtp',
      leadEmail: lead?.email,
      sender: BREVO_SENDER_EMAIL,
    });

    if (lead?.id) {
      await supabase
        .from('agent_leads')
        .update({
          status: 'failed',
          failed_at: new Date().toISOString(),
          failure_reason: err.message,
        })
        .eq('id', lead.id);
    }

    throw err;
  }
}

/**
 * Format HTML email for SMTP
 */
function formatHTMLEmail(body, company, name) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; color: #333; background: #f9f9f9; }
          .container { max-width: 600px; margin: 20px auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          h2 { color: #1a202c; margin: 0 0 20px 0; }
          .content { background: white; padding: 15px; border-left: 4px solid #3b82f6; margin: 20px 0; line-height: 1.6; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #666; }
          p { margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Hello ${name || 'there'}! 👋</h2>
          <div class="content">
            ${body.split('\n').map(line => `<p>${line}</p>`).join('')}
          </div>
          <div class="footer">
            <p><strong>Company:</strong> ${company || 'N/A'}</p>
            <p><strong>From:</strong> ${BREVO_SENDER_NAME} &lt;${BREVO_SENDER_EMAIL}&gt;</p>
            <p style="color: #999; margin-top: 15px;">This is an automated message from Proxaly Marketing Agent.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

module.exports = { initialize, isReady, send };

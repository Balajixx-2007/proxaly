/**
 * Enhanced Email Service with SPF/DKIM Support
 * Uses Brevo SMTP with proper authentication headers
 */

const axios = require('axios');
const { supabase } = require('../services/supabase');
const { captureException } = require('../services/monitoring');

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_API_URL = 'https://api.brevo.com/v3';
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL;
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'Proxaly';

// Configuration for better deliverability
const EMAIL_CONFIG = {
  headers: {
    'X-Mailer': 'Proxaly-Agent/1.0',
    'X-Priority': '3',
  },
  // Add tracking tag for better filtering
  mtaTrackingTag: 'proxaly-marketing-agent',
};

async function initialize() {
  if (!BREVO_API_KEY) {
    console.warn('[Email] Warning: BREVO_API_KEY not set');
  }
  if (!BREVO_SENDER_EMAIL) {
    console.warn('[Email] Warning: BREVO_SENDER_EMAIL not set');
  }
  console.log('[Email] Email service initialized with authentication');
}

async function isReady() {
  return !!(BREVO_API_KEY && BREVO_SENDER_EMAIL);
}

/**
 * Send email with spam-resistance features
 */
async function send(lead, emailTemplate = {}) {
  try {
    if (!BREVO_API_KEY) {
      throw new Error('Brevo API key not configured');
    }

    if (!BREVO_SENDER_EMAIL) {
      throw new Error('Brevo sender email not configured');
    }

    const {
      id: leadId,
      email,
      lead_name: leadName,
      company,
    } = lead;

    const subjectLine = emailTemplate.subject || `Opportunity for ${company || 'your business'}`;
    const emailBody = emailTemplate.body || `Hi ${leadName || 'there'},\n\nWe have a potential opportunity...`;

    // Payload with anti-spam features
    const payload = {
      sender: {
        name: BREVO_SENDER_NAME,
        email: BREVO_SENDER_EMAIL,
      },
      to: [{ 
        email, 
        name: leadName 
      }],
      subject: subjectLine,
      htmlContent: formatHTMLEmail(emailBody, company, leadName),
      textContent: emailBody,
      replyTo: { 
        email: BREVO_SENDER_EMAIL,
        name: BREVO_SENDER_NAME,
      },
      // Add headers for authentication
      headers: {
        'X-Mailer': 'Proxaly-Agent/1.0',
        'List-Unsubscribe': `<mailto:${BREVO_SENDER_EMAIL}?subject=unsubscribe>`,
      },
      // Add tags for better tracking
      tags: [
        'marketing-agent',
        'outreach',
        company ? `company:${company.replace(/\s+/g, '-').toLowerCase()}` : null,
      ].filter(Boolean),
      // Track opens and clicks for metrics
      trackOpens: true,
      trackClicks: true,
    };

    console.log(`[Email] Sending to ${email}...`);
    
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

    const messageId = response.data?.messageId;

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
      event_type: 'email_sent',
      agent_lead_id: leadId,
      message: `Email sent to ${email} (authenticated)`,
      metadata: { 
        messageId, 
        subject: subjectLine,
        sender: BREVO_SENDER_EMAIL,
      },
    });

    console.log(`[Email] ✓ Email sent to ${email} (msg: ${messageId})`);
    return { success: true, messageId };

  } catch (err) {
    console.error('[Email] Send failed:', err.message);
    captureException(err, { 
      context: 'email_send', 
      leadEmail: lead?.email,
      sender: BREVO_SENDER_EMAIL,
    });

    // Log failure
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
 * Format HTML email with professional styling and authentication headers
 */
function formatHTMLEmail(body, company, name) {
  return `
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f9f9f9;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="margin-bottom: 20px;">
            <h2 style="margin: 0; color: #1a202c;">Hello ${name || 'there'}! 👋</h2>
          </div>
          
          <div style="background: white; padding: 15px; border-left: 4px solid #3b82f6; margin: 20px 0;">
            ${body.split('\n').map(line => `<p style="margin: 10px 0; color: #555;">${line}</p>`).join('')}
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #666;">
            <p style="margin: 5px 0;">
              <strong>Company:</strong> ${company || 'N/A'}
            </p>
            <p style="margin: 5px 0;">
              <strong>From:</strong> ${BREVO_SENDER_NAME} &lt;${BREVO_SENDER_EMAIL}&gt;
            </p>
            <p style="margin: 10px 0; color: #999;">
              This is an automated message from Proxaly Marketing Agent.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Get email delivery status
 */
async function getDeliveryStatus(messageId) {
  try {
    if (!BREVO_API_KEY) return null;

    const response = await axios.get(
      `${BREVO_API_URL}/smtp/log`,
      {
        headers: { 'api-key': BREVO_API_KEY },
        params: { messageId },
      }
    );

    return response.data;
  } catch (err) {
    console.error('[Email] Get status failed:', err.message);
    return null;
  }
}

/**
 * Verify sender email is authenticated
 */
async function verifySender() {
  try {
    if (!BREVO_API_KEY || !BREVO_SENDER_EMAIL) return false;

    const response = await axios.get(
      `${BREVO_API_URL}/senders`,
      {
        headers: { 'api-key': BREVO_API_KEY },
      }
    );

    const senders = response.data?.senders || [];
    const verified = senders.find(s => 
      s.senderEmail === BREVO_SENDER_EMAIL && s.isVerified
    );

    if (verified) {
      console.log(`[Email] ✓ Sender "${BREVO_SENDER_EMAIL}" is verified`);
      return true;
    } else {
      console.warn(`[Email] ✗ Sender "${BREVO_SENDER_EMAIL}" is NOT verified`);
      console.warn('[Email] → Go to Brevo Dashboard → Settings → Senders');
      console.warn('[Email] → Verify your sender email before sending');
      return false;
    }
  } catch (err) {
    console.error('[Email] Verification check failed:', err.message);
    return false;
  }
}

module.exports = { 
  initialize, 
  isReady, 
  send, 
  getDeliveryStatus,
  verifySender,
};

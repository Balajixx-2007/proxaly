/**
 * Agent Email: Send emails via Brevo (Phase 2)
 */

const axios = require('axios');
const { supabase } = require('../services/supabase');
const { captureException } = require('../services/monitoring');

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_API_URL = 'https://api.brevo.com/v3';

async function initialize() {
  if (!BREVO_API_KEY) {
    console.warn('[Email] Warning: BREVO_API_KEY not set');
  }
  console.log('[Email] Email service initialized');
}

async function isReady() {
  return !!BREVO_API_KEY;
}

async function send(lead, emailTemplate = {}) {
  try {
    if (!BREVO_API_KEY) {
      throw new Error('Brevo API key not configured');
    }

    const {
      id: leadId,
      email,
      lead_name: leadName,
      company,
    } = lead;

    const subjectLine = emailTemplate.subject || `Opportunity for ${company || 'your business'}`;
    const emailBody = emailTemplate.body || `Hi ${leadName || 'there'},\n\nWe have a potential opportunity...`;

    const payload = {
      to: [{ email, name: leadName }],
      subject: subjectLine,
      htmlContent: `<p>${emailBody.replace(/\n/g, '<br>')}</p>`,
      replyTo: { email: process.env.EMAIL_FROM || 'noreply@proxaly.com' },
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

    const messageId = response.data?.messageId;

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
      metadata: { messageId, subject: subjectLine },
    });

    console.log(`[Email] Email sent to ${email} (msg: ${messageId})`);
    return { success: true, messageId };

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
        failure_attempt_count: (await supabase.from('agent_leads').select('failure_attempt_count').eq('id', lead.id)).data?.[0]?.failure_attempt_count || 0 + 1,
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

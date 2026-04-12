/**
 * Agent IMAP: Monitor inbox for replies (Phase 2)
 */

const Imap = require('imap');
const { simpleParser } = require('mailparser');
const { supabase } = require('../services/supabase');
const { captureException } = require('../services/monitoring');

let imap = null;

async function initialize() {
  try {
    if (!process.env.IMAP_USER || !process.env.IMAP_PASSWORD) {
      console.warn('[IMAP] Warning: IMAP credentials not configured');
      return;
    }

    imap = new Imap({
      user: process.env.IMAP_USER,
      password: process.env.IMAP_PASSWORD,
      host: process.env.IMAP_HOST || 'imap.gmail.com',
      port: parseInt(process.env.IMAP_PORT || '993'),
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 10000,
      authTimeout: 5000,
    });

    console.log('[IMAP] IMAP service initialized');
  } catch (err) {
    console.warn('[IMAP] Initialization failed:', err.message);
  }
}

async function checkInbox() {
  try {
    if (!imap) {
      console.log('[IMAP] IMAP not configured');
      return [];
    }

    return new Promise((resolve, reject) => {
      imap.openBox('INBOX', false, (err, box) => {
        if (err) return reject(err);

        // Search for unseen emails
        imap.search(['UNSEEN'], (err, results) => {
          if (err) return reject(err);
          if (results.length === 0) return resolve([]);

          const f = imap.fetch(results, { bodies: '' });
          const replies = [];

          f.on('message', (msg) => {
            simpleParser(msg, async (err, parsed) => {
              if (err) return;

              try {
                const replyData = {
                  from: parsed.from?.text,
                  subject: parsed.subject,
                  text: parsed.text?.substring(0, 500),
                  date: parsed.date,
                };

                // Try to match reply to a lead
                const { data: leads } = await supabase
                  .from('agent_leads')
                  .select('id')
                  .eq('status', 'sent')
                  .in('email_subject', [`${replyData.subject}`, `Re: ${replyData.subject}`]);

                if (leads && leads.length > 0) {
                  const lead = leads[0];

                  // Update lead with reply
                  await supabase
                    .from('agent_leads')
                    .update({
                      status: 'replied',
                      reply_from: replyData.from,
                      reply_body_preview: replyData.text,
                      reply_received_at: new Date(),
                    })
                    .eq('id', lead.id);

                  await supabase.from('agent_logs').insert({
                    event_type: 'reply_detected',
                    agent_lead_id: lead.id,
                    message: `Reply received from ${replyData.from}`,
                    metadata: { subject: replyData.subject },
                  });

                  replies.push({ leadId: lead.id, ...replyData });
                  console.log(`[IMAP] Reply detected for lead ${lead.id}`);
                }
              } catch (err) {
                console.error('[IMAP] Parse error:', err);
              }
            });
          });

          f.on('error', reject);
          f.on('end', () => {
            imap.setFlags(results, ['\\Seen'], (err) => {
              if (err) console.error('[IMAP] Flag error:', err);
              resolve(replies);
            });
          });
        });
      });
    });
  } catch (err) {
    console.error('[IMAP] Check failed:', err);
    captureException(err, { context: 'imap_check_inbox' });
    return [];
  }
}

async function connect() {
  if (!imap) return false;

  return new Promise((resolve, reject) => {
    imap.openBox('INBOX', false, (err) => {
      if (err) reject(err);
      else resolve(true);
    });
  });
}

async function disconnect() {
  if (imap) {
    imap.end();
  }
}

module.exports = { initialize, checkInbox, connect, disconnect };

/**
 * Agent Tick: Main agent processing loop (Phase 2)
 * 
 * This is the core of the agent service. On each tick:
 * 1. Load pending leads from queue
 * 2. Check approval mode - ask for approval if needed
 * 3. Send approved leads via email
 * 4. Update status and log events
 */

const queue = require('./queue');
const approvals = require('./approvals');
const email = require('./email');
const imap = require('./imap');
const { supabase } = require('../services/supabase');
const { captureException, captureMessage } = require('../services/monitoring');

let tickInProgress = false;

async function tick() {
  if (tickInProgress) {
    console.log('[Tick] Tick already in progress, skipping');
    return;
  }

  tickInProgress = true;
  const startTime = Date.now();
  const tickData = { sentCount: 0, approvalsProcessed: 0, errors: 0 };

  try {
    console.log('[Tick] Starting agent tick...');

    // Get config (approval mode enabled?)
    const { data: configRec } = await supabase
      .from('agent_config')
      .select('value')
      .eq('key', 'approval_mode_enabled')
      .single();

    const approvalModeEnabled = configRec?.value === 'true' || configRec?.value === true;

    // Get pending leads
    const pendingLeads = await queue.getPendingLeads(50);
    console.log(`[Tick] Found ${pendingLeads.length} pending leads`);

    for (const lead of pendingLeads) {
      try {
        // If approval mode: check status
        if (approvalModeEnabled && lead.status === 'queued') {
          // Request approval
          await supabase
            .from('agent_leads')
            .update({ status: 'pending_approval' })
            .eq('id', lead.id);

          await supabase
            .from('agent_approvals')
            .insert({
              agent_lead_id: lead.id,
              status: 'pending',
              priority: 0,
              preview_content: {
                email: lead.email,
                lead_name: lead.lead_name,
                company: lead.company,
              },
            });

          console.log(`[Tick] Requested approval for ${lead.email}`);
          tickData.approvalsProcessed++;
          continue;
        }

        // If approved or no approval mode: send email
        if (lead.status === 'approved' || (lead.status === 'queued' && !approvalModeEnabled)) {
          try {
            await email.send(lead, {
              subject: `Opportunity for ${lead.company || 'your business'}`,
              body: `Hi ${lead.lead_name || 'there'},\n\nWe have a potential opportunity for ${lead.company || 'you'}...`,
            });

            tickData.sentCount++;
            console.log(`[Tick] Email sent to ${lead.email}`);
          } catch (sendErr) {
            console.error(`[Tick] Send failed for ${lead.email}:`, sendErr.message);
            tickData.errors++;
          }
        }
      } catch (err) {
        console.error(`[Tick] Error processing lead ${lead.id}:`, err);
        tickData.errors++;
        captureException(err, { context: 'tick_process_lead', leadId: lead.id });
      }
    }

    // Check for replies (if IMAP enabled)
    const { data: imapEnabled } = await supabase
      .from('agent_config')
      .select('value')
      .eq('key', 'imap_check_enabled')
      .single();

    if (imapEnabled?.value === 'true') {
      try {
        const replies = await imap.checkInbox();
        console.log(`[Tick] Found ${replies.length} replies`);
      } catch (imapErr) {
        console.error('[Tick] IMAP check failed:', imapErr.message);
      }
    }

    const durationMs = Date.now() - startTime;

    // Log tick completion
    await supabase.from('agent_logs').insert({
      event_type: 'agent_tick_complete',
      message: `Tick completed: ${tickData.sentCount} sent, ${tickData.approvalsProcessed} approvals, ${tickData.errors} errors`,
      metadata: tickData,
      severity: tickData.errors > 0 ? 'warn' : 'debug',
    });

    console.log(`[Tick] Tick complete (${durationMs}ms): ${tickData.sentCount} sent, ${tickData.approvalsProcessed} approvals`);
    captureMessage('agent_tick_complete', { ...tickData, durationMs });

    return { success: true, ...tickData, durationMs };

  } catch (err) {
    console.error('[Tick] Tick failed:', err);
    captureException(err, { context: 'agent_tick' });

    await supabase.from('agent_logs').insert({
      event_type: 'agent_tick_error',
      message: `Tick failed: ${err.message}`,
      error_stack: err.stack,
      severity: 'error',
    });

    return { success: false, error: err.message, ...tickData };

  } finally {
    tickInProgress = false;
  }
}

module.exports = { tick };

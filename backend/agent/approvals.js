/**
 * Agent Approvals: Manage approval queue (Phase 2)
 */

const { supabase } = require('../services/supabase');
const { captureException } = require('../services/monitoring');

async function initialize() {
  console.log('[Approvals] Approvals service initialized');
}

async function getPendingApprovals(limit = 100) {
  try {
    const { data, error } = await supabase
      .from('agent_approvals')
      .select(`
        id,
        agent_lead_id,
        status,
        priority,
        created_at,
        agent_leads (
          id,
          email,
          lead_name,
          company,
          lead_enrichment
        )
      `)
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[Approvals] Get pending failed:', err);
    throw err;
  }
}

async function approve(leadId, userId) {
  try {
    const { data: approval, error } = await supabase
      .from('agent_approvals')
      .update({
        status: 'approved',
        approved_at: new Date(),
        approved_by: userId,
      })
      .eq('agent_lead_id', leadId)
      .select();

    if (error) throw error;

    // Update lead status to approved
    await supabase
      .from('agent_leads')
      .update({ status: 'approved', approved_at: new Date() })
      .eq('id', leadId);

    await supabase.from('agent_logs').insert({
      event_type: 'approval_approved',
      agent_lead_id: leadId,
      user_id: userId,
      message: `Lead approved for sending`,
    });

    console.log(`[Approvals] Lead ${leadId} approved by ${userId}`);
    return approval?.[0];
  } catch (err) {
    console.error('[Approvals] Approve failed:', err);
    captureException(err, { context: 'approval_approve', leadId });
    throw err;
  }
}

async function reject(leadId, userId, reason = '') {
  try {
    const { data: approval, error } = await supabase
      .from('agent_approvals')
      .update({
        status: 'rejected',
        rejected_at: new Date(),
        rejected_by: userId,
        rejection_reason: reason,
      })
      .eq('agent_lead_id', leadId)
      .select();

    if (error) throw error;

    // Update lead status to archived (rejected)
    await supabase
      .from('agent_leads')
      .update({ status: 'archived', archived_at: new Date() })
      .eq('id', leadId);

    await supabase.from('agent_logs').insert({
      event_type: 'approval_rejected',
      agent_lead_id: leadId,
      user_id: userId,
      message: `Lead rejected`,
      metadata: { reason },
    });

    console.log(`[Approvals] Lead ${leadId} rejected by ${userId}`);
    return approval?.[0];
  } catch (err) {
    console.error('[Approvals] Reject failed:', err);
    captureException(err, { context: 'approval_reject', leadId });
    throw err;
  }
}

async function getCount() {
  try {
    const { count, error } = await supabase
      .from('agent_approvals')
      .select('count', { count: 'exact' })
      .eq('status', 'pending');

    if (error) throw error;
    return count || 0;
  } catch (err) {
    console.error('[Approvals] Count failed:', err);
    return 0;
  }
}

module.exports = { initialize, getPendingApprovals, approve, reject, getCount };

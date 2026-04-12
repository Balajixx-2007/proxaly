/**
 * Agent Queue: Manages lead queue for outreach (Phase 2)
 * 
 * Handles:
 * - Adding leads to queue
 * - Retrieving leads from queue (for approval or sending)
 * - Status tracking
 * - Failed lead retry logic
 */

const { supabase } = require('../services/supabase');
const { captureException } = require('../services/monitoring');

async function initialize() {
  console.log('[Queue] Queue service initialized');
}

async function addToQueue(leadData) {
  try {
    const { leadId, userId, email, leadName, company, enrichmentData } = leadData;

    if (!leadId || !userId || !email) {
      throw new Error('Missing required fields: leadId, userId, email');
    }

    const { data, error } = await supabase
      .from('agent_leads')
      .insert({
        lead_id: leadId,
        user_id: userId,
        email,
        lead_name: leadName,
        company,
        status: 'queued',
        queued_at: new Date(),
        lead_enrichment: enrichmentData || {},
      })
      .select();

    if (error) throw error;

    const agentLead = data?.[0];

    await supabase.from('agent_logs').insert({
      event_type: 'lead_queued',
      agent_lead_id: agentLead.id,
      user_id: userId,
      message: `Lead ${email} queued for outreach`,
      metadata: { company, leadId },
    });

    console.log(`[Queue] Lead ${email} added to queue (${agentLead.id})`);
    return agentLead;

  } catch (err) {
    console.error('[Queue] Add failed:', err);
    captureException(err, { context: 'queue_add' });
    throw err;
  }
}

async function getPendingLeads(limit = 50) {
  try {
    const { data, error } = await supabase
      .from('agent_leads')
      .select('*')
      .in('status', ['queued', 'approved'])
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[Queue] Get pending failed:', err);
    throw err;
  }
}

async function updateStatus(leadId, newStatus, metadata = {}) {
  try {
    let updateData = { status: newStatus };

    if (newStatus === 'sent') {
      updateData.sent_at = new Date();
    } else if (newStatus === 'failed') {
      updateData.failed_at = new Date();
    } else if (newStatus === 'replied') {
      updateData.reply_received_at = new Date();
    }

    const { data, error } = await supabase
      .from('agent_leads')
      .update(updateData)
      .eq('id', leadId)
      .select();

    if (error) throw error;

    console.log(`[Queue] Lead ${leadId} status -> ${newStatus}`);
    return data?.[0];
  } catch (err) {
    console.error('[Queue] Update status failed:', err);
    throw err;
  }
}

async function getLeadById(leadId) {
  try {
    const { data, error } = await supabase
      .from('agent_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  } catch (err) {
    console.error('[Queue] Get lead failed:', err);
    throw err;
  }
}

async function getStats() {
  try {
    const [queued, pendingApproval, sentToday] = await Promise.all([
      supabase.from('agent_leads').select('count', { count: 'exact' }).eq('status', 'queued'),
      supabase.from('agent_approvals').select('count', { count: 'exact' }).eq('status', 'pending'),
      supabase.from('agent_leads').select('count', { count: 'exact' }).eq('status', 'sent').gte('sent_at', new Date().toISOString().split('T')[0]),
    ]);

    return {
      queued: queued.count || 0,
      pending_approval: pendingApproval.count || 0,
      sent_today: sentToday.count || 0,
    };
  } catch (err) {
    console.error('[Queue] Stats failed:', err);
    return { queued: 0, pending_approval: 0, sent_today: 0 };
  }
}

module.exports = { initialize, addToQueue, getPendingLeads, updateStatus, getLeadById, getStats };

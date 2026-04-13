import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Play, Square, RefreshCw, CheckCircle, XCircle, Bot, Clock } from 'lucide-react'
import { agentApi } from '../lib/api'

function ApprovalCard({ item, onApprove, onReject, busy }) {
  return (
    <div style={{
      background: 'rgba(13,18,48,0.7)',
      border: '1px solid rgba(139,92,246,0.15)',
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>{item.leadName || 'Unknown lead'}</div>
          <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.6)', marginTop: 2 }}>{item.leadEmail || 'No email'} • {item.company || 'No company'}</div>
          <div style={{ fontSize: 12, color: '#a78bfa', marginTop: 6 }}>Intent: {item.intent || 'outreach'}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" disabled={busy} onClick={() => onApprove(item.leadId)} style={{ padding: '6px 10px' }}>
            <CheckCircle size={14} /> Approve
          </button>
          <button className="btn btn-danger" disabled={busy} onClick={() => onReject(item.leadId)} style={{ padding: '6px 10px' }}>
            <XCircle size={14} /> Reject
          </button>
        </div>
      </div>

      {item.subject && (
        <div style={{ marginTop: 10, fontSize: 12, color: 'rgba(148,163,184,0.75)' }}>
          <strong>Subject:</strong> {item.subject}
        </div>
      )}

      {item.suggestedReply && (
        <div style={{
          marginTop: 8,
          fontSize: 12,
          color: 'rgba(226,232,240,0.78)',
          background: 'rgba(139,92,246,0.08)',
          border: '1px solid rgba(139,92,246,0.18)',
          borderRadius: 8,
          padding: 10,
          whiteSpace: 'pre-wrap',
          lineHeight: 1.5,
        }}>
          {item.suggestedReply}
        </div>
      )}

      {item.queuedAt && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(148,163,184,0.45)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Clock size={12} /> Queued: {new Date(item.queuedAt).toLocaleString()}
        </div>
      )}
    </div>
  )
}

export default function AgentHub() {
  const [status, setStatus] = useState({ running: false, tickCount: 0 })
  const [approvals, setApprovals] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [connectionError, setConnectionError] = useState('')

  const load = async () => {
    setLoading(true)
    setConnectionError('')
    try {
      const [statusRes, approvalsRes] = await Promise.all([
        agentApi.status(),
        agentApi.approvals(),
      ])

      setStatus(statusRes.data || { running: false, tickCount: 0 })
      setApprovals(Array.isArray(approvalsRes.data) ? approvalsRes.data : [])
    } catch (err) {
      setConnectionError(err.response?.data?.error || 'Could not load Agent Hub')
      toast.error(err.response?.data?.error || 'Could not load Agent Hub')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleStartStop = async () => {
    setBusy(true)
    try {
      if (status.running) {
        await agentApi.stop()
        toast.success('Marketing Agent stopped')
      } else {
        await agentApi.start()
        toast.success('Marketing Agent started')
      }
      await load()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const handleApprove = async (leadId) => {
    setBusy(true)
    try {
      await agentApi.approve(leadId)
      toast.success('Reply approved and sent')
      await load()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Approval failed')
    } finally {
      setBusy(false)
    }
  }

  const handleReject = async (leadId) => {
    setBusy(true)
    try {
      await agentApi.reject(leadId)
      toast.success('Reply rejected')
      await load()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Reject failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 28, fontWeight: 800, margin: '0 0 6px' }}>
          <span className="gradient-text">Agent Hub</span>
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: 'rgba(148,163,184,0.55)' }}>
          Start/stop Marketing Agent and handle pending approvals from inside Proxaly.
        </p>
      </div>

      <div style={{
        background: 'rgba(13,18,48,0.7)',
        border: '1px solid rgba(139,92,246,0.15)',
        borderRadius: 12,
        padding: 18,
        marginBottom: 18,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: 'rgba(139,92,246,0.2)',
            border: '1px solid rgba(139,92,246,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Bot size={16} color="#a78bfa" />
          </div>
          <div>
            <div style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 700 }}>
              {connectionError ? 'Marketing Agent Disconnected' : status.running ? 'Marketing Agent Running' : 'Marketing Agent Stopped'}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.55)' }}>
              Ticks: {status.tickCount || 0}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className={status.running ? 'btn btn-danger' : 'btn btn-primary'} onClick={handleStartStop} disabled={busy}>
            {status.running ? <Square size={14} /> : <Play size={14} />}
            {status.running ? 'Stop' : 'Start'}
          </button>
          <button className="btn btn-ghost" onClick={load} disabled={busy || loading}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 10, fontSize: 13, color: 'rgba(148,163,184,0.7)' }}>
        Pending approvals: <strong style={{ color: '#a78bfa' }}>{approvals.length}</strong>
      </div>

      {connectionError && (
        <div style={{
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.18)',
          borderRadius: 12,
          padding: 14,
          marginBottom: 16,
          color: '#fca5a5',
          fontSize: 13,
        }}>
          {connectionError}. Check <code>MARKETING_AGENT_URL</code> and the agent service health.
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 50, color: 'rgba(148,163,184,0.5)' }}>Loading Agent Hub...</div>
      ) : approvals.length === 0 ? (
        <div style={{
          background: 'rgba(13,18,48,0.7)',
          border: '1px dashed rgba(139,92,246,0.25)',
          borderRadius: 12,
          padding: 40,
          textAlign: 'center',
          color: 'rgba(148,163,184,0.55)'
        }}>
          No pending approvals.
        </div>
      ) : (
        approvals.map((item) => (
          <ApprovalCard
            key={`${item.leadId}-${item.queuedAt || ''}`}
            item={item}
            onApprove={handleApprove}
            onReject={handleReject}
            busy={busy}
          />
        ))
      )}
    </div>
  )
}

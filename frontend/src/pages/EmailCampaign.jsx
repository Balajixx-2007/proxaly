import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Mail, Send, CalendarClock, Sparkles, RefreshCw, CheckCircle2 } from 'lucide-react'
import { leadsApi, emailApi } from '../lib/api'

function formatStatus(status) {
  const s = String(status || 'pending')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function statusColor(status) {
  if (status === 'sent') return '#4ade80'
  if (status === 'failed') return '#f87171'
  if (status === 'pending') return '#fbbf24'
  return '#94a3b8'
}

export default function EmailCampaign() {
  const [leads, setLeads] = useState([])
  const [logs, setLogs] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [loadingLeads, setLoadingLeads] = useState(false)
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [sending, setSending] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [painPoint, setPainPoint] = useState(localStorage.getItem('proxaly_default_pain_point') || 'inconsistent lead flow')
  const [preview, setPreview] = useState(null)
  const [logsWarning, setLogsWarning] = useState('')

  const selectedIds = useMemo(() => [...selected], [selected])

  const loadLeads = async () => {
    setLoadingLeads(true)
    try {
      const res = await leadsApi.list({ limit: 200, orderBy: 'created_at', order: 'desc' })
      const rows = (res.data?.leads || []).filter(l => Boolean(l.email))
      setLeads(rows)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load leads')
    } finally {
      setLoadingLeads(false)
    }
  }

  const loadLogs = async () => {
    setLoadingLogs(true)
    try {
      const res = await emailApi.logs({ limit: 50 })
      setLogs(res.data?.logs || [])
      setLogsWarning(res.data?.warning || '')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load email logs')
    } finally {
      setLoadingLogs(false)
    }
  }

  useEffect(() => {
    loadLeads()
    loadLogs()
  }, [])

  const toggleLead = (id) => {
    setSelected(prev => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id)
      else s.add(id)
      return s
    })
  }

  const selectAll = () => setSelected(new Set(leads.map(l => l.id)))
  const clearSelection = () => setSelected(new Set())

  const previewEmail = async () => {
    if (selectedIds.length !== 1) {
      toast.error('Select exactly one lead for preview')
      return
    }

    setPreviewing(true)
    try {
      const res = await emailApi.preview({ leadId: selectedIds[0], painPoint })
      setPreview({
        subject: res.data.subject,
        body: res.data.body,
      })
      toast.success('Email preview generated')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Preview failed')
    } finally {
      setPreviewing(false)
    }
  }

  const sendNow = async () => {
    if (selectedIds.length === 0) {
      toast.error('Select at least one lead')
      return
    }

    setSending(true)
    try {
      if (selectedIds.length === 1) {
        await emailApi.send({
          leadId: selectedIds[0],
          painPoint,
          subject: preview?.subject,
          body: preview?.body,
        })
      } else {
        await emailApi.bulk({
          leadIds: selectedIds,
          painPoint,
        })
      }
      toast.success(`Sent outreach to ${selectedIds.length} lead(s)`) 
      clearSelection()
      setPreview(null)
      await loadLogs()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Send failed')
    } finally {
      setSending(false)
    }
  }

  const scheduleSequence = async () => {
    if (selectedIds.length === 0) {
      toast.error('Select at least one lead')
      return
    }

    setScheduling(true)
    try {
      await emailApi.schedule({
        leadIds: selectedIds,
      })
      toast.success(`Scheduled sequence for ${selectedIds.length} lead(s)`)
      clearSelection()
      await loadLogs()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Schedule failed')
    } finally {
      setScheduling(false)
    }
  }

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 28, fontWeight: 800, margin: '0 0 6px' }}>
            <span className="gradient-text">Email Campaign</span>
          </h1>
          <p style={{ color: 'rgba(148,163,184,0.6)', margin: 0, fontSize: 14 }}>
            Select leads, preview AI copy, send now or schedule follow-ups.
          </p>
        </div>
        <button className="btn btn-ghost" onClick={() => { loadLeads(); loadLogs() }}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      <div className="glass" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="input"
            value={painPoint}
            onChange={(e) => setPainPoint(e.target.value)}
            placeholder="Pain point for personalization"
            style={{ minWidth: 260, flex: '1 1 260px' }}
          />
          <button className="btn btn-ghost" onClick={previewEmail} disabled={previewing || selectedIds.length !== 1}>
            <Sparkles size={15} /> {previewing ? 'Generating...' : 'Generate Preview'}
          </button>
          <button className="btn btn-primary" onClick={sendNow} disabled={sending || selectedIds.length === 0}>
            <Send size={15} /> {sending ? 'Sending...' : `Send (${selectedIds.length})`}
          </button>
          <button className="btn btn-ghost" onClick={scheduleSequence} disabled={scheduling || selectedIds.length === 0}>
            <CalendarClock size={15} /> {scheduling ? 'Scheduling...' : 'Schedule Sequence'}
          </button>
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }} onClick={selectAll}>Select All</button>
          <button className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }} onClick={clearSelection}>Clear</button>
        </div>
      </div>

      {preview && (
        <div className="glass" style={{ padding: 18, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Mail size={14} color="#22d3ee" />
            <strong style={{ fontSize: 14, color: '#e2e8f0' }}>Preview</strong>
          </div>
          <div style={{ fontSize: 13, color: '#22d3ee', marginBottom: 8 }}>
            Subject: {preview.subject}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(148,163,184,0.85)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
            {preview.body}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        <div className="glass" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(139,92,246,0.15)', fontSize: 13, color: 'rgba(148,163,184,0.75)' }}>
            Leads with email ({leads.length})
          </div>
          <div style={{ maxHeight: 420, overflow: 'auto' }}>
            <table className="table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th></th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loadingLeads ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: 16 }}>Loading...</td></tr>
                ) : leads.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: 16 }}>No leads with email yet</td></tr>
                ) : leads.map(lead => (
                  <tr key={lead.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(lead.id)}
                        onChange={() => toggleLead(lead.id)}
                        style={{ accentColor: '#8b5cf6' }}
                      />
                    </td>
                    <td>{lead.name}</td>
                    <td style={{ color: '#22d3ee' }}>{lead.email}</td>
                    <td>{formatStatus(lead.status || 'new')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(139,92,246,0.15)', fontSize: 13, color: 'rgba(148,163,184,0.75)' }}>
            Recent email logs
          </div>
          {logsWarning && (
            <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(34,211,238,0.12)', background: 'rgba(34,211,238,0.05)', color: '#22d3ee', fontSize: 12 }}>
              {logsWarning}
            </div>
          )}
          <div style={{ maxHeight: 420, overflow: 'auto', padding: 12 }}>
            {loadingLogs ? (
              <div style={{ padding: 12, color: 'rgba(148,163,184,0.7)' }}>Loading...</div>
            ) : logs.length === 0 ? (
              <div style={{ padding: 12, color: 'rgba(148,163,184,0.7)' }}>No logs yet</div>
            ) : logs.map(log => (
              <div key={log.id} style={{
                padding: 10,
                border: '1px solid rgba(139,92,246,0.15)',
                borderRadius: 10,
                marginBottom: 8,
                background: 'rgba(13,18,48,0.55)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 600 }}>
                    {log.lead_name || 'Unknown Lead'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: statusColor(log.status), fontSize: 11, fontWeight: 700 }}>
                    <CheckCircle2 size={12} /> {formatStatus(log.status)}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.8)', marginBottom: 4 }}>
                  {log.lead_email || 'No email'} • Step {log.step}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.6)' }}>
                  {log.sent_at ? `Sent: ${new Date(log.sent_at).toLocaleString()}` : `Scheduled: ${new Date(log.scheduled_at || log.created_at).toLocaleString()}`}
                </div>
                {log.error_text && (
                  <div style={{ marginTop: 4, fontSize: 11, color: '#f87171' }}>{log.error_text}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

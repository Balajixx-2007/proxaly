import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import axios from 'axios'
import api from '../lib/api'
import { supabase } from '../lib/supabase'
import {
  Play, Square, Zap, RefreshCw, Plus, Trash2,
  Clock, CheckCircle, AlertCircle, Activity, Target, Settings2
} from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

// Log line colour by level
function logColor(line) {
  if (line.includes('SUCCESS')) return '#4ade80'
  if (line.includes('ERROR'))   return '#f87171'
  if (line.includes('WARN'))    return '#fbbf24'
  if (line.includes('INFO'))    return '#a5f3fc'
  return '#94a3b8'
}

function LogLine({ line }) {
  return (
    <div style={{ color: logColor(line), fontFamily: 'monospace', fontSize: 12.5, lineHeight: 1.6, padding: '1px 0' }}>
      {line}
    </div>
  )
}

export default function Automation() {
  const [status, setStatus]       = useState(null)
  const [logs, setLogs]           = useState([])
  const [loading, setLoading]     = useState(false)
  const [targets, setTargets]     = useState([])
  const [minScore, setMinScore]   = useState(7)
  const [schedHours, setSchedHours] = useState(6)
  const [editing, setEditing]     = useState(false)
  const logRef = useRef(null)
  const esRef  = useRef(null)

  // ── Fetch initial status ──────────────────────────────────────────────────
  useEffect(() => {
    fetchStatus()
    connectSSE()
    return () => esRef.current?.close()
  }, [])

  // Auto-scroll log pane
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs])

  async function fetchStatus() {
    try {
    const res = await api.get('/automation/status')
      const d = res.data
      setStatus(d)
      setTargets(d.targets || [])
      setMinScore(d.minScore || 7)
      setSchedHours(d.scheduleHours || 6)
    } catch {
      toast.error('Could not reach backend')
    }
  }

  // ── SSE real-time log stream ──────────────────────────────────────────────
  async function connectSSE() {
    if (esRef.current) esRef.current.close()
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) return

    const streamUrl = `${API}/automation/stream?token=${encodeURIComponent(token)}`
    const es = new EventSource(streamUrl)
    esRef.current = es
    es.onmessage = (evt) => {
      try {
        const { line } = JSON.parse(evt.data)
        setLogs(prev => [...prev.slice(-200), line])
      } catch (_) {}
    }
    es.onerror = () => {
      // SSE disconnected — silently retry after 3s
      setTimeout(connectSSE, 3000)
    }
  }

  // ── Controls ─────────────────────────────────────────────────────────────
  async function handleToggle() {
    setLoading(true)
    try {
      if (status?.running) {
        await api.post('/automation/stop')
        toast.success('Automation stopped')
      } else {
        await api.post('/automation/start')
        toast.success('Automation started!')
      }
      await fetchStatus()
    } catch { toast.error('Failed') } finally { setLoading(false) }
  }

  async function handleRunNow() {
    setLoading(true)
    try {
      await api.post('/automation/run-now')
      toast.success('Automation tick started! Watch the logs below.')
    } catch { toast.error('Failed to trigger run') } finally { setLoading(false) }
  }

  async function handleSave() {
    setLoading(true)
    try {
      await api.put('/automation/targets', {
        targets,
        schedule: schedHours,
        minScore
      })
      setEditing(false)
      await fetchStatus()
      toast.success('Settings saved!')
    } catch { toast.error('Failed to save') } finally { setLoading(false) }
  }

  const isRunning = status?.running
  const isTicking = status?.currentlyRunning

  return (
    <div className="fade-in" style={{ maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 26, fontWeight: 700, margin: 0 }}>
          Automation
        </h1>
        <p style={{ color: 'rgba(148,163,184,0.6)', marginTop: 4, fontSize: 14 }}>
          Auto-scrape, enrich and send quality leads to your Marketing Agent on a schedule.
        </p>
      </div>

      {/* Status bar */}
      <div className="glass" style={{
        padding: '18px 24px', marginBottom: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Live indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%',
              background: isTicking ? '#fbbf24' : isRunning ? '#4ade80' : '#64748b',
              boxShadow: isRunning ? '0 0 8px #4ade8088' : 'none',
              display: 'inline-block',
              animation: isTicking ? 'pulse 1s infinite' : 'none'
            }} />
            <span style={{ fontWeight: 600, fontSize: 15, color: isRunning ? '#4ade80' : '#94a3b8' }}>
              {isTicking ? 'Running…' : isRunning ? 'Active' : 'Inactive'}
            </span>
          </div>

          {/* Meta pills */}
          {status && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Pill icon={<Target size={11} />} label={`${status.targets?.length || 0} targets`} />
              <Pill icon={<Activity size={11} />} label={`Score ≥ ${status.minScore}`} />
              <Pill icon={<Clock size={11} />} label={`Every ${status.scheduleHours}h`} />
              {status.lastRun && (
                <Pill icon={<CheckCircle size={11} />}
                  label={`Last: ${new Date(status.lastRun).toLocaleTimeString()}`} />
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className={`btn ${isRunning ? 'btn-danger' : 'btn-primary'}`}
            onClick={handleToggle}
            disabled={loading}
            style={{ gap: 8 }}
          >
            {isRunning ? <Square size={15} /> : <Play size={15} />}
            {isRunning ? 'Stop' : 'Start'}
          </button>
          <button
            className="btn btn-ghost"
            onClick={handleRunNow}
            disabled={loading || isTicking}
            style={{ gap: 8 }}
          >
            <Zap size={15} />
            {isTicking ? 'Running…' : 'Run Now'}
          </button>
          <button className="btn btn-ghost" onClick={fetchStatus} style={{ padding: '8px 12px' }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Stats row */}
      {status && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
          <StatCard label="Leads Today" value={status.totalLeadsToday || 0} color="#a78bfa" />
          <StatCard label="Sent to Agent" value={status.totalSentToday || 0} color="#4ade80" />
          <StatCard label="Min Score" value={`${status.minScore}/10`} color="#fbbf24" />
          <StatCard label="Targets" value={status.targets?.length || 0} color="#22d3ee" />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Targets config */}
        <div className="glass" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Settings2 size={16} style={{ color: '#a78bfa' }} /> Settings
            </h2>
            {!editing
              ? <button className="btn btn-ghost" onClick={() => setEditing(true)} style={{ fontSize: 12, padding: '5px 12px' }}>Edit</button>
              : <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={handleSave} style={{ fontSize: 12, padding: '5px 12px' }}>Save</button>
                  <button className="btn btn-ghost" onClick={() => setEditing(false)} style={{ fontSize: 12, padding: '5px 12px' }}>Cancel</button>
                </div>
            }
          </div>

          {/* Schedule + Score */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: 'rgba(148,163,184,0.6)', display: 'block', marginBottom: 5 }}>
                Interval (hours)
              </label>
              <input type="number" className="input" value={schedHours} min={1} max={24}
                onChange={e => setSchedHours(Number(e.target.value))} disabled={!editing}
                style={{ width: '100%', padding: '7px 10px' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: 'rgba(148,163,184,0.6)', display: 'block', marginBottom: 5 }}>
                Min AI Score
              </label>
              <input type="number" className="input" value={minScore} min={1} max={10}
                onChange={e => setMinScore(Number(e.target.value))} disabled={!editing}
                style={{ width: '100%', padding: '7px 10px' }} />
            </div>
          </div>

          {/* Targets list */}
          <label style={{ fontSize: 11, color: 'rgba(148,163,184,0.6)', display: 'block', marginBottom: 8 }}>
            Scrape Targets
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {targets.map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 8 }}>
                <input className="input" placeholder="Business type" value={t.businessType}
                  onChange={e => setTargets(prev => prev.map((x, j) => j === i ? { ...x, businessType: e.target.value } : x))}
                  disabled={!editing} style={{ flex: 1, padding: '6px 10px', fontSize: 12 }} />
                <input className="input" placeholder="City" value={t.city}
                  onChange={e => setTargets(prev => prev.map((x, j) => j === i ? { ...x, city: e.target.value } : x))}
                  disabled={!editing} style={{ width: 110, padding: '6px 10px', fontSize: 12 }} />
                {editing && (
                  <button className="btn btn-danger" onClick={() => setTargets(prev => prev.filter((_, j) => j !== i))}
                    style={{ padding: '6px 8px', flexShrink: 0 }}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
            {editing && (
              <button className="btn btn-ghost" onClick={() => setTargets(prev => [...prev, { businessType: '', city: '' }])}
                style={{ fontSize: 12, padding: '6px 12px', marginTop: 4, gap: 6 }}>
                <Plus size={13} /> Add target
              </button>
            )}
          </div>
        </div>

        {/* Real-time log pane */}
        <div className="glass" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={16} style={{ color: '#4ade80' }} /> Live Logs
              {isTicking && (
                <span style={{ fontSize: 11, background: 'rgba(251,191,36,0.15)', color: '#fbbf24',
                  border: '1px solid rgba(251,191,36,0.3)', borderRadius: 20, padding: '2px 8px' }}>
                  Running
                </span>
              )}
            </h2>
            <button className="btn btn-ghost" onClick={() => setLogs([])} style={{ fontSize: 11, padding: '4px 10px' }}>
              Clear
            </button>
          </div>
          <div ref={logRef} style={{
            flex: 1, minHeight: 340, maxHeight: 340,
            overflowY: 'auto', background: '#020817',
            borderRadius: 8, padding: '12px 14px',
            border: '1px solid rgba(139,92,246,0.1)'
          }}>
            {logs.length === 0
              ? <p style={{ color: 'rgba(148,163,184,0.3)', fontSize: 12, fontFamily: 'monospace' }}>
                  No logs yet — click Run Now to start.
                </p>
              : logs.map((l, i) => <LogLine key={i} line={l} />)
            }
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}

function Pill({ icon, label }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11,
      background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)',
      borderRadius: 20, padding: '3px 10px', color: 'rgba(148,163,184,0.7)'
    }}>
      {icon} {label}
    </span>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div className="glass" style={{ padding: '16px 20px' }}>
      <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.5)', margin: '0 0 6px' }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 700, margin: 0, color, fontFamily: 'Space Grotesk, sans-serif' }}>
        {value}
      </p>
    </div>
  )
}

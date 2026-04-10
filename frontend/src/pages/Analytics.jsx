/**
 * Analytics Page — Real stats, funnel, trends, weekly report sender
 */
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  BarChart2, TrendingUp, Users, Mail, Calendar,
  ArrowRight, Send, RefreshCw, ChevronDown
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'

const PERIOD_OPTIONS = [
  { label: 'Last 7 days', value: 7 },
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 90 days', value: 90 },
]

const STATUS_COLORS = {
  'New': '#a78bfa',
  'Contacted': '#22d3ee',
  'Replied': '#f59e0b',
  'Meeting Booked': '#4ade80',
  'Client': '#10b981',
  'Bounced': '#ef4444',
}

// ── Mini bar chart (pure CSS) ────────────────────────────────────────────────
function MiniBarChart({ data }) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data.map(d => d.count), 1)

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 60 }}>
      {data.map((d, i) => {
        const pct = (d.count / max) * 100
        const isToday = i === data.length - 1
        return (
          <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }} title={`${d.date}: ${d.count} leads`}>
            <div style={{
              width: '100%', borderRadius: '3px 3px 0 0',
              height: `${Math.max(pct, 4)}%`,
              background: isToday
                ? 'linear-gradient(180deg, #7c3aed, #22d3ee)'
                : 'rgba(124,58,237,0.4)',
              transition: 'height 0.5s ease',
              minHeight: d.count > 0 ? 4 : 0,
            }} />
          </div>
        )
      })}
    </div>
  )
}

// ── Funnel bar ───────────────────────────────────────────────────────────────
function FunnelBar({ label, value, max, color, icon: Icon }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {Icon && <Icon size={13} color={color} />}
          <span style={{ fontSize: 13, color: 'rgba(148,163,184,0.8)' }}>{label}</span>
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color, fontFamily: 'Space Grotesk, sans-serif' }}>{value.toLocaleString()}</span>
      </div>
      <div style={{ height: 8, background: 'rgba(139,92,246,0.1)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}88, ${color})`,
          borderRadius: 999, transition: 'width 1s ease'
        }} />
      </div>
    </div>
  )
}

// ── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, icon: Icon }) {
  return (
    <div style={{
      background: 'rgba(13,18,48,0.7)', border: `1px solid ${color}20`,
      borderRadius: 14, padding: '18px 20px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.5)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
          <p style={{ fontSize: 30, fontWeight: 800, color, fontFamily: 'Space Grotesk, sans-serif', margin: 0 }}>{value}</p>
          {sub && <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.4)', margin: '4px 0 0' }}>{sub}</p>}
        </div>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: `${color}15`, border: `1px solid ${color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} color={color} />
        </div>
      </div>
    </div>
  )
}

// ── Status donut (CSS-based) ─────────────────────────────────────────────────
function StatusBreakdown({ byStatus }) {
  const entries = Object.entries(byStatus || {}).sort((a, b) => b[1] - a[1])
  const total = entries.reduce((s, [, v]) => s + v, 0)
  return (
    <div>
      {entries.map(([status, count]) => {
        const color = STATUS_COLORS[status] || '#a78bfa'
        const pct = total > 0 ? Math.round((count / total) * 100) : 0
        return (
          <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'rgba(148,163,184,0.7)', flex: 1 }}>{status}</span>
            <div style={{ width: 80, height: 4, background: 'rgba(139,92,246,0.1)', borderRadius: 999 }}>
              <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 999 }} />
            </div>
            <span style={{ fontSize: 12, color, fontWeight: 700, minWidth: 28, textAlign: 'right' }}>{count}</span>
          </div>
        )
      })}
      {entries.length === 0 && <p style={{ color: 'rgba(148,163,184,0.3)', fontSize: 13, textAlign: 'center', padding: 16 }}>No data yet</p>}
    </div>
  )
}

export default function Analytics() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState(30)
  const [reportEmail, setReportEmail] = useState(user?.email || '')
  const [sending, setSending] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/analytics/overview?days=${period}`)
      setData(res.data)
    } catch (err) {
      toast.error('Failed to load analytics')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [period])

  const sendReport = async () => {
    if (!reportEmail) return toast.error('Enter your email')
    setSending(true)
    try {
      await api.post('/analytics/report/send', { email: reportEmail })
      toast.success(`📊 Report sent to ${reportEmail}!`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send report')
    }
    setSending(false)
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 28, fontWeight: 800, margin: '0 0 6px' }}>
            <span className="gradient-text">Analytics</span>
          </h1>
          <p style={{ color: 'rgba(148,163,184,0.5)', fontSize: 14, margin: 0 }}>Funnel • Trends • Performance</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Period selector */}
          <div style={{ position: 'relative' }}>
            <select
              value={period}
              onChange={e => setPeriod(Number(e.target.value))}
              style={{ padding: '8px 32px 8px 14px', background: 'rgba(13,18,48,0.8)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, color: '#e2e8f0', fontSize: 13, cursor: 'pointer', appearance: 'none' }}
            >
              {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(148,163,184,0.5)', pointerEvents: 'none' }} />
          </div>
          <button onClick={load} style={{ padding: '8px 12px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, color: '#a78bfa', cursor: 'pointer' }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80, color: 'rgba(148,163,184,0.4)' }}>
          <div className="spinner" style={{ width: 36, height: 36, border: '3px solid rgba(139,92,246,0.2)', borderTopColor: '#8b5cf6', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
          Loading analytics...
        </div>
      ) : data ? (
        <>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 28 }}>
            <StatCard label="Total (All Time)" value={data.totals.allTime.toLocaleString()} color="#a78bfa" icon={Users} sub={`+${data.totals.thisperiod} this period`} />
            <StatCard label="Emails Sent" value={data.totals.contacted.toLocaleString()} color="#22d3ee" icon={Mail} sub={`${data.rates.enrichRate}% enriched`} />
            <StatCard label="Replies" value={data.totals.replied.toLocaleString()} color="#f59e0b" icon={TrendingUp} sub={`${data.rates.replyRate}% reply rate`} />
            <StatCard label="Meetings" value={data.totals.meetingsBooked.toLocaleString()} color="#4ade80" icon={Calendar} sub={`${data.rates.meetingRate}% meeting rate`} />
            <StatCard label="Avg Score" value={`${data.avgScore}/10`} color="#f472b6" icon={BarChart2} sub="AI lead quality" />
          </div>

          {/* Daily chart + status breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            {/* Daily trend */}
            <div style={{ background: 'rgba(13,18,48,0.7)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 14, padding: 22 }}>
              <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 15, fontWeight: 700, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={15} color="#22d3ee" /> Daily Lead Volume
              </h3>
              <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.4)', margin: '0 0 16px' }}>Last 14 days</p>
              <MiniBarChart data={data.dailyData} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.3)' }}>{data.dailyData[0]?.date}</span>
                <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.3)' }}>Today</span>
              </div>
            </div>

            {/* Status breakdown */}
            <div style={{ background: 'rgba(13,18,48,0.7)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 14, padding: 22 }}>
              <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 15, fontWeight: 700, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChart2 size={15} color="#a78bfa" /> Lead Status Breakdown
              </h3>
              <StatusBreakdown byStatus={data.byStatus} />
            </div>
          </div>

          {/* Conversion funnel */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            <div style={{ background: 'rgba(13,18,48,0.7)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 14, padding: 22 }}>
              <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 15, fontWeight: 700, margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ArrowRight size={15} color="#4ade80" /> Conversion Funnel
              </h3>
              <FunnelBar label="Scraped" value={data.funnel.scraped} max={data.funnel.scraped} color="#a78bfa" icon={Users} />
              <FunnelBar label="Enriched" value={data.funnel.enriched} max={data.funnel.scraped} color="#818cf8" icon={TrendingUp} />
              <FunnelBar label="Contacted" value={data.funnel.contacted} max={data.funnel.scraped} color="#22d3ee" icon={Mail} />
              <FunnelBar label="Replied" value={data.funnel.replied} max={data.funnel.scraped} color="#f59e0b" icon={Mail} />
              <FunnelBar label="Meeting Booked" value={data.funnel.meetings} max={data.funnel.scraped} color="#4ade80" icon={Calendar} />
              <FunnelBar label="Converted Client" value={data.funnel.clients} max={data.funnel.scraped} color="#10b981" icon={Users} />
            </div>

            {/* Top niches + sources */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: 'rgba(13,18,48,0.7)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 14, padding: 20, flex: 1 }}>
                <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 15, fontWeight: 700, margin: '0 0 14px' }}>🏆 Top Niches</h3>
                {data.topNiches.length > 0 ? data.topNiches.map((n, i) => (
                  <div key={n.niche} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(139,92,246,0.06)' }}>
                    <span style={{ fontSize: 13, color: 'rgba(148,163,184,0.7)' }}>#{i + 1} {n.niche}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa' }}>{n.count}</span>
                  </div>
                )) : <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.3)', textAlign: 'center', padding: 12 }}>No niche data yet</p>}
              </div>

              <div style={{ background: 'rgba(13,18,48,0.7)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 14, padding: 20 }}>
                <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 15, fontWeight: 700, margin: '0 0 14px' }}>📡 Lead Sources</h3>
                {Object.entries(data.bySource || {}).map(([source, count]) => (
                  <div key={source} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(139,92,246,0.06)' }}>
                    <span style={{ fontSize: 13, color: 'rgba(148,163,184,0.7)', textTransform: 'capitalize' }}>{source}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#22d3ee' }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Weekly Report Sender */}
          <div style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(34,211,238,0.04))', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 14, padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 15, fontWeight: 700, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Send size={15} color="#a78bfa" /> Weekly Email Report
                </h3>
                <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.4)', margin: 0 }}>
                  Auto-sends every Monday at 8am • Or send now manually
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                type="email"
                value={reportEmail}
                onChange={e => setReportEmail(e.target.value)}
                placeholder="your@email.com"
                style={{ flex: 1, padding: '10px 14px', background: 'rgba(13,18,48,0.8)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, color: '#e2e8f0', fontSize: 14 }}
              />
              <button
                onClick={sendReport}
                disabled={sending}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}
              >
                {sending ? '⏳ Sending...' : (<><Send size={14} /> Send Report</>)}
              </button>
            </div>
            <p style={{ fontSize: 11, color: 'rgba(148,163,184,0.3)', marginTop: 10 }}>
              💡 Add <code style={{ background: 'rgba(139,92,246,0.1)', padding: '1px 5px', borderRadius: 4 }}>BREVO_API_KEY</code> and <code style={{ background: 'rgba(139,92,246,0.1)', padding: '1px 5px', borderRadius: 4 }}>REPORT_EMAIL</code> to Railway for automatic weekly reports.
            </p>
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: 60, color: 'rgba(148,163,184,0.4)' }}>No analytics data yet. Start scraping leads!</div>
      )}
    </div>
  )
}

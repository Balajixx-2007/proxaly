/**
 * Channels Page — Multi-channel outreach hub
 * WhatsApp (Twilio) + LinkedIn (AI message generator + launcher)
 */
import { useState, useEffect } from 'react'
import {
  MessageCircle, BriefcaseBusiness, Send, Copy, ExternalLink,
  CheckCircle, Phone, RefreshCw, Zap, Info, ChevronRight
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'

const TABS = [
  { id: 'overview', label: 'Overview', icon: Zap },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { id: 'linkedin', label: 'LinkedIn', icon: BriefcaseBusiness },
]

// ── Channel stat card ─────────────────────────────────────────────────────────
function ChannelCard({ icon: Icon, label, value, color, sub, active }) {
  return (
    <div style={{
      background: active ? `${color}08` : 'rgba(13,18,48,0.7)',
      border: `1px solid ${active ? color + '30' : 'rgba(139,92,246,0.12)'}`,
      borderRadius: 14, padding: '20px 22px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: `${color}18`, border: `1px solid ${color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} color={color} />
        </div>
        <div>
          <div style={{ fontSize: 13, color: 'rgba(148,163,184,0.6)' }}>{label}</div>
          {active && <div style={{ fontSize: 10, color, fontWeight: 600 }}>● ACTIVE</div>}
        </div>
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color, fontFamily: 'Space Grotesk, sans-serif' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.4)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

// ── WhatsApp lead row ─────────────────────────────────────────────────────────
function WALeadRow({ lead, onSend }) {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSend = async () => {
    setSending(true)
    try {
      await onSend(lead)
      setSent(true)
      toast.success(`WhatsApp sent to ${lead.name}!`)
    } catch (err) {
      toast.error(err.message)
    }
    setSending(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(139,92,246,0.06)' }}>
      <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <MessageCircle size={15} color="#25d366" />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{lead.name}</div>
        <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.5)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Phone size={10} /> {lead.phone}
          <span style={{ padding: '1px 6px', borderRadius: 999, background: 'rgba(34,211,238,0.1)', color: '#22d3ee', fontSize: 10 }}>{lead.status}</span>
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.4)' }}>{lead.company}</div>
      {sent ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#4ade80', fontSize: 12 }}>
          <CheckCircle size={14} /> Sent
        </div>
      ) : (
        <button
          onClick={handleSend}
          disabled={sending}
          style={{ padding: '7px 14px', background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.25)', borderRadius: 8, color: '#25d366', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
        >
          {sending ? '⏳' : <><Send size={11} style={{ marginRight: 4 }} />Send</>}
        </button>
      )}
    </div>
  )
}

// ── LinkedIn lead row ─────────────────────────────────────────────────────────
function LILeadRow({ lead }) {
  const [message, setMessage] = useState(null)
  const [linkedinUrl, setLinkedinUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const [logged, setLogged] = useState(lead.linkedin_messaged || false)

  const generate = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/channels/linkedin/message/${lead.id}`)
      setMessage(res.data.message)
      setLinkedinUrl(res.data.linkedinUrl)
    } catch {
      toast.error('Failed to generate message')
    }
    setLoading(false)
  }

  const handleCopyAndOpen = async () => {
    navigator.clipboard.writeText(message)
    toast.success('Message copied! Opening LinkedIn...')
    window.open(linkedinUrl, '_blank')
    // Log it
    try {
      await api.post(`/channels/linkedin/log/${lead.id}`)
      setLogged(true)
    } catch {
      // Logging message status is best-effort.
    }
  }

  return (
    <div style={{ padding: '14px 0', borderBottom: '1px solid rgba(139,92,246,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: message ? 10 : 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(10,102,194,0.12)', border: '1px solid rgba(10,102,194,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <BriefcaseBusiness size={15} color="#0a66c2" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{lead.name}</div>
          <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.5)' }}>{lead.company}</div>
        </div>
        {logged && <span style={{ fontSize: 11, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={12} /> Done</span>}
        {!message ? (
          <button
            onClick={generate}
            disabled={loading}
            style={{ padding: '7px 12px', background: 'rgba(10,102,194,0.1)', border: '1px solid rgba(10,102,194,0.25)', borderRadius: 8, color: '#0a66c2', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
          >
            {loading ? '⏳' : '🤖 Generate'}
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => { navigator.clipboard.writeText(message); toast.success('Copied!') }} style={{ padding: '7px 10px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, color: '#a78bfa', cursor: 'pointer' }}>
              <Copy size={13} />
            </button>
            <button onClick={handleCopyAndOpen} style={{ padding: '7px 12px', background: 'rgba(10,102,194,0.1)', border: '1px solid rgba(10,102,194,0.25)', borderRadius: 8, color: '#0a66c2', fontSize: 12, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
              <ExternalLink size={12} /> Open LinkedIn
            </button>
          </div>
        )}
      </div>

      {message && (
        <div style={{ marginLeft: 48, padding: '10px 14px', background: 'rgba(10,102,194,0.06)', border: '1px solid rgba(10,102,194,0.12)', borderRadius: 8, fontSize: 12, color: 'rgba(226,232,240,0.7)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {message}
        </div>
      )}
    </div>
  )
}

export default function Channels() {
  const [tab, setTab] = useState('overview')
  const [stats, setStats] = useState(null)
  const [waQueue, setWaQueue] = useState([])
  const [liQueue, setLiQueue] = useState([])
  const [loadingWA, setLoadingWA] = useState(false)
  const [loadingLI, setLoadingLI] = useState(false)
  const [bulkSending, setBulkSending] = useState(false)

  useEffect(() => {
    api.get('/channels/stats').then(r => setStats(r.data)).catch(() => {})
  }, [])

  const loadWAQueue = async () => {
    setLoadingWA(true)
    try {
      const r = await api.get('/channels/whatsapp/queue')
      setWaQueue(r.data)
    } catch { toast.error('Failed to load WhatsApp queue') }
    setLoadingWA(false)
  }

  const loadLIQueue = async () => {
    setLoadingLI(true)
    try {
      const r = await api.get('/channels/linkedin/queue')
      setLiQueue(r.data)
    } catch { toast.error('Failed to load LinkedIn queue') }
    setLoadingLI(false)
  }

  useEffect(() => { if (tab === 'whatsapp') loadWAQueue() }, [tab])
  useEffect(() => { if (tab === 'linkedin') loadLIQueue() }, [tab])

  const sendWhatsApp = async (lead) => {
    await api.post('/channels/whatsapp/send', { leadId: lead.id })
  }

  const handleBulkWA = async () => {
    setBulkSending(true)
    try {
      const r = await api.post('/channels/whatsapp/bulk')
      toast.success(r.data.message)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Bulk send failed')
    }
    setBulkSending(false)
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 28, fontWeight: 800, margin: '0 0 6px' }}>
          <span className="gradient-text">Multi-Channel Outreach</span>
        </h1>
        <p style={{ color: 'rgba(148,163,184,0.5)', fontSize: 14, margin: 0 }}>
          Email → WhatsApp → LinkedIn — Triple the touchpoints, triple the replies
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, background: 'rgba(13,18,48,0.7)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px',
              borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: tab === t.id ? 'linear-gradient(135deg, rgba(124,58,237,0.4), rgba(34,211,238,0.2))' : 'transparent',
              color: tab === t.id ? '#e2e8f0' : 'rgba(148,163,184,0.5)',
              transition: 'all 0.15s',
            }}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {tab === 'overview' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
            <ChannelCard icon={Send} label="Email Outreach" value={stats?.email ?? '—'} color="#22d3ee" sub="Leads contacted by email" active />
            <ChannelCard icon={MessageCircle} label="WhatsApp Sent" value={stats?.whatsapp ?? '—'} color="#25d366" sub="Via Twilio API" active={stats?.whatsapp > 0} />
            <ChannelCard icon={BriefcaseBusiness} label="LinkedIn Queue" value={stats?.linkedin ?? '—'} color="#0a66c2" sub="AI messages generated" active={stats?.linkedin > 0} />
          </div>

          {/* How it works */}
          <div style={{ background: 'rgba(13,18,48,0.7)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 14, padding: 24, marginBottom: 24 }}>
            <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 16, margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={16} color="#f59e0b" /> How Multi-Channel Works
            </h3>
            {[
              { step: '1', icon: '✉️', channel: 'Email', desc: 'Day 1 — AI-personalized cold email sent automatically', color: '#22d3ee' },
              { step: '2', icon: '📧', channel: 'Follow-up Email', desc: 'Day 4 — AI follow-up if no reply', color: '#a78bfa' },
              { step: '3', icon: '📱', channel: 'WhatsApp', desc: 'Day 7 — WhatsApp message via Twilio (if phone number available)', color: '#25d366' },
              { step: '4', icon: '💼', channel: 'LinkedIn', desc: 'Manual — AI generates personalized DM, you click to send', color: '#0a66c2' },
            ].map(s => (
              <div key={s.step} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${s.color}18`, border: `1px solid ${s.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: s.color, flexShrink: 0 }}>{s.step}</div>
                <div style={{ fontSize: 20, flexShrink: 0 }}>{s.icon}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: s.color }}>{s.channel}</div>
                  <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.5)' }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Setup requirements */}
          <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: 18 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Info size={14} /> Railway Config Required
            </h4>
            {[
              { key: 'TWILIO_ACCOUNT_SID', desc: 'From twilio.com console' },
              { key: 'TWILIO_AUTH_TOKEN', desc: 'From twilio.com console' },
              { key: 'TWILIO_WHATSAPP_FROM', desc: 'Format: whatsapp:+14155238886 (sandbox)' },
            ].map(e => (
              <div key={e.key} style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                <code style={{ fontSize: 12, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>{e.key}</code>
                <span style={{ fontSize: 12, color: 'rgba(148,163,184,0.5)' }}>{e.desc}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* WHATSAPP TAB */}
      {tab === 'whatsapp' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 18, fontWeight: 700, margin: '0 0 4px', color: '#25d366' }}>📱 WhatsApp Queue</h2>
              <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.5)', margin: 0 }}>Leads with phone numbers, emailed already, no WhatsApp yet</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={loadWAQueue} style={{ padding: '8px 12px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, color: '#a78bfa', cursor: 'pointer' }}>
                <RefreshCw size={14} />
              </button>
              <button
                onClick={handleBulkWA}
                disabled={bulkSending || waQueue.length === 0}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'linear-gradient(135deg, #25d366, #128c7e)' }}
              >
                {bulkSending ? '⏳ Sending...' : <><Send size={13} /> Bulk Send ({waQueue.length})</>}
              </button>
            </div>
          </div>

          <div style={{ background: 'rgba(13,18,48,0.7)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 14, padding: '4px 20px' }}>
            {loadingWA ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'rgba(148,163,184,0.4)' }}>Loading...</div>
            ) : waQueue.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <MessageCircle size={36} color="rgba(37,211,102,0.3)" style={{ marginBottom: 12 }} />
                <p style={{ color: 'rgba(148,163,184,0.4)', fontSize: 13 }}>
                  No leads ready for WhatsApp yet.<br />
                  Add phone numbers to leads and send email first.
                </p>
              </div>
            ) : (
              waQueue.map(lead => <WALeadRow key={lead.id} lead={lead} onSend={sendWhatsApp} />)
            )}
          </div>
        </div>
      )}

      {/* LINKEDIN TAB */}
      {tab === 'linkedin' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 18, fontWeight: 700, margin: '0 0 4px', color: '#0a66c2' }}>💼 LinkedIn Queue</h2>
              <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.5)', margin: 0 }}>AI generates DM → you copy & send on LinkedIn (1-click workflow)</p>
            </div>
            <button onClick={loadLIQueue} style={{ padding: '8px 12px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, color: '#a78bfa', cursor: 'pointer' }}>
              <RefreshCw size={14} />
            </button>
          </div>

          <div style={{ padding: '10px 16px', background: 'rgba(10,102,194,0.06)', border: '1px solid rgba(10,102,194,0.15)', borderRadius: 10, marginBottom: 16, fontSize: 13, color: 'rgba(148,163,184,0.6)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Info size={14} color="#0a66c2" />
            Click <strong style={{ color: '#0a66c2' }}>Generate</strong> → AI writes the DM → Click <strong style={{ color: '#0a66c2' }}>Open LinkedIn</strong> → Message is copied → Paste & send!
          </div>

          <div style={{ background: 'rgba(13,18,48,0.7)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 14, padding: '4px 20px' }}>
            {loadingLI ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'rgba(148,163,184,0.4)' }}>Loading...</div>
            ) : liQueue.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <BriefcaseBusiness size={36} color="rgba(10,102,194,0.3)" style={{ marginBottom: 12 }} />
                <p style={{ color: 'rgba(148,163,184,0.4)', fontSize: 13 }}>No leads in LinkedIn queue.</p>
              </div>
            ) : (
              liQueue.map(lead => <LILeadRow key={lead.id} lead={lead} />)
            )}
          </div>
        </div>
      )}
    </div>
  )
}

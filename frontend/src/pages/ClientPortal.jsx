/**
 * Client Portal — Public page accessed via unique token
 * URL: /client/:token
 * No login required — clients see THEIR results only
 */
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {
  Users, Mail, Calendar, TrendingUp, CheckCircle,
  BarChart2, Clock, ArrowUpRight, Building2
} from 'lucide-react'
import api from '../lib/api'

const STATUS_COLORS = {
  'New': '#a78bfa',
  'Contacted': '#22d3ee',
  'Replied': '#f59e0b',
  'Meeting Booked': '#4ade80',
  'Client': '#10b981',
}

function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div style={{
      background: 'rgba(13,18,48,0.8)', border: `1px solid ${color}20`,
      borderRadius: 14, padding: '20px 22px', position: 'relative', overflow: 'hidden'
    }}>
      <div style={{ position: 'absolute', right: -10, top: -10, width: 80, height: 80, borderRadius: '50%', background: `${color}08` }} />
      <div style={{ width: 38, height: 38, borderRadius: 10, background: `${color}18`, border: `1px solid ${color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        <Icon size={18} color={color} />
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color, fontFamily: 'Space Grotesk, sans-serif', marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 13, color: 'rgba(148,163,184,0.6)' }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.35)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function ProgressBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: 'rgba(148,163,184,0.7)' }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{value}</span>
      </div>
      <div style={{ height: 6, background: 'rgba(139,92,246,0.1)', borderRadius: 999 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 999, transition: 'width 1s ease' }} />
      </div>
    </div>
  )
}

export default function ClientPortal() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [branding, setBranding] = useState({
    name: 'Proxaly',
    tagline: 'AI-Powered Lead Generation & Outreach',
    logoUrl: '',
    primaryColor: '#7c3aed',
    accentColor: '#22d3ee',
    footerText: '',
    supportEmail: 'support@proxaly.app',
    websiteUrl: 'https://proxaly.app',
    hideProxaly: false,
  })

  useEffect(() => {
    const load = async () => {
      try {
        const [clientRes, brandingRes] = await Promise.all([
          api.get(`/clients/portal/${token}`),
          api.get(`/branding/portal/${token}`).catch(() => ({ data: null }))
        ])
        setData(clientRes.data)

        // Apply branding
        const b = brandingRes.data
        if (b) {
          setBranding({
            name: b.agency_name || 'Proxaly',
            tagline: b.agency_tagline || 'AI-Powered Lead Generation & Outreach',
            logoUrl: b.logo_url || '',
            primaryColor: b.primary_color || '#7c3aed',
            accentColor: b.accent_color || '#22d3ee',
            footerText: b.footer_text || '',
            supportEmail: b.support_email || 'support@proxaly.app',
            websiteUrl: b.website_url || 'https://proxaly.app',
            hideProxaly: b.hide_proxaly_branding || false,
          })
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Portal not found')
      }
      setLoading(false)
    }
    load()
  }, [token])


  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#050814', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, border: '3px solid rgba(139,92,246,0.2)', borderTopColor: '#8b5cf6', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: 'rgba(148,163,184,0.5)', fontFamily: 'Inter, sans-serif', fontSize: 14 }}>Loading your dashboard…</p>
      </div>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', background: '#050814', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', padding: 40, maxWidth: 400 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <h2 style={{ color: '#e2e8f0', fontFamily: 'Space Grotesk, sans-serif', marginBottom: 8 }}>Portal Not Found</h2>
        <p style={{ color: 'rgba(148,163,184,0.5)', fontSize: 14 }}>{error}</p>
      </div>
    </div>
  )

  const { client, stats, recentActivity } = data

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #050814 0%, #0a0f2e 50%, #050814 100%)', fontFamily: 'Inter, sans-serif', color: '#e2e8f0' }}>
      {/* CSS animations */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@700;800&display=swap');
        * { box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.4s ease; }
      `}</style>

      {/* Top bar / header */}
      <div style={{ borderBottom: '1px solid rgba(139,92,246,0.1)', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(5,8,20,0.8)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt={branding.name} style={{ height: 32, borderRadius: 6, objectFit: 'contain' }} onError={e => e.target.style.display='none'} />
          ) : (
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${branding.primaryColor}, ${branding.accentColor})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>⚡</div>
          )}
          <div>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800, fontSize: 15, color: '#e2e8f0' }}>{branding.name}</div>
            <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.4)' }}>Client Report Portal</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 999 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80' }} />
          <span style={{ fontSize: 12, color: '#4ade80', fontWeight: 600 }}>Campaign Active</span>
        </div>
      </div>

      <div className="fade-in" style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>

        {/* Welcome */}
        <div style={{ marginBottom: 36, textAlign: 'center' }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(34,211,238,0.2))', border: '1px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>🏢</div>
          <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 28, fontWeight: 800, margin: '0 0 8px', background: `linear-gradient(135deg, #e2e8f0, ${branding.primaryColor})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {client.businessName || client.name} — Campaign Report
          </h1>
          <p style={{ color: 'rgba(148,163,184,0.5)', fontSize: 14, margin: 0 }}>
            Your AI-powered outreach campaign managed by {branding.name}
          </p>
          <div style={{ display: 'inline-flex', gap: 8, marginTop: 12 }}>
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, background: 'rgba(34,211,238,0.1)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.2)' }}>
              {client.niche || 'Custom Campaign'}
            </span>
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}>
              {client.plan?.toUpperCase()} Plan
            </span>
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 36 }}>
          <StatCard icon={Users} label="Total Leads Found" value={stats.totalLeads} color="#a78bfa" sub="Identified by AI" />
          <StatCard icon={Mail} label="Emails Sent" value={stats.emailsSent} color="#22d3ee" sub="Personalised outreach" />
          <StatCard icon={TrendingUp} label="Replies Received" value={stats.replies} color="#f59e0b" sub={stats.emailsSent > 0 ? `${Math.round((stats.replies / stats.emailsSent) * 100)}% reply rate` : '—'} />
          <StatCard icon={Calendar} label="Meetings Booked" value={stats.meetingsBooked} color="#4ade80" sub="Confirmed calls" />
        </div>

        {/* Funnel */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 36 }}>
          <div style={{ background: 'rgba(13,18,48,0.7)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 14, padding: 22 }}>
            <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 15, fontWeight: 700, margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart2 size={16} color="#a78bfa" /> Campaign Funnel
            </h3>
            <ProgressBar label="Leads Found" value={stats.totalLeads} max={stats.totalLeads || 1} color="#a78bfa" />
            <ProgressBar label="Emails Sent" value={stats.emailsSent} max={stats.totalLeads || 1} color="#22d3ee" />
            <ProgressBar label="Replies" value={stats.replies} max={stats.totalLeads || 1} color="#f59e0b" />
            <ProgressBar label="Meetings Booked" value={stats.meetingsBooked} max={stats.totalLeads || 1} color="#4ade80" />
          </div>

          <div style={{ background: 'rgba(13,18,48,0.7)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 14, padding: 22 }}>
            <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 15, fontWeight: 700, margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={16} color="#4ade80" /> Key Performance
            </h3>
            {[
              { label: 'Reply Rate', value: stats.emailsSent > 0 ? `${Math.round((stats.replies / stats.emailsSent) * 100)}%` : 'N/A', color: '#f59e0b', good: true },
              { label: 'Meeting Rate', value: stats.emailsSent > 0 ? `${Math.round((stats.meetingsBooked / stats.emailsSent) * 100)}%` : 'N/A', color: '#4ade80', good: true },
              { label: 'Leads → Contacted', value: stats.emailsSent > 0 ? `${Math.round((stats.emailsSent / (stats.totalLeads || 1)) * 100)}%` : 'N/A', color: '#22d3ee', good: true },
            ].map(m => (
              <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(139,92,246,0.08)' }}>
                <span style={{ fontSize: 13, color: 'rgba(148,163,184,0.6)' }}>{m.label}</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: m.color, fontFamily: 'Space Grotesk, sans-serif' }}>{m.value}</span>
              </div>
            ))}
            <div style={{ marginTop: 16, padding: '10px 12px', background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: 8, fontSize: 12, color: 'rgba(74,222,128,0.8)', lineHeight: 1.5 }}>
              ✅ Campaign is running on autopilot. Results update in real-time.
            </div>
          </div>
        </div>

        {/* Recent activity */}
        {recentActivity.length > 0 && (
          <div style={{ background: 'rgba(13,18,48,0.7)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 14, padding: 22 }}>
            <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 15, fontWeight: 700, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={16} color="#22d3ee" /> Recent Activity
            </h3>
            <div>
              {recentActivity.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < recentActivity.length - 1 ? '1px solid rgba(139,92,246,0.06)' : 'none' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: `${STATUS_COLORS[item.status] || '#a78bfa'}18`, border: `1px solid ${STATUS_COLORS[item.status] || '#a78bfa'}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Building2 size={14} color={STATUS_COLORS[item.status] || '#a78bfa'} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{item.name || item.company}</div>
                    <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.4)' }}>{item.company}</div>
                  </div>
                  <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, background: `${STATUS_COLORS[item.status] || '#a78bfa'}15`, color: STATUS_COLORS[item.status] || '#a78bfa', fontWeight: 600 }}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 48, paddingTop: 24, borderTop: '1px solid rgba(139,92,246,0.08)' }}>
          <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.35)' }}>
            Powered by <strong style={{ color: 'rgba(139,92,246,0.6)' }}>Proxaly</strong> — AI-Powered Lead Generation & Outreach
          </div>
        </div>
      </div>
    </div>
  )
}

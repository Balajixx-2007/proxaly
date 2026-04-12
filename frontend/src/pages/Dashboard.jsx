// Dashboard — stats overview + quick actions
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { leadsApi, campaignsApi } from '../lib/api'
import { Users, Megaphone, Zap, Plus, ArrowRight, Target, Activity } from 'lucide-react'
import AutomationCard from './AutomationCard'

function StatCard({ icon: Icon, label, value, sub, color = '#a78bfa', delta }) {
  return (
    <div className="stat-card fade-in" style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.6)', margin: '0 0 8px' }}>{label}</p>
          <p style={{ fontSize: 32, fontWeight: 700, margin: 0, color, fontFamily: 'Space Grotesk, sans-serif' }}>{value}</p>
          {sub && <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.5)', marginTop: 4 }}>{sub}</p>}
        </div>
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: `${color}18`,
          border: `1px solid ${color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Icon size={20} color={color} />
        </div>
      </div>
      {delta !== undefined && (
        <div style={{ marginTop: 12, fontSize: 12, color: delta >= 0 ? '#4ade80' : '#f87171' }}>
          {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}% from last week
        </div>
      )}
    </div>
  )
}

function RecentLead({ lead }) {
  const scoreColor = lead.ai_score >= 7 ? '#4ade80' : lead.ai_score >= 4 ? '#fbbf24' : '#f87171'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 0', borderBottom: '1px solid rgba(139,92,246,0.07)'
    }}>
      <div>
        <p style={{ fontSize: 14, fontWeight: 500, color: '#e2e8f0', margin: 0 }}>{lead.name}</p>
        <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.5)', margin: '2px 0 0' }}>
          {lead.city} · {lead.business_type}
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {lead.ai_score && (
          <span style={{ fontSize: 13, fontWeight: 600, color: scoreColor }}>
            {lead.ai_score}/10
          </span>
        )}
        <span className={`badge badge-${lead.status || 'new'}`}>{lead.status || 'New'}</span>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState({ leads: 0, campaigns: 0, contacted: 0, converted: 0 })
  const [recentLeads, setRecentLeads] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [leadsRes, campaignsRes] = await Promise.all([
        leadsApi.list({ limit: 5, orderBy: 'created_at', order: 'desc' }),
        campaignsApi.list(),
      ])
      const allLeads = leadsRes.data?.leads || []
      const campaigns = campaignsRes.data?.campaigns || []
      const totalLeads = leadsRes.data?.total || allLeads.length

      setRecentLeads(allLeads.slice(0, 5))
      setStats({
        leads: totalLeads,
        campaigns: campaigns.length,
        contacted: allLeads.filter(l => l.status === 'contacted').length,
        converted: allLeads.filter(l => l.status === 'converted').length,
      })
    } catch (loadErr) {
      // Backend might not be running — show zeros gracefully
      console.warn('Could not load dashboard data:', loadErr.message)
    } finally {
      setLoading(false)
    }
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  }

  const convRate = stats.leads > 0 ? ((stats.converted / stats.leads) * 100).toFixed(1) : '0.0'

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 28, fontWeight: 700, margin: 0 }}>
          {greeting()}, <span className="gradient-text">{user?.email?.split('@')[0]}</span> 👋
        </h1>
        <p style={{ color: 'rgba(148,163,184,0.6)', marginTop: 6 }}>
          Here's what's happening with your contact-ready prospect pipeline today.
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        {loading ? (
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 110, borderRadius: 12 }} />
          ))
        ) : (
          <>
            <StatCard icon={Users} label="Total Leads" value={stats.leads} sub="All time" color="#a78bfa" delta={12} />
            <StatCard icon={Megaphone} label="Campaigns" value={stats.campaigns} sub="Active" color="#22d3ee" />
            <StatCard icon={Activity} label="Contacted" value={stats.contacted} sub="Outreach sent" color="#f59e0b" />
            <StatCard icon={Target} label="Converted" value={`${convRate}%`} sub="Conversion rate" color="#4ade80" delta={3} />
          </>
        )}
      </div>

      {/* Bottom grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        {/* Recent leads */}
        <div className="glass" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Recent Leads</h2>
            <Link to="/leads" style={{ color: '#a78bfa', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {loading ? (
            Array(4).fill(0).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 52, marginBottom: 8, borderRadius: 6 }} />
            ))
          ) : recentLeads.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(148,163,184,0.4)' }}>
              <Users size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
              <p style={{ margin: 0 }}>No leads yet — scrape your first batch!</p>
            </div>
          ) : (
            recentLeads.map(lead => <RecentLead key={lead.id} lead={lead} />)
          )}
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="glass" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px' }}>Quick Actions</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link to="/leads" style={{ textDecoration: 'none' }}>
                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  <Zap size={16} /> Find New Leads
                </button>
              </Link>
              <Link to="/campaigns" style={{ textDecoration: 'none' }}>
                <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }}>
                  <Plus size={16} /> New Campaign
                </button>
              </Link>
            </div>
          </div>

          {/* Automation Card */}
          <AutomationCard />

          {/* Plan badge */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(34,211,238,0.1))',
            border: '1px solid rgba(139,92,246,0.25)', borderRadius: 12, padding: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Zap size={16} color="#a78bfa" />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#a78bfa' }}>Free Plan</span>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(148,163,184,0.6)', marginBottom: 6 }}>
                <span>Leads used</span>
                <span>{stats.leads}/50</span>
              </div>
              <div style={{ height: 6, background: 'rgba(139,92,246,0.15)', borderRadius: 3 }}>
                <div style={{
                  height: '100%', width: `${Math.min((stats.leads / 50) * 100, 100)}%`,
                  background: 'linear-gradient(90deg, #7c3aed, #22d3ee)',
                  borderRadius: 3, transition: 'width 0.5s ease'
                }} />
              </div>
            </div>
            <Link to="/billing" style={{ textDecoration: 'none' }}>
              <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}>
                Upgrade to Pro
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

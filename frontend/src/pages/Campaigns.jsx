// Campaigns page — create/manage campaigns with leads
import { useState, useEffect, useMemo } from 'react'
import { campaignsApi, leadsApi } from '../lib/api'
import toast from 'react-hot-toast'
import { Plus, Megaphone, Trash2, Users, TrendingUp, X, Loader2, Search, Mail, Link2, Sparkles } from 'lucide-react'

function buildIdeas(campaign) {
  const base = campaign.description?.trim() || campaign.name?.trim() || 'your campaign'
  return [
    `Open with a short note on how ${base.toLowerCase()} can create more qualified conversations.`,
    `Use a proof-first angle: one concrete result, one clear CTA, no fluff.`,
    `End with a low-friction offer such as a quick audit or a 15-minute walkthrough.`,
  ]
}

function CampaignCard({ campaign, onDelete, onManage }) {
  const convRate = campaign.total_leads > 0
    ? ((campaign.converted / campaign.total_leads) * 100).toFixed(0)
    : 0

  return (
    <div className="glass glass-hover fade-in" style={{ padding: '24px', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(34,211,238,0.15))',
            border: '1px solid rgba(139,92,246,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Megaphone size={16} color="#a78bfa" />
          </div>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{campaign.name}</h3>
            <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.5)', margin: '2px 0 0' }}>
              {new Date(campaign.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <button onClick={() => onDelete(campaign.id)} className="btn btn-danger" style={{ padding: '4px 8px' }}>
          <Trash2 size={12} />
        </button>
      </div>

      {campaign.description && (
        <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.6)', margin: '0 0 16px' }}>
          {campaign.description}
        </p>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {[
          { label: 'Total', value: campaign.total_leads || 0, color: '#a78bfa', icon: Users },
          { label: 'Contacted', value: campaign.contacted || 0, color: '#22d3ee', icon: TrendingUp },
          { label: 'Converted', value: `${convRate}%`, color: '#4ade80', icon: TrendingUp },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: `${color}0d`,
            border: `1px solid ${color}20`,
            borderRadius: 8, padding: '10px 12px', textAlign: 'center'
          }}>
            <p style={{ fontSize: 18, fontWeight: 700, color, margin: 0, fontFamily: 'Space Grotesk, sans-serif' }}>
              {value}
            </p>
            <p style={{ fontSize: 11, color: 'rgba(148,163,184,0.5)', margin: '4px 0 0' }}>{label}</p>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => onManage(campaign)} className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 12 }}>
          Manage Leads
        </button>
        <button onClick={() => onManage(campaign, 'ideas')} className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 12 }}>
          Outreach Ideas
        </button>
      </div>
    </div>
  )
}

function CreateModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return toast.error('Campaign name is required')
    setLoading(true)
    try {
      await onCreate({ name, description })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      backdropFilter: 'blur(4px)'
    }}>
      <div className="glass" style={{ width: 440, padding: '32px', maxWidth: '90vw' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>New Campaign</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(148,163,184,0.5)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'rgba(148,163,184,0.7)', marginBottom: 6 }}>
              Campaign Name *
            </label>
            <input
              id="campaign-name"
              className="input"
              placeholder="e.g. Chennai Dental Outreach"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'rgba(148,163,184,0.7)', marginBottom: 6 }}>
              Description
            </label>
            <textarea
              className="input"
              placeholder="Optional campaign description…"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              style={{ resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <Loader2 size={14} className="spinner" /> : <Plus size={14} />}
              Create Campaign
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ManageModal({ campaign, onClose, onChanged }) {
  const [loading, setLoading] = useState(true)
  const [assigned, setAssigned] = useState([])
  const [allLeads, setAllLeads] = useState([])
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [mode, setMode] = useState('leads')

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      try {
        const [assignedRes, leadsRes] = await Promise.all([
          campaignsApi.campaignLeads(campaign.id),
          leadsApi.list({ limit: 200 }),
        ])
        if (!mounted) return
        setAssigned(assignedRes.data?.leads || [])
        setAllLeads(leadsRes.data?.leads || [])
      } catch {
        if (mounted) {
          toast.error('Failed to load campaign leads')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [campaign.id])

  const assignedIds = useMemo(() => new Set(assigned.map(l => l.id)), [assigned])
  const availableLeads = useMemo(() => allLeads.filter(lead => !assignedIds.has(lead.id)), [allLeads, assignedIds])
  const filteredAvailable = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return availableLeads
    return availableLeads.filter(lead =>
      [lead.name, lead.email, lead.city, lead.business_type]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(q))
    )
  }, [availableLeads, query])

  const assignLead = async (leadId) => {
    setBusyId(leadId)
    try {
      await campaignsApi.addLead(campaign.id, leadId)
      const lead = allLeads.find(item => item.id === leadId)
      if (lead) setAssigned(prev => [lead, ...prev])
      onChanged()
      toast.success('Lead added to campaign')
    } catch {
      toast.error('Failed to add lead')
    } finally {
      setBusyId(null)
    }
  }

  const removeLead = async (leadId) => {
    setBusyId(leadId)
    try {
      await campaignsApi.removeLead(campaign.id, leadId)
      setAssigned(prev => prev.filter(lead => lead.id !== leadId))
      onChanged()
      toast.success('Lead removed')
    } catch {
      toast.error('Failed to remove lead')
    } finally {
      setBusyId(null)
    }
  }

  const ideas = buildIdeas(campaign)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(2,6,23,0.72)', backdropFilter: 'blur(6px)', display: 'grid', placeItems: 'center', padding: 20 }} onClick={onClose}>
      <div className="glass" style={{ width: '100%', maxWidth: 980, maxHeight: '90vh', overflow: 'auto', padding: 24 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: 'Space Grotesk, sans-serif', fontSize: 24 }}>{campaign.name}</h2>
            <p style={{ margin: '6px 0 0', color: 'rgba(148,163,184,0.65)', fontSize: 13 }}>
              {campaign.description || 'No description yet'}
            </p>
          </div>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button className="btn btn-ghost" onClick={() => setMode('leads')} style={{ opacity: mode === 'leads' ? 1 : 0.6 }}>Leads</button>
          <button className="btn btn-ghost" onClick={() => setMode('ideas')} style={{ opacity: mode === 'ideas' ? 1 : 0.6 }}>Outreach Ideas</button>
        </div>

        {mode === 'ideas' ? (
          <div className="glass" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Sparkles size={15} color="#a78bfa" />
              <strong>Campaign Assistant</strong>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              {ideas.map((idea, index) => (
                <div key={index} style={{ background: 'rgba(13,18,48,0.55)', border: '1px solid rgba(139,92,246,0.14)', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 12, color: '#a78bfa', marginBottom: 6 }}>Idea {index + 1}</div>
                  <div style={{ color: 'rgba(226,232,240,0.9)', lineHeight: 1.6, fontSize: 13 }}>{idea}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, fontSize: 12, color: 'rgba(148,163,184,0.55)' }}>
              Use these as a starting point for your outreach sequence, then refine by niche and city.
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <div className="glass" style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <strong>Assigned Leads</strong>
                <span style={{ fontSize: 12, color: 'rgba(148,163,184,0.55)' }}>{assigned.length}</span>
              </div>
              {loading ? (
                <div style={{ padding: 12, color: 'rgba(148,163,184,0.55)' }}>Loading...</div>
              ) : assigned.length === 0 ? (
                <div style={{ padding: 12, color: 'rgba(148,163,184,0.55)' }}>No leads assigned yet.</div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {assigned.map(lead => (
                    <div key={lead.id} style={{ background: 'rgba(13,18,48,0.55)', border: '1px solid rgba(139,92,246,0.14)', borderRadius: 10, padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ color: '#e2e8f0', fontWeight: 700 }}>{lead.name}</div>
                          <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.65)' }}>{lead.email || 'No email'} · {lead.city || 'No city'}</div>
                        </div>
                        <button className="btn btn-ghost" onClick={() => removeLead(lead.id)} disabled={busyId === lead.id} style={{ padding: '6px 10px', fontSize: 12 }}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="glass" style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Search size={15} color="#22d3ee" />
                <strong>Add Leads</strong>
              </div>
              <input
                className="input"
                placeholder="Search leads by name, email, city, business type"
                value={query}
                onChange={e => setQuery(e.target.value)}
                style={{ marginBottom: 12 }}
              />
              {loading ? (
                <div style={{ padding: 12, color: 'rgba(148,163,184,0.55)' }}>Loading...</div>
              ) : filteredAvailable.length === 0 ? (
                <div style={{ padding: 12, color: 'rgba(148,163,184,0.55)' }}>No available leads found.</div>
              ) : (
                <div style={{ display: 'grid', gap: 10, maxHeight: 520, overflow: 'auto', paddingRight: 4 }}>
                  {filteredAvailable.map(lead => (
                    <div key={lead.id} style={{ background: 'rgba(13,18,48,0.55)', border: '1px solid rgba(139,92,246,0.14)', borderRadius: 10, padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ color: '#e2e8f0', fontWeight: 700 }}>{lead.name}</div>
                          <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.65)' }}>{lead.email || 'No email'} · {lead.city || 'No city'}</div>
                          <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.45)', marginTop: 4 }}>{lead.business_type || 'Unknown type'}</div>
                        </div>
                        <button className="btn btn-primary" onClick={() => assignLead(lead.id)} disabled={busyId === lead.id} style={{ padding: '6px 10px', fontSize: 12 }}>
                          Add
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [activeCampaign, setActiveCampaign] = useState(null)
  const [activeMode, setActiveMode] = useState('leads')

  useEffect(() => { fetchCampaigns() }, [])

  async function fetchCampaigns() {
    setLoading(true)
    try {
      const res = await campaignsApi.list()
      setCampaigns(res.data?.campaigns || [])
    } catch {
      setCampaigns([])
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (data) => {
    try {
      const res = await campaignsApi.create(data)
      setCampaigns(prev => [res.data?.campaign, ...prev].filter(Boolean))
      toast.success('Campaign created! 🎯')
    } catch {
      toast.error('Failed to create campaign')
    }
  }

  const handleDelete = async (id) => {
    setCampaigns(prev => prev.filter(c => c.id !== id))
    try {
      await campaignsApi.delete(id)
      toast.success('Campaign deleted')
    } catch {
      toast.error('Delete failed')
    }
  }

  const handleManage = (campaign, mode = 'leads') => {
    setActiveCampaign(campaign)
    setActiveMode(mode)
  }

  return (
    <div className="fade-in">
      {showModal && <CreateModal onClose={() => setShowModal(false)} onCreate={handleCreate} />}
      {activeCampaign && (
        <ManageModal
          campaign={activeCampaign}
          onClose={() => setActiveCampaign(null)}
          onChanged={fetchCampaigns}
          initialMode={activeMode}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 26, fontWeight: 700, margin: 0 }}>
            Campaigns
          </h1>
          <p style={{ color: 'rgba(148,163,184,0.6)', marginTop: 4, fontSize: 14 }}>
            Group and track your lead outreach campaigns
          </p>
        </div>
        <button id="new-campaign" onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={16} /> New Campaign
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 200, borderRadius: 12 }} />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="glass" style={{ padding: 60, textAlign: 'center' }}>
          <Megaphone size={48} style={{ color: 'rgba(139,92,246,0.3)', marginBottom: 16 }} />
          <p style={{ fontSize: 16, fontWeight: 500, color: 'rgba(148,163,184,0.6)', marginBottom: 8 }}>
            No campaigns yet
          </p>
          <p style={{ fontSize: 14, color: 'rgba(148,163,184,0.4)', marginBottom: 20 }}>
            Create a campaign to start grouping and tracking leads
          </p>
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            <Plus size={16} /> Create First Campaign
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {campaigns.map(c => (
            <CampaignCard key={c.id} campaign={c} onDelete={handleDelete} onManage={handleManage} />
          ))}
        </div>
      )}
    </div>
  )
}

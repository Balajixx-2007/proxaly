// Campaigns page — create/manage campaigns with leads
import { useState, useEffect } from 'react'
import { campaignsApi } from '../lib/api'
import toast from 'react-hot-toast'
import { Plus, Megaphone, Trash2, Users, TrendingUp, X, Loader2 } from 'lucide-react'

function CampaignCard({ campaign, onDelete }) {
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
        ].map(({ label, value, color, icon: Icon }) => (
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

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

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

  return (
    <div className="fade-in">
      {showModal && <CreateModal onClose={() => setShowModal(false)} onCreate={handleCreate} />}

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
            <CampaignCard key={c.id} campaign={c} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}

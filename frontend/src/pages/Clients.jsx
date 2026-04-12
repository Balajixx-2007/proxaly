/**
 * Clients Page — Agency admin manages all client accounts
 * Each client gets a private portal link (no login required for clients)
 */
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  Users, Plus, Copy, Link, Trash2, RefreshCw,
  Building2, Mail, CheckCircle, BarChart2, X, Eye
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'

const PLAN_COLORS = {
  starter: '#a78bfa',
  pro: '#22d3ee',
  agency: '#f59e0b',
}
const PLAN_LABELS = { starter: 'Starter', pro: 'Pro', agency: 'Agency' }

function StatPill({ icon: Icon, label, value, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: `${color}10`, border: `1px solid ${color}25`, borderRadius: 999 }}>
      <Icon size={12} color={color} />
      <span style={{ fontSize: 12, color: 'rgba(148,163,184,0.7)' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color }}>{value}</span>
    </div>
  )
}

function ClientCard({ client, onDelete, onCopyLink, onRegenToken }) {
  const planColor = PLAN_COLORS[client.plan] || '#a78bfa'
  const fronendUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'https://proxaly.vercel.app'
  const portalUrl = `${fronendUrl}/client/${client.portal_token}`

  return (
    <div style={{
      background: 'rgba(13,18,48,0.7)', border: '1px solid rgba(139,92,246,0.15)',
      borderRadius: 14, padding: 20, transition: 'border-color 0.2s',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: `${planColor}18`, border: `1px solid ${planColor}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building2 size={18} color={planColor} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#e2e8f0' }}>{client.business_name || client.name}</div>
            <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.5)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Mail size={10} /> {client.email}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, background: `${planColor}18`, color: planColor, fontWeight: 600 }}>
            {PLAN_LABELS[client.plan]}
          </span>
          <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, background: client.status === 'active' ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)', color: client.status === 'active' ? '#4ade80' : '#ef4444', fontWeight: 600 }}>
            {client.status}
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <StatPill icon={Users} label="Leads" value={client.leads_sent || 0} color="#a78bfa" />
        <StatPill icon={CheckCircle} label="Meetings" value={client.meetings_booked || 0} color="#4ade80" />
        <StatPill icon={BarChart2} label="Niche" value={client.niche || 'N/A'} color="#22d3ee" />
      </div>

      {/* Portal link */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.12)', borderRadius: 8, marginBottom: 12 }}>
        <Link size={12} color="#7c3aed" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: 'rgba(148,163,184,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {portalUrl}
        </span>
        <button onClick={() => onCopyLink(portalUrl)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(148,163,184,0.5)', padding: 2 }}>
          <Copy size={13} />
        </button>
      </div>

      {/* Notes */}
      {client.notes && (
        <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.5)', margin: '0 0 12px', lineHeight: 1.5 }}>{client.notes}</p>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => window.open(`/client/${client.portal_token}`, '_blank')}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, color: '#a78bfa', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
        >
          <Eye size={13} /> View Portal
        </button>
        <button
          onClick={() => onCopyLink(portalUrl)}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)', borderRadius: 8, color: '#22d3ee', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
        >
          <Copy size={13} /> Copy Link
        </button>
        <button
          onClick={() => onRegenToken(client.id)}
          title="Regenerate portal link"
          style={{ padding: '8px 10px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, color: '#f59e0b', cursor: 'pointer' }}
        >
          <RefreshCw size={13} />
        </button>
        <button
          onClick={() => onDelete(client.id, client.name)}
          style={{ padding: '8px 10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8, color: '#ef4444', cursor: 'pointer' }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

function AddClientModal({ onClose, onAdd }) {
  const [form, setForm] = useState({ name: '', email: '', businessName: '', niche: '', plan: 'starter', notes: '' })
  const [loading, setLoading] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleAdd = async () => {
    if (!form.name || !form.email) return toast.error('Name and email are required')
    setLoading(true)
    try {
      await onAdd(form)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const inp = (label, key, type = 'text', placeholder = '') => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, color: 'rgba(148,163,184,0.6)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</label>
      <input
        type={type} value={form[key]} onChange={e => set(key, e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', padding: '10px 12px', background: 'rgba(13,18,48,0.8)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, color: '#e2e8f0', fontSize: 14, boxSizing: 'border-box' }}
      />
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'linear-gradient(135deg, rgba(13,18,48,0.98), rgba(17,24,64,0.98))', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 18, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 25px 80px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h3 style={{ margin: 0, fontFamily: 'Space Grotesk, sans-serif', fontSize: 18, fontWeight: 700 }}>
            Add New <span className="gradient-text">Client</span>
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(148,163,184,0.5)', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {inp('Contact Name', 'name', 'text', 'e.g. John Smith')}
        {inp('Email', 'email', 'email', 'john@business.com')}
        {inp('Business Name', 'businessName', 'text', 'e.g. Smith Dental')}
        {inp('Niche / Industry', 'niche', 'text', 'e.g. Dental Clinics')}

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 12, color: 'rgba(148,163,184,0.6)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Plan</label>
          <select value={form.plan} onChange={e => set('plan', e.target.value)} style={{ width: '100%', padding: '10px 12px', background: 'rgba(13,18,48,0.8)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, color: '#e2e8f0', fontSize: 14 }}>
            <option value="starter">Starter ($49/mo)</option>
            <option value="pro">Pro ($149/mo)</option>
            <option value="agency">Agency ($499/mo)</option>
          </select>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, color: 'rgba(148,163,184,0.6)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Campaign goals, special notes..." rows={3} style={{ width: '100%', padding: '10px 12px', background: 'rgba(13,18,48,0.8)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, color: '#e2e8f0', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
        </div>

        <button onClick={handleAdd} disabled={loading} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px 20px' }}>
          {loading ? '⏳ Creating...' : '🚀 Create Client & Generate Portal Link'}
        </button>
      </div>
    </div>
  )
}

export default function Clients() {
  const { user } = useAuth()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/clients')
      setClients(res.data || [])
    } catch {
      toast.error('Failed to load clients')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [user?.id])

  const handleAdd = async (form) => {
    const res = await api.post('/clients', form)
    setClients(c => [res.data, ...c])
    toast.success(`Client "${form.name}" created! Portal link copied to clipboard.`)
    const frontendUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'https://proxaly.vercel.app'
    navigator.clipboard.writeText(`${frontendUrl}/client/${res.data.portal_token}`)
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete client "${name}"? This cannot be undone.`)) return
    await api.delete(`/clients/${id}`)
    setClients(c => c.filter(x => x.id !== id))
    toast('Client deleted', { icon: '🗑️' })
  }

  const handleCopyLink = (url) => {
    navigator.clipboard.writeText(url)
    toast.success('Portal link copied!')
  }

  const handleRegenToken = async (id) => {
    if (!confirm('Regenerate portal link? The old link will stop working.')) return
    const res = await api.post(`/clients/${id}/regenerate-token`, {})
    setClients(c => c.map(x => x.id === id ? { ...x, portal_token: res.data.token } : x))
    navigator.clipboard.writeText(res.data.portalUrl)
    toast.success('New link generated & copied!')
  }

  const totalLeads = clients.reduce((s, c) => s + (c.leads_sent || 0), 0)
  const totalMeetings = clients.reduce((s, c) => s + (c.meetings_booked || 0), 0)

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 28, fontWeight: 800, margin: '0 0 6px' }}>
            <span className="gradient-text">Client Dashboard</span>
          </h1>
          <p style={{ color: 'rgba(148,163,184,0.5)', fontSize: 14, margin: 0 }}>
            Manage clients • Share private portals • Track results
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Plus size={16} /> Add Client
        </button>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Total Clients', value: clients.length, color: '#a78bfa', icon: Users },
          { label: 'Active', value: clients.filter(c => c.status === 'active').length, color: '#4ade80', icon: CheckCircle },
          { label: 'Leads Sent', value: totalLeads, color: '#22d3ee', icon: BarChart2 },
          { label: 'Meetings', value: totalMeetings, color: '#f59e0b', icon: CheckCircle },
        ].map(s => (
          <div key={s.label} style={{ background: 'rgba(13,18,48,0.7)', border: '1px solid rgba(139,92,246,0.12)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <s.icon size={14} color={s.color} />
              <span style={{ fontSize: 12, color: 'rgba(148,163,184,0.5)' }}>{s.label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color, fontFamily: 'Space Grotesk, sans-serif' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Clients grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'rgba(148,163,184,0.4)' }}>
          <div className="spinner" style={{ width: 36, height: 36, border: '3px solid rgba(139,92,246,0.2)', borderTopColor: '#8b5cf6', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
          Loading clients...
        </div>
      ) : clients.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: 'rgba(13,18,48,0.5)', border: '1px dashed rgba(139,92,246,0.2)', borderRadius: 16 }}>
          <Users size={40} color="rgba(139,92,246,0.3)" style={{ marginBottom: 16 }} />
          <p style={{ color: 'rgba(148,163,184,0.5)', marginBottom: 16 }}>No clients yet. Add your first client to get started.</p>
          <button onClick={() => setShowAdd(true)} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Plus size={14} /> Add First Client
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 18 }}>
          {clients.map(c => (
            <ClientCard key={c.id} client={c} onDelete={handleDelete} onCopyLink={handleCopyLink} onRegenToken={handleRegenToken} />
          ))}
        </div>
      )}

      {showAdd && <AddClientModal onClose={() => setShowAdd(false)} onAdd={handleAdd} />}
    </div>
  )
}

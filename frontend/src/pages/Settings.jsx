// Settings page
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { User, Key, Bell, Shield, Save, RefreshCw } from 'lucide-react'

function Section({ title, children }) {
  return (
    <div className="glass" style={{ padding: '24px', marginBottom: 16 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 20px', color: '#e2e8f0' }}>{title}</h2>
      {children}
    </div>
  )
}

export default function Settings() {
  const { user } = useAuth()
  const [groqKey, setGroqKey] = useState(localStorage.getItem('groq_key') || '')
  const [notifications, setNotifications] = useState({
    newLeads: true,
    enrichment: true,
    weeklyReport: false,
  })

  const saveGroqKey = () => {
    if (groqKey) {
      localStorage.setItem('groq_key', groqKey)
      toast.success('Groq API key saved locally')
    } else {
      localStorage.removeItem('groq_key')
      toast('Groq key cleared', { icon: '🗑️' })
    }
  }

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 26, fontWeight: 700, margin: 0 }}>
          Settings
        </h1>
        <p style={{ color: 'rgba(148,163,184,0.6)', marginTop: 4, fontSize: 14 }}>
          Manage your account and integrations
        </p>
      </div>

      <div style={{ maxWidth: 640 }}>
        {/* Profile */}
        <Section title="👤 Profile">
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'rgba(148,163,184,0.7)', marginBottom: 6 }}>Email</label>
            <input className="input" value={user?.email || ''} readOnly style={{ opacity: 0.7 }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'rgba(148,163,184,0.7)', marginBottom: 6 }}>User ID</label>
            <input className="input" value={user?.id || ''} readOnly style={{ opacity: 0.5, fontSize: 12 }} />
          </div>
          <div style={{ padding: '10px 14px', background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.15)', borderRadius: 8 }}>
            <p style={{ fontSize: 12, color: 'rgba(34,211,238,0.7)', margin: 0 }}>
              ✓ Account verified · Free plan · 50 leads/month
            </p>
          </div>
        </Section>

        {/* API Keys */}
        <Section title="🔑 API Keys">
          <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.5)', margin: '0 0 16px' }}>
            Your Groq API key for AI enrichment. Get a free key at{' '}
            <a href="https://console.groq.com" target="_blank" rel="noreferrer" style={{ color: '#a78bfa' }}>
              console.groq.com
            </a>
          </p>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'rgba(148,163,184,0.7)', marginBottom: 6 }}>
              Groq API Key (optional override)
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                id="groq-key"
                type="password"
                className="input"
                placeholder="gsk_…"
                value={groqKey}
                onChange={e => setGroqKey(e.target.value)}
              />
              <button onClick={saveGroqKey} className="btn btn-primary" style={{ flexShrink: 0 }}>
                <Save size={14} /> Save
              </button>
            </div>
          </div>
          <div style={{ padding: '10px 14px', background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 8 }}>
            <p style={{ fontSize: 12, color: 'rgba(139,92,246,0.7)', margin: 0 }}>
              💡 Groq is 100% free — 14,400 requests/day with llama3-8b-8192
            </p>
          </div>
        </Section>

        {/* Notifications */}
        <Section title="🔔 Notifications">
          {Object.entries({
            newLeads: 'Notify when new leads are found',
            enrichment: 'Notify when AI enrichment completes',
            weeklyReport: 'Weekly leads summary email',
          }).map(([key, label]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(139,92,246,0.07)' }}>
              <span style={{ fontSize: 14, color: 'rgba(226,232,240,0.8)' }}>{label}</span>
              <button
                onClick={() => setNotifications(p => ({ ...p, [key]: !p[key] }))}
                style={{
                  width: 40, height: 22, borderRadius: 999, border: 'none', cursor: 'pointer',
                  background: notifications[key] ? 'linear-gradient(135deg, #7c3aed, #22d3ee)' : 'rgba(139,92,246,0.2)',
                  position: 'relative', transition: 'all 0.2s'
                }}
              >
                <div style={{
                  position: 'absolute', top: 3, left: notifications[key] ? 20 : 3,
                  width: 16, height: 16, borderRadius: '50%', background: 'white',
                  transition: 'left 0.2s'
                }} />
              </button>
            </div>
          ))}
        </Section>

        {/* Danger zone */}
        <Section title="⚠️ Danger Zone">
          <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.5)', margin: '0 0 16px' }}>
            These actions cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => toast('Export coming soon', { icon: '📦' })}
              className="btn btn-ghost"
            >
              <RefreshCw size={14} /> Export all data
            </button>
            <button
              onClick={() => toast.error('This will delete all your data! Contact support to proceed.')}
              className="btn btn-danger"
            >
              Delete Account
            </button>
          </div>
        </Section>
      </div>
    </div>
  )
}

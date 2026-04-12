/**
 * Branding Page — White-label configuration with live preview
 * Configure agency name, logo, colors, email signature
 */
import { useState, useEffect } from 'react'
import {
  Palette, Eye, Save, RefreshCw, Upload, Globe,
  Mail, CheckCircle, Sparkles, EyeOff
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'

const PRESET_PALETTES = [
  { name: 'Cosmic Purple', primary: '#7c3aed', accent: '#22d3ee' },
  { name: 'Solar Flare', primary: '#f59e0b', accent: '#ef4444' },
  { name: 'Ocean Wave', primary: '#0ea5e9', accent: '#06b6d4' },
  { name: 'Emerald', primary: '#10b981', accent: '#14b8a6' },
  { name: 'Rose Gold', primary: '#f43f5e', accent: '#fb7185' },
  { name: 'Midnight', primary: '#6366f1', accent: '#8b5cf6' },
]

function FormField({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: 'block', fontSize: 12, color: 'rgba(148,163,184,0.6)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      {children}
      {hint && <p style={{ fontSize: 11, color: 'rgba(148,163,184,0.35)', margin: '5px 0 0' }}>{hint}</p>}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input
      type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ width: '100%', padding: '10px 14px', background: 'rgba(13,18,48,0.8)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, color: '#e2e8f0', fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
    />
  )
}

// ── Live client portal preview ────────────────────────────────────────────────
function PortalPreview({ branding }) {
  const primary = branding.primaryColor || '#7c3aed'
  const accent = branding.accentColor || '#22d3ee'
  const name = branding.agencyName || 'Your Agency'
  const logo = branding.logoUrl

  return (
    <div style={{
      background: '#050814', borderRadius: 14, overflow: 'hidden',
      border: '1px solid rgba(139,92,246,0.2)', fontSize: 12
    }}>
      {/* Preview label */}
      <div style={{ padding: '8px 14px', background: 'rgba(139,92,246,0.1)', borderBottom: '1px solid rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Eye size={12} color="#a78bfa" />
        <span style={{ fontSize: 11, color: '#a78bfa', fontWeight: 600 }}>CLIENT PORTAL PREVIEW</span>
      </div>

      {/* Mock header */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(5,8,20,0.8)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {logo ? (
            <img src={logo} alt="logo" style={{ width: 24, height: 24, borderRadius: 6, objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
          ) : (
            <div style={{ width: 24, height: 24, borderRadius: 6, background: `linear-gradient(135deg, ${primary}, ${accent})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>⚡</div>
          )}
          <div>
            <div style={{ fontWeight: 700, fontSize: 12, color: '#e2e8f0' }}>{name}</div>
            <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.4)' }}>Client Report Portal</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 999 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80' }} />
          <span style={{ fontSize: 10, color: '#4ade80' }}>Active</span>
        </div>
      </div>

      {/* Mock hero */}
      <div style={{ padding: '20px 16px', textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${primary}30, ${accent}20)`, border: `1px solid ${primary}40`, margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🏢</div>
        <div style={{ fontWeight: 800, fontSize: 14, color: '#e2e8f0', marginBottom: 4, background: `linear-gradient(135deg, #e2e8f0, ${primary})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Acme Corp — Campaign Report
        </div>
        <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.5)' }}>Your AI-powered outreach managed by {name}</div>
      </div>

      {/* Mock stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: '0 16px 16px' }}>
        {[
          { label: 'Leads', value: '124', color: primary },
          { label: 'Sent', value: '89', color: accent },
          { label: 'Replies', value: '23', color: '#f59e0b' },
          { label: 'Meetings', value: '7', color: '#4ade80' },
        ].map(s => (
          <div key={s.label} style={{ background: `${s.color}10`, border: `1px solid ${s.color}20`, borderRadius: 8, padding: '8px 6px', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.5)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Mock footer */}
      <div style={{ padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,0.04)', textAlign: 'center', fontSize: 9, color: 'rgba(148,163,184,0.25)' }}>
        {branding.hideProxalyBranding
          ? `Powered by ${name}`
          : `Powered by ${name} • Built on Proxaly`}
      </div>
    </div>
  )
}

export default function Branding() {
  const [branding, setBranding] = useState({
    agencyName: '',
    agencyTagline: '',
    logoUrl: '',
    faviconUrl: '',
    primaryColor: '#7c3aed',
    accentColor: '#22d3ee',
    emailSignature: '',
    supportEmail: '',
    websiteUrl: '',
    footerText: '',
    hideProxalyBranding: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const set = (key, val) => setBranding(b => ({ ...b, [key]: val }))

  useEffect(() => {
    api.get('/branding').then(r => {
      if (r.data) {
        setBranding({
          agencyName: r.data.agency_name || '',
          agencyTagline: r.data.agency_tagline || '',
          logoUrl: r.data.logo_url || '',
          faviconUrl: r.data.favicon_url || '',
          primaryColor: r.data.primary_color || '#7c3aed',
          accentColor: r.data.accent_color || '#22d3ee',
          emailSignature: r.data.email_signature || '',
          supportEmail: r.data.support_email || '',
          websiteUrl: r.data.website_url || '',
          footerText: r.data.footer_text || '',
          hideProxalyBranding: r.data.hide_proxaly_branding || false,
        })
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await api.post('/branding', branding)
      toast.success('✅ Branding saved! Client portals updated.')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save')
    }
    setSaving(false)
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 80, color: 'rgba(148,163,184,0.4)' }}>
      <div className="spinner" style={{ width: 36, height: 36, border: '3px solid rgba(139,92,246,0.2)', borderTopColor: '#8b5cf6', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
      Loading branding...
    </div>
  )

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 28, fontWeight: 800, margin: '0 0 6px' }}>
            <span className="gradient-text">White-Label Branding</span>
          </h1>
          <p style={{ color: 'rgba(148,163,184,0.5)', fontSize: 14, margin: 0 }}>
            Your clients see your brand — not Proxaly
          </p>
        </div>
        <button onClick={save} disabled={saving} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {saving ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</> : <><Save size={14} /> Save Branding</>}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, alignItems: 'start' }}>
        {/* Left: settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Agency Identity */}
          <div style={{ background: 'rgba(13,18,48,0.7)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 14, padding: 22 }}>
            <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 15, fontWeight: 700, margin: '0 0 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={15} color="#a78bfa" /> Agency Identity
            </h3>
            <FormField label="Agency Name" hint="Shown on client portal header and emails">
              <Input value={branding.agencyName} onChange={v => set('agencyName', v)} placeholder="e.g. GrowthPro Agency" />
            </FormField>
            <FormField label="Tagline" hint="Short description shown under your name">
              <Input value={branding.agencyTagline} onChange={v => set('agencyTagline', v)} placeholder="e.g. AI-Powered Client Acquisition" />
            </FormField>
            <FormField label="Logo URL" hint="Paste a direct image URL (Imgur, Cloudinary, etc.)">
              <Input value={branding.logoUrl} onChange={v => set('logoUrl', v)} placeholder="https://imgur.com/yourimageurl.png" />
            </FormField>
            <FormField label="Website URL">
              <Input value={branding.websiteUrl} onChange={v => set('websiteUrl', v)} placeholder="https://youragency.com" />
            </FormField>
            <FormField label="Support Email">
              <Input value={branding.supportEmail} onChange={v => set('supportEmail', v)} placeholder="support@youragency.com" type="email" />
            </FormField>
          </div>

          {/* Brand Colors */}
          <div style={{ background: 'rgba(13,18,48,0.7)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 14, padding: 22 }}>
            <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 15, fontWeight: 700, margin: '0 0 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Palette size={15} color="#22d3ee" /> Brand Colors
            </h3>

            {/* Preset palettes */}
            <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.5)', margin: '0 0 12px' }}>Quick presets:</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
              {PRESET_PALETTES.map(p => (
                <button
                  key={p.name}
                  onClick={() => { set('primaryColor', p.primary); set('accentColor', p.accent) }}
                  title={p.name}
                  style={{
                    width: 38, height: 38, borderRadius: 9, border: `2px solid ${branding.primaryColor === p.primary ? '#fff' : 'transparent'}`,
                    background: `linear-gradient(135deg, ${p.primary}, ${p.accent})`,
                    cursor: 'pointer', flexShrink: 0, transition: 'border-color 0.15s'
                  }}
                />
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <FormField label="Primary Color">
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="color" value={branding.primaryColor} onChange={e => set('primaryColor', e.target.value)}
                    style={{ width: 40, height: 38, border: 'none', borderRadius: 8, cursor: 'pointer', background: 'none', padding: 2 }}
                  />
                  <input
                    value={branding.primaryColor} onChange={e => set('primaryColor', e.target.value)}
                    style={{ flex: 1, padding: '9px 12px', background: 'rgba(13,18,48,0.8)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, color: '#e2e8f0', fontSize: 13, fontFamily: 'monospace' }}
                  />
                </div>
              </FormField>
              <FormField label="Accent Color">
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="color" value={branding.accentColor} onChange={e => set('accentColor', e.target.value)}
                    style={{ width: 40, height: 38, border: 'none', borderRadius: 8, cursor: 'pointer', background: 'none', padding: 2 }}
                  />
                  <input
                    value={branding.accentColor} onChange={e => set('accentColor', e.target.value)}
                    style={{ flex: 1, padding: '9px 12px', background: 'rgba(13,18,48,0.8)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, color: '#e2e8f0', fontSize: 13, fontFamily: 'monospace' }}
                  />
                </div>
              </FormField>
            </div>
          </div>

          {/* Email Signature */}
          <div style={{ background: 'rgba(13,18,48,0.7)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 14, padding: 22 }}>
            <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 15, fontWeight: 700, margin: '0 0 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Mail size={15} color="#f59e0b" /> Email Signature
            </h3>
            <FormField label="Email Signature" hint="Appended to every outreach email sent on your behalf">
              <textarea
                value={branding.emailSignature}
                onChange={e => set('emailSignature', e.target.value)}
                placeholder={'e.g.\n\nBest,\nJohn Smith\nGrowthPro Agency\nhttps://youragency.com'}
                rows={5}
                style={{ width: '100%', padding: '10px 14px', background: 'rgba(13,18,48,0.8)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, color: '#e2e8f0', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'monospace' }}
              />
            </FormField>
            <FormField label="Portal Footer Text" hint="Shown at the bottom of client portals">
              <Input value={branding.footerText} onChange={v => set('footerText', v)} placeholder="e.g. GrowthPro Agency • All Rights Reserved" />
            </FormField>
          </div>

          {/* White-label toggle */}
          <div style={{ background: 'rgba(13,18,48,0.7)', border: `1px solid ${branding.hideProxalyBranding ? 'rgba(74,222,128,0.25)' : 'rgba(139,92,246,0.15)'}`, borderRadius: 14, padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 15, fontWeight: 700, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <EyeOff size={15} color="#4ade80" /> Hide "Proxaly" Branding
                </h3>
                <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.5)', margin: 0 }}>
                  Client portals show only your agency name — Proxaly is invisible
                </p>
              </div>
              <button
                onClick={() => set('hideProxalyBranding', !branding.hideProxalyBranding)}
                style={{
                  width: 48, height: 26, borderRadius: 999, border: 'none', cursor: 'pointer',
                  background: branding.hideProxalyBranding ? 'linear-gradient(135deg, #10b981, #4ade80)' : 'rgba(139,92,246,0.2)',
                  position: 'relative', flexShrink: 0, transition: 'all 0.2s'
                }}
              >
                <div style={{
                  position: 'absolute', top: 3, left: branding.hideProxalyBranding ? 24 : 3,
                  width: 20, height: 20, borderRadius: '50%', background: 'white',
                  transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)'
                }} />
              </button>
            </div>
            {branding.hideProxalyBranding && (
              <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: 8, fontSize: 12, color: '#4ade80' }}>
                ✅ Full white-label mode ON — clients only see your agency brand
              </div>
            )}
          </div>
        </div>

        {/* Right: live preview (sticky) */}
        <div style={{ position: 'sticky', top: 20 }}>
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Eye size={14} color="#a78bfa" />
            <span style={{ fontSize: 13, color: '#a78bfa', fontWeight: 600 }}>Live Preview</span>
          </div>
          <PortalPreview branding={branding} />

          {/* Save button on mobile view */}
          <button
            onClick={save}
            disabled={saving}
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '12px 20px', marginTop: 16 }}
          >
            {saving ? '⏳ Saving...' : <><Save size={14} /> Save All Branding</>}
          </button>

          <div style={{ marginTop: 12, padding: '12px 14px', background: 'rgba(13,18,48,0.6)', border: '1px solid rgba(139,92,246,0.1)', borderRadius: 10 }}>
            <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.5)', margin: '0 0 8px', fontWeight: 600 }}>Branding applies to:</p>
            {['Client portal pages', 'Portal header & footer', 'Email signatures', 'Stats & reports'].map(item => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <CheckCircle size={12} color="#4ade80" />
                <span style={{ fontSize: 12, color: 'rgba(148,163,184,0.6)' }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Leads page — search, table, AI enrich, CSV export, status management
import { useState, useEffect, useCallback } from 'react'
import { leadsApi, campaignsApi } from '../lib/api'
import toast from 'react-hot-toast'
import {
  Search, Download,
  Globe, Phone, MapPin, Sparkles, Loader2, Trash2,
  RefreshCw, Mail, Send, MoreVertical
} from 'lucide-react'

const STATUS_OPTIONS = ['new', 'contacted', 'converted']
const BUSINESS_TYPE_OPTIONS = [
  'marketing agency',
  'digital agency',
  'consultant',
  'web design company',
]

function getContactScore(lead) {
  const hasEmail = Boolean(lead?.email)
  const hasPhone = Boolean(lead?.phone)
  const hasWebsite = Boolean(lead?.website)

  if (hasEmail && hasPhone) {
    return { label: 'High', title: 'Email + phone', color: '#4ade80' }
  }
  if (hasEmail || hasPhone) {
    return { label: 'Medium', title: hasEmail ? 'Email only' : 'Phone only', color: '#fbbf24' }
  }
  if (hasWebsite) {
    return { label: 'Low', title: 'Website only', color: '#fb7185' }
  }
  return { label: 'N/A', title: 'No contact', color: 'rgba(148,163,184,0.6)' }
}

function getContactReadiness(lead) {
  const hasEmail = Boolean(lead?.email)
  const hasPhone = Boolean(lead?.phone)
  const hasWebsite = Boolean(lead?.website)

  if (hasEmail || hasPhone) {
    return {
      label: 'Ready to Contact',
      color: '#22c55e',
      bg: 'rgba(34,197,94,0.14)',
      border: 'rgba(34,197,94,0.4)',
    }
  }

  if (hasWebsite) {
    return {
      label: 'Needs Enrichment',
      color: '#f59e0b',
      bg: 'rgba(245,158,11,0.14)',
      border: 'rgba(245,158,11,0.4)',
    }
  }

  return {
    label: 'No Direct Contact',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.14)',
    border: 'rgba(239,68,68,0.4)',
  }
}

function isContactable(lead) {
  if (typeof lead?.contactable === 'boolean') return lead.contactable
  return Boolean(lead?.email || lead?.phone || lead?.website)
}

function SearchForm({ onResults, loading, setLoading }) {
  const [businessType, setBusinessType] = useState('marketing agency')
  const [city, setCity] = useState('')
  const [source, setSource] = useState('auto')

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!businessType.trim() || !city.trim()) {
      return toast.error('Enter business type and city')
    }
    setLoading(true)
    try {
      const res = await leadsApi.scrape({ businessType, city, source })
      const leads = res.data?.leads || []
      const msg = res.data?.message || ''
      // Pass search context so table can filter to this search only
      onResults(leads, { businessType: businessType.trim(), city: city.trim(), source })
      if (leads.length > 0) {
        toast.success(`Found ${leads.length} leads for "${businessType}" in ${city}!`, { icon: '🎯' })
      } else {
        toast.error(msg || `No leads found in "${city}". Try a different source or check spelling.`, { duration: 5000 })
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Scraping failed. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSearch} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <div style={{ flex: '1 1 200px' }}>
        <label style={{ display: 'block', fontSize: 12, color: 'rgba(148,163,184,0.6)', marginBottom: 6 }}>
          Business Type
        </label>
        <select
          id="business-type"
          className="input"
          value={businessType}
          onChange={e => setBusinessType(e.target.value)}
          required
          style={{ appearance: 'none' }}
        >
          {BUSINESS_TYPE_OPTIONS.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>
      <div style={{ flex: '1 1 200px' }}>
        <label style={{ display: 'block', fontSize: 12, color: 'rgba(148,163,184,0.6)', marginBottom: 6 }}>
          City
        </label>
        <input
          id="city"
          className="input"
          placeholder="e.g. Chennai"
          value={city}
          onChange={e => setCity(e.target.value)}
          required
        />
      </div>
      <div style={{ flex: '1 1 160px' }}>
        <label style={{ display: 'block', fontSize: 12, color: 'rgba(148,163,184,0.6)', marginBottom: 6 }}>
          Source
        </label>
        <select
          className="input"
          value={source}
          onChange={e => setSource(e.target.value)}
          style={{ appearance: 'none' }}
        >
          <option value="auto">🤖 Auto (Smart)</option>
          <option value="google_maps">🗺️ Google Maps</option>
          <option value="justdial">📒 Justdial (India)</option>
          <option value="yellowpages">📋 Yellow Pages (US)</option>
          <option value="google_search">🔍 Google Search</option>
        </select>
      </div>
      <button
        id="search-leads"
        type="submit"
        className="btn btn-primary"
        disabled={loading}
        style={{ padding: '10px 20px', flexShrink: 0 }}
      >
        {loading ? <Loader2 size={16} className="spinner" /> : <Search size={16} />}
        {loading ? 'Finding new leads...' : 'Find Leads'}
      </button>
    </form>
  )
}

function LeadRow({ lead, onStatusChange, onEnrich, onFindEmail, onDelete, selected, onSelect, onSendToAgent, isNew }) {
  const [enriching, setEnriching] = useState(false)
  const [findingEmail, setFindingEmail] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const contactScore = getContactScore(lead)
  const contactReadiness = getContactReadiness(lead)

  const handleEnrich = async () => {
    setEnriching(true)
    try { await onEnrich(lead.id) } finally { setEnriching(false) }
  }

  const handleFindEmail = async () => {
    setFindingEmail(true)
    try { await onFindEmail(lead.id) } finally { setFindingEmail(false) }
  }

  const handleSendOne = async () => {
    setShowMenu(false)
    await onSendToAgent([lead.id])
  }

  return (
    <tr>
      <td>
        <input type="checkbox" checked={selected} onChange={() => onSelect(lead.id)}
          style={{ accentColor: '#8b5cf6', width: 14, height: 14 }} />
      </td>
      <td>
        <div style={{ fontWeight: 500, color: '#e2e8f0', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{lead.name}</span>
          {isNew && (
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.3,
              color: '#22c55e',
              border: '1px solid rgba(34,197,94,0.45)',
              background: 'rgba(34,197,94,0.12)',
              borderRadius: 999,
              padding: '1px 6px'
            }}>NEW</span>
          )}
        </div>
        {lead.business_type && (
          <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.5)', marginTop: 2 }}>{lead.business_type}</div>
        )}
      </td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(148,163,184,0.7)' }}>
          <MapPin size={12} /> {lead.city || lead.address || '—'}
        </div>
      </td>
      <td>
        {lead.email
          ? <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <a href={`mailto:${lead.email}`}
                style={{ color: '#4ade80', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, textDecoration: 'none' }}
                title={lead.email}>
                <Mail size={12} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
                  {lead.email}
                </span>
              </a>
              <button
                onClick={() => navigator.clipboard?.writeText(lead.email)}
                className="btn btn-ghost"
                style={{ padding: '2px 7px', fontSize: 10, width: 'fit-content' }}
              >
                Copy Email
              </button>
            </div>
          : <button
              onClick={handleFindEmail}
              className="btn btn-ghost"
              disabled={findingEmail}
              style={{ padding: '3px 8px', fontSize: 11 }}
              title="Retry enrichment for this business">
              {findingEmail ? <Loader2 size={11} className="spinner" /> : <Mail size={11} />}
              {findingEmail ? '…' : 'Click to retry enrichment'}
            </button>}
      </td>
      <td>
        {lead.phone
          ? <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <a href={`tel:${lead.phone}`} style={{ color: '#22d3ee', display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none', fontSize: 12 }}>
                <Phone size={12} />{lead.phone}
              </a>
              <button
                onClick={() => navigator.clipboard?.writeText(lead.phone)}
                className="btn btn-ghost"
                style={{ padding: '2px 7px', fontSize: 10, width: 'fit-content' }}
              >
                Copy Phone
              </button>
            </div>
          : <span style={{ color: 'rgba(148,163,184,0.3)', fontSize: 12 }}>—</span>}
      </td>
      <td>
        {lead.website
          ? <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <a href={lead.website} target="_blank" rel="noreferrer"
                style={{ color: '#a78bfa', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, textDecoration: 'none' }}>
                <Globe size={12} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
                  {lead.website.replace(/^https?:\/\//, '')}
                </span>
              </a>
              {!lead.email && (
                <a
                  href={lead.website}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost"
                  style={{ padding: '2px 7px', fontSize: 10, width: 'fit-content' }}
                >
                  Visit Website
                </a>
              )}
            </div>
          : <span style={{ color: 'rgba(148,163,184,0.3)', fontSize: 13 }}>—</span>}
      </td>
      <td>
        <span title={contactScore.title} style={{
          fontWeight: 700,
          fontSize: 11,
          color: contactScore.color,
          letterSpacing: 0.3,
          border: `1px solid ${contactScore.color}44`,
          background: `${contactScore.color}1a`,
          borderRadius: 999,
          padding: '3px 8px',
          display: 'inline-block'
        }}>
          {contactScore.label}
        </span>
        <div style={{ marginTop: 6 }}>
          <span style={{
            fontWeight: 700,
            fontSize: 10,
            color: contactReadiness.color,
            border: `1px solid ${contactReadiness.border}`,
            background: contactReadiness.bg,
            borderRadius: 999,
            padding: '2px 8px',
            display: 'inline-block'
          }}>
            {contactReadiness.label}
          </span>
        </div>
      </td>
      <td style={{ maxWidth: 220 }}>
        {lead.outreach_message
          ? <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.7)', margin: 0, overflow: 'hidden',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {lead.outreach_message}
            </p>
          : <span style={{ color: 'rgba(148,163,184,0.3)', fontSize: 12 }}>—</span>}
      </td>
      <td>
        <select
          value={lead.status || 'new'}
          onChange={e => onStatusChange(lead.id, e.target.value)}
          className="input"
          style={{ padding: '4px 8px', fontSize: 12, width: 'auto' }}
        >
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </td>
      <td style={{ position: 'relative' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setShowMenu(!showMenu)} className="btn btn-ghost"
            style={{ padding: '4px 8px', fontSize: 12, position: 'relative' }}>
            <MoreVertical size={12} />
          </button>
          {showMenu && (
            <div style={{
              position: 'absolute', right: 0, top: '100%', marginTop: 4,
              background: '#1e293b', border: '1px solid rgba(139,92,246,0.2)',
              borderRadius: 6, padding: '4px 0', zIndex: 100, minWidth: 140,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}>
              <button onClick={handleSendOne} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                width: '100%', border: 'none', background: 'transparent', color: '#a78bfa',
                cursor: 'pointer', fontSize: 12, textAlign: 'left'
              }}>
                <Send size={12} /> Send to Agent
              </button>
              <button onClick={() => { onDelete(lead.id); setShowMenu(false) }} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                width: '100%', border: 'none', background: 'transparent', color: '#f87171',
                cursor: 'pointer', fontSize: 12, textAlign: 'left'
              }}>
                <Trash2 size={12} /> Delete
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

export default function Leads() {
  const [leads, setLeads] = useState([])
  const [allLeads, setAllLeads] = useState([])         // full DB list
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [selected, setSelected] = useState(new Set())
  const [filterStatus, setFilterStatus] = useState('all')
  const [textFilter, setTextFilter] = useState('')      // search box filter
  const [lastSearch, setLastSearch] = useState(null)   // { businessType, city }
  const [bulkEnriching, setBulkEnriching] = useState(false)
  const [onlyContactable, setOnlyContactable] = useState(true)
  const [newLeadIds, setNewLeadIds] = useState(new Set())
  // Marketing Agent integration
  const [agentStatus, setAgentStatus] = useState({ status: 'offline' })
  const [sendingToAgent, setSendingToAgent] = useState(false)
  const agentReachable = agentStatus.status !== 'offline'

  useEffect(() => { fetchLeads() }, [])

  // Poll agent status every 30 seconds
  useEffect(() => {
    const pollAgent = async () => {
      try {
        const res = await leadsApi.getAgentStatus()
        setAgentStatus(res.data || { status: 'offline' })
        console.log('[Agent Status]', res.data)
      } catch (err) {
        console.warn('[Agent Status] Could not fetch:', err.message)
        setAgentStatus({ status: 'offline' })
      }
    }

    pollAgent() // Poll immediately
    const interval = setInterval(pollAgent, 30000) // Then every 30s
    return () => clearInterval(interval)
  }, [])

  async function fetchLeads() {
    setFetching(true)
    try {
      const res = await leadsApi.list({ limit: 200 })
      const data = res.data?.leads || []
      setAllLeads(data)
      setLeads(data)
      setLastSearch(null)   // reset to show all on refresh
      setTextFilter('')
      setNewLeadIds(new Set())
    } catch (err) {
      console.warn('Could not fetch leads:', err.message)
    } finally {
      setFetching(false)
    }
  }

  // After scraping: show ONLY the new results for that search
  const handleResults = (newLeads, searchContext) => {
    const usable = newLeads.filter(isContactable)
    if (usable.length === 0) return
    // Merge into allLeads (deduplicated)
    setAllLeads(prev => {
      const ids = new Set(prev.map(l => l.id))
      return [...prev, ...usable.filter(l => !ids.has(l.id))]
    })
    // Show only this search’s results in the table
    setLeads(usable)
    setLastSearch(searchContext)
    setTextFilter('')
    setSelected(new Set())
    setNewLeadIds(new Set(usable.map(l => l.id)))
    toast.success(`+${usable.length} new leads found`, { icon: '✨' })
  }

  const handleFindNewLeads = async () => {
    if (!lastSearch?.businessType || !lastSearch?.city) {
      return fetchLeads()
    }

    setLoading(true)
    try {
      const res = await leadsApi.scrape({
        businessType: lastSearch.businessType,
        city: lastSearch.city,
        source: lastSearch.source || 'auto',
        maxResults: 20,
      })
      handleResults(res.data?.leads || [], lastSearch)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to find new leads')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (id, status) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
    try {
      await leadsApi.update(id, { status })
      toast.success('Status updated')
    } catch {
      toast.error('Failed to update status')
    }
  }

  const handleEnrich = async (id) => {
    try {
      const res = await leadsApi.enrich(id)
      const updated = res.data?.lead
      if (updated) {
        setLeads(prev => prev.map(l => l.id === id ? { ...l, ...updated } : l))
        toast.success('AI enrichment complete! ✨')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Enrichment failed')
    }
  }

  const handleFindEmail = async (id) => {
    try {
      const res = await leadsApi.findEmail(id)
      const { email, message } = res.data || {}
      if (email) {
        setLeads(prev => prev.map(l => l.id === id ? { ...l, email } : l))
        toast.success(`Email found: ${email} 📧`)
      } else {
        toast.error(message || 'No direct email found. Alternative contact methods available.')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Email lookup failed')
    }
  }

  const handleDelete = async (id) => {
    setLeads(prev => prev.filter(l => l.id !== id))
    setSelected(prev => { const s = new Set(prev); s.delete(id); return s })
    try {
      await leadsApi.delete(id)
    } catch {
      toast.error('Failed to delete')
    }
  }

  const handleSendToAgent = async (leadIds) => {
    if (!leadIds || leadIds.length === 0) {
      return toast.error('Select leads first')
    }

    const selectedLeads = leads.filter(l => leadIds.includes(l.id))
    const emailable = selectedLeads.filter(l => l.email)
    const skipped = selectedLeads.length - emailable.length

    if (emailable.length === 0) {
      return toast.error('No selected leads have email addresses')
    }

    if (skipped > 0) {
      toast(`Skipping ${skipped} lead(s) without email`, { icon: '⚠️' })
    }

    setSendingToAgent(true)
    try {
      const emailableIds = emailable.map(l => l.id)
      console.log(`Sending ${emailableIds.length} lead(s) to Marketing Agent...`)
      const res = await leadsApi.sendToAgent(emailableIds)
      const { sent, failed, total, errors } = res.data || {}

      if (sent && sent > 0) {
        toast.success(`✅ ${sent} lead${sent !== 1 ? 's' : ''} sent to Marketing Agent!`, { duration: 4000 })
        console.log(`[Marketing Agent] Successfully sent ${sent}/${total} leads`)
        
        // Clear selection after success
        if (leadIds.every(id => selected.has(id))) {
          setSelected(new Set())
        }
        
        // Poll agent status to verify it started
        setTimeout(async () => {
          try {
            const status = await leadsApi.getAgentStatus()
            setAgentStatus(status.data || { status: 'offline' })
            if (status.data?.running) {
              toast.success('🚀 Marketing Agent is now running!', { duration: 3000 })
            }
          } catch (e) {
            // Silently fail if can't check status
          }
        }, 1000)
      }

      if (failed && failed > 0) {
        const firstError = Array.isArray(errors) && errors.length > 0 ? String(errors[0]) : ''
        const likelyAgentIssue = /econnrefused|enotfound|timeout|network|unreachable|503|500/i.test(firstError)

        if (likelyAgentIssue) {
          toast.error(`⚠️ Failed to send ${failed} lead(s). Marketing Agent service is unreachable.`, { duration: 5000 })
        } else if (firstError) {
          toast.error(`⚠️ Failed to send ${failed} lead(s). ${firstError}`, { duration: 5000 })
        } else {
          toast.error(`⚠️ Failed to send ${failed} lead(s).`, { duration: 4000 })
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send leads. Is Marketing Agent running?', { duration: 5000 })
      console.error('[Send to Agent Error]', err.message)
    } finally {
      setSendingToAgent(false)
    }
  }

  const handleBulkEnrich = async () => {
    if (selected.size === 0) return toast.error('Select leads first')
    setBulkEnriching(true)
    try {
      const res = await leadsApi.bulkEnrich([...selected])
      const updated = res.data?.leads || []
      setLeads(prev => prev.map(l => {
        const u = updated.find(u => u.id === l.id)
        return u ? { ...l, ...u } : l
      }))
      toast.success(`Enriched ${updated.length} leads!`)
      setSelected(new Set())
    } catch {
      toast.error('Bulk enrichment failed')
    } finally {
      setBulkEnriching(false)
    }
  }

  const handleEnrichAll = async () => {
    const ids = filteredLeads.map(l => l.id)
    if (ids.length === 0) return

    setBulkEnriching(true)
    try {
      const chunkSize = 20
      const updates = []
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize)
        const res = await leadsApi.bulkEnrich(chunk)
        updates.push(...(res.data?.leads || []))
      }

      setLeads(prev => prev.map(l => {
        const u = updates.find(x => x.id === l.id)
        return u ? { ...l, ...u } : l
      }))
      toast.success(`Enriched ${updates.length} leads!`)
    } catch {
      toast.error('Enrich all failed')
    } finally {
      setBulkEnriching(false)
    }
  }

  const handleDeleteSelected = async () => {
    const ids = [...selected]
    if (ids.length === 0) return toast.error('Select leads first')

    try {
      await leadsApi.bulkDelete(ids)
      setLeads(prev => prev.filter(l => !selected.has(l.id)))
      setAllLeads(prev => prev.filter(l => !selected.has(l.id)))
      setSelected(new Set())
      toast.success(`Deleted ${ids.length} leads`)
    } catch {
      toast.error('Failed to delete selected leads')
    }
  }

  const handleExport = async () => {
    try {
      const res = await leadsApi.export({ status: filterStatus !== 'all' ? filterStatus : undefined })
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url; a.download = 'Proxaly_leads.csv'; a.click()
      URL.revokeObjectURL(url)
      toast.success('CSV downloaded!')
    } catch {
      // Fallback: manual CSV from client data
      const rows = [
        ['Name','City','Phone','Website','Score','Status','Outreach'],
        ...filteredLeads.map(l => [
          l.name, l.city || l.address, l.phone, l.website,
          l.ai_score, l.status, l.outreach_message
        ])
      ]
      const csv = rows.map(r => r.map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'leads.csv'; a.click()
      toast.success('CSV exported!')
    }
  }

  const toggleSelect = (id) => {
    setSelected(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }
  const toggleAll = () => {
    if (selected.size === filteredLeads.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filteredLeads.map(l => l.id)))
    }
  }

  // Apply status + text filters to current lead view
  const filteredLeads = leads
    .filter(l => !onlyContactable || isContactable(l))
    .filter(l => filterStatus === 'all' || (l.status || 'new') === filterStatus)
    .filter(l => {
      if (!textFilter) return true
      const q = textFilter.toLowerCase()
      return (
        l.name?.toLowerCase().includes(q) ||
        l.business_type?.toLowerCase().includes(q) ||
        l.city?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q)
      )
    })

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 26, fontWeight: 700, margin: 0 }}>
          Contact-Ready Prospects
        </h1>
        <p style={{ color: '#4ade80', marginTop: 6, marginBottom: 0, fontSize: 13, fontWeight: 600 }}>
          All results shown here are contact-ready or include a direct contact path.
        </p>
        <p style={{ color: 'rgba(148,163,184,0.6)', marginTop: 4, fontSize: 14 }}>
          Find actionable prospects with verified contact paths, enrichment, and outreach-ready context.
        </p>
      </div>

      {/* Search */}
      <div className="glass" style={{ padding: '24px', marginBottom: 20 }}>
        <SearchForm onResults={handleResults} loading={loading} setLoading={setLoading} />
      </div>

      {/* Active search banner */}
      {lastSearch && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)',
          borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13
        }}>
          <span style={{ color: '#a78bfa' }}>
            🔍 Showing <strong>{leads.length}</strong> results for
            &nbsp;<strong>"{lastSearch.businessType}"</strong> in
            &nbsp;<strong>{lastSearch.city}</strong>
          </span>
          <button
            onClick={fetchLeads}
            className="btn btn-ghost"
            style={{ fontSize: 12, padding: '4px 12px' }}
          >
            🗄️ View all saved leads ({allLeads.length})
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Text filter */}
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'rgba(148,163,184,0.4)' }} />
            <input
              className="input"
              placeholder="Filter by name, type, city..."
              value={textFilter}
              onChange={e => setTextFilter(e.target.value)}
              style={{ paddingLeft: 30, fontSize: 12, padding: '6px 10px 6px 28px', width: 200 }}
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(148,163,184,0.75)' }}>
            <input type="checkbox" checked={onlyContactable} onChange={(e) => setOnlyContactable(e.target.checked)} />
            Only Contactable Leads
          </label>
          {/* Status filters */}
          {['all', ...STATUS_OPTIONS].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className="btn"
              style={{
                padding: '6px 14px', fontSize: 13,
                background: filterStatus === s ? 'rgba(139,92,246,0.2)' : 'transparent',
                border: filterStatus === s ? '1px solid rgba(139,92,246,0.4)' : '1px solid rgba(139,92,246,0.1)',
                color: filterStatus === s ? '#a78bfa' : 'rgba(148,163,184,0.6)',
              }}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
              <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.7 }}>
                {s === 'all'
                  ? leads.filter(l => !textFilter || l.name?.toLowerCase().includes(textFilter.toLowerCase())).length
                  : leads.filter(l => (l.status || 'new') === s).length}
              </span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Agent Status Indicator */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
            borderRadius: 6, background: 'rgba(139,92,246,0.08)',
            border: '1px solid rgba(139,92,246,0.15)', fontSize: 12
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: agentStatus.status === 'offline' ? '#22c55e' : '#4ade80',
              boxShadow: agentStatus.status === 'offline' ? '0 0 0 2px rgba(34,197,94,0.2)' : '0 0 0 2px rgba(74,222,128,0.2)'
            }}></div>
            <span style={{ color: '#4ade80' }}>
              {agentStatus.status === 'offline'
                ? 'System Ready (Agent not connected)'
                : `AI Ready (${(agentStatus.tickCount || 0)} ticks)`}
            </span>
          </div>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(148,163,184,0.75)' }}>
            <input
              type="checkbox"
              checked={selected.size === filteredLeads.length && filteredLeads.length > 0}
              onChange={toggleAll}
              style={{ accentColor: '#8b5cf6' }}
            />
            Select All
          </label>

          {selected.size > 0 && (
            <button onClick={handleDeleteSelected} className="btn btn-ghost" style={{ color: '#f87171' }}>
              <Trash2 size={14} /> Delete Selected
            </button>
          )}

          {selected.size > 0 && (
            <button
              onClick={() => handleSendToAgent([...selected])}
              disabled={sendingToAgent || !agentReachable}
              id="send-to-agent"
              title={!agentReachable ? 'Marketing Agent is unreachable. Check MARKETING_AGENT_URL and agent service.' : ''}
              style={{
                padding: '8px 14px', fontSize: 13, fontWeight: 500,
                background: 'linear-gradient(135deg, #a78bfa, #8b5cf6)',
                border: 'none', borderRadius: 6, color: '#fff',
                cursor: (sendingToAgent || !agentReachable) ? 'not-allowed' : 'pointer',
                opacity: (sendingToAgent || !agentReachable) ? 0.55 : 1,
                display: 'flex', alignItems: 'center', gap: 6
              }}
            >
              {sendingToAgent ? <Loader2 size={14} className="spinner" /> : <Send size={14} />}
              Send {selected.size} to Agent
            </button>
          )}
          {selected.size > 0 && (
            <button
              onClick={handleBulkEnrich}
              className="btn btn-ghost"
              disabled={bulkEnriching}
              id="bulk-enrich"
            >
              {bulkEnriching ? <Loader2 size={14} className="spinner" /> : <Sparkles size={14} />}
              Enrich {selected.size} leads
            </button>
          )}

          <button
            onClick={handleEnrichAll}
            className="btn btn-ghost"
            disabled={bulkEnriching || filteredLeads.length === 0}
          >
            {bulkEnriching ? <Loader2 size={14} className="spinner" /> : <Sparkles size={14} />}
            Enrich All
          </button>

          <button onClick={handleFindNewLeads} className="btn btn-ghost" style={{ padding: '6px 12px' }} disabled={loading}>
            <RefreshCw size={14} />
            {loading ? 'Finding new leads...' : 'Find New Leads'}
          </button>
          <button onClick={handleExport} className="btn btn-ghost" id="export-csv">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="glass" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          {fetching ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <Loader2 size={28} className="spinner" style={{ color: '#8b5cf6', margin: '0 auto 12px' }} />
              <p style={{ color: 'rgba(148,163,184,0.5)', fontSize: 14 }}>Loading leads…</p>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'rgba(148,163,184,0.4)' }}>
              <Search size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
              <p style={{ fontWeight: 500, fontSize: 16, marginBottom: 8 }}>No leads found</p>
              <p style={{ fontSize: 14 }}>Use the search above to scrape your first leads</p>
            </div>
          ) : (
            <table className="data-table" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>
                    <input type="checkbox"
                      checked={selected.size === filteredLeads.length && filteredLeads.length > 0}
                      onChange={toggleAll}
                      style={{ accentColor: '#8b5cf6', width: 14, height: 14 }} />
                  </th>
                  <th>Business</th>
                  <th>Location</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Website</th>
                  <th>Contact Score</th>
                  <th>Outreach</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map(lead => (
                  <LeadRow
                    key={lead.id}
                    lead={lead}
                    isNew={newLeadIds.has(lead.id)}
                    selected={selected.has(lead.id)}
                    onSelect={toggleSelect}
                    onStatusChange={handleStatusChange}
                    onEnrich={handleEnrich}
                    onFindEmail={handleFindEmail}
                    onDelete={handleDelete}
                    onSendToAgent={handleSendToAgent}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
        {filteredLeads.length > 0 && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(139,92,246,0.07)',
            fontSize: 13, color: 'rgba(148,163,184,0.5)', display: 'flex', justifyContent: 'space-between' }}>
            <span>{filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''}</span>
            {selected.size > 0 && <span style={{ color: '#a78bfa' }}>{selected.size} selected</span>}
          </div>
        )}
      </div>
    </div>
  )
}

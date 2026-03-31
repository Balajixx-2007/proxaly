// Leads page — search, table, AI enrich, CSV export, status management
import { useState, useEffect, useCallback } from 'react'
import { leadsApi, campaignsApi } from '../lib/api'
import toast from 'react-hot-toast'
import {
  Search, Zap, Download, Filter, ChevronDown, ChevronUp,
  Globe, Phone, MapPin, Sparkles, Loader2, Trash2,
  CheckCircle, Clock, RefreshCw, Mail
} from 'lucide-react'

const STATUS_OPTIONS = ['new', 'contacted', 'converted']

function SearchForm({ onResults, loading, setLoading }) {
  const [businessType, setBusinessType] = useState('')
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
      onResults(leads, { businessType: businessType.trim(), city: city.trim() })
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
        <input
          id="business-type"
          className="input"
          placeholder="e.g. dental clinics"
          value={businessType}
          onChange={e => setBusinessType(e.target.value)}
          required
        />
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
        {loading ? 'Scraping…' : 'Find Leads'}
      </button>
    </form>
  )
}

function LeadRow({ lead, onStatusChange, onEnrich, onFindEmail, onDelete, selected, onSelect }) {
  const [enriching, setEnriching] = useState(false)
  const [findingEmail, setFindingEmail] = useState(false)
  const scoreColor = !lead.ai_score ? 'rgba(148,163,184,0.4)'
    : lead.ai_score >= 7 ? '#4ade80'
    : lead.ai_score >= 4 ? '#fbbf24'
    : '#f87171'

  const handleEnrich = async () => {
    setEnriching(true)
    try { await onEnrich(lead.id) } finally { setEnriching(false) }
  }

  const handleFindEmail = async () => {
    setFindingEmail(true)
    try { await onFindEmail(lead.id) } finally { setFindingEmail(false) }
  }

  return (
    <tr>
      <td>
        <input type="checkbox" checked={selected} onChange={() => onSelect(lead.id)}
          style={{ accentColor: '#8b5cf6', width: 14, height: 14 }} />
      </td>
      <td>
        <div style={{ fontWeight: 500, color: '#e2e8f0', fontSize: 14 }}>{lead.name}</div>
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
          ? <a href={`mailto:${lead.email}`}
              style={{ color: '#4ade80', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, textDecoration: 'none' }}
              title={lead.email}>
              <Mail size={12} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
                {lead.email}
              </span>
            </a>
          : <button
              onClick={handleFindEmail}
              className="btn btn-ghost"
              disabled={findingEmail}
              style={{ padding: '3px 8px', fontSize: 11 }}
              title="Find email for this business">
              {findingEmail ? <Loader2 size={11} className="spinner" /> : <Mail size={11} />}
              {findingEmail ? '…' : 'Find'}
            </button>}
      </td>
      <td>
        {lead.phone
          ? <a href={`tel:${lead.phone}`} style={{ color: '#22d3ee', display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none', fontSize: 12 }}>
              <Phone size={12} />{lead.phone}
            </a>
          : <span style={{ color: 'rgba(148,163,184,0.3)', fontSize: 12 }}>—</span>}
      </td>
      <td>
        {lead.website
          ? <a href={lead.website} target="_blank" rel="noreferrer"
              style={{ color: '#a78bfa', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, textDecoration: 'none' }}>
              <Globe size={12} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
                {lead.website.replace(/^https?:\/\//, '')}
              </span>
            </a>
          : <span style={{ color: 'rgba(148,163,184,0.3)', fontSize: 13 }}>—</span>}
      </td>
      <td>
        {lead.ai_score !== null && lead.ai_score !== undefined
          ? <span style={{ fontWeight: 700, fontSize: 15, color: scoreColor }}>{lead.ai_score}/10</span>
          : <button
              onClick={handleEnrich}
              className="btn btn-ghost"
              disabled={enriching}
              style={{ padding: '4px 10px', fontSize: 12 }}
            >
              {enriching ? <Loader2 size={12} className="spinner" /> : <Sparkles size={12} />}
              {enriching ? '…' : 'Enrich'}
            </button>}
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
      <td>
        <button onClick={() => onDelete(lead.id)} className="btn btn-danger"
          style={{ padding: '4px 8px', fontSize: 12 }}>
          <Trash2 size={12} />
        </button>
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

  useEffect(() => { fetchLeads() }, [])

  async function fetchLeads() {
    setFetching(true)
    try {
      const res = await leadsApi.list({ limit: 200 })
      const data = res.data?.leads || []
      setAllLeads(data)
      setLeads(data)
      setLastSearch(null)   // reset to show all on refresh
      setTextFilter('')
    } catch (err) {
      console.warn('Could not fetch leads:', err.message)
    } finally {
      setFetching(false)
    }
  }

  // After scraping: show ONLY the new results for that search
  const handleResults = (newLeads, searchContext) => {
    if (newLeads.length === 0) return
    // Merge into allLeads (deduplicated)
    setAllLeads(prev => {
      const ids = new Set(prev.map(l => l.id))
      return [...prev, ...newLeads.filter(l => !ids.has(l.id))]
    })
    // Show only this search’s results in the table
    setLeads(newLeads)
    setLastSearch(searchContext)
    setTextFilter('')
    setSelected(new Set())
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
        toast.error(message || 'Could not find email for this business')
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
          Lead Finder
        </h1>
        <p style={{ color: 'rgba(148,163,184,0.6)', marginTop: 4, fontSize: 14 }}>
          Scrape businesses with AI enrichment. Find, score, and contact leads.
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
        <div style={{ display: 'flex', gap: 10 }}>
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
          <button onClick={fetchLeads} className="btn btn-ghost" style={{ padding: '6px 12px' }}>
            <RefreshCw size={14} />
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
                  <th>AI Score</th>
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
                    selected={selected.has(lead.id)}
                    onSelect={toggleSelect}
                    onStatusChange={handleStatusChange}
                    onEnrich={handleEnrich}
                    onFindEmail={handleFindEmail}
                    onDelete={handleDelete}
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

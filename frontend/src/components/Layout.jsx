// Sidebar + Layout shell
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import {
  LayoutDashboard, Users, Megaphone, CreditCard, Settings,
  LogOut, Zap, ChevronLeft, ChevronRight, Menu, X, Building2
} from 'lucide-react'

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/leads', icon: Users, label: 'Leads' },
  { to: '/campaigns', icon: Megaphone, label: 'Campaigns' },
  { to: '/clients', icon: Building2, label: 'Clients' },
  { to: '/billing', icon: CreditCard, label: 'Billing' },
  { to: '/automation', icon: Zap, label: 'Automation' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Layout({ children }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    toast.success('Signed out')
    navigate('/login')
  }

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px 12px' }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 8, marginBottom: 32 }}>
        <div style={{
          width: 32, height: 32,
          background: 'linear-gradient(135deg, #7c3aed, #22d3ee)',
          borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0
        }}>
          <Zap size={18} color="white" />
        </div>
        {!collapsed && (
          <span style={{
            fontFamily: 'Space Grotesk, sans-serif',
            fontWeight: 700, fontSize: 18,
            background: 'linear-gradient(135deg, #a78bfa, #22d3ee)',
            WebkitBackgroundClip: 'text', backgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>Proxaly</span>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            title={collapsed ? label : undefined}
          >
            <Icon size={18} style={{ flexShrink: 0 }} />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      <div style={{ borderTop: '1px solid rgba(139,92,246,0.1)', paddingTop: 16, marginTop: 16 }}>
        {!collapsed && (
          <div style={{ paddingLeft: 8, marginBottom: 12 }}>
            <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.5)', marginBottom: 2 }}>Signed in as</p>
            <p style={{ fontSize: 13, color: '#a78bfa', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email}
            </p>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="nav-item"
          style={{ width: '100%', background: 'none', border: 'none', color: 'rgba(239,68,68,0.7)', cursor: 'pointer' }}
          title={collapsed ? 'Sign out' : undefined}
        >
          <LogOut size={18} />
          {!collapsed && 'Sign out'}
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#050814' }}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            zIndex: 40, display: 'none'
          }}
          className="mobile-overlay"
        />
      )}

      {/* Desktop sidebar */}
      <aside style={{
        width: collapsed ? 60 : 220,
        flexShrink: 0,
        background: 'rgba(9,13,31,0.95)',
        borderRight: '1px solid rgba(139,92,246,0.12)',
        transition: 'width 0.2s ease',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <SidebarContent />

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            position: 'absolute', top: 20, right: -12,
            width: 24, height: 24,
            background: '#0d1230', border: '1px solid rgba(139,92,246,0.3)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#a78bfa', zIndex: 10
          }}
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, padding: '32px 32px 32px', minHeight: 0 }}>
          {children}
        </div>
      </main>
    </div>
  )
}

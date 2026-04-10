import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Leads from './pages/Leads'
import Campaigns from './pages/Campaigns'
import Billing from './pages/Billing'
import Settings from './pages/Settings'
import Automation from './pages/Automation'
import Clients from './pages/Clients'
import ClientPortal from './pages/ClientPortal'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: '100vh', background: '#050814' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{
            width: 40, height: 40, border: '3px solid rgba(139,92,246,0.2)',
            borderTopColor: '#8b5cf6', borderRadius: '50%', margin: '0 auto 16px'
          }} />
          <p style={{ color: 'rgba(148,163,184,0.6)', fontSize: 14 }}>Loading Proxaly…</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  const { user } = useAuth()

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/client/:token" element={<ClientPortal />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      {/* Protected routes */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/leads" element={<Leads />} />
                <Route path="/campaigns" element={<Campaigns />} />
                <Route path="/clients" element={<Clients />} />
                <Route path="/billing" element={<Billing />} />
                <Route path="/automation" element={<Automation />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            className: 'toast-custom',
            duration: 3500,
            style: {
              background: '#0d1230',
              border: '1px solid rgba(139,92,246,0.3)',
              color: '#e2e8f0',
              fontFamily: 'Inter, sans-serif',
              fontSize: '14px',
            },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  )
}

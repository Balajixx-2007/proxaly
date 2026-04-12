// Login / Signup page
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { Zap, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) return toast.error('Fill in all fields')
    if (password.length < 6) return toast.error('Password must be 6+ chars')
    setLoading(true)

    try {
      const fn = mode === 'login' ? signIn : signUp
      const { error } = await fn(email, password)
      if (error) throw error

      if (mode === 'signup') {
        toast.success('Account created! Check your email to confirm.')
      } else {
        toast.success('Welcome back!')
      }
    } catch (err) {
      toast.error(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#050814',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', position: 'relative'
    }}>
      {/* Background glow blobs */}
      <div style={{
        position: 'absolute', top: '-15%', left: '-10%',
        width: 500, height: 500,
        background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', bottom: '-15%', right: '-10%',
        width: 500, height: 500,
        background: 'radial-gradient(circle, rgba(34,211,238,0.1) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />

      {/* Card */}
      <div className="glass fade-in" style={{ width: 420, padding: '40px 36px', position: 'relative' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
          <div style={{
            width: 40, height: 40,
            background: 'linear-gradient(135deg, #7c3aed, #22d3ee)',
            borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Zap size={22} color="white" />
          </div>
          <div>
            <h1 style={{
              fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 22, margin: 0,
              background: 'linear-gradient(135deg, #a78bfa, #22d3ee)',
              WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent'
            }}>Proxaly</h1>
            <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.5)', margin: 0 }}>AI Contact-Ready Prospecting</p>
          </div>
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 6px', color: '#e2e8f0' }}>
          {mode === 'login' ? 'Welcome back' : 'Create account'}
        </h2>
        <p style={{ fontSize: 14, color: 'rgba(148,163,184,0.6)', margin: '0 0 28px' }}>
          {mode === 'login'
            ? 'Sign in to access your dashboard'
            : 'Start finding leads with AI for free'}
        </p>

        <form onSubmit={handleSubmit}>
          {/* Email */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'rgba(148,163,184,0.8)', marginBottom: 6 }}>
              Email address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                color: 'rgba(139,92,246,0.6)'
              }} />
              <input
                id="email"
                type="email"
                className="input"
                style={{ paddingLeft: 38 }}
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'rgba(148,163,184,0.8)', marginBottom: 6 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                color: 'rgba(139,92,246,0.6)'
              }} />
              <input
                id="password"
                type={showPass ? 'text' : 'password'}
                className="input"
                style={{ paddingLeft: 38, paddingRight: 38 }}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'rgba(148,163,184,0.5)', padding: 0
                }}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            id="submit-auth"
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '12px 20px', fontSize: 15 }}
          >
            {loading ? (
              <span className="spinner" style={{
                width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: 'white', borderRadius: '50%', display: 'inline-block'
              }} />
            ) : (
              <>
                {mode === 'login' ? 'Sign In' : 'Create Account'}
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Toggle */}
        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'rgba(148,163,184,0.5)' }}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a78bfa', fontWeight: 500 }}
          >
            {mode === 'login' ? 'Sign up free' : 'Sign in'}
          </button>
        </p>

        {/* Demo hint */}
        <div style={{
          marginTop: 20, padding: '12px 14px',
          background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.15)',
          borderRadius: 8
        }}>
          <p style={{ fontSize: 12, color: 'rgba(34,211,238,0.7)', margin: 0 }}>
            💡 <strong>Free tier:</strong> 50 leads/month, AI enrichment, CSV export — no credit card required
          </p>
        </div>
      </div>
    </div>
  )
}

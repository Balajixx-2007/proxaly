import { useState } from 'react'
import { Check, Zap, Rocket, Building2, ArrowRight, Star, X, CreditCard, Copy, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../lib/api'

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    monthlyPrice: 0,
    icon: Zap,
    color: '#a78bfa',
    description: 'Perfect to get started',
    features: [
      '50 leads / month',
      '3 campaigns',
      'AI enrichment (basic)',
      'CSV export',
      'Groq AI scoring',
      'Email support',
    ],
    limitations: ['No bulk enrichment', 'No priority scraping'],
    cta: 'Current Plan',
    current: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 29,
    icon: Rocket,
    color: '#22d3ee',
    badge: '🔥 Most Popular',
    description: 'For growing teams',
    features: [
      '500 leads / month',
      'Unlimited campaigns',
      'Full AI enrichment + outreach',
      'Bulk enrichment',
      'Priority scraping queue',
      'Justdial + Yellow Pages',
      'LinkedIn scraping',
      'Priority email support',
    ],
    limitations: [],
    cta: 'Upgrade to Pro',
    current: false,
  },
  {
    id: 'agency',
    name: 'Agency',
    monthlyPrice: 79,
    icon: Building2,
    color: '#f59e0b',
    description: 'For agencies & teams',
    features: [
      'Unlimited leads',
      'Unlimited campaigns',
      'All Pro features',
      'Team collaboration (5 seats)',
      'White-label option',
      'API access',
      'Webhook integrations',
      'Dedicated support',
    ],
    limitations: [],
    cta: 'Upgrade to Agency',
    current: false,
  },
]

const PAYMENT_METHODS = [
  {
    id: 'stripe',
    name: 'Credit / Debit Card',
    logo: '💳',
    description: 'Visa, Mastercard, Amex — Secure Stripe checkout',
    tag: 'Instant',
    tagColor: '#22d3ee',
  },
  {
    id: 'paypal',
    name: 'PayPal',
    logo: '🅿️',
    description: 'Pay with your PayPal balance or linked card',
    tag: 'Instant',
    tagColor: '#f59e0b',
  },
  {
    id: 'wise',
    name: 'Wise / Bank Transfer',
    logo: '🏦',
    description: 'International bank transfer via Wise',
    tag: '1–3 days',
    tagColor: '#a78bfa',
  },
]

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: copied ? '#4ade80' : 'rgba(148,163,184,0.5)',
        padding: '2px 6px', borderRadius: 4, transition: 'color 0.2s'
      }}
    >
      {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
    </button>
  )
}

function WiseDetails({ details }) {
  if (!details) return null
  const rows = [
    { label: 'Account Holder', value: details.bankDetails.accountHolder },
    { label: 'Wise Email', value: details.bankDetails.email },
    { label: 'Amount', value: `$${details.amount} USD` },
    { label: 'Reference', value: details.bankDetails.reference },
  ]
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ background: 'rgba(13,18,48,0.8)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 10, overflow: 'hidden' }}>
        {rows.map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid rgba(139,92,246,0.08)' }}>
            <span style={{ fontSize: 12, color: 'rgba(148,163,184,0.5)' }}>{label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 13, color: '#e2e8f0', fontFamily: 'monospace' }}>{value}</span>
              <CopyButton text={value} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 8, fontSize: 12, color: 'rgba(251,191,36,0.9)', lineHeight: 1.6 }}>
        ⚠️ After sending, email <strong>support@proxaly.app</strong> with your transaction ID. Plan activates within 24 hours.
      </div>
    </div>
  )
}

function PaymentModal({ plan, isAnnual, onClose }) {
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(false)
  const [wiseDetails, setWiseDetails] = useState(null)

  const planId = `${plan.id}_${isAnnual ? 'annual' : 'monthly'}`
  const price = isAnnual ? Math.floor(plan.monthlyPrice * 0.8 * 12) : plan.monthlyPrice
  const period = isAnnual ? '/year' : '/month'

  const handlePay = async () => {
    if (!selected) return toast.error('Choose a payment method')
    setLoading(true)
    try {
      if (selected === 'stripe') {
        const res = await api.post('/billing/stripe/checkout', { planId })
        if (res.data?.url) window.location.href = res.data.url
        else toast.error(res.data?.error || 'Stripe not configured yet')
      } else if (selected === 'paypal') {
        const res = await api.get(`/billing/paypal/link/${planId}`)
        if (res.data?.url) window.open(res.data.url, '_blank')
        else toast.error(res.data?.error || 'PayPal not configured yet')
      } else if (selected === 'wise') {
        const res = await api.get(`/billing/wise/details/${planId}`)
        setWiseDetails(res.data)
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Payment error')
    }
    setLoading(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: 'linear-gradient(135deg, rgba(13,18,48,0.98) 0%, rgba(17,24,64,0.98) 100%)',
        border: '1px solid rgba(139,92,246,0.3)', borderRadius: 20, padding: 28,
        width: '100%', maxWidth: 460, boxShadow: '0 25px 80px rgba(0,0,0,0.6)',
        animation: 'fadeIn 0.2s ease'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h3 style={{ margin: 0, fontFamily: 'Space Grotesk, sans-serif', fontSize: 18, fontWeight: 700 }}>
              Upgrade to <span className="gradient-text">{plan.name}</span>
            </h3>
            <p style={{ margin: '4px 0 0', color: 'rgba(148,163,184,0.6)', fontSize: 13 }}>
              ${price}{period} {isAnnual && <span style={{ color: '#4ade80', fontSize: 11 }}>• 20% saved</span>}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(148,163,184,0.5)', cursor: 'pointer', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* No GST notice */}
        <div style={{ padding: '8px 12px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 8, marginBottom: 18, fontSize: 12, color: 'rgba(74,222,128,0.9)' }}>
          ✅ No GST applied currently. All prices in USD. Invoice available on request.
        </div>

        {/* Payment method selection */}
        <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.5)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Choose payment method</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {PAYMENT_METHODS.map(m => (
            <div
              key={m.id}
              onClick={() => { setSelected(m.id); setWiseDetails(null) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px',
                border: `1px solid ${selected === m.id ? 'rgba(139,92,246,0.5)' : 'rgba(139,92,246,0.12)'}`,
                borderRadius: 12, cursor: 'pointer', transition: 'all 0.15s',
                background: selected === m.id ? 'rgba(139,92,246,0.08)' : 'transparent',
              }}
            >
              <div style={{ fontSize: 24, width: 36, textAlign: 'center' }}>{m.logo}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 2 }}>
                  {m.name}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.5)' }}>{m.description}</div>
              </div>
              <div>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: `${m.tagColor}18`, color: m.tagColor, fontWeight: 600 }}>
                  {m.tag}
                </span>
              </div>
              <div style={{
                width: 18, height: 18, borderRadius: '50%',
                border: `2px solid ${selected === m.id ? '#7c3aed' : 'rgba(139,92,246,0.3)'}`,
                background: selected === m.id ? '#7c3aed' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                {selected === m.id && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'white' }} />}
              </div>
            </div>
          ))}
        </div>

        {/* Wise details (shown inline) */}
        {selected === 'wise' && wiseDetails && <WiseDetails details={wiseDetails} />}

        {/* Pay button */}
        {!(selected === 'wise' && wiseDetails) && (
          <button
            onClick={handlePay}
            disabled={loading || !selected}
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '13px 20px', marginTop: 4, opacity: selected ? 1 : 0.5 }}
          >
            {loading ? '⏳ Processing...' : selected === 'wise' ? '🏦 Show Bank Details' : `Pay $${price}${period}`}
            {!loading && selected !== 'wise' && <ArrowRight size={14} style={{ marginLeft: 6 }} />}
          </button>
        )}

        <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(148,163,184,0.35)', marginTop: 12 }}>
          🔒 Secure • Cancel anytime • No hidden fees
        </p>
      </div>
    </div>
  )
}

function PlanCard({ plan, isAnnual, onSelect }) {
  const price = isAnnual ? Math.floor(plan.monthlyPrice * 0.8) : plan.monthlyPrice
  const Icon = plan.icon

  return (
    <div
      className={plan.badge ? 'gradient-border' : ''}
      style={{
        background: 'rgba(13, 18, 48, 0.7)',
        border: plan.badge ? 'none' : '1px solid rgba(139, 92, 246, 0.15)',
        borderRadius: 16, padding: '28px 24px', position: 'relative',
        display: 'flex', flexDirection: 'column', transition: 'transform 0.2s, box-shadow 0.2s',
        boxShadow: plan.badge ? `0 0 40px ${plan.color}20` : 'none',
      }}
    >
      {plan.badge && (
        <div style={{
          position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
          background: `linear-gradient(135deg, #7c3aed, #22d3ee)`,
          color: 'white', fontSize: 11, fontWeight: 700, padding: '4px 14px',
          borderRadius: 999, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4
        }}>
          {plan.badge}
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: `${plan.color}18`, border: `1px solid ${plan.color}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Icon size={18} color={plan.color} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 16, fontFamily: 'Space Grotesk, sans-serif' }}>{plan.name}</span>
        </div>
        <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.6)', margin: 0 }}>{plan.description}</p>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 42, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: plan.current ? 'rgba(148,163,184,0.7)' : '#e2e8f0' }}>
            ${price}
          </span>
          {plan.monthlyPrice > 0 && <span style={{ fontSize: 14, color: 'rgba(148,163,184,0.5)' }}>/mo</span>}
        </div>
        {isAnnual && plan.monthlyPrice > 0 && (
          <span style={{ fontSize: 12, color: '#4ade80' }}>Save 20% — billed ${Math.floor(plan.monthlyPrice * 0.8 * 12)}/year</span>
        )}
      </div>

      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', flex: 1 }}>
        {plan.features.map(f => (
          <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10, fontSize: 13 }}>
            <Check size={14} style={{ color: plan.color, marginTop: 1, flexShrink: 0 }} />
            <span style={{ color: 'rgba(226,232,240,0.85)' }}>{f}</span>
          </li>
        ))}
        {plan.limitations.map(f => (
          <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10, fontSize: 13 }}>
            <span style={{ color: 'rgba(148,163,184,0.3)', marginTop: 1, flexShrink: 0, marginLeft: 2 }}>—</span>
            <span style={{ color: 'rgba(148,163,184,0.3)' }}>{f}</span>
          </li>
        ))}
      </ul>

      <button
        id={`plan-${plan.id}`}
        onClick={() => !plan.current && onSelect(plan)}
        disabled={plan.current}
        className={plan.current ? 'btn' : 'btn btn-primary'}
        style={{
          width: '100%', justifyContent: 'center', padding: '12px 20px',
          ...(plan.current ? {
            background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)',
            color: 'rgba(148,163,184,0.5)', cursor: 'default'
          } : {}),
          ...(plan.badge && !plan.current ? {
            background: `linear-gradient(135deg, #7c3aed, #22d3ee)`,
          } : {})
        }}
      >
        {plan.current ? '✓ Current Plan' : (<>{plan.cta} <ArrowRight size={14} /></>)}
      </button>
    </div>
  )
}

export default function Billing() {
  const [isAnnual, setIsAnnual] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState(null)

  // Handle ?success=true redirect from Stripe/PayPal
  const urlParams = new URLSearchParams(window.location.search)
  const paymentSuccess = urlParams.get('success')
  const paymentCancelled = urlParams.get('cancelled')

  return (
    <div className="fade-in">
      {/* Payment success/cancel banners */}
      {paymentSuccess && (
        <div style={{ padding: '14px 20px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 10, marginBottom: 24, color: '#4ade80', fontSize: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <CheckCircle size={18} /> Payment successful! Your plan is being activated. Check your email for confirmation.
        </div>
      )}
      {paymentCancelled && (
        <div style={{ padding: '14px 20px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, marginBottom: 24, color: '#ef4444', fontSize: 14 }}>
          ❌ Payment cancelled. No charges were made.
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 32, fontWeight: 800, margin: '0 0 10px' }}>
          <span className="gradient-text">Simple, transparent pricing</span>
        </h1>
        <p style={{ color: 'rgba(148,163,184,0.6)', fontSize: 15 }}>
          Pay with card, PayPal, or bank transfer. No GST. No hidden fees.
        </p>

        {/* Annual toggle */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginTop: 20, background: 'rgba(13,18,48,0.8)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 999, padding: '6px 16px' }}>
          <span style={{ fontSize: 13, color: isAnnual ? 'rgba(148,163,184,0.5)' : '#e2e8f0' }}>Monthly</span>
          <button
            onClick={() => setIsAnnual(!isAnnual)}
            style={{ width: 40, height: 22, borderRadius: 999, border: 'none', cursor: 'pointer', background: isAnnual ? 'linear-gradient(135deg, #7c3aed, #22d3ee)' : 'rgba(139,92,246,0.2)', position: 'relative', transition: 'all 0.2s' }}
          >
            <div style={{ position: 'absolute', top: 3, left: isAnnual ? 20 : 3, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
          </button>
          <span style={{ fontSize: 13, color: isAnnual ? '#e2e8f0' : 'rgba(148,163,184,0.5)' }}>
            Annual <span style={{ color: '#4ade80', fontSize: 11, fontWeight: 600 }}>-20%</span>
          </span>
        </div>
      </div>

      {/* Payment methods row */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 36, flexWrap: 'wrap' }}>
        {[
          { icon: '💳', label: 'Stripe' },
          { icon: '🅿️', label: 'PayPal' },
          { icon: '🏦', label: 'Wise Transfer' },
        ].map(m => (
          <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'rgba(13,18,48,0.7)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 999, fontSize: 12, color: 'rgba(148,163,184,0.7)' }}>
            <span>{m.icon}</span> {m.label}
          </div>
        ))}
      </div>

      {/* Plan cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, maxWidth: 900, margin: '0 auto' }}>
        {PLANS.map(plan => (
          <PlanCard key={plan.id} plan={plan} isAnnual={isAnnual} onSelect={setSelectedPlan} />
        ))}
      </div>

      {/* FAQ */}
      <div style={{ marginTop: 56, maxWidth: 700, margin: '56px auto 0' }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, textAlign: 'center', marginBottom: 28 }}>Frequently Asked Questions</h2>
        {[
          { q: 'Is there GST on payments?', a: 'No GST is applied currently. All prices are in USD. We will update invoices once GST registration is complete.' },
          { q: 'Which payment methods are accepted?', a: 'Credit/Debit cards via Stripe, PayPal, and international bank transfers via Wise.' },
          { q: 'Is the free plan really free?', a: 'Yes! 50 leads/month, AI enrichment, and CSV export — no credit card required.' },
          { q: 'Can I cancel anytime?', a: 'Yes. No contracts, no lock-in. Cancel and downgrade to free anytime with one click.' },
          { q: 'How does Wise/bank transfer work?', a: 'Send payment to our Wise account using the details shown. After payment, email us your transaction ID and your plan activates within 24 hours.' },
        ].map(({ q, a }) => (
          <div key={q} style={{ marginBottom: 16, padding: '16px 20px', background: 'rgba(13,18,48,0.6)', border: '1px solid rgba(139,92,246,0.1)', borderRadius: 10 }}>
            <p style={{ fontWeight: 600, fontSize: 14, margin: '0 0 6px', color: '#e2e8f0' }}>{q}</p>
            <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.6)', margin: 0 }}>{a}</p>
          </div>
        ))}
      </div>

      {/* Payment modal */}
      {selectedPlan && (
        <PaymentModal
          plan={selectedPlan}
          isAnnual={isAnnual}
          onClose={() => setSelectedPlan(null)}
        />
      )}
    </div>
  )
}

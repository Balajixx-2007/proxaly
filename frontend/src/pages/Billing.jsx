// Billing page — plan tiers (UI only, Stripe later)
import { useState } from 'react'
import { Check, Zap, Rocket, Building2, ArrowRight, Star } from 'lucide-react'
import toast from 'react-hot-toast'

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
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
    price: 29,
    icon: Rocket,
    color: '#22d3ee',
    badge: 'Most Popular',
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
    price: 79,
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

function PlanCard({ plan, isAnnual }) {
  const price = isAnnual ? Math.floor(plan.price * 0.8) : plan.price
  const Icon = plan.icon

  return (
    <div
      className={plan.badge ? 'gradient-border' : ''}
      style={{
        background: 'rgba(13, 18, 48, 0.7)',
        border: plan.badge ? 'none' : '1px solid rgba(139, 92, 246, 0.15)',
        borderRadius: 16,
        padding: '28px 24px',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.2s, box-shadow 0.2s',
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
          <Star size={10} fill="white" /> {plan.badge}
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
          <span style={{ fontWeight: 700, fontSize: 16, fontFamily: 'Space Grotesk, sans-serif' }}>
            {plan.name}
          </span>
        </div>
        <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.6)', margin: 0 }}>{plan.description}</p>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{
            fontSize: 42, fontWeight: 800, color, fontFamily: 'Space Grotesk, sans-serif',
            color: plan.current ? 'rgba(148,163,184,0.7)' : '#e2e8f0'
          }}>
            ${price}
          </span>
          {plan.price > 0 && (
            <span style={{ fontSize: 14, color: 'rgba(148,163,184,0.5)' }}>/mo</span>
          )}
        </div>
        {isAnnual && plan.price > 0 && (
          <span style={{ fontSize: 12, color: '#4ade80' }}>Save 20% with annual billing</span>
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
        onClick={() => {
          if (!plan.current) {
            toast('Stripe billing coming soon! 🚀', { icon: '💳' })
          }
        }}
        disabled={plan.current}
        className={plan.current ? 'btn' : 'btn btn-primary'}
        style={{
          width: '100%', justifyContent: 'center', padding: '12px 20px',
          ...(plan.current ? {
            background: 'rgba(139,92,246,0.08)',
            border: '1px solid rgba(139,92,246,0.2)',
            color: 'rgba(148,163,184,0.5)',
            cursor: 'default'
          } : {}),
          ...(plan.badge && !plan.current ? {
            background: `linear-gradient(135deg, #7c3aed, #22d3ee)`,
          } : {})
        }}
      >
        {plan.current ? '✓ Current Plan' : (
          <>{plan.cta} <ArrowRight size={14} /></>
        )}
      </button>
    </div>
  )
}

export default function Billing() {
  const [isAnnual, setIsAnnual] = useState(false)

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 32, fontWeight: 800, margin: '0 0 10px' }}>
          <span className="gradient-text">Simple, transparent pricing</span>
        </h1>
        <p style={{ color: 'rgba(148,163,184,0.6)', fontSize: 15 }}>
          Start free. Scale as you grow. No hidden fees.
        </p>

        {/* Annual toggle */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginTop: 20,
          background: 'rgba(13,18,48,0.8)', border: '1px solid rgba(139,92,246,0.2)',
          borderRadius: 999, padding: '6px 16px'
        }}>
          <span style={{ fontSize: 13, color: isAnnual ? 'rgba(148,163,184,0.5)' : '#e2e8f0' }}>Monthly</span>
          <button
            onClick={() => setIsAnnual(!isAnnual)}
            style={{
              width: 40, height: 22, borderRadius: 999, border: 'none', cursor: 'pointer',
              background: isAnnual ? 'linear-gradient(135deg, #7c3aed, #22d3ee)' : 'rgba(139,92,246,0.2)',
              position: 'relative', transition: 'all 0.2s'
            }}
          >
            <div style={{
              position: 'absolute', top: 3, left: isAnnual ? 20 : 3,
              width: 16, height: 16, borderRadius: '50%', background: 'white',
              transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
            }} />
          </button>
          <span style={{ fontSize: 13, color: isAnnual ? '#e2e8f0' : 'rgba(148,163,184,0.5)' }}>
            Annual <span style={{ color: '#4ade80', fontSize: 11, fontWeight: 600 }}>-20%</span>
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, maxWidth: 900, margin: '0 auto' }}>
        {PLANS.map(plan => <PlanCard key={plan.id} plan={plan} isAnnual={isAnnual} />)}
      </div>

      {/* FAQ */}
      <div style={{ marginTop: 56, maxWidth: 700, margin: '56px auto 0' }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, textAlign: 'center', marginBottom: 28 }}>
          Frequently Asked Questions
        </h2>
        {[
          { q: 'Is the free plan really free?', a: 'Yes! 50 leads/month, AI enrichment, and CSV export — no credit card required.' },
          { q: 'What AI model powers enrichment?', a: 'We use Groq\'s llama3-8b-8192 model for lightning-fast enrichment, 100% free on our end.' },
          { q: 'Where does lead data come from?', a: 'We scrape public sources: Google Maps, Justdial, Yellow Pages. All publicly available data.' },
          { q: 'Can I cancel anytime?', a: 'Yes. No contracts, no lock-in. Cancel and downgrade to free anytime.' },
        ].map(({ q, a }) => (
          <div key={q} style={{ marginBottom: 20, padding: '18px 20px', background: 'rgba(13,18,48,0.6)', border: '1px solid rgba(139,92,246,0.1)', borderRadius: 10 }}>
            <p style={{ fontWeight: 600, fontSize: 14, margin: '0 0 8px', color: '#e2e8f0' }}>{q}</p>
            <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.6)', margin: 0 }}>{a}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

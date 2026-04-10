/**
 * Billing Routes — Stripe, PayPal, Wise support
 * No GST applied (will update when registered)
 */

const express = require('express');
const router = express.Router();

const PLANS = {
  pro_monthly: {
    name: 'Proxaly Pro — Monthly',
    amount: 2900, // $29 in cents
    currency: 'usd',
    interval: 'month',
    paypalAmount: '29.00',
    wiseAmount: '29',
  },
  pro_annual: {
    name: 'Proxaly Pro — Annual',
    amount: 27840, // $29 * 12 * 0.8 = $278.40
    currency: 'usd',
    interval: 'year',
    paypalAmount: '278.40',
    wiseAmount: '278.40',
  },
  agency_monthly: {
    name: 'Proxaly Agency — Monthly',
    amount: 7900, // $79 in cents
    currency: 'usd',
    interval: 'month',
    paypalAmount: '79.00',
    wiseAmount: '79',
  },
  agency_annual: {
    name: 'Proxaly Agency — Annual',
    amount: 75840, // $79 * 12 * 0.8 = $758.40
    currency: 'usd',
    interval: 'year',
    paypalAmount: '758.40',
    wiseAmount: '758.40',
  },
};

// ── Stripe Checkout Session ─────────────────────────────────────────────────
router.post('/stripe/checkout', async (req, res) => {
  const { planId } = req.body;
  const plan = PLANS[planId];

  if (!plan) return res.status(400).json({ error: 'Invalid plan' });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return res.status(503).json({ error: 'Stripe not configured. Add STRIPE_SECRET_KEY to Railway env vars.' });
  }

  try {
    const stripe = require('stripe')(stripeKey);
    const frontendUrl = process.env.FRONTEND_URL || 'https://proxaly.vercel.app';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: plan.currency,
          product_data: { name: plan.name },
          unit_amount: plan.amount,
          ...(plan.interval === 'month' ? {
            recurring: { interval: 'month' }
          } : plan.interval === 'year' ? {
            recurring: { interval: 'year' }
          } : {}),
        },
        quantity: 1,
      }],
      mode: plan.interval ? 'subscription' : 'payment',
      success_url: `${frontendUrl}/billing?success=true&plan=${planId}`,
      cancel_url: `${frontendUrl}/billing?cancelled=true`,
      metadata: { planId },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Get PayPal payment link for a plan ─────────────────────────────────────
router.get('/paypal/link/:planId', (req, res) => {
  const plan = PLANS[req.params.planId];
  if (!plan) return res.status(400).json({ error: 'Invalid plan' });

  const paypalEmail = process.env.PAYPAL_EMAIL || '';
  if (!paypalEmail) {
    return res.status(503).json({ error: 'PayPal not configured. Add PAYPAL_EMAIL to Railway env vars.' });
  }

  const frontendUrl = process.env.FRONTEND_URL || 'https://proxaly.vercel.app';
  const returnUrl = encodeURIComponent(`${frontendUrl}/billing?success=true&plan=${req.params.planId}&method=paypal`);
  const cancelUrl = encodeURIComponent(`${frontendUrl}/billing?cancelled=true`);

  const paypalLink = `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=${encodeURIComponent(paypalEmail)}&item_name=${encodeURIComponent(plan.name)}&amount=${plan.paypalAmount}&currency_code=USD&return=${returnUrl}&cancel_return=${cancelUrl}`;

  res.json({ url: paypalLink, amount: plan.paypalAmount });
});

// ── Wise bank transfer details ──────────────────────────────────────────────
router.get('/wise/details/:planId', (req, res) => {
  const plan = PLANS[req.params.planId];
  if (!plan) return res.status(400).json({ error: 'Invalid plan' });

  res.json({
    amount: plan.wiseAmount,
    currency: 'USD',
    plan: plan.name,
    bankDetails: {
      accountHolder: process.env.WISE_ACCOUNT_NAME || 'Your Name',
      email: process.env.WISE_EMAIL || 'your@email.com',
      bankName: 'Wise (TransferWise)',
      reference: `PROXALY-${req.params.planId.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
      note: 'Send payment via Wise to the email above. After payment, email us at support@proxaly.app with your transaction ID to activate your plan.'
    }
  });
});

// ── Plans metadata for frontend ─────────────────────────────────────────────
router.get('/plans', (req, res) => {
  res.json(PLANS);
});

module.exports = router;

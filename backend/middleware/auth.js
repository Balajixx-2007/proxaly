/**
 * Auth middleware — verifies Supabase JWT on protected routes
 */

const { createUserClient, supabaseAdmin } = require('../services/supabase')

/**
 * Require authentication — attach user to req.user
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' })
  }

  const token = authHeader.split(' ')[1]

  try {
    // Verify token with Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    req.user = user
    req.accessToken = token
    next()
  } catch (err) {
    console.error('Auth middleware error:', err.message)
    return res.status(401).json({ error: 'Authentication failed' })
  }
}

/**
 * Optional auth — attaches user if token present, doesn't block if not
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader) return next()

  try {
    const token = authHeader.split(' ')[1]
    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    req.user = user
    req.accessToken = token
  } catch {}

  next()
}

module.exports = { requireAuth, optionalAuth }

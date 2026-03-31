/**
 * Supabase backend clients
 * 
 * Strategy: use user's JWT token directly from request headers.
 * This means RLS policies enforce data isolation automatically.
 * Falls back to service role key if available (for admin ops).
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.SUPABASE_ANON_KEY || 'placeholder'

// Admin client — uses service role if available, otherwise anon
// With anon key + RLS, data is still protected per-user via JWT
const supabaseAdmin = createClient(
  supabaseUrl,
  serviceRoleKey || anonKey,
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
)

/**
 * Create a user-scoped Supabase client using the user's JWT
 * This is the preferred method — respects RLS automatically
 */
function createUserClient(accessToken) {
  return createClient(supabaseUrl, anonKey, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` }
    },
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

/**
 * Get the right client for a request
 * Uses user token when available (respects RLS), falls back to admin
 */
function getClient(req) {
  if (req?.accessToken) {
    return createUserClient(req.accessToken)
  }
  return supabaseAdmin
}

module.exports = { supabaseAdmin, createUserClient, getClient }

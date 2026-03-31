/**
 * Email finder service — REAL emails only, no AI guessing
 * Strategy:
 * 1. Scrape the business website's contact/about pages for mailto: links
 * 2. Google search: "BusinessName city" email
 * 3. If nothing found → return null (never guess)
 */

const puppeteer = require('puppeteer')

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g

// Skip these — they are not real contact emails
const SKIP_DOMAINS = [
  'sentry.io', 'wix.com', 'squarespace.com', 'wordpress.com',
  'example.com', 'test.com', 'noreply', 'no-reply', 'placeholder',
  'google.com', 'facebook.com', 'instagram.com', 'twitter.com',
  'youtube.com', 'linkedin.com', 'yelp.com', 'yellowpages.com',
  'justdial.com', 'maps.google', 'goo.gl', 'bit.ly',
]

const SKIP_PREFIXES = ['noreply', 'no-reply', 'donotreply', 'mailer', 'bounce', 'support@sentry']

function isRealEmail(email) {
  if (!email || !email.includes('@')) return false
  const [user, domain] = email.toLowerCase().split('@')
  if (!domain || domain.length < 4) return false
  if (SKIP_DOMAINS.some(skip => domain.includes(skip))) return false
  if (SKIP_PREFIXES.some(p => user.startsWith(p))) return false
  if (!domain.includes('.')) return false
  // Must have valid TLD
  const tld = domain.split('.').pop()
  if (!tld || tld.length < 2 || tld.length > 6) return false
  return true
}

function extractEmails(text) {
  const found = text.match(EMAIL_REGEX) || []
  return [...new Set(found)].filter(isRealEmail)
}

async function launchBrowser() {
  return puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox',
      '--disable-dev-shm-usage', '--disable-gpu',
    ],
  })
}

/**
 * Strategy 1: Scrape business website for real email
 */
async function scrapeWebsiteEmail(website) {
  if (!website) return null

  let browser
  try {
    browser = await launchBrowser()
    const page = await browser.newPage()
    await page.setRequestInterception(true)
    page.on('request', req => {
      if (['image', 'font', 'media', 'stylesheet'].includes(req.resourceType())) req.abort()
      else req.continue()
    })

    const base = website.replace(/\/$/, '')
    // Try contact pages first (highest chance of real email)
    const pagesToTry = [
      `${base}/contact`,
      `${base}/contact-us`,
      `${base}/contactus`,
      `${base}/about`,
      `${base}/about-us`,
      base,  // homepage last
    ]

    for (const url of pagesToTry) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 })
        await new Promise(r => setTimeout(r, 800))

        // Check mailto: links first (most reliable)
        const mailtoEmails = await page.evaluate(() => {
          const links = document.querySelectorAll('a[href^="mailto:"]')
          return [...links].map(l => l.href.replace('mailto:', '').split('?')[0])
        })
        const realMailto = mailtoEmails.filter(isRealEmail)
        if (realMailto.length > 0) {
          console.log(`  📧 Real mailto found on ${url}: ${realMailto[0]}`)
          return realMailto[0]
        }

        // Scan visible text for emails
        const text = await page.evaluate(() => document.body.innerText)
        const found = extractEmails(text)
        if (found.length > 0) {
          console.log(`  📧 Real email in page text on ${url}: ${found[0]}`)
          return found[0]
        }
      } catch (_) {}
    }
    return null
  } catch (err) {
    console.warn('Website email scrape error:', err.message)
    return null
  } finally {
    if (browser) await browser.close()
  }
}

/**
 * Strategy 2: Google search for real business email
 */
async function googleSearchEmail(businessName, city, website) {
  let browser
  try {
    browser = await launchBrowser()
    const page = await browser.newPage()
    await page.setRequestInterception(true)
    page.on('request', req => {
      if (['image', 'font', 'media'].includes(req.resourceType())) req.abort()
      else req.continue()
    })

    // Build a targeted search
    const domainHint = website
      ? `site:${new URL(website.startsWith('http') ? website : 'https://' + website).hostname} email`
      : `"${businessName}" ${city} email contact`

    const url = `https://www.google.com/search?q=${encodeURIComponent(domainHint)}&num=5`
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await new Promise(r => setTimeout(r, 1000))

    const text = await page.evaluate(() => document.body.innerText)
    const found = extractEmails(text)

    if (found.length > 0) {
      // Extra filter: email domain should match business name or website
      const businessSlug = businessName.toLowerCase().replace(/[^a-z0-9]/g, '')
      const siteMatch = found.find(e => {
        const domain = e.split('@')[1]
        return businessSlug.split('').some((_, i) =>
          businessSlug.slice(i, i + 4).length === 4 &&
          domain.includes(businessSlug.slice(i, i + 4))
        )
      })
      const result = siteMatch || found[0]
      console.log(`  📧 Real email via Google search: ${result}`)
      return result
    }
    return null
  } catch (err) {
    console.warn('Google email search error:', err.message)
    return null
  } finally {
    if (browser) await browser.close()
  }
}

/**
 * Main finder — ONLY returns real scraped emails, never guesses
 */
async function findEmail(lead) {
  console.log(`\n📧 Finding REAL email for: ${lead.name}`)

  // Already have a real email
  if (lead.email && isRealEmail(lead.email)) {
    return lead.email
  }

  // Strategy 1: Scrape their website
  if (lead.website) {
    const email = await scrapeWebsiteEmail(lead.website)
    if (email) return email
  }

  // Strategy 2: Google search
  const googleEmail = await googleSearchEmail(lead.name, lead.city || '', lead.website)
  if (googleEmail) return googleEmail

  // Nothing found — return null, do NOT guess
  console.log(`  ❌ No real email found for "${lead.name}"`)
  return null
}

module.exports = { findEmail }

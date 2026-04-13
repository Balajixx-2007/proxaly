/**
 * Lead scraper service — multi-source business directory scraper
 * Fixed: proper city-aware search, cleaner selectors, better fallbacks
 */

const puppeteer = require('puppeteer')
const cheerio = require('cheerio')
const axios = require('axios')
const { v4: uuidv4 } = require('uuid')

const delay = (ms = 2000) => new Promise(r => setTimeout(r, ms + Math.random() * 1000))

// Indian cities list for routing to Justdial
const INDIAN_CITIES = [
  'chennai', 'mumbai', 'delhi', 'bangalore', 'bengaluru', 'hyderabad',
  'kolkata', 'pune', 'ahmedabad', 'jaipur', 'surat', 'lucknow',
  'kanpur', 'nagpur', 'indore', 'thane', 'bhopal', 'visakhapatnam',
  'pimpri', 'patna', 'vadodara', 'ghaziabad', 'ludhiana', 'agra',
  'nashik', 'faridabad', 'meerut', 'coimbatore', 'noida', 'gurgaon',
  'gurugram', 'kochi', 'thiruvananthapuram', 'madurai', 'chandigarh',
]

const isIndianCity = (city) =>
  INDIAN_CITIES.some(c => city.toLowerCase().includes(c))

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
const EMAIL_VALIDATION_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/
const BLOCKED_WEBSITE_HOSTS = [
  'google.com',
  'maps.google.com',
  'justdial.com',
  'yellowpages.com',
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'youtube.com',
  'twitter.com',
  'x.com',
  'yelp.com',
]

// Keywords that indicate a generic marketing/agency business —
// used to detect and filter out wrong scraper results
const AGENCY_MISMATCH_KEYWORDS = [
  'marketing agency', 'seo agency', 'digital agency', 'creative agency',
  'advertising agency', 'production studio', 'growth agency', 'pr agency',
  'media agency', 'social media agency', 'branding agency'
]

async function launchBrowser() {
  return puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1366,768',
    ],
    defaultViewport: { width: 1366, height: 768 },
  })
}

/**
 * Scrape Google Maps — works for any city worldwide
 * Uses the maps search URL with explicit city in query
 */
async function scrapeGoogleMaps(businessType, city, maxResults = 15) {
  const browser = await launchBrowser()
  const leads = []

  try {
    const page = await browser.newPage()

    // Set headers to look more human
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    })

    // Intercept and block images/fonts for speed
    await page.setRequestInterception(true)
    page.on('request', (req) => {
      const type = req.resourceType()
      if (['image', 'font', 'media'].includes(type)) {
        req.abort()
      } else {
        req.continue()
      }
    })

    // Include city explicitly in the search query
    const query = `${businessType} in ${city}`
    const encodedQuery = encodeURIComponent(query)
    const url = `https://www.google.com/maps/search/${encodedQuery}`

    console.log(`🗺️  Google Maps: "${query}"`)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await delay(3000)

    // Scroll the results panel to load more
    for (let i = 0; i < 4; i++) {
      try {
        await page.evaluate(() => {
          // Try multiple selectors for the results feed
          const selectors = [
            '[role="feed"]',
            '.m6QErb[aria-label]',
            '.DxyBCb',
          ]
          for (const sel of selectors) {
            const el = document.querySelector(sel)
            if (el) { el.scrollTop += 400; break }
          }
        })
        await delay(800)
      } catch (_) {}
    }

    // Extract business data from the page
    const results = await page.evaluate((query, city) => {
      const items = []

      // Method 1: Feed-based results (most common layout)
      const feedItems = document.querySelectorAll('[role="feed"] > div[jsaction]')
      feedItems.forEach(card => {
        if (items.length >= 20) return
        try {
          // Business name — from aria-label or heading
          const nameEl = card.querySelector('[aria-label]') ||
                         card.querySelector('div.fontHeadlineSmall') ||
                         card.querySelector('.qBF1Pd') ||
                         card.querySelector('h3')

          let name = nameEl?.getAttribute('aria-label') || nameEl?.textContent?.trim()

          // Filter out UI elements (not business names)
          if (!name || name.length < 2) return
          const uiKeywords = ['filter', 'rating', 'hours', 'directions', 'menu', 'sponsored', 'open', 'closed']
          if (uiKeywords.some(kw => name.toLowerCase().startsWith(kw))) return
          if (name.includes('·')) name = name.split('·')[0].trim()  // clean up
          if (name.length < 2) return

          // Rating
          const ratingEl = card.querySelector('.MW4etd')
          const rating = ratingEl?.textContent?.trim() || null

          // Review count
          const reviewEl = card.querySelector('.UY7F9')
          const reviews = reviewEl?.textContent?.replace(/[()]/g, '').trim() || null

          // Address / subtitle
          const subtitleEls = card.querySelectorAll('.W4Efsd')
          let address = null
          subtitleEls.forEach(el => {
            const text = el.textContent.trim()
            if (text && !address && text.length > 5 && !text.includes('·')) {
              address = text
            }
          })

          // Phone
          const phoneEl = card.querySelector('[data-item-id*="phone"]')
          const phone = phoneEl?.textContent?.trim() || null

          // Category
          const catEl = card.querySelector('.W4Efsd span')
          const category = catEl?.textContent?.trim() || null

          if (name && name.length >= 2) {
            items.push({ name, address, phone, rating, reviews, category })
          }
        } catch (_) {}
      })

      // Method 2: If feed method returned nothing, try div.Nv2PK
      if (items.length === 0) {
        document.querySelectorAll('div.Nv2PK').forEach(card => {
          if (items.length >= 20) return
          try {
            const nameEl = card.querySelector('.fontHeadlineSmall, .qBF1Pd, h3, a[aria-label]')
            let name = nameEl?.textContent?.trim() || nameEl?.getAttribute('aria-label')
            if (!name || name.length < 2) return
            if (name.includes('·')) name = name.split('·')[0].trim()

            const ratingEl = card.querySelector('.MW4etd')
            const rating = ratingEl?.textContent?.trim()

            items.push({ name, address: city, phone: null, rating: rating || null, reviews: null, category: null })
          } catch (_) {}
        })
      }

      return items
    }, query, city)

    console.log(`  → Extracted ${results.length} raw results`)

    const randomOffset = Math.floor(Math.random() * Math.min(5, Math.max(1, Math.floor(results.length / 3))))
    const randomized = shuffleArray(results).slice(randomOffset)

    for (const r of randomized) {
      if (!r.name || leads.length >= maxResults) continue
      leads.push({
        id: uuidv4(),
        name: cleanName(r.name),
        address: r.address || city,
        city: city,
        phone: r.phone || null,
        website: null,
        rating: r.rating || null,
        business_type: businessType,
        source: 'google_maps',
        status: 'new',
        created_at: new Date().toISOString(),
      })
    }

    console.log(`✅ Google Maps: ${leads.length} valid leads for "${businessType} in ${city}"`)
  } catch (err) {
    console.error('❌ Google Maps error:', err.message)
  } finally {
    await browser.close()
  }

  return leads
}

/**
 * Scrape Justdial — best for Indian cities
 * Justdial hides phones behind JS — we wait for them to load
 */
async function scrapeJustdial(businessType, city, maxResults = 15) {
  const browser = await launchBrowser()
  const leads = []

  try {
    const page = await browser.newPage()

    // Don't block all resources — Justdial needs JS
    await page.setRequestInterception(true)
    page.on('request', req => {
      const type = req.resourceType()
      // Allow JS (needed for rendering), block only media
      if (['image', 'media', 'font'].includes(type)) req.abort()
      else req.continue()
    })

    const citySlug = city.toLowerCase().replace(/\s+/g, '-')
    const bizSlug = businessType.toLowerCase().replace(/\s+/g, '-')

    const urls = [
      `https://www.justdial.com/${citySlug}/${bizSlug}`,
      `https://www.justdial.com/${citySlug}/${bizSlug}-in-${citySlug}`,
    ]

    let loaded = false
    for (const url of urls) {
      try {
        console.log(`📒 Justdial: ${url}`)
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 })
        await delay(3000)  // let JS render
        const title = await page.title()
        if (title && !title.includes('404') && !title.includes('Not Found')) {
          loaded = true
          break
        }
      } catch (_) {}
    }

    if (!loaded) {
      console.warn('⚠️  Justdial: no valid page found')
      return leads
    }

    // Scroll to load more listings
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 800))
      await delay(1000)
    }

    // Extract listings from the rendered page
    const items = await page.evaluate((maxResults) => {
      const results = []
      // Justdial listing cards (try multiple selectors)
      const cards = document.querySelectorAll(
        'li.cntLst, .resultbox_info, li[class*="store"], .jd-card, [class*="resultbox"]'
      )

      cards.forEach(card => {
        if (results.length >= maxResults) return

        // Name
        const nameEl = card.querySelector(
          '[class*="lng_cont_name"], [class*="store-name"], .resultbox_name, h2.jd-header-info, .fn'
        )
        const name = nameEl?.textContent?.trim()
        if (!name || name.length < 2) return

        // Phone — Justdial shows it in spans with class containing "tel" or "mobilesv"
        let phone = null
        const phoneEls = card.querySelectorAll(
          '[class*="tel"], [class*="mobilesv"], [class*="contact"], [class*="phone"], a[href^="tel:"]'
        )
        for (const el of phoneEls) {
          const href = el.getAttribute('href')
          if (href?.startsWith('tel:')) {
            phone = href.replace('tel:', '').trim()
            break
          }
          const text = el.textContent.replace(/[^\d+\s-]/g, '').trim()
          if (text.replace(/\D/g, '').length >= 7) {
            phone = text
            break
          }
        }

        // Address
        const addrEl = card.querySelector(
          '[class*="address"], .resultbox_address, .jd-header-address, .address'
        )
        const address = addrEl?.textContent?.trim()

        // Rating
        const ratingEl = card.querySelector('[class*="rt_count"], .star_m, [class*="rating"]')
        const rating = ratingEl?.textContent?.trim()

        // Website
        const siteEl = card.querySelector('a[href*="http"]:not([href*="justdial"])')
        const website = siteEl?.href || null

        results.push({ name, phone, address, rating, website })
      })

      return results
    }, maxResults)

    console.log(`  → Found ${items.length} Justdial listings`)

    const randomOffset = Math.floor(Math.random() * Math.min(4, Math.max(1, Math.floor(items.length / 3))))
    const randomized = shuffleArray(items).slice(randomOffset)

    for (const item of randomized) {
      if (leads.length >= maxResults) break
      const phone = item.phone || extractPhone(item.address || '')
      leads.push({
        id: require('uuid').v4(),
        name: cleanName(item.name),
        address: item.address || city,
        city,
        phone: isValidPhone(phone) ? phone : null,
        website: item.website || null,
        rating: item.rating || null,
        business_type: businessType,
        source: 'justdial',
        status: 'new',
        created_at: new Date().toISOString(),
      })
    }

    console.log(`✅ Justdial: ${leads.length} leads for "${businessType} in ${city}"`)
  } catch (err) {
    console.error('❌ Justdial error:', err.message)
  } finally {
    await browser.close()
  }

  return leads
}

/**
 * Scrape Yellow Pages — good for US cities
 */
async function scrapeYellowPages(businessType, city, maxResults = 15) {
  const browser = await launchBrowser()
  const leads = []

  try {
    const page = await browser.newPage()
    await page.setRequestInterception(true)
    page.on('request', req => {
      if (['image', 'font', 'media'].includes(req.resourceType())) req.abort()
      else req.continue()
    })

    const url = `https://www.yellowpages.com/search?search_terms=${encodeURIComponent(businessType)}&geo_location_terms=${encodeURIComponent(city)}`
    console.log(`📒 Yellow Pages: "${businessType}" in "${city}"`)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await delay(2000)

    const html = await page.content()
    const $ = cheerio.load(html)

    const rows = []
    $('.result, .organic .v-card, .srp-listing').each((i, el) => {
      if (leads.length >= maxResults) return false

      const name = $(el).find('a.business-name, h2.n span, .business-name span').first().text().trim()
      if (!name || name.length < 2) return

      // Phone — Yellow Pages shows real phone numbers in .phones
      const rawPhone = $(el).find('.phones.phone, .phone.primary, .phones').first().text().trim()
      const phone = isValidPhone(rawPhone) ? rawPhone : extractPhone($(el).text())

      const street = $(el).find('.street-address').text().trim()
      const cityState = $(el).find('.city-name').text().trim()
      const address = [street, cityState].filter(Boolean).join(', ')

      const website = $(el).find('a.track-visit-website').attr('href') || null
      const rating = $(el).find('.ratings .count, .ratings .stars').attr('class')?.match(/(\d+)/)?.[1] || null

      rows.push({
        id: uuidv4(),
        name: cleanName(name),
        address: address || city,
        city,
        phone: phone || null,
        website: website || null,
        rating: rating || null,
        business_type: businessType,
        source: 'yellowpages',
        status: 'new',
        created_at: new Date().toISOString(),
      })
    })

    const randomOffset = Math.floor(Math.random() * Math.min(4, Math.max(1, Math.floor(rows.length / 3))))
    const randomized = shuffleArray(rows).slice(randomOffset)
    for (const row of randomized) {
      if (leads.length >= maxResults) break
      leads.push(row)
    }

    console.log(`✅ Yellow Pages: ${leads.length} leads for "${businessType}" in "${city}"`)
  } catch (err) {
    console.error('❌ Yellow Pages error:', err.message)
  } finally {
    await browser.close()
  }

  return leads
}

/**
 * Scrape via Google Search (fallback — works for any city)
 * Extracts structured results from Google's local pack
 */
async function scrapeGoogleSearch(businessType, city, maxResults = 10) {
  const browser = await launchBrowser()
  const leads = []

  try {
    const page = await browser.newPage()
    await page.setRequestInterception(true)
    page.on('request', req => {
      if (['image', 'font', 'media'].includes(req.resourceType())) req.abort()
      else req.continue()
    })

    const query = `${businessType} in ${city} phone address`
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=20`

    console.log(`🔍 Google Search: "${query}"`)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await delay(1500)

    const html = await page.content()
    const $ = cheerio.load(html)

    // Extract from Google's local business pack (3-pack)
    const rows = []
    $('div[data-attrid="kc:/local:expandable_poi_list"] > div, .rllt__details').each((i, el) => {
      if (leads.length >= maxResults) return false

      const nameEl = $(el).find('[role="heading"], .dbg0pd, .rllt__details div:first-child').first()
      const name = nameEl.text().trim()
      if (!name || name.length < 2) return

      const phone = extractPhone($(el).text())
      const address = $(el).find('.rllt__wrapped-text, div:nth-child(2)').text().trim()

      rows.push({
        id: uuidv4(),
        name: cleanName(name),
        address: address || city,
        city,
        phone,
        website: null,
        rating: null,
        business_type: businessType,
        source: 'google_search',
        status: 'new',
        created_at: new Date().toISOString(),
      })
    })

    // Also check organic results
    if (leads.length < 3) {
      $('div.g, .MjjYud .g').each((i, el) => {
        if (leads.length >= maxResults) return false
        const title = $(el).find('h3').first().text().trim()
        if (!title || title.length < 2) return
        const snippet = $(el).find('.VwiC3b, .lyLwlc').first().text().trim()
        const phone = extractPhone(snippet)
        const link = $(el).find('a').first().attr('href')

        if (title && !title.toLowerCase().includes('best ') && !title.toLowerCase().includes('top ')) {
          rows.push({
            id: uuidv4(),
            name: cleanName(title),
            address: city,
            city,
            phone,
            website: link?.startsWith('http') ? link : null,
            rating: null,
            business_type: businessType,
            source: 'google_search',
            status: 'new',
            created_at: new Date().toISOString(),
          })
        }
      })
    }

    const randomOffset = Math.floor(Math.random() * Math.min(4, Math.max(1, Math.floor(rows.length / 3))))
    const randomized = shuffleArray(rows).slice(randomOffset)
    for (const row of randomized) {
      if (leads.length >= maxResults) break
      leads.push(row)
    }

    console.log(`✅ Google Search: ${leads.length} leads for "${businessType}" in "${city}"`)
  } catch (err) {
    console.error('❌ Google Search error:', err.message)
  } finally {
    await browser.close()
  }

  return leads
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function cleanName(name) {
  if (!name) return name
  name = name.split('\u00b7')[0].split('\u00b7')[0].trim()
  name = name.replace(/\d+\.\d+\s*(star|\u2605|\u2606).*/i, '').trim()
  return name.slice(0, 100)
}

/**
 * Extract a real phone number from text
 * Handles Indian (+91, 10-digit), US (10-digit), international
 */
function extractPhone(text) {
  if (!text) return null
  // Indian mobile: 10 digits starting with 6-9
  const indian = text.match(/(?:\+91[\s-]?)?[6-9]\d{9}/)
  if (indian) return indian[0].replace(/\s/g, '')
  // International with country code
  const intl = text.match(/\+\d{1,3}[\s-]?\(?\d{2,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}/)
  if (intl) return intl[0].trim()
  // Generic: 10-15 digit sequences
  const generic = text.match(/\b\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b/)
  if (generic) return generic[0].replace(/[\s.-]/g, '')
  return null
}

function isValidPhone(phone) {
  if (!phone) return false
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 15
}

function shuffleArray(input) {
  const arr = [...input]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function normalizeBusinessName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getLeadDedupeMarkers(lead) {
  const markers = []
  const domain = getDomainFromWebsite(lead?.website)
  if (domain) markers.push(`domain:${domain}`)
  const normalizedName = normalizeBusinessName(lead?.name)
  if (normalizedName) markers.push(`name:${normalizedName}`)
  return markers
}

function isContactableLead(lead) {
  return Boolean(lead?.email || lead?.phone || lead?.website)
}

function toContactReadyLead(lead) {
  const website = normalizeWebsiteUrl(lead.website)
  return {
    ...lead,
    email: sanitizeEmail(lead.email) || null,
    phone: isValidPhone(lead.phone) ? lead.phone : null,
    website,
    contactable: Boolean((sanitizeEmail(lead.email) || null) || (isValidPhone(lead.phone) ? lead.phone : null) || website),
  }
}

function normalizeWebsiteUrl(website) {
  if (!website || typeof website !== 'string') return null
  const trimmed = website.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  return `https://${trimmed}`
}

function getDomainFromWebsite(website) {
  try {
    const normalized = normalizeWebsiteUrl(website)
    if (!normalized) return null
    const host = new URL(normalized).hostname.toLowerCase()
    return host.replace(/^www\./, '')
  } catch (_) {
    return null
  }
}

function isUsableBusinessWebsite(website) {
  const domain = getDomainFromWebsite(website)
  if (!domain) return false
  return !BLOCKED_WEBSITE_HOSTS.some(host => domain.includes(host))
}

function extractEmailFromText(text) {
  if (!text) return null
  const found = text.match(EMAIL_REGEX) || []
  for (const item of found) {
    const email = sanitizeEmail(item)
    if (email) return email
  }
  return null
}

function sanitizeEmail(value) {
  if (!value || typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  if (!EMAIL_VALIDATION_REGEX.test(email)) return null
  if (email.startsWith('//')) return null
  const [, domain] = email.split('@')
  if (!domain) return null
  if (BLOCKED_WEBSITE_HOSTS.some(host => domain.includes(host))) return null
  return email
}

function websiteMatchesLead(name, website) {
  const domain = getDomainFromWebsite(website)
  if (!domain) return false

  const normalizedDomain = domain.replace(/\.(com|in|co|io|net|org|biz|ai|agency)$/g, '')
  const tokens = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter(t => t.length >= 4)
    .filter(t => !['marketing', 'agency', 'digital', 'company', 'consultant', 'services', 'solutions'].includes(t))

  if (tokens.length === 0) return true
  return tokens.some(t => normalizedDomain.includes(t))
}

async function scrapeWebsiteContacts(website) {
  const normalized = normalizeWebsiteUrl(website)
  if (!normalized) return { email: null, phone: null }

  const pages = [
    normalized,
    `${normalized.replace(/\/$/, '')}/contact`,
    `${normalized.replace(/\/$/, '')}/contact-us`,
    `${normalized.replace(/\/$/, '')}/contactus`,
    `${normalized.replace(/\/$/, '')}/about`,
    `${normalized.replace(/\/$/, '')}/about-us`,
  ]

  for (const pageUrl of pages) {
    try {
      const { data } = await axios.get(pageUrl, {
        timeout: 7000,
        maxRedirects: 3,
        headers: { 'User-Agent': 'Mozilla/5.0 ProxalyBot/1.0' },
      })

      const html = typeof data === 'string' ? data : ''
      if (!html) continue

      const $ = cheerio.load(html)
      let email = null

      const mailto = $('a[href^="mailto:"]').first().attr('href')
      if (mailto) {
        email = sanitizeEmail(mailto.replace('mailto:', '').split('?')[0])
      }

      if (!email) {
        const text = $('body').text() || ''
        email = extractEmailFromText(text)
      }

      const textBlob = `${$('body').text() || ''} ${html}`
      const phone = extractPhone(textBlob)

      if (email || phone) {
        return { email: sanitizeEmail(email) || null, phone: isValidPhone(phone) ? phone : null }
      }
    } catch (_) {}
  }

  return { email: null, phone: null }
}

async function discoverWebsiteForLead(name, city) {
  const resolveSearchHref = (href) => {
    if (!href) return null
    if (href.startsWith('http') && !href.includes('bing.com/ck/a?')) return href

    try {
      const parsed = new URL(href.startsWith('http') ? href : `https:${href}`)

      if (parsed.hostname.includes('bing.com') && parsed.pathname.includes('/ck/a')) {
        const u = parsed.searchParams.get('u')
        if (u) {
          const encoded = u.startsWith('a1') ? u.slice(2) : u
          const padded = encoded + '='.repeat((4 - (encoded.length % 4)) % 4)
          const decoded = Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
          if (decoded.startsWith('http')) return decoded
        }
      }

      if (parsed.hostname.includes('duckduckgo.com') && parsed.pathname.startsWith('/l/')) {
        const target = parsed.searchParams.get('uddg')
        if (target?.startsWith('http')) return decodeURIComponent(target)
      }
    } catch (_) {}

    return null
  }

  try {
    const query = `${name} ${city} official website`
    const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=8`
    const { data } = await axios.get(url, {
      timeout: 8000,
      maxRedirects: 3,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })

    const html = typeof data === 'string' ? data : ''
    if (!html) return null

    const $ = cheerio.load(html)
    const links = []
    $('li.b_algo h2 a').each((_, el) => {
      const href = $(el).attr('href')
      const resolved = resolveSearchHref(href)
      if (resolved) links.push(resolved)
    })

    for (const link of links) {
      if (isUsableBusinessWebsite(link) && websiteMatchesLead(name, link)) {
        return link
      }
    }
  } catch (_) {}

  try {
    const query = `${name} ${city} official website`
    const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`
    const { data } = await axios.get(url, {
      timeout: 8000,
      maxRedirects: 3,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })

    const html = typeof data === 'string' ? data : ''
    if (!html) return null

    const $ = cheerio.load(html)
    const links = []
    $('a.result__a').each((_, el) => {
      const href = $(el).attr('href')
      const resolved = resolveSearchHref(href)
      if (resolved) links.push(resolved)
    })

    for (const link of links) {
      if (isUsableBusinessWebsite(link) && websiteMatchesLead(name, link)) {
        return link
      }
    }
  } catch (_) {}

  return null
}

function guessCommonEmails(website) {
  const domain = getDomainFromWebsite(website)
  if (!domain) return []
  return [`info@${domain}`, `contact@${domain}`, `hello@${domain}`, `sales@${domain}`]
}

async function enrichLeadContacts(leads) {
  const enriched = []

  for (const lead of leads) {
    const next = { ...lead }
    if (!next.website) {
      const discovered = await discoverWebsiteForLead(next.name || '', next.city || '')
      if (discovered) next.website = discovered
    }

    next.website = normalizeWebsiteUrl(next.website)

    if (!next.email && !next.phone && next.website) {
      const scraped = await scrapeWebsiteContacts(next.website)
      if (scraped.email) next.email = scraped.email
      // Preserve maps/directories phone and only fill if missing.
      if (!next.phone && scraped.phone) next.phone = scraped.phone

      if (!next.email) {
        const guesses = guessCommonEmails(next.website)
        if (guesses.length > 0) next.email = sanitizeEmail(guesses[0])
      }
    } else if (!next.email && next.website) {
      const guesses = guessCommonEmails(next.website)
      if (guesses.length > 0) next.email = sanitizeEmail(guesses[0])
    }

    enriched.push(toContactReadyLead(next))
  }

  return enriched
}

/**
 * Validate that a scraped lead is relevant to the searched business type.
 * Catches the case where Google Maps returns marketing agencies for "dentist" searches.
 */
function isRelevantToSearch(lead, searchedType) {
  const type = (searchedType || '').toLowerCase().trim()
  const name = (lead.name || '').toLowerCase()

  // Split search type into keywords (e.g. 'dental clinic' -> ['dental', 'clinic'])
  const typeWords = type.split(/\s+/).filter(w => w.length > 3)

  // If search contains any of these, it's an agency search — any agency result is fine
  const isAgencySearch = AGENCY_MISMATCH_KEYWORDS.some(kw => type.includes(kw.split(' ')[0]))
  if (isAgencySearch) return true

  // For non-agency searches, filter out obvious agency/studio results
  const agencyTerms = ['agency', 'marketing', 'studio', 'creative', 'roi', 'seo', 'branding', 'media', 'advertising', 'production']
  const hasAgencyName = agencyTerms.some(term => name.includes(term))
  if (hasAgencyName && !isAgencySearch) {
    // Double check: does the searched type itself include any agency terms?
    const typeIncludesAgency = agencyTerms.some(term => type.includes(term))
    if (!typeIncludesAgency) {
      console.log(`[Filter] Removing mismatched result: "${lead.name}" (searching for "${searchedType}")`)
      return false
    }
  }

  return true
}

function dedupeLeads(leads) {
  const seen = new Set()
  const deduped = []

  for (const lead of leads) {
    const markers = getLeadDedupeMarkers(lead)
    if (markers.length === 0) continue
    if (markers.some(marker => seen.has(marker))) continue
    markers.forEach(marker => seen.add(marker))
    deduped.push(lead)
  }

  return deduped
}

/**
 * Smart scraper — picks the best source for the city
 * Falls back automatically if primary source returns 0 leads
 */
async function scrapeLeads({ businessType, city, source = 'auto', maxResults = 15 }) {
  // IMPORTANT: Always use the exact businessType the user searched for.
  // Never replace it with marketing keywords.
  const keyword = businessType
  console.log(`\n🔍 Scraping: "${keyword}" in "${city}" [source: ${source}]`)

  const indian = isIndianCity(city)

  // Auto-select best source based on city
  let primarySource = source
  if (source === 'auto' || source === 'google_maps') {
    primarySource = indian ? 'justdial' : 'yellowpages'
  }

  let leads = []

  // Try primary source first
  switch (primarySource) {
    case 'justdial':
      leads = await scrapeJustdial(keyword, city, maxResults + 8)
      break
    case 'yellowpages':
      leads = await scrapeYellowPages(keyword, city, maxResults + 8)
      break
    case 'google_search':
      leads = await scrapeGoogleSearch(keyword, city, maxResults + 8)
      break
    case 'google_maps':
      leads = await scrapeGoogleMaps(keyword, city, maxResults + 8)
      break
    default:
      leads = await scrapeGoogleMaps(keyword, city, maxResults + 8)
  }

  // Fallback chain: if primary gave 0 relevant results
  if (leads.length === 0) {
    console.log(`⚠️  Primary source (${primarySource}) returned 0 leads. Trying fallback...`)

    if (primarySource !== 'google_maps') {
      leads = await scrapeGoogleMaps(keyword, city, maxResults + 8)
    }

    if (leads.length === 0) {
      console.log('⚠️  Google Maps also returned 0. Trying Google Search...')
      leads = await scrapeGoogleSearch(keyword, city, maxResults + 8)
    }

    if (leads.length === 0 && indian) {
      leads = await scrapeJustdial(keyword, city, maxResults + 8)
    }
  }

  const shuffled = shuffleArray(leads)
  const deduped = dedupeLeads(shuffled)
  const contactEnriched = await enrichLeadContacts(deduped)
  const contactable = contactEnriched.filter(isContactableLead)

  // Filter out results that clearly don't match the searched business type
  const relevant = contactable.filter(lead => isRelevantToSearch(lead, businessType))
  const filtered = relevant.length > 0 ? relevant : contactable // fallback to all if filter too aggressive

  const fresh = shuffleArray(filtered).slice(0, maxResults)

  console.log(`\n✅ Total leads scraped: ${fresh.length} (filtered from ${contactable.length})`)
  return fresh
}

module.exports = {
  scrapeLeads,
  scrapeGoogleMaps,
  scrapeJustdial,
  scrapeYellowPages,
  scrapeGoogleSearch,
}

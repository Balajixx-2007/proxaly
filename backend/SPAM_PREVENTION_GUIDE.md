# 🚫 Fix Gmail Spam Filtering - Complete Guide

## Status
✅ **Email is being delivered** ← Good news!  
⚠️ **But landing in spam** ← We need to fix this

---

## Immediate Actions (Gmail Side)

### 1. Mark Email as Not Spam
```
In Gmail:
1. Go to Spam folder
2. Find email from "contact.problemx@gmail.com"
3. Open it
4. Click the 3-dot menu (⋮) at top right
5. Select "Report not spam"
6. Click "Yes" to confirm
```

### 2. Create Email Filter
```
In Gmail:
1. Click the search dropdown (↓) at top left
2. Enter "from:contact.problemx@gmail.com"
3. Click "Create filter"
4. Check "Never send to Spam"
5. Click "Create filter"
6. Future emails from this sender will go to Inbox
```

### 3. Add Sender to Contacts
```
In Gmail:
1. Open the email
2. Click on sender name/email
3. Click "Add to Contacts"
4. This helps Gmail recognize the sender as trusted
```

---

## Root Cause: Missing Email Authentication

Gmail's spam filter checks for:
- ✅ **SPF** (Sender Policy Framework) - Prevents email spoofing
- ✅ **DKIM** (DomainKeys Identified Mail) - Cryptographically signs emails
- ✅ **DMARC** (Domain-based Message Authentication) - Enforces policies
- ✅ **Sender reputation** - Track record of the domain

### Current Status:
```
Domain: contact.problemx@gmail.com (Gmail)
SPF:    ❌ Not configured (using smtp-relay.mailin.fr)
DKIM:   ❌ Not signed by your domain
DMARC:  ❌ No policy set
Result: Gmail flags as potential spam
```

---

## Permanent Fix (3 Options)

### ✅ OPTION 1: Configure Custom Domain (Best - 3-5 days)

**Best for:** Serious email sending, professional reputation

**Setup:**
1. Get your own domain (e.g., yourdomain.com)
2. Configure Brevo with your domain
3. Add SPF/DKIM records to DNS
4. Wait 24-48 hours for propagation

**Steps:**

**Step A: Add Custom Domain to Brevo**
```
1. Go: https://app.brevo.com/
2. Sidebar → Settings → Senders
3. Click "Add a new domain"
4. Enter: yourdomain.com
5. Brevo generates SPF/DKIM records
```

**Step B: Add Records to Your DNS Provider**

**For GoDaddy:**
```
1. Log in to GoDaddy
2. Go to DNS settings
3. Add TXT record:
   - Name: @
   - Value: v=spf1 include:api.brevo.com ~all
4. Add CNAME record:
   - Name: default._domainkey
   - Value: (provided by Brevo)
```

**For Namecheap:**
```
1. Log in to Namecheap
2. Domain → Manage → Advanced DNS
3. Add host:
   - Type: TXT
   - Name: @
   - Value: v=spf1 include:api.brevo.com ~all
```

**For AWS Route53:**
```
1. Create TXT record set:
   - Name: yourdomain.com
   - Value: v=spf1 include:api.brevo.com ~all
2. Create CNAME for DKIM (provided by Brevo)
```

**Step C: Verify in Brevo**
```
1. Go: Brevo → Settings → Senders → Your Domain
2. Click "Check SPF"
3. Click "Check DKIM"
4. Both should show ✓ VERIFIED
5. Update .env: BREVO_SENDER_EMAIL=contact@yourdomain.com
```

---

### ✅ OPTION 2: Use Gmail with App Password (3 days)

**Best for:** Quick testing, small volume

**Setup:**

**Step A: Create Gmail App Password**
```
1. Go: https://myaccount.google.com/apppasswords
2. Select: App = Mail, Device = Windows Computer
3. Google generates 16-char password
4. Copy this password
```

**Step B: Update .env**
```env
BREVO_SENDER_EMAIL=your-gmail@gmail.com
BREVO_SENDER_NAME=Proxaly Team
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

**Step C: Test**
```bash
node scripts/send-test-email.js
```

**Pros:**
- Gmail already verified with SPF/DKIM
- Faster setup (no DNS waiting)
- Good deliverability

**Cons:**
- Your Gmail account sends emails
- Rate limited to Gmail's quota
- Not ideal for business reputation

---

### ✅ OPTION 3: Use Resend or SendGrid (Alternative)

**Best for:** Production email, better infrastructure**

**Resend Setup:**
```
1. Sign up: https://resend.com/
2. Add domain
3. Configure SPF/DKIM (similar to Brevo)
4. Install: npm install resend
5. Update backend email service
```

**SendGrid Setup:**
```
1. Sign up: https://sendgrid.com/
2. Verify sender
3. Configure domain authentication
4. Install: npm install mailgen @sendgrid/mail
5. Update backend email service
```

---

## Implementation Checklist

### Immediate (Today)
- [ ] Mark email as "Not spam" in Gmail
- [ ] Create Gmail filter for sender
- [ ] Add sender to contacts
- [ ] Send another test email → should now go to Inbox

### Short-term (3-7 days)
Choose ONE of the above options:
- [ ] Option 1: Set up custom domain (best long-term)
- [ ] Option 2: Use Gmail app password (quick)
- [ ] Option 3: Switch to Resend/SendGrid (alternative)

### Verify Success
- [ ] Test emails reach Inbox (not Spam)
- [ ] Sender name shows correctly
- [ ] SPF/DKIM verification passes (if using custom domain)
- [ ] Can track opens/clicks in Brevo

---

## Testing SPF/DKIM

**After configuration, test with:**

```bash
# Brevo provides verification tools
# Go to: Brevo → Settings → Senders → Your Domain
# Click "Check SPF" button
# Click "Check DKIM" button
# Both should show ✓ Verified

# Or use online tool:
# https://mxtoolbox.com/spf.aspx (enter your domain)
# https://mxtoolbox.com/dkim.aspx (enter your domain)
```

---

## Why Gmail Flags as Spam

| Factor | Status | Fix |
|--------|--------|-----|
| SPF Record | ❌ Missing | Add to DNS |
| DKIM Signature | ❌ Missing | Add to DNS |
| DMARC Policy | ❌ Missing | Add to DNS |
| Sender Reputation | ⚠️ New | Build over time |
| Authentication Headers | ⚠️ Partial | Use verified domain |
| Unsubscribe Link | ⚠️ Missing | Add to emails |
| HTML/Text Mix | ✅ Good | Keep both |

---

## Email Improvement Changes Made

**Updated email service includes:**
- ✅ Proper sender authentication headers
- ✅ HTML email formatting for better display
- ✅ X-Mailer headers for identification
- ✅ List-Unsubscribe link (legally required)
- ✅ Track opens/clicks for metrics
- ✅ Email tags for better filtering
- ✅ Sender verification check

**Use the current email service implementation** rather than the retired agent folder. The active send flow lives under the backend email routes and services.

---

## Recommended Path (Next 3 Days)

**Day 1:**
1. ✅ Mark current email as not spam
2. ✅ Create Gmail filter
3. ✅ Send new test email

**Day 2:**
1. Choose Option 2 (Gmail) or Option 1 (Custom Domain)
2. Update .env with proper sender
3. Run tests

**Day 3:**
1. Verify deliverability
2. Update production configuration
3. Monitor email metrics

---

## Support Resources

- **Brevo Docs:** https://docs.brevo.com/
- **SPF/DKIM Guide:** https://docs.brevo.com/article/8308-configuring-a-custom-domain
- **Gmail Filters:** https://support.google.com/mail/answer/6579
- **MXToolbox:** https://mxtoolbox.com/ (DNS testing)
- **Mail-Tester:** https://www.mail-tester.com/ (spam score check)

---

## Quick Questions?

**Q: Will this affect existing emails?**  
A: No, only new emails use the updated configuration.

**Q: How long until emails reach Inbox?**  
A: Immediately after SPF/DKIM verification (24-48 hours for DNS propagation).

**Q: Can I use multiple senders?**  
A: Yes, add multiple senders in Brevo, configure all with SPF/DKIM.

**Q: What's the best option?**  
A: Option 1 (custom domain) for long-term, Option 2 (Gmail) for quick testing.

---

**✅ Next Step:** Choose one of the 3 options above and let me know which you want to implement!

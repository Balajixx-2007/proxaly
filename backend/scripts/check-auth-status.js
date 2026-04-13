#!/usr/bin/env node
/**
 * Email Authentication Status Checker
 * Checks SPF, DKIM, and DMARC records for your domain
 * Usage: node scripts/check-auth-status.js
 */

require('dotenv').config();
const dns = require('dns').promises;

const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL;

async function checkAuthStatus() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  EMAIL AUTHENTICATION STATUS CHECKER');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (!BREVO_SENDER_EMAIL) {
    console.error('❌ Error: BREVO_SENDER_EMAIL not set in .env');
    process.exit(1);
  }

  const [localPart, domain] = BREVO_SENDER_EMAIL.split('@');

  console.log(`📧 Sender Email: ${BREVO_SENDER_EMAIL}`);
  console.log(`🌐 Domain: ${domain}\n`);

  // If using Gmail
  if (domain === 'gmail.com') {
    console.log('✅ Using Gmail as sender\n');
    console.log('📋 Gmail Authentication Status:');
    console.log('  SPF:  ✓ Gmail handles this for you');
    console.log('  DKIM: ✓ Gmail handles this for you');
    console.log('  DMARC: ✓ Gmail policy applied\n');
    console.log('✅ Gmail addresses have excellent deliverability by default!\n');
    return;
  }

  // Check custom domain
  console.log('🔍 Checking custom domain authentication...\n');

  try {
    // Check SPF
    console.log('📋 [1/3] Checking SPF Record...');
    try {
      const spfRecords = await dns.resolveTxt(domain);
      const spfRecord = spfRecords.find(r => r[0].startsWith('v=spf1'));
      
      if (spfRecord) {
        console.log(`  ✓ SPF found: ${spfRecord.join('')}`);
        if (spfRecord[0].includes('api.brevo.com')) {
          console.log('  ✓ Includes Brevo (api.brevo.com) - Good!');
        } else {
          console.log('  ⚠ Does NOT include Brevo - Add: include:api.brevo.com');
        }
      } else {
        console.log('  ❌ No SPF record found');
        console.log('  → Add SPF: v=spf1 include:api.brevo.com ~all');
      }
    } catch (err) {
      console.log('  ❌ No SPF record found');
      console.log('  → Add SPF: v=spf1 include:api.brevo.com ~all');
    }
    console.log();

    // Check DKIM
    console.log('📋 [2/3] Checking DKIM Record...');
    try {
      // Common DKIM selectors
      const selectors = ['default', 'mailo', 'brevo', 'selector1', 'selector2'];
      let dkimFound = false;

      for (const selector of selectors) {
        try {
          const dkimDomain = `${selector}._domainkey.${domain}`;
          const dkimRecords = await dns.resolveTxt(dkimDomain);
          if (dkimRecords.length > 0) {
            console.log(`  ✓ DKIM found for selector "${selector}"`);
            dkimFound = true;
            break;
          }
        } catch (_) {
          // Selector not found, try next
        }
      }

      if (!dkimFound) {
        console.log('  ❌ No DKIM record found');
        console.log('  → Add DKIM record from Brevo dashboard');
        console.log('  → Go: Brevo → Settings → Senders → Your Domain');
        console.log('  → Copy DKIM record and add to DNS');
      }
    } catch (err) {
      console.log('  ❌ No DKIM record found');
      console.log('  → Add DKIM record from Brevo dashboard');
    }
    console.log();

    // Check DMARC
    console.log('📋 [3/3] Checking DMARC Policy...');
    try {
      const dmarcRecords = await dns.resolveTxt(`_dmarc.${domain}`);
      const dmarcRecord = dmarcRecords.find(r => r[0].startsWith('v=DMARC1'));

      if (dmarcRecord) {
        console.log(`  ✓ DMARC found: ${dmarcRecord.join('')}`);
      } else {
        console.log('  ⚠ DMARC record exists but may not be configured properly');
      }
    } catch (_) {
      console.log('  ⚠ No DMARC record found (optional but recommended)');
      console.log('  → Optional: Add DMARC: v=DMARC1; p=quarantine; rua=mailto:admin@${domain}');
    }
    console.log();

  } catch (err) {
    console.error('❌ DNS lookup failed:', err.message);
    console.log('\n💡 Possible reasons:');
    console.log('  - Domain name may be incorrect');
    console.log('  - DNS server unreachable');
    console.log('  - Try checking manually: https://mxtoolbox.com/');
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('📝 NEXT STEPS');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (domain === 'gmail.com') {
    console.log('🎉 Gmail sender: No action needed!');
    console.log('✅ Your emails should have excellent deliverability.\n');
  } else {
    console.log('1. Go to Brevo Dashboard: https://app.brevo.com/');
    console.log('2. Settings → Senders → Your Domain');
    console.log('3. Get SPF/DKIM records provided by Brevo');
    console.log('4. Add records to your DNS provider');
    console.log('5. Wait 24-48 hours for DNS propagation');
    console.log('6. Click "Check SPF" and "Check DKIM" in Brevo');
    console.log('7. Both should show ✓ Verified\n');
  }

  console.log('═══════════════════════════════════════════════════════════\n');
}

checkAuthStatus().catch(console.error);

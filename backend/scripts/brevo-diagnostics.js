#!/usr/bin/env node
/**
 * Diagnostic script to check Brevo email account and delivery status
 * Usage: node scripts/brevo-diagnostics.js
 */

require('dotenv').config();
const axios = require('axios');

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_API_URL = 'https://api.brevo.com/v3';
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL;

async function runDiagnostics() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  BREVO EMAIL DIAGNOSTICS');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (!BREVO_API_KEY) {
    console.error('❌ Error: BREVO_API_KEY not set in .env');
    process.exit(1);
  }

  const headers = {
    'api-key': BREVO_API_KEY,
    'Content-Type': 'application/json',
  };

  try {
    // Test 1: Check account info
    console.log('📋 [TEST 1] Checking Brevo Account Info...');
    try {
      const accountRes = await axios.get(`${BREVO_API_URL}/account`, { headers, timeout: 10000 });
      const {
        email: accountEmail,
        companyName,
        email_credits: emailCredits,
        sms_credits: smsCredits,
        plan,
      } = accountRes.data;

      console.log(`  ✓ Account Email: ${accountEmail}`);
      console.log(`  ✓ Company Name: ${companyName || 'Not set'}`);
      console.log(`  ✓ Email Credits: ${emailCredits || 'Unlimited'}`);
      console.log(`  ✓ SMS Credits: ${smsCredits || 'N/A'}`);
      console.log(`  ✓ Plan Type: ${plan || 'Free'}\n`);
    } catch (err) {
      console.error(`  ✗ Failed to fetch account info: ${err.message}\n`);
    }

    // Test 2: Check sender emails
    console.log('📋 [TEST 2] Checking Verified Sender Emails...');
    try {
      const sendersRes = await axios.get(`${BREVO_API_URL}/senders`, { headers, timeout: 10000 });
      const senders = sendersRes.data?.senders || [];

      if (senders.length === 0) {
        console.log('  ⚠ No verified sender emails found!\n');
      } else {
        senders.forEach((sender) => {
          const status = sender.isVerified ? '✓ Verified' : '⚠ Pending verification';
          console.log(`  ${status}: ${sender.senderName} <${sender.senderEmail}>`);
          if (!sender.isVerified) {
            console.log(`       → Verification email sent to: ${sender.replyToEmail || 'N/A'}`);
          }
        });
        console.log();
      }
    } catch (err) {
      console.error(`  ✗ Failed to fetch senders: ${err.message}\n`);
    }

    // Test 3: Check SMTP configuration
    console.log('📋 [TEST 3] Checking SMTP Configuration...');
    console.log(`  Sender Email (from .env): ${BREVO_SENDER_EMAIL || 'Not configured'}`);
    console.log(`  API Key Status: ${BREVO_API_KEY ? '✓ Configured' : '✗ Missing'}\n`);

    // Test 4: Get email statistics
    console.log('📋 [TEST 4] Email Statistics (Last 7 Days)...');
    try {
      const statsRes = await axios.get(`${BREVO_API_URL}/smtp/statistics`, {
        headers,
        timeout: 10000,
      });

      const {
        emails: totalEmails = 0,
        delivered = 0,
        failed = 0,
        bounced = 0,
        opens = 0,
        clicks = 0,
        deferred = 0,
      } = statsRes.data || {};

      console.log(`  Total Sent: ${totalEmails}`);
      console.log(`  Delivered: ${delivered}`);
      console.log(`  Failed: ${failed}`);
      console.log(`  Bounced: ${bounced}`);
      console.log(`  Deferred: ${deferred}`);
      console.log(`  Opens: ${opens}`);
      console.log(`  Clicks: ${clicks}`);

      if (totalEmails > 0) {
        const deliveryRate = ((delivered / totalEmails) * 100).toFixed(2);
        console.log(`  Delivery Rate: ${deliveryRate}%\n`);
      } else {
        console.log(`  (No emails sent yet)\n`);
      }
    } catch (err) {
      console.error(`  ✗ Failed to fetch statistics: ${err.message}\n`);
    }

    // Test 5: Email deliverability test (validation)
    console.log('📋 [TEST 5] Recipient Email Validations...');
    const testEmails = ['bb6010757@gmail.com'];

    for (const email of testEmails) {
      try {
        const validateRes = await axios.post(
          `${BREVO_API_URL}/email/checker`,
          { email },
          { headers, timeout: 10000 }
        );

        const { result, score } = validateRes.data;
        console.log(`  Email: ${email}`);
        console.log(`    Result: ${result} (Score: ${score})`);
      } catch (err) {
        console.log(`  Email: ${email}`);
        console.log(`    ⚠ Validation failed: ${err.response?.data?.message || err.message}`);
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📝 TROUBLESHOOTING TIPS:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('1. Verify sender email is confirmed in Brevo dashboard');
    console.log('2. Check spam/junk folder in recipient mailbox');
    console.log('3. Ensure sufficient email credits in Brevo account');
    console.log('4. Check Brevo logs for delivery status and bounce reasons');
    console.log('5. Verify recipient email address is spelled correctly');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (err) {
    console.error('❌ Diagnostic failed:', err.message);
    process.exit(1);
  }
}

runDiagnostics();

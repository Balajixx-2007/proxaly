const axios = require('axios');

const baseURL = process.env.SMOKE_BASE_URL || 'https://proxaly-production.up.railway.app';

const tests = [
  { method: 'get', path: '/health', expect: [200] },

  // Public endpoints
  { method: 'get', path: '/api/billing/plans', expect: [200] },
  { method: 'get', path: '/api/billing/paypal/link/pro', expect: [200, 400] },
  { method: 'get', path: '/api/billing/wise/details/pro', expect: [200, 400] },
  { method: 'get', path: '/api/clients/portal/invalid-token', expect: [400, 401, 404] },
  { method: 'get', path: '/api/branding/portal/invalid-token', expect: [200, 400, 401, 404] },

  // Protected endpoints should reject unauthenticated requests with 401/403, not 500
  { method: 'get', path: '/api/auth/profile', expect: [401, 403] },
  { method: 'get', path: '/api/leads', expect: [401, 403] },
  { method: 'post', path: '/api/leads/scrape', data: { query: 'dentist in london' }, expect: [401, 403] },
  { method: 'get', path: '/api/leads/export', expect: [401, 403] },

  { method: 'get', path: '/api/campaigns', expect: [401, 403] },
  { method: 'post', path: '/api/campaigns', data: { name: 'Smoke Campaign' }, expect: [401, 403] },

  { method: 'post', path: '/api/enrich', data: { leadId: 'x' }, expect: [401, 403] },

  { method: 'get', path: '/api/automation/status', expect: [401, 403] },
  { method: 'get', path: '/api/automation/logs', expect: [401, 403] },
  { method: 'post', path: '/api/automation/start', data: {}, expect: [401, 403] },

  { method: 'get', path: '/api/analytics/overview', expect: [401, 403] },
  { method: 'get', path: '/api/analytics/campaigns', expect: [401, 403] },
  { method: 'post', path: '/api/analytics/report/send', data: {}, expect: [401, 403] },

  { method: 'get', path: '/api/channels/stats', expect: [401, 403] },
  { method: 'get', path: '/api/channels/whatsapp/queue', expect: [401, 403] },

  { method: 'get', path: '/api/clients', expect: [401, 403] },
  { method: 'post', path: '/api/clients', data: { name: 'Smoke Client' }, expect: [401, 403] },

  { method: 'get', path: '/api/branding', expect: [401, 403] },
  { method: 'post', path: '/api/branding', data: { brand_name: 'Smoke Brand' }, expect: [401, 403] },

  { method: 'post', path: '/api/email/preview', data: { leadId: 'x' }, expect: [401, 403] },
  { method: 'post', path: '/api/email/send', data: { leadId: 'x' }, expect: [401, 403] },
  { method: 'post', path: '/api/email/bulk', data: { leadIds: [] }, expect: [401, 403] },
  { method: 'post', path: '/api/email/schedule', data: { leadId: 'x' }, expect: [401, 403] },
  { method: 'get', path: '/api/email/logs', expect: [401, 403] },

  // Unknown route should be clean 404 JSON
  { method: 'get', path: '/api/does-not-exist', expect: [404] },
];

async function run() {
  const failures = [];
  let passed = 0;

  for (const t of tests) {
    try {
      const res = await axios({
        method: t.method,
        url: `${baseURL}${t.path}`,
        data: t.data,
        timeout: 15000,
        validateStatus: () => true,
      });

      const ok = t.expect.includes(res.status);
      const tag = ok ? 'PASS' : 'FAIL';
      console.log(`${tag} ${t.method.toUpperCase()} ${t.path} -> ${res.status}`);

      if (!ok) {
        failures.push({ test: t, status: res.status, body: res.data });
      } else {
        passed += 1;
      }
    } catch (err) {
      console.log(`FAIL ${t.method.toUpperCase()} ${t.path} -> ERROR ${err.message}`);
      failures.push({ test: t, error: err.message });
    }
  }

  console.log(`\nSummary: ${passed}/${tests.length} passed`);

  if (failures.length) {
    console.log('\nFailures detail:');
    for (const f of failures) {
      console.log(JSON.stringify(f, null, 2));
    }
    process.exit(1);
  }
}

run();

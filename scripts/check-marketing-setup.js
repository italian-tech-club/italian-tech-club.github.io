// Read-only configuration check. Never logs API keys or webhook signing secrets.
// Usage: node scripts/check-marketing-setup.js [path/to/backend.env]
import dotenv from 'dotenv';
dotenv.config({ path: process.argv[2] || '.env', override: true });

const key = process.env.RESEND_API_KEY;
if (!key) {
  console.log('RESEND_API_KEY is missing.');
  process.exitCode = 1;
} else {
  const get = async (path) => {
    const response = await fetch(`https://api.resend.com/${path}`, {
      headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000),
    });
    const body = await response.json();
    if (!response.ok) {
      console.log(`Resend ${path}: HTTP ${response.status} (${body.name || 'request rejected'}).`);
      return null;
    }
    return body;
  };
  try {
    const domains = await get('domains');
    const sendingDomain = process.env.SPONSOR_FROM_EMAIL?.match(/@([^>\s]+)/)?.[1];
    const domain = domains?.data?.find((d) => d.name === sendingDomain);
    if (domain) {
      const settings = await get(`domains/${domain.id}`);
      if (settings) console.log(JSON.stringify({
        sendingDomain, status: settings.status,
        openTracking: settings.open_tracking, clickTracking: settings.click_tracking,
        trackingSubdomain: settings.tracking_subdomain,
        trackingDns: settings.records?.filter((record) => record.record === 'Tracking'),
      }, null, 2));
    } else if (domains) console.log('The configured sending domain was not found in this Resend account.');
    const webhooks = await get('webhooks');
    if (webhooks) {
      const matching = (webhooks.data || []).filter((w) => w.endpoint?.includes('/api/marketing/resend-webhook'))
        .map(({ endpoint, status, events }) => ({ endpoint, status, events }));
      console.log('Marketing webhooks:', JSON.stringify(matching));
    }
    console.log('Backend signing secret configured:', Boolean(process.env.RESEND_WEBHOOK_SECRET));
    console.log('Gomry API key configured:', Boolean(process.env.GOMRY_API_KEY));
    console.log('Luma API key configured:', Boolean(process.env.LUMA_API_KEY));
    if (!domains || !webhooks) process.exitCode = 1;
  } catch (error) {
    console.error('Configuration check could not reach Resend:', error.cause?.code || error.name);
    process.exitCode = 1;
  }
}

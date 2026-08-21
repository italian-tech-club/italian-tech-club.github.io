/**
 * Print the Gomry webhook deliveries captured so far, so the member-sync mapping
 * can be written against real payloads instead of a guessed schema.
 *
 * Gomry publishes no payload documentation, and the one thing the NYC sync needs
 * most — the applicant's email address — is absent from the MCP server's contact
 * serializer. So the first question is simply whether these deliveries carry it.
 * `--fields` answers that across every delivery at once; the default dump shows
 * whole payloads.
 *
 * Usage: MONGODB_URI must be set (or present in .env), then:
 *   node scripts/inspect-gomry-webhooks.js [--channel application|contact]
 *                                          [--limit N] [--fields] [--unprocessed]
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import GomryWebhookEvent from '../server/models/GomryWebhookEvent.js';

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : (process.argv[i + 1] ?? true);
};
const flag = (name) => process.argv.includes(`--${name}`);

// Walks nested objects/arrays and yields every leaf as a dotted path, so a
// payload nesting the email two levels down still shows up.
function* leaves(value, path = '') {
  if (value === null || typeof value !== 'object') {
    yield [path, value];
    return;
  }
  if (Array.isArray(value)) {
    for (const [i, item] of value.entries()) yield* leaves(item, `${path}[${i}]`);
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    yield* leaves(item, path ? `${path}.${key}` : key);
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not defined');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });

  const query = {};
  if (arg('channel')) query.channel = arg('channel');
  if (flag('unprocessed')) query.processedAt = null;

  const events = await GomryWebhookEvent.find(query)
    .sort({ createdAt: -1 })
    .limit(Number(arg('limit', 10)))
    .lean();

  if (!events.length) {
    console.log('No deliveries captured yet.');
    console.log('Check that the webhook URLs are saved in Gomry (Impostazioni Organizzazione → Integrazioni)');
    console.log('and that GOMRY_WEBHOOK_SECRET matches the ?secret= in those URLs.');
    await mongoose.disconnect();
    return;
  }

  console.log(`${events.length} delivery(ies), newest first\n`);

  if (flag('fields')) {
    // Which paths exist, how often they carry a value, and one example each —
    // enough to write the field mapping from.
    const seen = new Map();
    for (const event of events) {
      for (const [path, value] of leaves(event.payload)) {
        const stat = seen.get(path) || { total: 0, filled: 0, example: null };
        stat.total += 1;
        if (value !== null && value !== '' && value !== undefined) {
          stat.filled += 1;
          if (stat.example === null) stat.example = value;
        }
        seen.set(path, stat);
      }
    }

    for (const [path, stat] of [...seen.entries()].sort()) {
      const example = typeof stat.example === 'string' ? stat.example.slice(0, 60) : JSON.stringify(stat.example);
      console.log(`  ${String(stat.filled).padStart(3)}/${String(stat.total).padEnd(3)} ${path.padEnd(46)} ${example ?? ''}`);
    }

    const emails = new Set();
    for (const event of events) {
      for (const [, value] of leaves(event.payload)) {
        if (typeof value === 'string' && EMAIL_RE.test(value)) emails.add(value.toLowerCase());
      }
    }
    console.log(`\n${emails.size ? '✅' : '❌'} email addresses found in these payloads: ${emails.size}`);
    for (const email of [...emails].slice(0, 10)) console.log(`   ${email}`);
  } else {
    for (const event of events) {
      console.log('='.repeat(70));
      console.log(`${event.channel}  ${event.createdAt.toISOString()}  application=${event.applicationId} contact=${event.contactId} status=${event.status}`);
      console.log('='.repeat(70));
      console.log(JSON.stringify(event.payload, null, 1));
      console.log();
    }
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('❌ Inspect failed:', error);
  process.exit(1);
});

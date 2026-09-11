# Campaign analytics setup

The Marketing tab reports accepted sends, confirmed deliveries, recorded opens,
CTA clicks, bounces, failures, spam complaints, unsubscribes, and conversions.
Select a campaign to see its report, recipient timestamps, filters, and CSV export.

## Enable email events

1. Deploy the frontend and API changes together. The new dynamic function is
   `/api/marketing/[action].js`; it brings this project to 12 Vercel functions.
2. In [Resend Domains](https://resend.com/domains), choose the sending domain.
   Enable open and click tracking and verify the tracking subdomain’s DNS records.
   Resend’s [tracking guide](https://resend.com/docs/dashboard/domains/tracking)
   explains the required CNAME and any additional CAA records.
3. In Resend Webhooks, add the public backend URL:

   ```text
   https://<api-host>/api/marketing/resend-webhook
   ```

   Subscribe to `email.sent`, `email.delivered`, `email.opened`, `email.clicked`,
   `email.bounced`, `email.complained`, `email.failed`, `email.suppressed`, and
   `email.delivery_delayed`.
4. Save its `whsec_...` signing secret as `RESEND_WEBHOOK_SECRET` in the backend
   environment and redeploy. Use the same variable in `.env` for local testing.
5. Keep `RESEND_API_KEY` and `SPONSOR_FROM_EMAIL` configured for sending. If the
   public website and API have different origins, set `MARKETING_API_URL` to the
   API origin so mail clients’ one-click unsubscribe POSTs reach the backend.
6. Send a future campaign to a controlled audience only when you intend to send
   that email. Resend’s test webhook with unrelated message IDs is acknowledged
   and ignored. The composer’s **Send test** deliberately creates no campaign
   analytics records.

Domain tracking also affects other messages sent on that domain. Tracking must
be enabled and DNS verified before sending. Historic campaigns have no stored
provider IDs or events; the report marks them as tracking unavailable rather
than treating them as unopened. A webhook secret being configured does not prove
domain tracking is enabled; the report separately shows the latest received event.

## RSVP and ticket conversions

Choose **Event RSVP or ticket (Gomry / Luma)** before sending, and use the
Gomry or Luma event URL as the button link. This is the default for new campaigns.
The saved send captures the goal, destination and event, so later composer edits
do not rewrite previous sends’ attribution.

The report’s **Sync registrations** button detects the platform from the saved
event link and syncs connected platforms. Unconnected platforms show a setup
message and are skipped, allowing another connected platform to sync.

For Gomry, it reads every attendee page from the linked event using
`GOMRY_API_KEY` (requires attendee read access).
Only `valid` and `checked_in` registrations count. Pending approvals and invited
contacts do not; cancelled/refunded tickets disappear from conversions on the
next successful sync if Gomry no longer reports them as valid. Failed or partial
fetches never remove conversions. Registrations are refreshed on demand; email
delivery/open/click events arrive through the webhook automatically.

For Luma, set `LUMA_API_KEY` in the backend environment. Keys belong to a single
calendar and require Luma Plus; create one in
[Luma calendar settings](https://luma.com/calendar/manage/api-keys).
The integration resolves the saved event URL through that calendar’s managed
events and reads every guest page. Only approved guests with a registration
timestamp and a free or captured paid ticket are eligible. Invitation timestamps
are never substituted for registration dates. Missing events, permission errors,
incomplete pagination and unexpected responses preserve existing conversions.
Declined/cancelled registrations are removed on the next complete sync. A refund
that leaves the guest approved still counts as an RSVP; revenue and refund
amounts are not tracked. Keep the event URL stable between sending and syncing.
Without a connected Luma calendar, email activity still works and registration
attribution remains unavailable. See the
[Luma API guide](https://docs.luma.com/reference/getting-started-with-your-api).

A matching email address must have clicked the campaign CTA before registering,
within 30 days. The latest qualifying campaign click receives credit. A person
counts once per campaign even if they click repeatedly or receive another send.
The same ticket is never attributed twice. Existing registrations before a click
are excluded. This is observed-click attribution: email scanners, missing click
events, different checkout email addresses, and cross-device behavior limit its
accuracy. It cannot prove the email caused the purchase.

Registration means a confirmed free RSVP or paid ticket. This integration does
not calculate revenue, ticket quantities, fees, or purchase amounts from ticket
prices. Other ticketing providers are not integrated.

**First member profile claim** remains an optional goal. Only a first claim
after a qualifying campaign click counts; repeated sign-ins do not. New claims
store `claimedAt`, allowing a report refresh to recover attribution if the click
webhook arrived late. Pre-existing claims are never backfilled with guessed dates.

## How metrics are calculated

- Unique recipients are grouped by member profile, including across repeat sends.
- Accepted means the sending API accepted the message; delivered requires the
  provider’s `email.delivered` event (mail-server acceptance, not inbox placement).
- Open rate = delivered recipients with a recorded open / delivered recipients.
- CTA click rate = delivered recipients with a CTA click / delivered recipients.
- Conversion rate = delivered recipients with a conversion / delivered recipients.
- Click-to-conversion rate = CTA clickers with a conversion / CTA clickers.
- Rates display `—` when there is no denominator. Recipients without a delivery
  event are excluded from delivery-based rate numerators too.
- Any-link clicks are separate from CTA clicks. The fallback URL beneath the CTA
  is the same destination and counts toward CTA clicks.
- Opens reflect image loads, not confirmed reading. Automated security scanners
  can generate opens and clicks; these reports do not claim human/bot filtering.
- Unsubscribes are bound to the delivery in the footer or one-click API link;
  undo removes that delivery’s unsubscribe mark. Old links still update the
  member’s global opt-out but cannot identify a campaign.

Callbacks verify the exact body bytes and Svix signature with a five-minute
timestamp tolerance. First/last timestamps use atomic min/max updates, so retries
and out-of-order events do not inflate metrics. Send snapshots are created before
calling Resend and correlated using tags, including when callbacks beat the send
response. Provider payloads, recipient IP addresses and user agents are not stored.
Only authenticated admins can read/export recipient results or sync registrations.

## Validation

```sh
npm run test:marketing
npm run test:marketing-ui
npm run build
```

`node scripts/check-marketing-setup.js [path/to/backend.env]` checks Resend
domain and webhook settings without printing credentials or sending email.

The backend tests use an isolated temporary MongoDB instance, never `.env`’s
database, and mock email sends and Gomry requests. The first run downloads a
MongoDB binary. Browser checks use local sample data and a temporary Vite server;
set `CHROME_PATH` if Chrome is not in the default macOS location. They never send
emails or access live campaign data.

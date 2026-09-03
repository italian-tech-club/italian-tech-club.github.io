# Italian Tech Club - New York Chapter

This is the repository for the [Italian Tech Club NYC](https://italiantechclub.github.io) landing page.

## Tech Stack

- React
- Vite
- Tailwind CSS
- Framer Motion

## Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Run development server: `npm run dev`
4. Build for production: `npm run build`

## Deployment

The site is automatically deployed to GitHub Pages via GitHub Actions when pushing to the `main` branch.

## Events Admin Panel

Events live in the `events` MongoDB collection and are managed from `/admin` (password-protected). The public site fetches them from `GET /api/events`, falling back to the bundled `src/data/events.json` if the API is unreachable.

### Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `MONGODB_URI` | Vercel + local `.env` | MongoDB Atlas connection string |
| `ADMIN_PASSWORD` | Vercel + local `.env` | Password for the `/admin` panel |
| `VITE_API_URL` | `.env.production` | API base URL baked into the frontend build |
| `PARTNER_VERIFY_KEY_<SLUG>` | Vercel + local `.env` | Per-partner secret its staff need to mark a one-time benefit code redeemed, e.g. `PARTNER_VERIFY_KEY_TIH`. Unset = `/verify` stays read-only for that partner. |
| `GOMRY_API_KEY` | Vercel + local `.env` | Gomry REST. Reads applications and their answers — the only surface that returns an applicant's email. |
| `GOMRY_MCP_TOKEN` | Vercel + local `.env` | Gomry MCP. The only surface that can *write*: approve/reject an application, and add a contact to the chapter list. |
| `GOMRY_WEBHOOK_SECRET` | Vercel + local `.env` | Shared secret in the `?secret=` of the webhook URLs registered in Gomry. |

### Seeding / migration

To (re)seed the `events` collection from `src/data/events.json` (idempotent, upserts on date + title):

```bash
npm run migrate:events
```

## Membership applications (Gomry)

Membership is decided on one Gomry form shared by every ITC chapter, and acceptance there — not a separate ITC review — is what makes someone a member. The `hub` answer says which chapter an application is for; `New York` is ours.

The **Applications** tab in `/admin` is the New York desk for that queue:

- Lists only `hub = New York` submissions. The rest of the org's pending applications (usually the large majority) show as a per-chapter tally and nothing more — the API refuses a decision on them.
- **Approve** writes `Accepted` to Gomry first, then creates the ITC member profile from the application and sends the welcome/claim email. Gomry stays the source of truth; the profile always follows from it.
- The **Send Gomry's acceptance / rejection email** checkbox maps to Gomry's `notify_applicant`. It is never defaulted server-side — on or off, the panel says which.
- A decision made here and one made in the Gomry dashboard end up in the same place: acceptance adds the contact to "All Members (Approved)", which fires the contact webhook that also creates the member. The webhook dedupes on `gomryContactId`, so the two paths can't both create a profile.

### Member photos

Gomry stores a 200–300px avatar at best, and many members arrive with none. LinkedIn can't be read from a server (`www.linkedin.com` answers a scraper with HTTP 999, and its og:image is a small preview crop), so a person has to be looking at the page. Two ways to be that person:

- In `/admin` — the photo frame on any application card, and the **Photo → fix** column on the Community tab's member table. Open their LinkedIn, then drag the photo onto the frame, or copy it and press ⌘V. A pasted image is downscaled in the browser; a dragged or pasted `media.licdn.com` URL is fetched server-side at the 800px render. Replacing a photo clears the member's pre-rendered share card so it re-renders.
- In bulk — `npm run collect:pics`, which drives a real Chrome window through everyone missing a photo. Still the right tool for a whole backlog.

## Partners & member benefits

Partners and the perks they offer members live in `src/data/partners.js` — one module imported by both the frontend and the partners API, so benefit ids can't drift. Adding a partner means adding an entry there and dropping a logo in `public/images/partners/`; nothing else to wire up.

Partner identity and perk mechanics are deliberately on separate pages, so the public side stays a directory that scales as partners are added:

- `/partners` — public logo wall, one uniform tile per partner. Scales by wrapping, not by growing taller.
- `/partners/:slug` — a partner's own page. Describes their perks without exposing codes; shareable, so a partner can be sent the URL of the page about them.
- `/community/perks` — member-gated. Where a member unlocks and copies their codes, grouped by partner. Linked from the `/community` header.
- `/verify` — partner-facing page. Staff enter the code a member gave them and see whether the holder is a current ITC member, plus the member's name, member number, and masked email to match against the person in front of them.
- One-time benefits can be burned from `/verify` with the issuing partner's own key — hand each partner a link with `?k=<their key>` baked in, generated with `openssl rand -base64 24` and stored as `PARTNER_VERIFY_KEY_<SLUG>`. Keys are scoped per partner, so one partner's link cannot burn another partner's codes, and a leaked key is revoked by rotating one env var. Reusable benefits are never marked off. Never put a key in `src/data/partners.js` — that module is bundled into the client.
- Codes are `ITC-<PARTNER>-XXXX-XXXX`, issued once per member per benefit (idempotent) and stored in the `benefit_claims` collection. Never rename a benefit id — codes in circulation reference it. Retire a benefit with `active: false` instead.
- A code stops verifying the moment the member's profile leaves `approved` status, so lapsed members lose the discount without anyone telling the partner.

### Notes

- Poster and gallery images can be uploaded directly in the admin panel — they are downscaled client-side and stored in MongoDB as base64 data URLs. Repo paths (`/images/events/...`) and external URLs also still work.
- The list endpoint (`GET /api/events`) omits gallery contents and returns `galleryCount`; the full gallery is fetched per event via `GET /api/events?id=<id>` when a gallery is opened. Keeps the homepage payload small.
- Events are capped at ~4MB each (Vercel request/response body limit).
- Local dev: `npm run dev:all` runs Vite and the Express API (`server/`) that mirrors the Vercel functions in `api/`.

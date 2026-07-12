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

### Seeding / migration

To (re)seed the `events` collection from `src/data/events.json` (idempotent, upserts on date + title):

```bash
npm run migrate:events
```

### Notes

- Event poster and gallery fields are image *paths*. The image files themselves must still be committed to the repo under `public/images/events/` (or be full external URLs) — the serverless API has no file storage.
- Local dev: `npm run dev:all` runs Vite and the Express API (`server/`) that mirrors the Vercel functions in `api/`.

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/e5b9fce5-b82e-4e8c-a602-2838d1830b6e

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Project Notes

- UI / code structure notes: [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)

## Backend Analytics (Vercel + custom sink)

This project now includes a lightweight server ingestion endpoint: `POST /api/track`.

- Frontend hook: `src/hooks/useAnalytics.ts` posts key events (page view, upload, export, etc.) in production.
- Server endpoint: `api/track.ts` enriches event metadata (`ip`, `ua`, `host`) and logs it.
- Optional forwarding: set `ANALYTICS_WEBHOOK_URL` to push events into your own backend
  (for example Alibaba Cloud Function/SLS pipeline).

Recommended Vercel environment variables:

- `VITE_ENABLE_SERVER_TRACKING=true`
- `VITE_ANALYTICS_WRITE_KEY=<same-secret-as-backend>`
- `ANALYTICS_WRITE_KEY=<same-secret-as-frontend>`
- `ANALYTICS_WEBHOOK_URL=<your-ingestion-endpoint>` (optional)
- `ANALYTICS_WEBHOOK_TOKEN=<bearer-token>` (optional)

# Calorie Tracker Deployment

This folder is ready to deploy to Vercel as a small web app.

## What Runs Where

- `index.html`, `styles.css`, and `app.js` are the browser app.
- `api/state.js` is the Vercel serverless API for shared data.
- Upstash Redis stores the calorie tracker state so it works from your phone, laptop, or any browser.
- `server.js` is still available for local-only testing.

## Deploy To Vercel

### Dashboard Path

1. Create a Vercel account or sign in.
2. Create a new Vercel project from this `calorie-tracker` folder.
3. In the Vercel project, add the Upstash Redis integration from Vercel Marketplace.
4. Confirm these environment variables exist in Vercel:

```text
KV_REST_API_URL
KV_REST_API_TOKEN
ACCESS_CODE
```

Use `ACCESS_CODE` for your private app password.

5. Deploy the project.
6. Open the Vercel URL on your phone and computer. The first sync asks for `ACCESS_CODE`.

### CLI Path

If Vercel CLI is installed and you are already logged in:

```powershell
cd C:\Users\Matheus Gramel\Documents\Codex\2026-06-26\i-want-a-simple-app-to\outputs\calorie-tracker
vercel
vercel env add ACCESS_CODE
```

After creating/connecting Upstash Redis in the Vercel dashboard, redeploy:

```powershell
vercel --prod
```

## Local Test

From this folder:

```powershell
npm run local
```

Then open:

```text
http://localhost:8080
```

Local testing uses `data/state.json`. Vercel uses Upstash Redis instead.

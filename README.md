# AdPlatform — Email Campaign Manager

A full-stack email advertising platform built on **Cloudflare Pages + Workers + D1**, with
**Supabase Auth & Storage**, **NeonDB** for contact lists, and **Gmail OAuth** for sending.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (CF Pages — React SPA)                                 │
│  Login · Templates · Images · Contacts · Campaigns · Analytics  │
└────────────────────────┬────────────────────────────────────────┘
                         │ fetch + Bearer JWT
┌────────────────────────▼────────────────────────────────────────┐
│  CF Worker (REST API + Cron)                                    │
│  /api/*  ·  /t/open/:id  ·  /t/click/:id  ·  /t/unsub/:id     │
└───┬─────────────┬──────────────┬───────────────┬───────────────┘
    │             │              │               │
  CF D1        NeonDB       Supabase          Gmail API
  (app data)   (contacts)   (auth+storage)   (sending)
```

### Data flow
- **CF D1** — campaigns, templates, image metadata, send logs, events, unsubscribes
- **NeonDB** — read-only source of contact lists (your existing subscriber tables/views)
- **Supabase Auth** — JWT-based login/signup (email + password)
- **Supabase Storage** — image uploads, served via public CDN URL
- **Gmail OAuth** — sends emails using stored refresh token (per user)

---

## Project structure

```
adplatform/
├── schema.sql                 # D1 database schema
├── frontend/                  # React SPA → CF Pages
│   ├── src/
│   │   ├── lib/api.ts         # API client + Supabase client + types
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── TemplatesPage.tsx
│   │   │   ├── ImagesPage.tsx
│   │   │   ├── ContactListsPage.tsx
│   │   │   ├── CampaignsPage.tsx
│   │   │   ├── CampaignEditorPage.tsx
│   │   │   ├── AnalyticsPage.tsx
│   │   │   ├── CampaignAnalyticsPage.tsx
│   │   │   └── SettingsPage.tsx
│   │   └── components/Layout.tsx
│   └── public/_redirects      # SPA routing for CF Pages
└── worker/                    # CF Worker
    └── src/
        ├── index.ts           # Router + tracking endpoints + cron
        ├── routes.ts          # All API handlers
        ├── auth.ts            # Supabase JWT verification
        ├── gmail.ts           # OAuth token refresh + send + tracking injection
        ├── neon.ts            # NeonDB contact queries
        ├── sender.ts          # Campaign send orchestration
        └── types.ts           # Shared TypeScript types
```

---

## Prerequisites

- [Node.js](https://nodejs.org) 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (`npm i -g wrangler`)
- Cloudflare account (free tier works)
- Supabase project (free tier works)
- NeonDB project with at least one table containing emails
- Gmail account with OAuth credentials

---

## Step-by-step setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. **Auth**: Email/password is enabled by default — no changes needed
3. **Storage**: Create a bucket called `ad-images`, set it to **Public**
4. Note your:
   - Project URL: `https://xxxxx.supabase.co`
   - Anon key (Settings → API)
   - Service role key (Settings → API) — keep this secret

### 2. NeonDB

Your NeonDB should already have tables with subscriber emails.
Example table the app expects:
```sql
-- subscribers table in NeonDB (you probably already have this)
CREATE TABLE subscribers (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  subscribed_at TIMESTAMPTZ DEFAULT NOW()
);
```
You just need the **connection string** (postgres://user:pass@host/db).

### 3. Gmail OAuth credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project → Enable **Gmail API**
3. OAuth consent screen → External → fill required fields
4. Credentials → Create OAuth 2.0 Client ID → Web application
5. Add `https://developers.google.com/oauthplayground` to Authorized redirect URIs
6. Note your **Client ID** and **Client Secret**

**Get refresh token using OAuth Playground:**
1. Go to [OAuth Playground](https://developers.google.com/oauthplayground/)
2. Click gear → check "Use your own OAuth credentials" → paste Client ID + Secret
3. In Step 1, type `https://mail.google.com/` → Authorize APIs
4. Sign in with your Gmail → allow access
5. In Step 2, click "Exchange authorization code for tokens"
6. Copy the **Refresh token**

### 4. Cloudflare D1

```bash
# Login to Cloudflare
wrangler login

# Create the database
wrangler d1 create adplatform-db
# → copy the database_id printed

# Apply schema
wrangler d1 execute adplatform-db --file=schema.sql
```

Edit `worker/wrangler.toml`:
```toml
[[d1_databases]]
database_id = "PASTE_YOUR_DATABASE_ID_HERE"
```

### 5. Worker secrets

```bash
cd worker

wrangler secret put SUPABASE_SERVICE_KEY
# paste your Supabase service role key

wrangler secret put SUPABASE_ANON_KEY
# paste your Supabase anon key

wrangler secret put NEON_DATABASE_URL
# paste postgres://user:pass@host/db

wrangler secret put TRACK_PIXEL_BASE_URL
# paste your worker URL AFTER first deploy, e.g.:
# https://adplatform-worker.YOUR_SUBDOMAIN.workers.dev
```

Also update the `[vars]` in `worker/wrangler.toml`:
```toml
[vars]
SUPABASE_URL = "https://YOUR_PROJECT.supabase.co"
FRONTEND_URL = "https://YOUR_PAGES_DOMAIN.pages.dev"
```

### 6. Deploy the worker

```bash
cd worker
npm install
npm run deploy
# → note the worker URL printed
```

Then update `TRACK_PIXEL_BASE_URL` secret with the actual worker URL:
```bash
wrangler secret put TRACK_PIXEL_BASE_URL
# https://adplatform-worker.YOUR_SUBDOMAIN.workers.dev
```

### 7. Deploy the frontend

```bash
cd frontend

# Create .env (copy from example)
cp .env.example .env
# Edit .env:
# VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
# VITE_SUPABASE_ANON_KEY=your_anon_key
# VITE_API_URL=https://adplatform-worker.YOUR_SUBDOMAIN.workers.dev

npm install
npm run deploy
# → deploys to CF Pages, prints your pages URL
```

---

## Local development

```bash
# Terminal 1 — Worker
cd worker
npm install
npm run dev          # starts on http://localhost:8787

# Terminal 2 — Frontend
cd frontend
npm install
# Edit .env → VITE_API_URL=http://localhost:8787
npm run dev          # starts on http://localhost:3000
```

For local D1, wrangler dev uses a local SQLite — apply schema first:
```bash
wrangler d1 execute adplatform-db --local --file=../schema.sql
```

---

## Using the platform

### 1. Login
Open your Pages URL → create an account → verify email (Supabase sends confirmation).

### 2. Settings
Go to Settings → paste Gmail credentials → Save.

### 3. Add contact list
Go to Contact Lists → Add List → enter:
- **List name**: e.g. "Newsletter"
- **NeonDB table**: e.g. `subscribers`
- **Email column**: `email`
- **Name column**: `name`
- Hit **Sync** to pull the count from NeonDB

### 4. Create a template
Go to Templates → New Template → paste your HTML.
Use `{{name}}` and `{{email}}` as merge tags — replaced per recipient at send time.

### 5. Upload images
Go to Image Library → drag/drop images → copy URLs to paste into your HTML template.

### 6. Create and send campaign
Go to Campaigns → New Campaign:
- Pick a template or write HTML directly
- Insert images via the Images button
- Select a contact list
- Set From name/email
- Click **Send now** or pick a schedule

### 7. View analytics
Analytics dashboard shows:
- Open rate, click rate, unsubscribe rate per campaign
- 30-day activity timeline
- Per-campaign breakdown with hourly opens/clicks chart
- Top clicked links

---

## Analytics tracking

Three invisible tracking mechanisms are injected at send time:

| Mechanism | Endpoint | How |
|-----------|----------|-----|
| **Opens** | `GET /t/open/:sendId` | 1×1 transparent GIF pixel in email |
| **Clicks** | `GET /t/click/:sendId?url=...` | All `<a href>` rewritten to proxy |
| **Unsubscribes** | `GET /t/unsub/:sendId` | Footer link added to every email |

All events stored in `email_events` D1 table, queryable for analytics.

---

## Scheduled campaigns

Set `scheduled_at` when creating a campaign. The Worker cron (`*/5 * * * *`) checks every
5 minutes for campaigns where `scheduled_at <= NOW()` and status is `scheduled`, then fires them.

---

## Gmail limits

| Account type | Daily limit |
|---|---|
| Free @gmail.com | 500 emails/day |
| Google Workspace | 2,000 emails/day |

The sender batches 5 emails at a time with 1-second delays. For larger lists, schedule campaigns
across multiple days or use Google Workspace.

---

## Environment variables reference

### Worker (`wrangler.toml` vars + secrets)

| Variable | Type | Description |
|---|---|---|
| `SUPABASE_URL` | var | Your Supabase project URL |
| `FRONTEND_URL` | var | Your CF Pages URL |
| `SUPABASE_SERVICE_KEY` | secret | Supabase service role key |
| `SUPABASE_ANON_KEY` | secret | Supabase anon/public key |
| `NEON_DATABASE_URL` | secret | NeonDB connection string |
| `TRACK_PIXEL_BASE_URL` | secret | Worker URL for tracking |

### Frontend (`.env`)

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_API_URL` | Worker URL |

---

## Security notes

- Gmail credentials stored in D1 (encrypted at rest by Cloudflare)
- Supabase JWTs verified on every API request via Supabase Auth API
- All D1 queries scoped to `user_id` — users can only access their own data
- Unsubscribes are globally honoured — excluded from all future campaigns for that sender
- Service role key never exposed to the browser

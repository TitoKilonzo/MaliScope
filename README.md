# MaliScope

MaliScope is an Africa-first financial literacy and market intelligence platform. It combines structured financial education, NSE-focused market information, daily briefings, an offline resource library and a simulated investing lab.

## Product boundaries

- The included market prices and company figures are **illustrative demo data**, not live NSE quotes or investment research.
- No brokerage, real-money trading, personalized investment advice or investment-product distribution is implemented.
- Before public market-data publication, obtain the appropriate NSE / licensed-provider agreement and verify external display, redistribution, delayed-data and historical-data rights.
- Have Kenyan counsel review the exact product scope against current CMA requirements before launching advisory, order-routing, investment-product marketing or other regulated functionality.

## Technology

- Web: Next.js App Router, React, TypeScript, Tailwind CSS, Recharts, Lucide
- API: Node.js, Express, TypeScript, Zod, Helmet, rate limiting, cookie sessions
- Data: PostgreSQL, Drizzle ORM, SQL migrations
- PWA: manifest, service worker, offline handout caching
- Included learning content: four seeded course paths, substantive lesson text, four client-side practice knowledge checks and three bundled PDF handouts
- Publishing: create, review and publish briefings; broader user/course/document CMS screens and direct PDF upload are future work
- Testing: Vitest, Supertest

## Requirements

- Node.js 20.11+ (Node 22 LTS recommended)
- npm 10+
- Docker (optional, for PostgreSQL persistence)

## Quick start: demo mode

1. Copy `.env.example` to `.env`.
2. Install dependencies: `npm install`.
3. Start the complete platform: `npm run dev`.
4. Open `http://localhost:3000`.

The API runs in in-memory demo mode when `DATABASE_URL` is unset or unreachable and `DEMO_MODE=true`. This makes the product easy to explore, but records created in demo mode are lost when the API restarts.

Local demo administrator: `admin@maliscope.demo` / `ChangeMe123!`. These credentials are for local exploration only; change both before any shared deployment. The credentials are not displayed in the product UI. The example `SESSION_SECRET` is intentionally invalid for production; replace it with a high-entropy secret of at least 32 characters. Production seeding also refuses the demo email domain and default password.

## PostgreSQL-backed local development

1. Copy `.env.example` to `.env` and keep `DATABASE_URL=postgres://postgres:postgres@localhost:5432/maliscope`.
2. Start PostgreSQL: `docker compose up -d postgres`.
3. Install dependencies: `npm install`.
4. Apply schema: `npm run db:migrate`.
5. Seed initial content and demo admin: `npm run db:seed`.
6. Start web and API: `npm run dev`.

If PostgreSQL is not ready, the API can fall back to demo mode during local development when `DEMO_MODE=true`. In production, the API always requires a working database and never creates the built-in demo administrator.

## Useful commands

```bash
npm run dev
npm run build
npm run typecheck
npm test
npm run db:migrate
npm run db:seed
npm run job:market-refresh
```

## Applications

- `apps/web`: public site, learning workspace, market dashboard, library, practice lab and admin UI.
- `apps/api`: REST API, validation, authentication, data adapters, Drizzle schema and migrations.
- `docs/`: product, architecture, security and deployment notes.

## API endpoints

- `GET /api/health`
- `GET /api/dashboard`
- `GET /api/markets/overview`
- `GET /api/markets/instruments`
- `GET /api/markets/instruments/:symbol`
- `GET /api/briefings`
- `GET /api/academy/courses`
- `GET /api/academy/courses/:slug`
- `GET /api/library/documents`
- `GET /api/watchlist` (authenticated)
- `POST /api/watchlist` (authenticated)
- `DELETE /api/watchlist/:symbol` (authenticated)
- `GET /api/practice/instruments`, `GET /api/practice/portfolio` (authenticated; simulator prices are separate illustrative references)
- `POST /api/practice/trades` (authenticated; simulated only)
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET /api/admin/overview`, `GET /api/admin/briefings`, `POST /api/admin/briefings`, `POST /api/admin/briefings/:slug/publish` (admin)

## Production checklist

1. Provision managed PostgreSQL, object storage (for example R2), secrets management and backups.
2. Set `DEMO_MODE=false`, a high-entropy `SESSION_SECRET`, `DATABASE_URL`, `WEB_ORIGIN` and `NEXT_PUBLIC_API_URL`.
3. Deploy the API and web independently; configure HTTPS and exact CORS origins.
4. Replace demo market adapter with an authorised provider adapter. Keep provider credentials on the API only.
5. Add a trading calendar, provider entitlements, data freshness SLAs, source attribution and ingestion monitoring before publication.
6. Configure email verification, password reset, transactional email, session revocation, audit retention and security monitoring.
7. Configure a scheduler to invoke `npm run job:market-refresh` after each completed exchange session only after a licensed provider adapter is implemented.
8. Obtain privacy, copyright, data redistribution and regulatory review before public launch.
9. Run dependency, SAST, DAST, backup-restore and load tests in CI/CD.

### Render deployment

Deploy two Render services from the repository root so npm workspaces can resolve the shared lockfile. For the API web service, use build command `npm install --include=dev && npm run build -w @maliscope/api` and start command `npm run start -w @maliscope/api`. For the web service, use build command `npm install --include=dev && npm run build -w @maliscope/web` and start command `npm run start -w @maliscope/web`. The build needs development dependencies such as TypeScript and type declarations even when `NODE_ENV=production`; both apps honor Render's assigned `PORT`.

Configure the API service with `NODE_ENV=production`, `DEMO_MODE=false`, `DATABASE_URL`, `SESSION_SECRET` (at least 32 characters), and `WEB_ORIGIN` set to the web service's HTTPS origin without a trailing slash (for example, `https://mali-scope.vercel.app`). Configure the web service with `NEXT_PUBLIC_API_URL` set to the API's HTTPS origin without a trailing slash (for example, `https://maliscope.onrender.com`). Run `npm run db:migrate -w @maliscope/api` as the API service's pre-deploy command before its first deployment and after schema changes. Never enable demo mode in production.

## Market data adapter

The course catalogue and lessons are seeded content; each course has a client-side practice knowledge check. Three PDFs are bundled in the web app and can be saved for offline use. The initial content studio manages briefings and ingestion review only; add course/document CRUD and object-storage uploads before operating this as a full institutional CMS.

The current adapter intentionally imports no market prices. The UI uses seeded illustrative examples with `DEMO` provenance; they are not copied into the market-data table as quotes. Run `npm run job:market-refresh` after database setup to record a skipped demo ingestion. Once an authorised provider adapter is implemented, each successful daily import creates or refreshes a factual briefing draft for editorial review; the job never auto-publishes a generated market report. Implement an authorised provider in `apps/api/src/services/market-data.ts` only after obtaining commercial entitlement. Every provider row is validated for OHLC integrity, duplicate timestamps and external-display permission. Preserve source, exchange timestamp, retrieval timestamp, delay status and entitlement metadata. Do not scrape exchange pages or strip source labels.

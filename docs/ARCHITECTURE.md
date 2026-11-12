# Architecture decisions

## Shape
A modular monolith is the deliberate starting point. The web app and API deploy independently, while the API owns business rules and persistence. Modules are separated by domain: identity, academy, markets, publishing, library, watchlists, simulation and administration.

## Why PostgreSQL
The core domain is relational: users enrol in courses, lessons belong to courses, prices belong to instruments and exchanges, and simulated transactions belong to portfolios. PostgreSQL provides transactions, constraints and predictable reporting queries. Drizzle keeps SQL explicit and migrations reviewable.

## Background work
The initial release exposes the processing boundaries and ingestion-run table. A production scheduler/queue should use the exchange calendar, idempotent ingestion keys, retries with backoff and dead-letter handling. It must not rely on a browser timer.

## Market-data integrity
Each price record needs provider, exchange timestamp, retrieved timestamp, currency, delay designation and source entitlement. The demo adapter must never be presented as current market data. Validation should detect gaps, duplicate bars and implausible changes before publication.

## Offline architecture
The PWA caches the application shell and user-selected educational documents. It does not cache a stale market quote as though it were current. Offline pages display a disconnected state and the last successful market timestamp.

## Regulatory boundary
The MVP is education and factual information. It does not provide individualized recommendations, execute orders, custody funds or distribute investment products. Any extension into regulated activity requires a fresh legal/CMA assessment and relevant licences/partnerships.

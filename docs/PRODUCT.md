# Product specification

## Product objective
Help people build practical financial literacy and understand market activity through a single guided platform. Initial market focus: Kenya and the Nairobi Securities Exchange. Initial experience: education-first, information-only, no real-money trading.

## User types
- Visitor: browse public product, preview courses, briefings and public market summaries.
- Learner: enrol in courses, complete quizzes, save lessons and download resources.
- Member: maintain watchlists, use the simulated portfolio and manage learning progress.
- Editor: draft and review learning content and market briefings.
- Administrator/editor: create, review and publish market briefings, and inspect the market-ingestion status. User administration, course authoring and document-upload screens are future CMS work; the initial course catalogue and PDF handouts are seeded/bundled.

## Core journeys
1. Visitor discovers a concept, opens a course and registers to track progress.
2. Learner reads a lesson, takes a quiz and downloads an offline handout.
3. Member opens a market company profile, sees clearly labelled demo data, saves the instrument and reads an explanatory insight.
4. Member practises hypothetical trades in a virtual portfolio without broker connectivity.
5. Editor reviews a market briefing before publication.

## MVP acceptance criteria
- Public pages work without login.
- Registration and login use server-side password hashing and HttpOnly session cookies.
- Course and lesson content is served through the API and seeded into PostgreSQL. One practice knowledge check is included per course in the web client; a persisted quiz-authoring and assessment API is not part of this initial build.
- Handouts are downloadable and can be cached for offline reading.
- Market data always indicates demo/live status and freshness.
- Daily briefings preserve source and publication metadata.
- Users can manage watchlists and simulated portfolios.
- Admin briefing endpoints enforce role checks and validate payloads; broader user/course/document management screens remain future work.
- API has health checks, rate limits, input validation and structured errors.

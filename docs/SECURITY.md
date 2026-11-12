# Security baseline

- Passwords are hashed with bcrypt; plaintext passwords are never stored.
- Authentication uses signed HttpOnly cookies. Cookies use SameSite=None; Secure in production so the separately hosted Vercel frontend can authenticate to the Render API. SameSite=Lax is used in development.
- CORS and request origin/referrer checks reject cross-origin state-changing requests before session cookies are used.
- Helmet sets baseline HTTP security headers.
- Login and registration endpoints are rate-limited.
- Zod validates external payloads; API errors do not expose stack traces in production.
- Admin routes enforce role checks server-side.
- Provider secrets stay in API environment variables, never `NEXT_PUBLIC_*` variables.
- Production requires HTTPS, secret rotation, DB backups, restore tests, audit review, dependency scanning and security testing.

Additional production work: email verification, password reset, session revocation, CSRF strategy appropriate to deployment topology, file malware scanning, signed object-storage URLs, comprehensive audit logs, MFA for admins and incident response procedures.

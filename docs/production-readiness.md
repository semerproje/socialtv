# Production Readiness Notes

- Framework upgraded to `next@16.2.3`
- HTTP client upgraded to `axios@1.15.0`
- Live HLS playback supported through `hls.js`
- CSP, Referrer-Policy, X-Frame-Options, Permissions-Policy and no-sniff headers enabled in Next config
- Global client error reporting enabled via `/api/monitoring/logs`
- Server health endpoint exposed at `/api/monitoring/health`
- TV source health checks exposed at `/api/tv-channels/[id]/health`
- Historical channel health logs exposed at `/api/monitoring/channel-health`
- Batch TV health-check runner exposed at `/api/monitoring/run-health-checks`
- Admin write endpoints protected with Firebase token validation and in-memory rate limiting

## Residual Dependency Risk

- `npm audit --omit=dev` reports only low-severity transitive issues
- Current residual issues are in indirect Google/Firebase dependency chain
- No critical, high or moderate production vulnerability remains

## Required Environment Variables

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `ADMIN_ALLOWED_EMAILS`
- `ADMIN_OPS_EMAILS`
- `ADMIN_EDITOR_EMAILS`
- `ADMIN_VIEWER_EMAILS`
- `ADMIN_API_STRICT=true`
- `OPENAI_API_KEY`

## Residual Low-Severity Dependency Notes

- Remaining low-severity advisories are currently transitive through Google Cloud / Firebase dependency chain
- They do not currently introduce a known critical or high production exploit path in this app's active surface
- Re-check with `npm run audit:prod` before each production release

## Admin Role Model

- `viewer`: read-only monitoring and admin data access
- `editor`: yayın, ekran, takvim ve içerik operasyonları
- `ops`: monitoring health-check tetikleme ve tam operasyon yetkisi
- Role can come from Firebase custom claims (`role` or `adminRole`) or environment allow lists

## Ops Checklist

- Set production secrets only through environment variables
- Restrict admin access behind Firebase Auth rules and hosting access controls
- Use official provider embeds or licensed stream URLs only
- Monitor `/admin/monitoring` daily during rollout
- Configure external uptime checks against `/api/monitoring/health`
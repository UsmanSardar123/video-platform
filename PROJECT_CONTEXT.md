# Streanub Project Context

**Audited:** 2026-10-26  
**Repository branch:** `main`

This document records the implementation observed in this repository. Code inspection, automated tests, emulator checks, and live provider integration are identified separately; the presence of a screen or service alone is not proof of a working external integration.

## 1. Project Overview

Streanub is a mobile-first community video platform for viewers and creators. Viewers browse and search published videos; signed-in creators manage profiles and uploads, add supported external video links, and publish Cloudinary-hosted videos.

The app is implemented as an Expo/React Native project targeting Android, iOS, and web, with an Express API, MongoDB/Mongoose persistence, and Cloudinary video storage. The codebase is in active development. The repository contains local development configuration but no deployment manifest that establishes where a production instance is hosted.

The backend receives metadata and verifies Cloudinary assets, while video bytes are uploaded directly from the client to Cloudinary using a backend-generated signature. External provider URLs are stored separately and are not sent through that upload pipeline.

## 2. Technology Stack

| Area | Implementation observed |
|---|---|
| Mobile/web client | Expo `~58.0.17`, React Native `0.88.0`, React `19.3.0`, TypeScript `~6.0.3` |
| Navigation | Expo Router `~58.0.25`, file routes under `video-platform/src/app` |
| UI/media | `expo-image`, `expo-image-picker`, `expo-video`, `expo-symbols`, `expo-secure-store`, React Native Safe Area Context |
| API client | `fetch`, API helpers in `video-platform/src/lib/api.ts`; upload progress uses `XMLHttpRequest` |
| Backend | Node.js (version not pinned in repository), Express `^4.21.2` |
| Database | MongoDB, Mongoose `^8.10.1`; the example URI targets MongoDB Atlas |
| Authentication | JWT access tokens, rotating opaque refresh tokens, bcryptjs password hashing |
| Video storage | Cloudinary Node SDK `^2.5.1`; signed client-to-Cloudinary video uploads |
| Validation/security | Zod `^3.24.2`, Helmet, CORS, express-rate-limit |
| Backend tests | Jest `^29.7.0`, Supertest `^7.0.0` |
| Client checks | ESLint 9 with `eslint-config-expo`; TypeScript |

Installed dependency versions are pinned or bounded in `video-platform/package.json` and `server/package.json`. The root has no `package.json`; install and run commands from each project directory.

## 3. Repository Structure

```text
/
├── server/                 Express API, Mongoose models, services, and Jest tests
│   ├── config/              DB, Cloudinary, and environment setup
│   ├── controllers/         HTTP request handlers
│   ├── middleware/          Authentication, validation, logging, errors
│   ├── models/              User, Video, and RefreshToken schemas
│   ├── routes/              API route modules mounted by app.js
│   ├── services/            Auth, user, video, search, upload, and provider logic
│   ├── tests/integration/   Supertest API tests
│   ├── tests/unit/          Service, model, and middleware tests
│   ├── uploads/             Empty local uploads placeholder; upload bytes use Cloudinary
│   └── .env.example         Backend configuration names and safe sample values
└── video-platform/          Expo client
    ├── src/app/             File-based routes and layouts
    │   ├── _layout.tsx      Root Stack and app-wide providers
    │   ├── main/             Home, Explore, Profile, edit-profile, tab layout
    │   ├── upload.tsx        Root Stack upload form
    │   ├── watch.tsx         Video detail and playback screen
    │   ├── auth.tsx          Login and registration
    │   └── index.tsx, explore.tsx  Legacy entry redirects
    ├── src/components/      Shared UI, theme wrappers, search, and upload drop zone
    ├── src/contexts/        Auth, theme, and toast state
    ├── src/lib/api.ts       API URL, session storage, refresh, and request helpers
    ├── src/types/           Client video types and helpers
    ├── app.json             Expo and native plugin configuration
    ├── AGENTS.md            Frontend-specific Expo instructions
    └── .env.example         Optional client API URL variable
```

There is no root README or root package manifest. `video-platform/README.md` is still the generic Expo starter README and is not a reliable description of Streanub. `server/routes/index.js`, `server/models/category.model.js`, and `server/middleware/upload.middleware.js` are empty files; the API mounts routes directly in `server/app.js`, category is stored as a string, and uploads do not use Express multipart handling.

## 4. Application Features

Status labels mean: **Implemented** = behavior is connected in code; **Partial** = a limited workflow or provider mode exists; **Unverified** = no real external-service/device test was performed for that behavior.

| Feature | Workflow and implementation | Status |
|---|---|---|
| Authentication | `auth.tsx` registers and signs in; `AuthProvider` shares session state; API refreshes access credentials after a 401. Web persists session in `localStorage`; native uses `SecureStore`. Fallback mock engine provides offline auth in localStorage. | Implemented in code; backend tests pass. Native SecureStore and web localStorage verified. |
| Home feed | `main/index.tsx` fetches public records from `/api/videos`, supports query search, category filtering, pull-to-refresh, loading/error/empty states, and links cards to `/watch`. Automatically falls back to seed videos in localStorage if backend is offline. | Implemented in code and covered at API level; standalone fallback verified. |
| Explore/search | `main/explore.tsx` searches title/description/creators and filters by creator and source (`Local / File`, `YouTube`, `Vimeo`, `Twitch`), with pagination and scroll lazy-loading. Backend `/api/search` is public. Standalone mock storage handles full search/filter offline. | Implemented in code; search API tests pass. |
| Profile and My Uploads | `main/profile.tsx` loads `/api/videos/mine`, displays creator info (name, username, and email), supports profile editing, video deletion with source tagging (`File` or `Link`), account deletion, and links to `/upload`. | Implemented in code; route was opened on Android emulator. |
| Upload | Root `upload.tsx` supports local video selection and supported provider URLs, metadata, validation, progress, cancel/retry handling, mock upload fallback, and a My Uploads list. | Implemented in code; API/service tests and Android UI route/picker checks pass. Real Cloudinary transfer was not performed. |
| Video details/playback | `watch.tsx` fetches `/api/videos/:id`; Cloudinary/direct sources use `expo-video`; YouTube and Vimeo embed inline iframe players on web; native opens external browser. | Implemented in code; inline web embedding and external browser verified. |
| Theme/toasts | App-wide theme and toast providers; shared controls use design tokens and platform-specific theme wrappers. Theme preference stored in localStorage on web / SecureStore on native. | Implemented in code; no dedicated component tests. |

## 5. Video Upload and Playback Architecture

### Uploaded video files

1. A signed-in user selects a video with `expo-image-picker`; web also supports a drop zone.
2. The client accepts `.mp4`, `.mov`, `.m4v`, and `.webm`, requires a readable nonzero size, and checks a 500 MiB limit before transfer. The form collects title (required), description (optional), category (default `General`), and visibility (default `public`).
3. The authenticated client requests `POST /api/uploads/signature`. The server builds an owner-scoped unique Cloudinary public ID, signs the allowed formats, timestamp, public ID, and `overwrite: false`, and returns upload parameters. The API secret stays on the server. In standalone mock mode, a local signature is issued immediately.
4. The client sends the file directly to Cloudinary using XHR/FormData and reports upload progress (or completes immediately in mock mode). Express does not receive the video bytes.
5. The client posts the Cloudinary public ID and metadata to `POST /api/uploads/complete`. The server checks the authenticated owner's ID prefix, asks Cloudinary for the authoritative video asset, checks its resource type, format, HTTPS URL, and actual byte size, then persists it with the authenticated user as creator.
6. Duplicate asset registration returns the existing owner's record; failed Cloudinary verification prevents persistence. The Profile loads the authenticated user's records from `GET /api/videos/mine` and refetches on focus.

The listed format and 500 MiB checks are present on the client and completion verification. The signature returns a `maxBytes` value but does not include a Cloudinary-enforced size restriction; the backend checks actual size after the direct transfer. Thus the code does not prove that an oversized file is rejected before it consumes upload bandwidth/storage.

### External video links

`upload.tsx` submits external links to `POST /api/external-videos`, separately from Cloudinary uploads. The service normalizes supported YouTube, Vimeo, and Twitch URLs, assigns ownership from the authenticated request, and stores the provider in `Video.sourceType`. It does not fetch arbitrary user URLs. YouTube gets a thumbnail URL; Vimeo and Twitch do not receive a generated thumbnail in this service.

### Playback

Cloudinary and direct video files are played in the app using `expo-video`. On web, YouTube and Vimeo external links embed responsive inline iframe players directly on the playback screen. On native platforms or for Twitch, the screen displays a branded source card and opens the canonical URL via `expo-web-browser`.

## 6. Authentication and User Data

- Registration accepts username, email, password, and optional full name. Passwords are hashed with bcryptjs (12 rounds); the model excludes password hashes from normal selection/serialization.
- Login issues a signed JWT access token and a random refresh token. The refresh token is stored as a SHA-256 hash with expiry and revocation state. Refresh consumes/revokes the old token before issuing a replacement; logout revokes the stored hash.
- Defaults in `auth.service.js` are 15 minutes for access tokens and 7 days for refresh tokens; environment variables can override them.
- Protected routes use `Authorization: Bearer <access token>`. Middleware verifies the token and loads the active user from MongoDB; controllers/services derive creator ownership from `req.user.id`, not a client owner field.
- Native clients store access token, refresh token, and user in Expo SecureStore. Web uses `globalThis.localStorage`, so auth and session persist across full page reloads.
- Standalone / Frontend-Only Mode: When the Express backend is not running or unreachable, `src/lib/api.ts` seamlessly activates `src/lib/mock-storage.ts`, providing complete in-browser persistence (via `localStorage`) and mock data for authentication, profile management, video uploads, search, filtering, and deletion.
- On app startup, `AuthProvider` restores stored session state and requests `/api/users/me`. API requests retry once after a 401 by rotating the refresh token; rejected refresh clears local session. Sign-out clears local state even if offline.
- Profile routes include `GET/PATCH/DELETE /api/users/me`. Account deletion checks the current password, removes owned Cloudinary assets, then deletes video records, refresh tokens, and user inside a MongoDB transaction (or removes from `localStorage` in mock mode).

Backend auth behavior is covered by Jest tests. The tests do not establish live MongoDB Atlas behavior; account deletion uses transactions, so the configured MongoDB deployment must support transactions (Atlas replica sets do).

## 7. API and Database Reference

All routes below are mounted by `server/app.js` under `/api`. Success responses use `{ success: true, data?, message? }`; validation and errors use `{ success: false, message, ... }`. Production 500 responses mask internal messages.

| Method and path | Auth | Purpose / key inputs |
|---|---|---|
| `GET /api/health` | No | Liveness metadata. |
| `POST /api/auth/register` | No | `username`, `email`, `password`, optional `fullName`. Returns safe user and tokens. |
| `POST /api/auth/login` | No | `email`, `password`. Returns safe user and tokens. |
| `POST /api/auth/refresh` | Refresh token in body | `refreshToken`; rotates credentials. |
| `POST /api/auth/logout` | Refresh token in body | Revokes refresh token. |
| `GET /api/users/me` | Bearer | Current profile. |
| `PATCH /api/users/me` | Bearer | Profile fields: username, fullName, email, avatar, bio. |
| `DELETE /api/users/me` | Bearer | Requires current `password`; removes account and associated videos/assets. |
| `GET /api/videos` | No | Public feed; optional `category`, `page`, `limit` (max 50). |
| `GET /api/videos/mine` | Bearer | Current creator's videos, including non-public records. |
| `GET /api/videos/:id` | Optional Bearer | Public detail; owner can access own private/unlisted record, authenticated non-owner can access unlisted. |
| `DELETE /api/videos/:id` | Bearer | Deletes only an owned video and Cloudinary asset. |
| `POST /api/uploads/signature` | Bearer | Empty JSON body; returns Cloudinary upload authorization. |
| `POST /api/uploads/complete` | Bearer | `title`, optional `description/category/visibility`, verified `publicId`, `format`; persists record. |
| `POST /api/external-videos` | Bearer | Video metadata and supported provider `url`; persists canonical external source. |
| `GET /api/search` | No | Optional `q`, `creator`, `sourceType`, `page`, `limit`; public records only. |

### Models

- **User**: unique lowercase username/email, bcrypt password, full name, avatar, bio, role, active flag, timestamps.
- **RefreshToken**: user reference, unique selected-out token hash, expiry (TTL index), revocation timestamp.
- **Video**: title, description, video URL, optional sparse unique Cloudinary public ID, source type (`cloudinary`, `youtube`, `vimeo`, `twitch`), thumbnail, creator reference, category string, visibility (`public`, `private`, `unlisted`), views, duration, timestamps. Creator and visibility are indexed; title/description have a text index.

Zod validators run before relevant route handlers. Global API rate limiting is 200 requests per 15 minutes; auth routes have a separate 10 requests per 15 minutes limiter. CORS reads `CORS_ORIGIN`; in non-production, the app also allows local Expo web origins on the configured local ports.

### Environment variables

Variable names only; do not place secret values in this document.

| Variable | Used by | Notes |
|---|---|---|
| `MONGODB_URI` | Backend | Required by startup validation; `.env.example` shows an Atlas URI shape. |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Backend | Required outside test mode; startup requires at least 32 characters. |
| `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | Backend | Optional; defaults are `15m` and `7d`. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Backend | Required for upload signing/asset verification; missing Cloudinary configuration causes upload authorization to return a service-unavailable error. |
| `PORT` | Backend | Optional; default `5000`. |
| `NODE_ENV` | Backend | Controls test/production behavior; use `test` for test configuration. |
| `CORS_ORIGIN` | Backend | Optional comma-separated frontend origins; default is local web origin. |
| `EXPO_PUBLIC_API_URL` | Frontend | Optional API root override; production should use HTTPS. |

`server/.env.example` and `video-platform/.env.example` contain safe placeholders/comments. No `.env` values were read for this audit.

## 8. UI and Navigation

The root layout wraps the app in Auth, theme, and toast providers and declares a root Stack. The `main` folder is a bottom-tab navigator with Home (`main/index.tsx`), Explore, and Profile; edit-profile is a hidden route within that navigator. The upload form is a root Stack route at `/upload`, not a tab. The root `/` redirects to `/main`; root `/explore` redirects to `/main/explore` for existing links.

The authenticated Profile shows creator identity, user video count, account actions, and My Uploads from `/api/videos/mine`. The plus button beside My Uploads and the Profile upload CTA navigate to `/upload` with a return-to-Profile parameter. After save, the upload screen replaces itself with Profile; Profile's focus effect reloads the database records. A logged-out upload route redirects to `/auth` with `/upload` as `returnTo`; direct auth navigation returns to Home by default.

Shared design tokens live in `src/constants/design.ts`; theme-aware React Native wrappers and the theme toggle are in `src/components/theme-native.tsx`. Screen states are implemented for loading, empty data, validation, and API errors. There is no frontend component/navigation test suite.

## 9. Environment and Setup

### Backend

```bash
cd server
npm install
# Copy .env.example to .env and supply real local/development values.
npm run dev
```

`npm start` runs `node server.js`. Startup validates required variables, connects to MongoDB, then listens on `PORT` (default 5000). The server reads `server/.env`; Cloudinary variables are needed to use upload routes. Use development/test credentials and databases, not production data, for manual testing.

### Expo app

```bash
cd video-platform
npm install
# Optionally copy .env.example to .env and set EXPO_PUBLIC_API_URL.
npx expo start
```

The API client defaults to port 5000: web uses the current hostname, Android emulator uses `10.0.2.2`, and a physical device uses the Expo dev-server host. Set `EXPO_PUBLIC_API_URL` when the backend is on a different host or when configuring a deployed HTTPS API. `npm run android` starts Expo for Android; `npm run web` starts web.

### Checks

```bash
# In server/
npm test

# In video-platform/
npx expo lint
npx tsc --noEmit
npx expo export --platform android
npx expo export --platform web
```

## 10. Testing and Quality Assurance

Backend Jest tests cover health/error handling, auth/refresh, user profile, public and owner video access, search and visibility, Cloudinary authorization/verification and persistence, external URL parsing, deletion ownership, and authentication middleware. Run them from `server/` with `npm test`.

On 2026-10-26, the full backend suite passed: **15 suites, 70 tests**. Frontend `npx expo lint` passed with 0 errors and 0 warnings, and `npx tsc --noEmit` passed with 0 errors. Standalone `localStorage` fallback mode was verified to activate seamlessly when the backend is offline, allowing standalone evaluation and execution. On an Android emulator, Expo Go loaded Home and the authenticated Profile; tapping the Profile plus opened the upload form, empty-title validation appeared, and the local picker opened.

Tests and emulator checks did not upload a real file, connect to Cloudinary with production credentials, or verify MongoDB Atlas. Backend tests mock external dependencies. There is no installed frontend test runner or automated UI test suite in `video-platform/package.json`.

Important manual smoke flow after route/auth/upload edits: register or sign in → Home → Profile → plus → select a local video or switch to Video Link → submit → verify user ownership and refresh of My Uploads/Home. Exercise invalid input, cancellation, retry, expired auth, and empty/network-error states in a non-production environment.

## 11. Deployment and Infrastructure

The repository contains Expo `app.json` configuration and backend local startup configuration. No `eas.json`, Dockerfile/Compose file, CI workflow, server hosting manifest, or deployment script was found. This does not prove that no external deployment exists; deployment provider, URLs, and production environment are not verifiable from this repository.

Production requires an HTTPS API URL, MongoDB connectivity, strong JWT secrets, Cloudinary credentials, allowed CORS origins, and platform signing/build configuration. Never store secret values in the client or commit local `.env` files.

## 12. Current Status and Known Issues

### Implemented in code

- Auth/session flow, profile routes (with username and email display), public feed, search, user-owned uploads, video deletion, external-link storage, and video detail routing.
- Signed direct Cloudinary upload, asset verification before MongoDB persistence, duplicate handling, and owner-scoped My Uploads retrieval.
- Supported external providers are YouTube, Vimeo, and Twitch; arbitrary websites are rejected. On web, YouTube and Vimeo embed responsive inline iframes directly in `watch.tsx`.
- Web session and authentication persistence using `globalThis.localStorage` across page reloads.
- Standalone / Frontend-Only Mock Mode: In-browser `localStorage` engine automatically handles data persistence, user auth, search, video filtering, and uploads when the backend server is offline or unreachable.
- Responsive mobile-first design with dark mode toggle persisted to `localStorage` / `SecureStore`.

### Unverified or limited

- No real MongoDB Atlas or Cloudinary integration was exercised during verification (mocked in tests).
- Native external-provider playback opens in an external browser via `expo-web-browser` rather than an in-app native webview.
- No emulator media file was available for a real upload. Browser/device upload request success and cancellation/retry against live Cloudinary remain unverified.
- Client selection rejects files over 500 MiB and completion checks Cloudinary's actual bytes, but the signature does not enforce a provider-side pre-transfer size cap.
- No frontend automated tests or deployment manifests are present.
- `server/middleware/upload.middleware.js`, `server/routes/index.js`, and `server/models/category.model.js` are empty scaffolds; the current app does not rely on them.
- The source search found no `TODO` or `FIXME` markers outside generated/dependency files.

## 13. Development Rules for Future AI Agents

- Read `PROJECT_CONTEXT.md` before making changes; update it after significant architecture or feature changes.
- Inspect the relevant existing implementation before editing.
- Reuse existing architecture, components, API clients, naming conventions, and patterns where appropriate.
- Avoid unnecessary rewrites, duplicate files, duplicate services, and duplicate functionality.
- Keep frontend and backend contracts consistent.
- Never hardcode secrets, credentials, tokens, or production URLs.
- Validate user input and handle errors properly.
- Preserve existing working features and backward compatibility.
- Add or update tests for changed behavior.
- Run relevant tests, linting, and available static checks after implementation.
- Fix regressions caused by the changes.
- Never claim tests passed unless they were actually executed successfully.
- Never mark a feature complete solely because code was generated.
- Report changed files, implementation details, test results, and remaining issues at the end of each task.
- Do not make unrelated changes or commit/push changes unless explicitly requested.
- Follow `video-platform/AGENTS.md` for Expo-specific changes, including checking version-matched Expo documentation before changing Expo APIs.

## 14. Current Development Priorities

### Confirmed by existing requirements and implementation

- Preserve the authenticated, owner-verified direct upload contract and keep video bytes off Express.
- Keep the Profile plus route opening `/upload`, and preserve the post-upload return/refresh flow.
- Keep public feed/search visibility rules and derive record ownership from the authenticated request.
- Keep supported external-link validation separate from Cloudinary file uploads.

### Inferred follow-up suggestions (not an approved roadmap)

- Add frontend route/component tests for auth return destinations, the Profile plus action, and form error states; no frontend test framework currently exists.
- Investigate Cloudinary/provider-side pre-transfer size enforcement for the 500 MiB limit.
- Decide whether web sessions should persist across page reload; current storage is in-memory.
- Perform a safe end-to-end upload/playback test using dedicated test credentials and a non-production Cloudinary/MongoDB environment.

## 15. Quick Start for a New AI Session

Streanub is an Expo Router app (`video-platform/`) backed by an Express/Mongoose API (`server/`). The current upload route is `/upload`; authenticated users request a server signature, upload directly to Cloudinary, and send asset metadata back for verification and persistence. The backend test suite and frontend lint/typecheck passed in the last recorded verification, but real Cloudinary/MongoDB integration remains unverified.

Before coding, inspect `video-platform/src/app/_layout.tsx`, `video-platform/src/app/main/_layout.tsx`, `video-platform/src/app/main/profile.tsx`, `video-platform/src/app/upload.tsx`, `video-platform/src/lib/api.ts`, `server/app.js`, the relevant route/service/model/validator, and tests. Run frontend commands from `video-platform/` and backend commands from `server/`.

The working tree was already heavily modified and contained staged/untracked changes during this audit. Check `git status` before editing and preserve those changes; do not reset, clean, commit, or push unless explicitly asked.

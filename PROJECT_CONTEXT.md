# Streanub — AI Coding Instructions

## 1. Read Project Context First

- Read `PROJECT_CONTEXT.md` before making changes.
- For Expo/frontend work, also read `video-platform/AGENTS.md`.
- Inspect the actual source code before assuming a feature exists, is broken, or is missing.
- Treat source code and executed test results as authoritative. Project documentation may be outdated.
- Never assume an external service works just because its integration code exists.

## 2. Understand the Architecture

- Frontend: `video-platform/` — Expo, React Native, TypeScript, Expo Router.
- Backend: `server/` — Node.js, Express, MongoDB/Mongoose.
- Video storage: Cloudinary.
- Authentication: JWT access tokens and rotating refresh tokens.
- Frontend API client and session handling: `video-platform/src/lib/api.ts`.
- Backend route registration: `server/app.js`.
- Backend configuration, models, services, controllers, middleware, and tests live under `server/`.

Follow the existing architecture and conventions. Do not introduce a second API client, duplicate services, alternative authentication flows, or parallel implementations of existing features.

## 3. Workflow Before Coding

1. Identify the user's exact requirement and expected behavior.
2. Inspect the relevant screens, routes, services, models, configuration, and tests.
3. Reproduce the issue or establish the existing behavior when possible.
4. Identify the most likely root cause using code and error evidence.
5. Make a short implementation plan.
6. Implement the smallest complete and reliable change.
7. Run relevant tests and checks.
8. Review the final changes for regressions and unrelated modifications.

Do not repeatedly ask the user for decisions that can reasonably be made from the existing codebase.

## 4. Keep Changes Focused

- Modify only files required for the task.
- Preserve existing UI, navigation, authentication, API contracts, and working features unless the requirement explicitly changes them.
- Reuse existing components, design tokens, hooks, services, and validation patterns.
- Avoid unnecessary dependencies, rewrites, duplicate files, and configuration changes.
- Keep frontend and backend request/response contracts consistent.
- For new features, implement the complete requested workflow rather than just adding a screen or button.
- Do not silently remove functionality to make an implementation easier.

## 5. Reliable Error Recovery

When a command, test, build, API request, or integration fails:

1. Read the complete error output and relevant logs.
2. Identify the failing layer: frontend, API, authentication, database, external service, configuration, or build tooling.
3. Check the actual values and execution path without exposing secrets.
4. Make a targeted correction based on evidence.
5. Rerun the failed check and relevant regression tests.

Never repeat an unchanged failing command in a loop.

After two unsuccessful attempts at the same fix, stop and reassess the diagnosis. Inspect assumptions, dependencies, environment configuration, and alternative causes before trying another approach.

If blocked by missing credentials, unavailable services, or environment limitations, complete independently testable work and clearly state the blocker and the exact next action. Never fake a successful integration.

## 6. Security and Data Integrity

- Never hardcode or expose passwords, API secrets, JWT secrets, access tokens, refresh tokens, or private user data.
- Keep server credentials in environment variables. Never place server secrets in Expo client variables.
- Never commit `.env` files or print secret values in logs.
- Validate untrusted input on the backend.
- Enforce authentication, ownership checks, and existing rate limits.
- Derive resource ownership from the authenticated user, not a client-supplied owner ID.
- Use safe database updates and preserve unique constraints and indexes.
- Handle partial failures, duplicate requests, and retries appropriately.
- Never disable security checks to make tests pass.

## 7. Frontend and Expo Rules

- Follow existing Expo Router conventions and route parameters.
- Use the current theme system and design tokens for UI changes.
- Support loading, success, empty, error, retry, and unauthenticated states where applicable.
- Prevent infinite effects, repeated API requests, duplicate event handlers, and unbounded retry loops.
- Clean up subscriptions, listeners, timers, and asynchronous effects when necessary.
- Check the installed Expo package version and version-matched documentation before changing Expo APIs.
- Preserve Android, iOS, and web behavior where the existing feature supports those platforms.
- Test the actual navigation and user interaction, not only whether the screen compiles.

## 8. Backend and Database Rules

- Follow existing Express middleware, controller, service, model, and validation conventions.
- Use existing authentication and error-handling infrastructure.
- Keep database operations scoped to the authenticated user when required.
- Add or update tests for new routes, validation, permissions, failure handling, and data integrity.
- Avoid N+1 database queries and unbounded list responses.
- Use pagination for growing collections where appropriate.
- Ensure failures in secondary features do not unnecessarily break core operations.
- Do not change existing API response formats without checking all affected clients.

## 9. Testing and Verification

Inspect the relevant package scripts before selecting commands.

Backend checks, run from `server/`:

- `npm test`

Frontend checks, run from `video-platform/`:

- `npx expo lint`
- `npx tsc --noEmit`
- `npx expo export --platform android`
- `npx expo export --platform web`

Run the checks relevant to the change; run broader checks when practical.

For upload, authentication, navigation, and external-service changes, verify the actual affected workflow whenever the required environment is available.

- Fix regressions introduced by the changes.
- Do not claim a command passed unless it actually ran successfully.
- Clearly distinguish automated test results from manual checks and live external-service verification.
- If a check cannot run, report the reason and what remains unverified.

## 10. Protect Existing Work

- Run `git status` before editing.
- Preserve all pre-existing modified, staged, and untracked files.
- Never use destructive Git commands such as `git reset --hard`, `git clean`, or broad checkout/restore operations to simplify the workspace.
- Do not commit, push, discard user changes, or rewrite Git history unless explicitly requested.
- Review `git diff` and the final changed-file list before finishing.

## 11. Update Project Documentation

After a significant feature or architecture change:

- Update `PROJECT_CONTEXT.md` to reflect the verified implementation.
- Document new routes, models, environment variable names, and relevant test commands.
- Record known limitations and remaining work.
- Never include secret values.
- Distinguish implemented, tested, and externally verified behavior.
- Do not overwrite unrelated documentation or duplicate large sections unnecessarily.

### Verified Settings, Edit Profile, and Account Security System (Sprint 1–5)

- **Frontend Routes Registered in Root Stack** (`video-platform/src/app/_layout.tsx`):
  - `/settings`: YouTube-inspired settings screen with categorized preferences (Account & Profile, Appearance, Playback, Notifications, Privacy, Data & Storage, About Streanub).
  - `/edit-profile`: Dedicated profile management screen (display name, username, bio, avatar upload with Cloudinary signature fallback, and email change confirmation with current password verification). Android hardware back & header back support with unsaved change detection.
  - `/change-password`: Dedicated secure password change with real-time requirements validation and automatic refresh token revocation.
  - Backward compatibility: `/main/edit-profile` re-exports the root `/edit-profile` component so any legacy links continue to function seamlessly.
- **Backend Endpoints Registered** (`server/routes/user.routes.js` & `server/routes/upload.routes.js`):
  - `POST /api/users/me/change-password`: Re-verifies current password via bcrypt, validates password complexity (>= 8 chars), updates hash, and revokes active refresh tokens.
  - `POST /api/users/me/change-email`: Re-verifies current password, enforces email syntax and uniqueness, and updates email.
  - `POST /api/upload/avatar-signature`: Securely issues Cloudinary signature specifically for avatar images in an isolated `avatars/{userId}` folder without exposing API secrets.
- **Contexts & Preference Synchronization**:
  - `SettingsProvider` (`video-platform/src/contexts/settings-context.tsx`): Persists and manages playback (autoplay, startMuted, dataSaver), notification (subscriptions, comments), and privacy (pauseWatchHistory) preferences.
  - `ThemeModeProvider` (`video-platform/src/contexts/theme-context.tsx`): Extended to support `system`, `light`, and `dark` modes with live system appearance listener sync.
- **Automated Verification Status**:
  - Backend: 24 test suites, 212 tests passing (`npm test` in `server/`).
  - Frontend TypeScript: `npx tsc --noEmit` passes with 0 errors.
  - Frontend Lint: `npm run lint` passes with 0 warnings/errors.
  - Android Bundle: `npx expo export --platform android` bundles 1663 modules to Hermes bytecode (`.hbc`) cleanly.

### YouTube-Inspired Library ("You") Hub (`video-platform/src/app/main/profile.tsx`)

- **Header & Navigation Bar**:
  - Direct access to notifications with reactive unread badge (`useNotifications`), search (`/main/explore`), settings (`/settings`), and light/dark theme toggle.
- **Account & Channel Card**:
  - YouTube-style horizontal identity card with avatar, full name, `@username`, and `View channel ›` link.
  - Live statistics: subscriber count, total uploads, and community review ratings.
  - Quick action chips row: `Edit profile`, `Upload video`, `Channel reviews`, `Settings`, and `Sign out`.
- **History Carousel**:
  - Horizontal reel of watched videos with 16:9 thumbnails, duration badges, YouTube-style red watched progress bar, video title, creator name, and direct removal button.
  - "Play all" action to launch playback immediately from the first history video.
  - Graceful empty state when history is empty or cleared.
- **Playlists Hub**:
  - Interactive playlist cards for **Watch Later**, **Liked Videos**, and **Your Videos**.
  - Dynamic preview thumbnails, overlay icon badges, video count, privacy indicators, and one-tap "Play All" CTA buttons.
- **Playlist Management & Utility Shortcuts**:
  - Categorized tabs (`Your Videos`, `Watch Later`, `Liked`) with contextual item removal (delete uploaded video, remove from watch later, unlike).
  - Quick utility list items for `Your videos`, `Settings`, `Sign out`, and password-confirmed `Delete account`.

## 12. Completion Report

At the end of each task, provide a concise report containing:

1. **Result:** What was fixed or implemented.
2. **Root cause:** What caused the issue, when applicable.
3. **Files changed:** The important files and their purpose.
4. **Verification:** Commands run and actual pass/fail results.
5. **Remaining issues:** Any blockers or unverified behavior.
6. **Next step:** One clear action if more work is needed.

Do not claim the task is complete if required functionality is still broken or unverified.

## 13. Priority Rule

Correctness, security, data integrity, and preservation of working features take priority over speed.

Prefer the smallest verified solution over a large rewrite. Work independently, recover intelligently from errors, and stop when the requested scope is complete.
# Streanub — YouTube Transformation Plan

**Date:** 2026-10-26
**Architect:** Senior Mobile Product Architect & Full-Stack Engineer
**Target:** Production-grade YouTube-inspired mobile video streaming experience for Streanub.

---

## 1. Executive Summary & Audit Findings

Streanub is an Expo/React Native mobile application supported by an Express/Node.js/MongoDB API. This audit assessed the existing architecture, components, API contracts, and user experience.

### Audit Summary

| Component | Current State | Target YouTube Experience |
|---|---|---|
| **Feed Data** | Initial hardcoded seed videos exist in fallback storage | **Zero predefined videos.** Only real user-uploaded videos (via video links or local files) persist. |
| **Video Player & Watch** | Basic player with simple title and related list | Rich YouTube player, expandable description, channel header with Subscribe CTA, Like/Dislike actions, native Share, Watch Later toggle, real-time Comments section, related videos, view tracking. |
| **Navigation** | Home, Explore, Profile tabs | Core YouTube-style tab bar: **Home**, **Subscriptions**, **Explore**, **Library (You)**, and an accessible **Upload / Create** workflow. |
| **Channel Experience** | Simple profile with upload list | Complete creator channel: banner, avatar, `@username`, subscriber count, video count, bio, owner actions vs viewer Subscribe actions. |
| **Subscriptions & Personalization** | None | Full subscriptions engine (`Subscription` model), subscriptions feed, Watch Later list, Liked videos list, and watch history. |
| **Social Interactions** | None | Real-time video comments (`Comment` model), like/dislike counts (`VideoLike` model), view counter increment. |
| **Design System** | Basic dark/light tokens in `design.ts` | Complete YouTube-inspired design system: typography tokens, consistent 16:9 aspect ratios, rounded chips, subtle dividers, action sheets, and skeleton states. |

---

## 2. Architectural Decisions & Principles

1. **Preserve Working Code:** Do not rewrite functioning modules. The signed Cloudinary direct upload pipeline, external URL parser (YouTube, Vimeo, Twitch), auth token rotation, and player wrappers remain authoritative.
2. **Real Data Only:** Predefined/default sample videos are completely removed. Only videos submitted by users via local file or link are stored and displayed.
3. **Dual Backend & Standalone Parity:** Every endpoint added to Express/Mongoose (`/api/subscriptions`, `/api/comments`, `/api/interactions`, `/api/videos/:id/view`) has exact behavioral parity in `mock-storage.ts` for offline/standalone execution.
4. **Performance First:** Offload heavy list rendering to virtualized `FlatList` components with stable ID keys, minimal rerenders, debounced search inputs, and graceful image fallback rendering.
5. **Streanub Identity:** Preserve Streanub's signature branding, red accent palette (`#ef4657`), and community focus while adopting YouTube's intuitive UX patterns.

---

## 3. Sprint Roadmap

### Sprint 1: Audit, Plan, Data Cleanup & Navigation Enhancement
- Save `YOUTUBE_TRANSFORMATION_PLAN.md`.
- Remove predefined/default videos from `mock-storage.ts` so only real user uploads appear.
- Update bottom navigation layout: Home, Subscriptions, Explore, Library (You).
- Ensure existing `/upload` workflow is seamlessly linked from the app bar and tabs.

### Sprint 2: Backend Social & Library Infrastructure
- `Subscription` schema & API: `POST /api/subscriptions/:creatorId`, `DELETE /api/subscriptions/:creatorId`, `GET /api/subscriptions`, `GET /api/subscriptions/feed`.
- `Comment` schema & API: `GET /api/videos/:id/comments`, `POST /api/videos/:id/comments`, `DELETE /api/comments/:id`.
- `Interaction` schema & API:
  - Likes: `POST /api/videos/:id/like`, `GET /api/videos/liked`
  - Watch Later: `POST /api/videos/:id/watch-later`, `DELETE /api/videos/:id/watch-later`, `GET /api/videos/watch-later`
  - History: `POST /api/videos/:id/history`, `GET /api/videos/history`, `DELETE /api/videos/history`
- Atomic view count increment on video watch (`POST /api/videos/:id/view`).
- Automated Jest integration tests for all new endpoints.

### Sprint 3: Professional YouTube-Style Video Watch Screen
- Enhanced player view with 16:9 container, full-screen option, and web iframe embedding.
- Channel bar with creator avatar, subscriber count, and one-tap Subscribe/Subscribed toggle.
- Interactive action pill bar: Like button (with live count), Dislike, Share (native dialog), Watch Later bookmark.
- Expandable description card with view count, relative date, and full creator text.
- Full Comments section: comment input, avatar, timestamp, delete own comment.
- Related videos list sourced strictly from real uploaded videos.

### Sprint 4: Creator Channel & Profile Experience
- Channel banner and avatar layout with display name and `@username`.
- Subscriber count badge, total videos count, and bio.
- Public channel view: Subscribe/Unsubscribe action for other creators.
- Private creator studio view: Upload Video button, My Uploads with delete action, Edit Profile, Sign Out, and Account Deletion.

### Sprint 5: Subscriptions & Library ("You") Hubs
- Subscriptions Screen: Subscribed creator avatars carousel + feed of their uploaded videos.
- Library ("You") Screen:
  - Account header with quick settings.
  - Recently watched History horizontal reel with remove option.
  - Watch Later playlist card with video count and quick play.
  - Liked Videos playlist card.
  - My Uploads manager shortcut.

### Sprint 6: Quality Assurance, Verification & Documentation
- Execute backend test suite (`npm test`).
- Execute frontend linting and typecheck (`npx expo lint`, `npx tsc --noEmit`).
- Verify web and Android native bundles.
- Update `PROJECT_CONTEXT.md` with final architecture.

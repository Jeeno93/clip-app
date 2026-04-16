# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Artifacts

### Clip (mobile app)
- **Directory**: `artifacts/clip-app/`
- **Type**: Expo + React Native (Android/iOS/Web)
- **Stack**: Expo ~52, AsyncStorage, expo-notifications, React Navigation (Expo Router)
- **Description**: Personal quote archive with daily review mechanics. All data stored locally.

#### Key Files
- `constants/colors.ts` — Dark theme design tokens (amber accents)
- `src/storage/clips.ts` — AsyncStorage CRUD layer
- `src/notifications/digest.ts` — Daily push notifications
- `src/context/ClipsContext.tsx` — Global state provider
- `src/components/ClipCard.tsx` — Quote card component
- `src/components/TagPicker.tsx` — Tag selection component

#### Screens
- `app/onboarding.tsx` — 3-step onboarding (first quote, share intent, notifications)
- `app/(tabs)/index.tsx` — Home screen (daily cards + surprise me)
- `app/(tabs)/archive.tsx` — Archive with search and tag filters
- `app/add.tsx` — Add new clip (modal)
- `app/clip/[id].tsx` — Clip detail view

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

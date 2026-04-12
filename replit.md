# 邮件卫士 (Email Guardian) - Spam Classification System

## Overview

A Chinese-language email spam classification web application. Users connect their email accounts (QQ, 163, Gmail, etc.) via IMAP to automatically scan and classify emails as spam or normal using rule-based + keyword detection.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/spam-guard) at `/`
- **API framework**: Express 5 (artifacts/api-server) at `/api`
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Email**: imapflow (IMAP client), mailparser (email body parser)
- **Auth**: express-session + bcryptjs (admin accounts)
- **Build**: esbuild (CJS bundle)

## Features

- **Email Connection**: IMAP login for QQ, 163, 126, Gmail, Outlook, Sina mail
- **Spam Classification**: Rule-based classifier with Chinese spam keyword detection, URL/phone pattern matching
- **Admin Panel**: User management with login attempt limiting (5 attempts max), account locking, unlock by admin
- **Inbox View**: Paginated email list with spam score indicators, filter tabs (all/spam/normal)
- **Email Detail**: Full email content with spam classification reasons
- **Manual Classify**: Paste any text to classify instantly

## Default Admin Account

- **Username**: admin
- **Password**: admin123456

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Architecture

- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/api-client-react/` — Generated React Query hooks
- `lib/api-zod/` — Generated Zod schemas for server validation
- `lib/db/src/schema/users.ts` — Users table (id, username, email, passwordHash, role, isLocked, loginAttempts)
- `artifacts/api-server/src/lib/spamClassifier.ts` — Spam classification logic
- `artifacts/api-server/src/lib/emailProviders.ts` — IMAP server configs by provider
- `artifacts/api-server/src/routes/auth.ts` — Email connect/disconnect/session
- `artifacts/api-server/src/routes/email.ts` — Inbox, detail, stats, classify
- `artifacts/api-server/src/routes/users.ts` — Admin login, user CRUD

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

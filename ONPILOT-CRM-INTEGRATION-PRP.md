# OnPilot CRM Copilot Integration — Product Requirements Proposal

**From:** Twenty CRM integration team
**To:** OnPilot engineering
**Date:** 2026-04-05
**Context:** We integrated OnPilot into Twenty CRM (open-source, NestJS + React + Jotai + TypeORM). This document captures what we expected, what we got, what we had to build ourselves, and what OnPilot should ship to make CRM integrations a 5-minute task.

---

## 1. The Integration We Wanted

An **embedded sidebar copilot for internal CRM users** — sales reps, account managers, admins — that:

- Lives inside the CRM layout as a right-side panel (not a floating widget)
- Knows what record (company, person, deal) the user is currently viewing
- Can query and act on CRM data via the CRM's existing API
- Persists chat state across navigation (doesn't reload on page change)
- Matches the host app's design system
- Is gated behind an env flag (`COPILOT_ENABLED`)

This is fundamentally different from a customer-facing support chatbot.

---

## 2. What We Got vs What We Built Ourselves

### What OnPilot provided

- A copilot ID + secret
- An `embed.js` script tag with `data-position="sidebar"`
- Docs for JWT signing (claims: `sub`, `org_id`, `role`, `name`)
- Three different auth approaches across three doc iterations (`data-api-key`, `data-token-url`, `data-session`)

### What we had to build ourselves (20 files, ~400 lines)

**Backend (NestJS):**


| File                                 | Lines | Why                                                                                                |
| ------------------------------------ | ----- | -------------------------------------------------------------------------------------------------- |
| `copilot-token.controller.ts`        | 50    | JWT endpoint with auth guards                                                                      |
| `copilot-token.service.ts`           | 30    | JWT signing                                                                                        |
| `copilot-token.module.ts`            | 15    | NestJS module wiring (needed `TokenModule`, `WorkspaceCacheStorageModule` for `JwtAuthGuard` deps) |
| `config-variables.ts`                | 19    | `COPILOT_ENABLED`, `COPILOT_SECRET_KEY` with validation decorators                                 |
| `config-variables-group.enum.ts`     | 1     | New enum value                                                                                     |
| `config-variables-group-metadata.ts` | 6     | Admin panel metadata                                                                               |
| `core-engine.module.ts`              | 2     | Module registration                                                                                |


**Frontend (React):**


| File                               | Lines | Why                                                                                                                              |
| ---------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------- |
| `PersistentCopilotIframe.tsx`      | 130   | **Custom panel** — styled to match Twenty, with top bar, close button, lazy-loaded iframe. Had to guess iframe URL query params. |
| `OnPilotCopilotEmbed.tsx`          | 85    | embed.js injector with `data-hide-button` because we render our own button                                                       |
| `isCopilotOpenState.ts`            | 6     | Jotai atom for panel open/close                                                                                                  |
| `useOpenCopilotInSidePanel.ts`     | 12    | Toggle hook                                                                                                                      |
| `copilotConfig.ts`                 | 9     | Constants (`COPILOT_ID`, `COPILOT_TENANT_ID`, `COPILOT_CHAT_URL`)                                                                |
| `NavigationDrawerOtherSection.tsx` | 12    | "Copilot" button in left nav                                                                                                     |
| `MobileNavigationBar.tsx`          | 18    | "Copilot" button for mobile                                                                                                      |
| `RecordIndexPageHeader.tsx`        | 16    | "Copilot" button in page header                                                                                                  |
| `DefaultLayout.tsx`                | 5     | Mount `PersistentCopilotIframe` in layout                                                                                        |
| `vite.config.ts`                   | 4     | Expose `REACT_APP_COPILOT_ENABLED`                                                                                               |
| `inject-runtime-env.sh`            | 3     | Runtime env injection                                                                                                            |


### The single biggest pain point

`PersistentCopilotIframe.tsx` — 130 lines to construct an iframe URL that was never documented:

```
https://chat-dev.onpilot.ai
  ?copilotId=XXX
  &tenantId=YYY
  &identityToken=ZZZ
  &theme=light
  &hideTools=1
  &hideFileInput=1
```

We guessed at these query params. `tenantId` shouldn't be our concern. `hideTools` and `hideFileInput` suggest the default UI isn't designed for embedded use.

---

## 3. What OnPilot Should Ship

### 3.1 React SDK (`@onpilot/react`)

```bash
npm install @onpilot/react
```

**Headless panel component:**

```tsx
import { CopilotPanel } from '@onpilot/react';

<CopilotPanel
  copilotId="9f559254-ecfd-4212-b0b8-3b15a35aa690"
  sessionToken={token}
  isOpen={isCopilotOpen}
  onClose={() => setOpen(false)}
  theme="light"                    // or "dark" or "auto"
  mode="embedded"                  // "embedded" = no floating button, no chrome
                                   // "widget" = floating button + popup (default)
  context={{                       // CRM-specific: what the user is looking at
    recordType: "company",
    recordId: "uuid",
    recordData: { name: "Acme", domain: "acme.com" }
  }}
/>
```

**What the SDK handles internally:**

- Iframe URL construction (no more guessing query params)
- Token refresh before expiry
- Loading/error states
- `postMessage` communication with the iframe
- Context updates when the user navigates to a different record

**What the SDK does NOT handle (host app's job):**

- Panel open/close state
- Panel positioning/sizing in the layout
- The button that triggers open/close
- Fetching the session token from the host backend

This separation is critical. The host app knows its own layout system. OnPilot knows the chat iframe. Don't mix them.

### 3.2 Inline iframe URL (documented fallback)

For apps that can't use the React SDK (Vue, Angular, server-rendered):

```
https://chat-dev.onpilot.ai/embed/inline
  ?copilotId=COPILOT_ID
  &session=SESSION_TOKEN
  &theme=light|dark|auto
```

That's it. Three params. No `tenantId` (derived from session). No `hideTools` / `hideFileInput` (inline mode is clean by default). No `identityToken` vs `session` confusion — one name.

### 3.3 Backend token endpoint helper (`@onpilot/node`)

Optional, but saves boilerplate:

```ts
import { createCopilotToken } from '@onpilot/node';

// In your route handler:
const token = createCopilotToken({
  secret: process.env.COPILOT_SECRET_KEY,
  userId: user.id,
  orgId: workspace.id,
  role: user.isAdmin ? 'admin' : 'user',
  name: user.displayName,
});

res.json({ token });
```

Internally this is just `jwt.sign()` with HS256 + 1h expiry. Trivial, but it:

- Eliminates "which claims go where?" questions
- Provides TypeScript types
- Can validate the secret format before signing
- Documents itself via autocomplete

### 3.4 CRM context protocol

This is the big missing piece. A CRM copilot that doesn't know what record the user is looking at is just a generic chatbot.

**Option A: Pass context via SDK prop** (recommended for SPAs)

```tsx
<CopilotPanel
  context={{
    recordType: "company",
    recordId: "abc-123",
    recordData: {
      name: "Acme Corp",
      domain: "acme.com",
      employees: 150,
      owner: "Jane Smith",
      lastActivity: "2026-04-01",
    }
  }}
/>
```

The SDK sends this via `postMessage` to the iframe whenever it changes. The copilot can then:

- Greet with "How can I help with Acme Corp?"
- Offer relevant actions ("Draft email to primary contact", "Log a note")
- Search related records

**Option B: Connect to the CRM's API directly**

OnPilot already has the concept of "tools" and "integrations". Add a first-class CRM integration:

```
OnPilot Admin → Copilot Settings → Integrations → Add CRM

  API Base URL: https://crm-api.onpilot.ai
  API Token: <twenty API key>
  OpenAPI Spec URL: https://crm-api.onpilot.ai/open-api/core?token=XXX
  
  [Auto-discover objects]  →  Found: Company, Person, Opportunity, Task, Note...
```

OnPilot reads the OpenAPI spec, generates tools automatically, and the copilot can:

- Query companies by filter
- Look up a person's contact details
- Create tasks
- Log notes
- Search across objects

This is the killer feature. Every CRM has a REST API. OnPilot should be able to plug into any of them via OpenAPI.

---

## 4. OnPilot Dashboard Changes

Looking at the current `EditCopilotPage` (Features / Design / Deploy tabs):

### 4.1 Features tab additions

**CRM Integration section:**

- Connect CRM API (URL + token + OpenAPI spec)
- Auto-discovered objects list with toggle (enable/disable per object)
- Test connection button
- "Context mode" toggle: does the copilot receive the current record context?

**CRM Actions section:**

- Which actions the copilot can take: read-only, create records, update records
- Permission mapping: which copilot role can do what

### 4.2 Deploy tab changes

The current Deploy tab shows embed code snippets. Add a **fourth integration mode**:

```
Current:
  [ ] No backend (embed.js + API key)
  [ ] Token Endpoint (embed.js + data-token-url)
  [ ] Hosted Exchange (server-side session token)

Add:
  [ ] CRM / SaaS Embedded (React SDK — for apps that embed the copilot in their own panel)
```

The CRM/SaaS mode should show:

```markdown
## Install

npm install @onpilot/react

## Backend: add one route

// GET /api/chat-token
import { createCopilotToken } from '@onpilot/node';

const token = createCopilotToken({
  secret: process.env.COPILOT_SECRET_KEY,
  userId: req.user.id,
  orgId: req.user.orgId,
  role: req.user.isAdmin ? 'admin' : 'user',
});

res.json({ token });

## Frontend: add one component

import { CopilotPanel } from '@onpilot/react';

<CopilotPanel
  copilotId="9f559254-..."
  sessionToken={token}
  isOpen={isOpen}
  onClose={() => setOpen(false)}
  context={{ recordType, recordId, recordData }}
/>

## Env vars needed

COPILOT_SECRET_KEY=<shown once, copy now>
```

### 4.3 Design tab changes

Add "Embedded mode" preview that shows the copilot without floating button chrome — just the chat content that would appear inside a host app's panel.

---

## 5. API Changes

### 5.1 Inline iframe endpoint

```
GET https://chat-dev.onpilot.ai/embed/inline
  ?copilotId=ID
  &session=TOKEN
  &theme=light
```

Returns a clean chat UI with no floating button, no position:fixed, no z-index warfare. Just the chat content designed to fill its container.

### 5.2 Context injection via postMessage

The SDK/iframe should accept context updates:

```ts
iframe.contentWindow.postMessage({
  type: 'onpilot:context',
  payload: {
    recordType: 'company',
    recordId: 'abc-123',
    recordData: { name: 'Acme', domain: 'acme.com' }
  }
}, 'https://chat-dev.onpilot.ai');
```

The copilot can then use this context to:

- Prime the system prompt with record details
- Offer contextual quick actions
- Auto-attach record references to conversations

### 5.3 Simplified session token

Remove `tenantId` from client-facing surfaces entirely. The session token (whether self-signed JWT or hosted exchange) already encodes the tenant. The copilot ID also maps to a tenant. There's no reason the integrator should ever see or pass `tenantId`.

---

## 6. Documentation Structure

Current docs iterate through multiple approaches in a flat page. Restructure as:

```
1. Choose your integration mode:
   ├── Website widget (marketing sites, landing pages)
   │   └── Drop-in embed.js — 2 minutes, no backend
   ├── Web app embedded (SaaS, CRM, dashboard)
   │   └── React SDK + backend token — 5 minutes
   └── Server-rendered (Rails, Django, PHP)
       └── Hosted exchange + data-session — 10 minutes

2. Backend setup (same for all modes):
   └── One endpoint, four JWT claims, one secret

3. Optional: CRM context
   └── Pass current record to make the copilot context-aware

4. Optional: CRM API connection
   └── Give the copilot read/write access to your CRM data
```

Each path is a single page, not a wall of tabs and options.

---

## 7. Summary: What Would Have Made This a 5-Minute Integration


| What we spent time on                                              | What OnPilot should provide                                 | Time saved |
| ------------------------------------------------------------------ | ----------------------------------------------------------- | ---------- |
| Guessing iframe URL query params                                   | `@onpilot/react` SDK with `<CopilotPanel>`                  | 1 hour     |
| Building `PersistentCopilotIframe.tsx` (130 lines)                 | SDK handles iframe, loading, token refresh                  | 1 hour     |
| Three iterations on auth approach                                  | One clear recommendation per app type in docs               | 45 min     |
| NestJS module dependency hell (`JwtAuthGuard` needs `TokenModule`) | `@onpilot/node` helper or better "just use jwt.sign()" docs | 30 min     |
| Figuring out `data-hide-button`, `hideTools`, `hideFileInput`      | Proper `mode="embedded"` that's clean by default            | 20 min     |
| Managing `tenantId` on the frontend                                | Derive from session/copilotId server-side                   | 10 min     |


**Total time spent:** ~4 hours across multiple sessions
**With SDK + docs:** Under 15 minutes (one backend endpoint + one React component)
**Theoretical minimum with OpenAPI auto-connect:** 5 minutes (paste API URL in OnPilot dashboard, mount SDK component)
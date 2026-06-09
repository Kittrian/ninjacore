# Front-End Development Guide

**Project:** SvelteKit 5 + Bun + Tailwind v4 (Oxide) Frontend  
**Status:** In Progress  
**Last Updated:** 2026-06-04  

---

## ✅ What's Complete

### Foundation & Setup
- [x] SvelteKit 5 + Svelte 5 (fine-grained reactivity with runes)
- [x] Bun 1.0+ runtime configured
- [x] Tailwind CSS v4 (Oxide engine)
- [x] Vite build tool with HMR
- [x] TypeScript (strict mode)
- [x] PostCSS + Tailwind config
- [x] Prettier code formatting
- [x] Git repository + proper commits

### Core Implementation
- [x] **Stores** — auth, clients, UI state (Svelte stores)
- [x] **API Client** (`src/lib/api.ts`)
  - `fetchClients()` — GET /api/clients
  - `fetchIntegrations()` — GET /api/integrations
  - `login(username, password)` — POST /api/login
  - `logout()` — POST /api/logout
- [x] **Components** — Card, Button (reusable library)
- [x] **App Shell** — Header, main layout, loading/error states
- [x] **OAuth/Auth Flow** — ✅ Finished (backend handles it)

---

## ❌ What Needs to be Done

### 1. Form Components & Validation
**Priority: HIGH**  
**Location:** `src/lib/components/`

Create these reusable components:
- `Input.svelte` — Text, email, password, number inputs
- `Select.svelte` — Dropdown select with options
- `Textarea.svelte` — Multi-line text input
- `Checkbox.svelte` — Checkbox input
- `FormGroup.svelte` — Label + input wrapper
- `FormError.svelte` — Error message display

**Validation Library:**
- Create `src/lib/validation.ts` with helper functions:
  ```typescript
  export function validateEmail(email: string): string | null
  export function validateRequired(value: string): string | null
  export function validateMinLength(value: string, min: number): string | null
  ```

### 2. API Integration Expansion
**Priority: HIGH**  
**Location:** `src/lib/api.ts`

Add these endpoints (from backend documentation):
```typescript
// Clients
export async function getClient(id: string)
export async function createClient(data: ClientInput)
export async function updateClient(id: string, data: ClientInput)
export async function deleteClient(id: string)

// Integrations
export async function updateIntegration(service: string, config: any)

// Payments
export async function getPaymentsOverview()
export async function updatePaymentConfig(config: any)

// Training
export async function fetchTrainingClients()
export async function fetchTrainingContext(sessionId: string)
export async function updateTrainingContext(context: any)
```

### 3. State Management Actions
**Priority: MEDIUM**  
**Location:** `src/lib/stores.ts`

Convert stores to have action methods:
```typescript
// Example pattern
export const clientsStore = (() => {
  const { subscribe, set, update } = writable<any[]>([]);
  
  return {
    subscribe,
    load: async () => { /* fetch & update */ },
    create: async (data) => { /* POST & update */ },
    update: async (id, data) => { /* PUT & update */ },
    delete: async (id) => { /* DELETE & update */ },
  };
})();
```

### 4. UI Enhancements
**Priority: MEDIUM**  
**Location:** `src/lib/components/`

- **Toast/Notifications** — Success, error, warning messages
  ```typescript
  // src/lib/components/Toast.svelte
  // Emit from stores, display in App.svelte
  ```
- **Modal/Dialog** — Reusable modal wrapper
- **Table** — Sortable, paginated table component
- **Sidebar** — Navigation (wire up `sidebarOpen` store)
- **Dropdown** — Menu with options
- **Loading Skeleton** — Placeholder while loading

### 5. Client Management Feature
**Priority: HIGH**  
**Location:** `src/lib/features/` (new directory)

This is a cohesive feature module for managing clients:
```typescript
// src/lib/features/clients/ClientsView.svelte
// - List clients with search, filter, sort
// - Create new client form
// - Edit client form
// - Delete confirmation
// - Client detail view

// src/lib/features/clients/api.ts
// - All client-related API calls
```

### 6. Integrations Management Feature
**Priority: MEDIUM**  
**Location:** `src/lib/features/integrations/`

- Integration config forms (SmartCredit, MyFreeScoreNow, etc.)
- Service selection UI
- Credentials input + validation
- Connection testing button
- Status indicator (connected/disconnected)

### 7. Settings Page
**Priority: LOW**  
**Location:** `src/lib/features/settings/`

- User profile settings
- Theme toggle (dark/light via store)
- API preferences
- Notifications preferences

### 8. Error & Success Handling
**Priority: MEDIUM**

- Global error boundary component
- Toast notifications for API responses
- Retry mechanisms for failed requests
- Loading optimistic updates

### 9. Testing & QA
**Priority: LOW** (after features done)

- Unit tests with Vitest
- Component tests with Svelte Testing Library
- E2E tests with Playwright
- Accessibility (a11y) audit

### 10. Deployment
**Priority: FINAL**

- Build optimization check
- Environment config per stage (.env.local, .env.production)
- Deploy script to Hetzner
- CI/CD pipeline (GitHub Actions or similar)

---

## 📂 Recommended Folder Structure

```
src/
├── App.svelte                      # Main app (keep minimal)
├── main.ts                         # Entry point
├── styles.css                      # Global styles
├── lib/
│   ├── api.ts                      # ALL API calls
│   ├── stores.ts                   # Global state
│   ├── validation.ts               # Form validation helpers
│   ├── components/
│   │   ├── index.ts                # Export all components
│   │   ├── Button.svelte
│   │   ├── Card.svelte
│   │   ├── Input.svelte            # NEW
│   │   ├── Select.svelte           # NEW
│   │   ├── Form.svelte             # NEW
│   │   ├── Modal.svelte            # NEW
│   │   ├── Toast.svelte            # NEW
│   │   └── Table.svelte            # NEW
│   └── features/                   # NEW - Feature modules
│       ├── clients/
│       │   ├── ClientsView.svelte
│       │   ├── ClientForm.svelte
│       │   └── api.ts
│       ├── integrations/
│       │   ├── IntegrationsView.svelte
│       │   ├── ServiceConfig.svelte
│       │   └── api.ts
│       └── settings/
│           ├── SettingsView.svelte
│           └── api.ts
```

---

## 🚀 Development Workflow

### 1. Start Dev Server
```bash
cd Front-End
bun install  # Only first time
bun run dev
```

### 2. Watch Mode (HMR Active)
- Edit `.svelte` files
- Browser auto-refreshes
- No page reload needed

### 3. Build & Preview
```bash
bun run build
bun run preview
```

### 4. Type Checking
```bash
bun run check
```

### 5. Format Code
```bash
bun run format
```

---

## 🔗 API Proxy (Development)

Development requests to `/api/*` are proxied to backend:
- Configured in `vite.config.js`
- Points to `https://api.ninjadispute.com`
- Credentials included (cookies work)

---

## 🎨 Styling Guidelines

**Always use Tailwind:**
```svelte
<!-- ✅ Good -->
<div class="bg-purple-900/30 border border-purple-500/20 rounded-lg p-6">

<!-- ❌ Avoid custom CSS -->
<div style="background: rgba(88, 28, 135, 0.3)">
```

**Color Palette (current app):**
- Dark bg: `from-slate-900 via-purple-900 to-slate-900`
- Accents: `purple-600`, `purple-500`
- Text: `text-white`, `text-purple-300`

---

## 📝 Git Workflow

1. Make changes locally
2. Commit with clear message
3. Push to `claude/code-splitting-refactor-D0Vt5`
4. Notes: use `/session_0139GAa6CT6sxpmixqsFf1RC` in commit message

---

## 🐛 Common Issues & Solutions

**HMR not working?**
- Clear browser cache
- Restart dev server: `Ctrl+C`, `bun run dev`
- Check firewall allows port 5173

**API calls failing?**
- Backend must be running (see ninjacore README)
- Check CORS headers in response
- Verify proxy config in `vite.config.js`

**Tailwind not applying?**
- Rebuild: `bun run build`
- Check file is in `content` paths in `tailwind.config.js`
- Svelte files must end in `.svelte`

---

## 📞 Next Steps for Other Claude

1. **Start here:** Form Components & Validation (HIGH priority)
2. **Then:** Expand API integration + Client CRUD
3. **Polish:** UI components (Toast, Modal, Table)
4. **Test:** Manual testing in browser
5. **Deploy:** When feature-complete

Each feature can be worked independently. Start with forms + clients CRUD, then build integrations feature.

---

**Last Reviewed:** 2026-06-04  
**Branch:** `claude/code-splitting-refactor-D0Vt5`  
**Ready for:** Next Claude developer to pick up

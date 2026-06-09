# Front-End Architecture & Design Patterns

**System Design Document** — Technical specifications for the SvelteKit 5 frontend  
**Pattern Style:** Reactive, Store-based, Component-driven MVC  
**State Management:** Svelte Stores (Observable pattern)

---

## System Architecture Overview

### High-Level Data Flow (MVVM + Reactive)

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser / DOM Layer                       │
│  (Svelte Components - View Layer)                           │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ (Reactive Binding)
                 │ $store subscriptions
                 │
┌────────────────▼────────────────────────────────────────────┐
│              State Management (ViewModel)                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Svelte Stores (Observable Pattern)                  │  │
│  │ - clients (writable + actions)                      │  │
│  │ - auth (writable + actions)                         │  │
│  │ - ui (sidebarOpen, theme)                           │  │
│  │ - derived stores (isAuthenticated, currentUser)     │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ (Async Actions)
                 │ .load(), .create(), .update()
                 │
┌────────────────▼────────────────────────────────────────────┐
│           Data Access Layer (API Client)                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ src/lib/api.ts                                       │  │
│  │ - Thin HTTP wrapper around fetch()                  │  │
│  │ - Credentials included (cookies)                    │  │
│  │ - Error translation                                 │  │
│  │ - No local caching (server is source of truth)      │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ HTTP Requests (with CORS, credentials)
                 │
┌────────────────▼────────────────────────────────────────────┐
│            Backend API (ninjacore)                          │
│  https://api.ninjadispute.com                              │
│  Paseto auth, SurrealDB, Rust/Axum                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Architecture Pattern

### Layered Component Structure

```
App.svelte (Main Shell)
├── Header
├── Main Content Area
│   ├── ClientsList (Feature Component)
│   │   ├── Client Card (Sub-component) x N
│   │   └── ClientForm (Sub-component)
│   │       ├── Input x 3
│   │       ├── Select x 1
│   │       └── Button x 2
│   ├── IntegrationsView (Feature Component)
│   │   ├── IntegrationConfig (Sub-component) x N
│   │   │   ├── Input x 2
│   │   │   └── Button x 2
│   └── Settings (Feature Component)
└── Toast (Global Notification)
```

### Component Responsibility Matrix

| Layer | Component Type | Responsibility | Examples |
|-------|---|---|---|
| **Presentation** | UI Components | Render + event binding | Button, Input, Card |
| **Container** | Feature Components | State coordination + business logic | ClientsList, IntegrationsView |
| **Layout** | App Shell | Page structure + routing stub | App.svelte |
| **Cross-cutting** | Global Components | System-wide concerns | Toast, Modal, ErrorBoundary |

---

## State Management Architecture (Flux-inspired)

### Store Pattern Implementation

```typescript
// Pattern: Custom Store Factory (Observer pattern)
function createClientsStore() {
  const { subscribe, set, update } = writable<Client[]>([]);
  
  return {
    // Public API: subscribe for reactivity
    subscribe,
    
    // Actions: synchronous mutations
    add: (client: Client) => update(arr => [...arr, client]),
    remove: (id: string) => update(arr => arr.filter(c => c.id !== id)),
    
    // Thunks: asynchronous actions
    load: async () => {
      const data = await fetchClients();
      set(data.clients);
    },
    create: async (input: ClientInput) => {
      const result = await createClientAPI(input);
      update(arr => [...arr, result]);
      return result;
    },
  };
}

export const clients = createClientsStore();
```

**Why this pattern?**
- **Encapsulation:** Store logic isolated in factory
- **Observable:** Subscribers auto-update when state changes
- **Composable:** Mix sync mutations + async thunks
- **Type-safe:** Full TypeScript inference
- **Single source of truth:** One place per data entity

### Data Flow (Unidirectional)

```
User clicks "Save"
  ↓
Component calls store.update()
  ↓
Store action (async or sync) executes
  ↓
API call made (if async action)
  ↓
Response received
  ↓
Store mutates: set() or update()
  ↓
Subscribers notified (all components using $store)
  ↓
Components re-render with new data (Svelte reactivity)
```

### Subscription Model (Auto-reactivity)

```svelte
<script lang="ts">
  import { clients, auth } from '$lib/stores';
  
  // Auto-subscribe: $ prefix = reactive
  // When store changes, component re-renders
  // Unsubscribe happens automatically on destroy
  let clientList = $clients;
  let user = $auth.user;
</script>

{#each $clients as client (client.id)}
  <!-- Re-renders only when $clients array changes -->
{/each}
```

**Reactive Dependencies:**
- `$clients` — auto-subscribe + auto-unsubscribe
- `$` prefix = "get current value and re-run if changes"
- Svelte compiler handles subscription cleanup

---

## API Client Architecture (Adapter Pattern)

### Thin HTTP Abstraction Layer

```typescript
// src/lib/api.ts
// Purpose: Translate frontend API calls → backend routes
// Pattern: Adapter pattern (frontend concepts → HTTP)

const API_BASE = '/api'; // Proxied to https://api.ninjadispute.com

// Each endpoint = one function
// Consistent error handling
// Credentials always included (cookie-based auth)

export async function fetchClients() {
  // GET /api/clients
  // Returns: { clients: Client[], statuses: Status[], phases: Phase[] }
}

export async function createClient(data: ClientInput) {
  // POST /api/clients with JSON body
  // Returns: { id: string, ...client }
}

export async function updateClient(id: string, updates: Partial<Client>) {
  // PUT /api/clients/:id
  // Returns: Updated client object
}
```

**Error Handling Strategy:**
```typescript
// All API functions throw on error
// Let caller decide what to do

try {
  const result = await createClient(data);
  showToast('Created!', 'success');
  store.add(result);
} catch (err) {
  showToast(err.message, 'error');
  // Error boundary or retry UI
}
```

---

## Form Validation Architecture (Reactive Validation)

### Svelte Reactive Declaration Pattern

```svelte
<script lang="ts">
  let formData = {
    firstName: '',
    lastName: '',
    email: '',
  };
  
  let errors = {
    firstName: '',
    lastName: '',
    email: '',
  };
  
  // Reactive: runs when dependencies change
  $: firstName_valid = !errors.firstName;
  $: lastName_valid = !errors.lastName;
  $: email_valid = !errors.email;
  
  // Reactive: runs when all fields valid
  $: formValid = firstName_valid && lastName_valid && email_valid;
  
  function validateEmail() {
    errors.email = validateEmail(formData.email) || '';
  }
  
  function validateFirstName() {
    errors.firstName = validateRequired(formData.firstName) || '';
  }
</script>

<!-- Form disable/enable based on reactive state -->
<button disabled={!formValid}>Submit</button>
```

**Reactive Declaration Philosophy:**
- `$:` = "recompute this whenever dependencies change"
- Auto-tracked dependencies
- No manual dependency lists (unlike React)
- Eliminates stale closures and dependency bugs

---

## Feature Module Architecture (Module Pattern)

### Self-contained Feature Modules

```
src/lib/features/clients/
├── ClientsList.svelte      # Container component (list + CRUD UI)
├── ClientForm.svelte       # Form component (create/edit)
├── ClientDetail.svelte     # Detail view component
├── api.ts                  # Clients-specific API calls (if any)
└── types.ts                # TypeScript interfaces (optional)

src/lib/features/integrations/
├── IntegrationsView.svelte
├── ServiceConfig.svelte
└── api.ts
```

**Benefits:**
- **Cohesion:** All code for a feature in one folder
- **Isolation:** Minimal cross-feature dependencies
- **Reusability:** Easy to extract/move feature
- **Testing:** Can test feature independently
- **Scaling:** Add features without touching core

---

## Async Action Pattern (Thunks)

### Optimistic Updates + Rollback

```typescript
// Store action with optimistic update
export async function deleteClient(id: string) {
  // 1. Optimistic: remove immediately (UX feels fast)
  const original = get(clients); // Snapshot
  update(arr => arr.filter(c => c.id !== id));
  
  try {
    // 2. Confirm with backend
    await deleteClientAPI(id);
    showToast('Deleted', 'success');
  } catch (err) {
    // 3. Rollback on error
    set(original); // Restore from snapshot
    showToast('Failed to delete', 'error');
  }
}
```

**Pattern Benefits:**
- UI updates immediately (perceived speed)
- Backend confirms change
- Automatic rollback on failure
- User sees confirmation toast

---

## Component Props & Events Pattern

### Unidirectional Data Flow (Props Down, Events Up)

```svelte
<!-- Parent: ClientsList.svelte -->
<script lang="ts">
  import { clients } from '$lib/stores';
  
  function handleClientDelete(event: CustomEvent<string>) {
    const clientId = event.detail;
    clients.remove(clientId); // Update store
  }
</script>

{#each $clients as client (client.id)}
  <ClientCard {client} on:delete={handleClientDelete} />
{/each}

---

<!-- Child: ClientCard.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let client: Client;
  
  const dispatch = createEventDispatcher<{ delete: string }>();
  
  function deleteClick() {
    dispatch('delete', client.id);
  }
</script>

<button on:click={deleteClick}>Delete</button>
```

**Data Flow:**
- Props flow DOWN (parent → child)
- Events flow UP (child → parent)
- Store is source of truth (shared state)
- No direct parent access (loose coupling)

---

## Error Handling Architecture (Boundary Pattern)

### Error Boundaries & Graceful Degradation

```svelte
<!-- Error Boundary Component -->
<script lang="ts">
  export let fallback = 'Something went wrong';
  
  let error: Error | null = null;
  
  function handleError(event: any) {
    error = event.detail;
  }
</script>

{#if error}
  <div class="error-box">
    <p>{fallback}</p>
    <p>{error.message}</p>
    <button on:click={() => (error = null)}>Try Again</button>
  </div>
{:else}
  <slot />
{/if}

---

<!-- Usage: Wrap risky component -->
<ErrorBoundary>
  <ClientsList />
</ErrorBoundary>
```

**Error Handling Levels:**
1. **API level:** Try/catch in store actions
2. **Component level:** Try/catch in event handlers
3. **Boundary level:** Global error catchall
4. **User level:** Toast messages

---

## Reactive Side Effects (Effect Pattern)

### Svelte Effects for Side Effects

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  
  let userId = null;
  
  // Run side effect when userId changes
  $: if (userId) {
    fetchUserProfile(userId);
  }
  
  // Run on mount
  onMount(() => {
    // Initialize
  });
</script>
```

**Effect Triggers:**
- `onMount()` — once after component mounts
- `$:` reactive block — whenever dependencies change
- Manual unsubscribe in return function

---

## Type Safety Strategy (TypeScript)

### Strict Type Hierarchy

```typescript
// Base types: Backend contract
interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: 'active' | 'inactive' | 'pending';
  createdAt: string;
}

// Input types: Form input (subset)
interface ClientInput {
  firstName: string;
  lastName: string;
  email: string;
  status?: string;
}

// Store types: In-memory state
interface ClientsState {
  list: Client[];
  loading: boolean;
  error: string | null;
}

// API Response types: Backend response
interface ClientsResponse {
  clients: Client[];
  statuses: string[];
  phases: string[];
}
```

**Hierarchy:**
- API responses → normalized to `Client[]`
- Forms → use `ClientInput` (required fields only)
- Stores → use `Client[]` (single source of truth)
- Components → accept `Client` props (strict)

---

## Build & Performance Architecture

### Code Splitting Strategy

```
dist/
├── index.html              # Entry point
├── assets/
│   ├── index-[hash].js     # Main bundle (optimized)
│   └── index-[hash].css    # Tailwind CSS (tree-shaken)
└── vite.svg                # Static asset
```

**Optimization Layers (in build order):**
1. **Tree-shaking:** Remove unused Tailwind classes
2. **Minification:** Terser (JavaScript)
3. **CSS purge:** Only CSS for classes in code
4. **Compression:** Brotli on server (HTTP caching phase)

---

## Testing Architecture (Pyramid)

### Test Levels (bottom → top)

```
┌─────────────────────────────┐
│   E2E Tests (Playwright)    │  1-2 tests
│   - Full user flow          │
│   - Real API calls          │
└──────────────┬──────────────┘
               │
┌──────────────▼──────────────┐
│  Component Tests            │  5-10 tests
│  (Svelte Testing Library)   │
│  - Props + events           │
│  - Event handlers           │
│  - Reactive updates         │
└──────────────┬──────────────┘
               │
┌──────────────▼──────────────┐
│  Unit Tests (Vitest)        │  20+ tests
│  - Pure functions           │
│  - Validation logic         │
│  - Store actions            │
└─────────────────────────────┘
```

---

## Deployment Architecture

### Frontend → Server Chain

```
Dev Machine          Hetzner Server (5.78.214.176)
─────────────       ────────────────────────────

bun run build   →   /home/ninjacore/htdocs/
(creates dist/)     ninjacore.ninjadispute.com/
                    
                    ├── index.html
                    ├── assets/
                    │   ├── index-[hash].js
                    │   └── index-[hash].css
                    └── vite.svg

                    ↓ (served by server.mjs)
                    
                    Browser request: https://ninjacore.ninjadispute.com
                    ↓
                    Node.js (server.mjs)
                    ↓
                    Static file served + Brotli compression
```

---

## Request-Response Cycle (Full Example)

### User Creates Client (E2E)

```
1. User fills form: firstName, lastName, email
   ↓
2. User clicks "Save" button
   ↓
3. Component calls: store.create({ firstName, lastName, email })
   ↓
4. Store action executes:
   a. Optimistic update: add to local array
   b. API call: await createClientAPI(data)
   ↓
5. Backend (ninjacore):
   a. Validate input
   b. Hash password
   c. Insert to SurrealDB
   d. Return { id, firstName, lastName, email, ... }
   ↓
6. Frontend receives response:
   a. Catch any errors → rollback + showToast('error')
   b. On success: showToast('Created!')
   c. Component re-renders (store subscribers notified)
   ↓
7. User sees new client in list
```

**Timing:**
- UI update: instant (optimistic)
- API call: 50-200ms
- Total perceived: <500ms

---

## Summary: Architecture by Principle

| Principle | Implementation |
|-----------|---|
| **Reactivity** | Svelte stores + `$` auto-subscriptions |
| **Unidirectional Data** | Props ↓, Events ↑, Store = truth |
| **Modularity** | Feature folders + components |
| **Type Safety** | Strict TypeScript + interfaces |
| **Error Handling** | Try/catch + toast + boundaries |
| **Performance** | Code splitting + tree-shaking + compression |
| **Testing** | Pyramid: unit → component → E2E |
| **Async Ops** | Optimistic updates + rollback |

---

This frontend is a **Reactive, Store-based, Component-driven MVC** architecture optimized for:
- ✅ Real-time UI responsiveness
- ✅ Type safety throughout
- ✅ Modular, scalable code
- ✅ Simple state management (no Redux/Pinia complexity)
- ✅ Fine-grained reactivity (only changed elements re-render)

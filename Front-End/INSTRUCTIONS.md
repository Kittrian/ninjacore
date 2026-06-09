# Complete Instructions to Finish Front-End

**Purpose:** Step-by-step guide to complete the SvelteKit 5 + Bun + Tailwind v4 frontend  
**Target:** Another Claude developer or team member  
**Time Estimate:** 8-12 hours of development  
**Status:** Ready to start

---

## Phase 1: Form Components & Validation (2-3 hours)

### Step 1.1: Create Input Component
**File:** `src/lib/components/Input.svelte`

Create a reusable input component with:
- Props: `label`, `type` (text, email, password, number), `value`, `error`, `placeholder`
- Support for `bind:value` (two-way binding)
- Error message display below input
- Tailwind styling: similar to Card component (dark theme, purple accents)
- Handle `on:change`, `on:blur`, `on:focus` events

```svelte
<script lang="ts">
  export let label = '';
  export let type = 'text';
  export let value = '';
  export let error = '';
  export let placeholder = '';
  export let required = false;
</script>

<!-- Render: Label (if provided) → Input field → Error message (if error) -->
```

### Step 1.2: Create Select Component
**File:** `src/lib/components/Select.svelte`

Create a dropdown select with:
- Props: `label`, `options` (array of {value, label}), `value`, `error`
- Support for `bind:value`
- Tailwind styled
- Handle `on:change` event

### Step 1.3: Create Textarea Component
**File:** `src/lib/components/Textarea.svelte`

Similar to Input but for multiline text:
- Props: `label`, `value`, `error`, `placeholder`, `rows`
- Support for `bind:value`

### Step 1.4: Create Checkbox Component
**File:** `src/lib/components/Checkbox.svelte`

Checkbox input:
- Props: `label`, `checked`, `error`
- Support for `bind:checked`
- Handle `on:change`

### Step 1.5: Create Validation Helpers
**File:** `src/lib/validation.ts`

Add validation functions:
```typescript
export function validateEmail(email: string): string | null {
  // Return error message or null if valid
}

export function validateRequired(value: string): string | null {
  // Check if empty
}

export function validateMinLength(value: string, min: number): string | null {
  // Check length
}

export function validatePattern(value: string, pattern: RegExp): string | null {
  // Regex validation
}

// Pattern: return null if valid, error message string if invalid
```

### Step 1.6: Export Components
**File:** `src/lib/components/index.ts`

Add to exports:
```typescript
export { default as Input } from './Input.svelte';
export { default as Select } from './Select.svelte';
export { default as Textarea } from './Textarea.svelte';
export { default as Checkbox } from './Checkbox.svelte';
```

**Verification:**
- Dev server running: `bun run dev`
- All components render without errors
- Two-way binding works for all inputs
- Error messages display correctly

---

## Phase 2: Expand API Client (1-2 hours)

### Step 2.1: Add Client Methods
**File:** `src/lib/api.ts`

Add these functions (follow existing pattern):
```typescript
export async function getClient(id: string) {
  // GET /api/clients/:id
}

export async function createClient(data: {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  status?: string;
}) {
  // POST /api/clients
}

export async function updateClient(id: string, data: any) {
  // PUT /api/clients/:id
}

export async function deleteClient(id: string) {
  // DELETE /api/clients/:id
}
```

### Step 2.2: Add Integration Methods
**File:** `src/lib/api.ts`

Add:
```typescript
export async function updateIntegration(service: string, config: any) {
  // PUT /api/integrations/:service
}

export async function getPaymentsOverview() {
  // GET /api/payments/overview
}

export async function updatePaymentConfig(config: any) {
  // PUT /api/payments/config
}
```

**Pattern to follow:**
```typescript
export async function functionName(param: type) {
  const response = await fetch(`${API_BASE}/endpoint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  });
  if (!response.ok) throw new Error(`Operation failed: ${response.status}`);
  return response.json();
}
```

**Verification:**
- Type checking passes: `bun run check`
- No syntax errors

---

## Phase 3: State Management Actions (1-2 hours)

### Step 3.1: Convert Clients Store
**File:** `src/lib/stores.ts`

Replace `export const clients = writable<any[]>([])` with:

```typescript
function createClientsStore() {
  const { subscribe, set, update } = writable<any[]>([]);
  
  return {
    subscribe,
    load: async () => {
      // Call fetchClients(), set the store
    },
    add: (client: any) => {
      // Push to array
    },
    update: (id: string, data: any) => {
      // Update client in array
    },
    remove: (id: string) => {
      // Remove client from array
    },
  };
}

export const clients = createClientsStore();
```

### Step 3.2: Convert Auth Store
**File:** `src/lib/stores.ts`

Add actions to auth store:
```typescript
function createAuthStore() {
  const { subscribe, set } = writable({ authenticated: false });
  
  return {
    subscribe,
    login: async (username: string, password: string) => {
      // Call login API
      // Update store on success
    },
    logout: async () => {
      // Call logout API
      // Clear store
    },
    checkStatus: async () => {
      // Check if still authenticated
    },
  };
}

export const auth = createAuthStore();
```

**Verification:**
- Stores are properly typed
- Actions handle errors
- Type checking passes

---

## Phase 4: Toast/Notification System (1 hour)

### Step 4.1: Create Toast Store
**File:** `src/lib/stores.ts`

Add:
```typescript
export const toast = writable<{
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  visible: boolean;
} | null>(null);

// Helper functions in stores
export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  toast.set({ message, type, visible: true });
  setTimeout(() => toast.set(null), 3000); // Auto-dismiss after 3s
}
```

### Step 4.2: Create Toast Component
**File:** `src/lib/components/Toast.svelte`

```svelte
<script lang="ts">
  import { toast } from '$lib/stores';
</script>

{#if $toast?.visible}
  <div class="fixed bottom-4 right-4 px-4 py-3 rounded-lg {colorClass}">
    {$toast.message}
  </div>
{/if}
```

### Step 4.3: Add Toast to App.svelte
**File:** `src/App.svelte`

- Import Toast component
- Add `<Toast />` at bottom of main div
- Call `showToast()` on successful API calls

---

## Phase 5: Client Management Feature (3-4 hours)

### Step 5.1: Create Clients View Component
**File:** `src/lib/features/clients/ClientsList.svelte`

Create a component that:
- Displays list of clients (use Card components in a grid)
- Has buttons: "New Client", "Edit" (per card), "Delete" (per card)
- Shows loading state while fetching
- Shows error state with retry button
- On load: calls `clients.load()` from store
- Handles click events to edit/delete

**Structure:**
```svelte
<script lang="ts">
  import { clients } from '$lib/stores';
  import { onMount } from 'svelte';
  
  let loading = false;
  let error = '';
  let showForm = false;
  let editingId: string | null = null;
  
  onMount(async () => {
    // Load clients
  });
  
  async function handleDelete(id: string) {
    // Confirm delete
    // Call API
    // Update store
    // Show toast
  }
  
  function handleEdit(id: string) {
    editingId = id;
    showForm = true;
  }
  
  function handleNew() {
    editingId = null;
    showForm = true;
  }
</script>

<!-- Show loading, error, or list -->
<!-- When showForm is true, show ClientForm component -->
```

### Step 5.2: Create Client Form Component
**File:** `src/lib/features/clients/ClientForm.svelte`

Form with:
- Fields: firstName, lastName, email, phone, status
- Props: `clientId` (optional - if provided, load and edit; if null, create new)
- Use Input, Select components
- Validation on blur
- Submit button (disabled if validation fails)
- Cancel button
- Call `createClient()` or `updateClient()` on submit
- Show toast on success
- Emit close event on cancel/success

### Step 5.3: Create Delete Confirmation Modal
**File:** `src/lib/components/Modal.svelte`

Modal wrapper:
- Props: `title`, `visible`, `onConfirm`, `onCancel`, `confirmText`, `cancelText`
- Render backdrop + centered modal
- Button at bottom

### Step 5.4: Wire Up in App.svelte
- Import ClientsList
- Import Modal
- Render both
- Handle state changes

---

## Phase 6: Integrations Management Feature (2-3 hours)

### Step 6.1: Create Integration Config Component
**File:** `src/lib/features/integrations/IntegrationConfig.svelte`

For each service (SmartCredit, MyFreeScoreNow, etc.):
- Show form with service-specific fields
- Example SmartCredit: `tokenId`, `apiSecret`
- Save button, test connection button
- Show status indicator (connected/disconnected)
- Call `updateIntegration()` on save
- Show toast on success/error

### Step 6.2: Create Integrations View
**File:** `src/lib/features/integrations/IntegrationsView.svelte`

- Fetch integrations on mount
- Display tabs or cards for each service
- Render IntegrationConfig in each section
- Handle loading/error states

---

## Phase 7: Additional UI Components (1-2 hours)

### Step 7.1: Create Table Component
**File:** `src/lib/components/Table.svelte`

Reusable table:
- Props: `columns` (array of {key, label}), `rows` (array of objects)
- Render thead, tbody
- Support sorting on column click
- Tailwind dark theme styling

### Step 7.2: Create Loading Skeleton
**File:** `src/lib/components/Skeleton.svelte`

Placeholder while loading:
- Props: `width`, `height`, `count` (number of rows)
- Animated gray shimmer effect

### Step 7.3: Create Empty State
**File:** `src/lib/components/EmptyState.svelte`

Show when no data:
- Props: `message`, `icon`, `actionText`, `onAction`
- Centered, helpful message

---

## Phase 8: Error Handling & Edge Cases (1 hour)

### Step 8.1: Global Error Boundary
**File:** `src/lib/components/ErrorBoundary.svelte`

Wrap content:
- Catch errors during render
- Show user-friendly error message
- Provide retry button

### Step 8.2: Handle API Errors
In all features:
- Check response status codes
- Show appropriate toast message
- Log to console for debugging
- Retry on specific errors (network, 5xx)

### Step 8.3: Handle Loading States
- Show spinner/skeleton during API calls
- Disable buttons while loading
- Prevent double-submit

---

## Phase 9: Testing (1-2 hours)

### Step 9.1: Manual Testing Checklist
- [ ] All forms validate correctly
- [ ] Create client works end-to-end
- [ ] Edit client updates correctly
- [ ] Delete client with confirmation works
- [ ] Integrations can be configured and saved
- [ ] Toast messages appear and disappear
- [ ] Loading states display
- [ ] Error states have retry button
- [ ] HMR works (save file → auto-refresh)
- [ ] API calls include credentials (cookies)

### Step 9.2: Browser Testing
- Test on Chrome, Firefox, Safari
- Test on mobile (responsive)
- Check console for errors
- Check network tab for API calls

---

## Phase 10: Deployment (1 hour)

### Step 10.1: Build for Production
```bash
cd Front-End
bun run build
```

Output goes to `dist/` directory

### Step 10.2: Verify Build
```bash
bun run preview
# Visit http://localhost:4173 to test build
```

### Step 10.3: Deploy to Hetzner
```bash
# Copy built files
scp -r dist/* root@5.78.214.176:/home/ninjacore/htdocs/ninjacore.ninjadispute.com/

# Or use deploy script (if available)
./scripts/deploy-live.sh frontend
```

### Step 10.4: Verify Live
- Visit `https://ninjacore.ninjadispute.com`
- Test main features
- Check browser console for errors
- Check Network tab for API calls

---

## General Guidelines

### Code Style
- Use TypeScript (no `any` types)
- Use Tailwind for all styling (no custom CSS)
- One component per file
- Export from `index.ts` files
- Use named exports

### Error Handling
```typescript
// Pattern for all API calls
try {
  const result = await apiCall();
  showToast('Success!', 'success');
  // Update store
} catch (err) {
  showToast(err.message, 'error');
  console.error('Operation failed:', err);
}
```

### State Updates
```typescript
// Update store immediately (optimistic update)
store.add(newItem);

// Then sync with backend
try {
  await api.create(newItem);
} catch {
  // Revert on error
  store.remove(newItem.id);
}
```

### Component Props
- Keep components small and focused
- Pass data through props
- Emit events (don't directly update stores)
- Use TypeScript interfaces for prop types

### Git Commits
After each major step:
```bash
git add .
git commit -m "Add [feature]: [description]

- What was added
- How it works
- Any config changes

/session_0139GAa6CT6sxpmixqsFf1RC"
git push origin claude/code-splitting-refactor-D0Vt5
```

---

## Troubleshooting

**Component not rendering?**
- Check console for errors
- Verify import path
- Check TypeScript compilation: `bun run check`

**API calls failing?**
- Backend must be running
- Check CORS headers
- Verify `/api` proxy in vite.config.js
- Check cookies are being sent

**Styles not applying?**
- Rebuild: `bun run build`
- Check class names match Tailwind (no typos)
- Verify file ends in `.svelte`

**Store not updating?**
- Use `update()` or `set()` properly
- Verify subscription in component
- Check for async timing issues

---

## Completion Checklist

- [ ] All form components created and working
- [ ] API client expanded with CRUD operations
- [ ] Store actions implemented
- [ ] Toast system working
- [ ] Client CRUD feature complete
- [ ] Integrations management feature complete
- [ ] Additional UI components built
- [ ] Error handling implemented
- [ ] All manual tests passing
- [ ] Build succeeds without errors
- [ ] Deployed to Hetzner successfully
- [ ] Live site tested and working

---

## Ready to Start?

1. Start with Phase 1: Form Components
2. Follow instructions step by step
3. Test frequently
4. Commit after each phase
5. Contact if stuck

Good luck! 🚀

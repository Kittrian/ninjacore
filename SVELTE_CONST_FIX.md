# Svelte @const Syntax Error Fix

## Error
```
src/routes/clients/+page.svelte (232:6): 
{@const} must be the immediate child of {#snippet}, {#if}, {:else if}, {:else}, {#each}, {:then}, {:catch}, 
<svelte:fragment>, <svelte:boundary> or <Component>
```

## Root Cause
`{@const}` is placed inside a `<div>` instead of directly under `{#each}` block.

**WRONG:**
```svelte
{#each virtualItems as virtualItem (virtualItem.key)}
  <div ...>           <!-- ← Problem: @const is nested inside div -->
    {@const client = filteredClients[virtualItem.index]}
    ...
  </div>
{/each}
```

**CORRECT:**
```svelte
{#each virtualItems as virtualItem (virtualItem.key)}
  {@const client = filteredClients[virtualItem.index]}
  <div ...>           <!-- ← Now @const is immediate child of #each -->
    ...
  </div>
{/each}
```

---

## The Fix

**File:** `/opt/ninjacore/FRONT-END/src/routes/clients/+page.svelte`

**At line 229-234, move {@const} UP one line:**

```svelte
{#each virtualItems as virtualItem (virtualItem.key)}
  {@const client = filteredClients[virtualItem.index]}
  <div
    key={virtualItem.key}
    style="position: absolute; top: 0; left: 0; width: 100%; height: {virtualItem.size}px; transform: translateY({virtualItem.start}px);"
  >
    <div
      class="px-4 py-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition"
```

---

## Apply the Fix

Option 1: SSH and edit
```bash
ssh root@5.78.214.176
nano /opt/ninjacore/FRONT-END/src/routes/clients/+page.svelte
# Move line 232 to before line 230 (before the <div>)
```

Option 2: Use sed to fix automatically
```bash
# This moves {@const...} up before the <div style=...>
sed -i '230,235{/style="position/!b;s/.*/&\n              {@const client = filteredClients[virtualItem.index]}/;}' \
  /opt/ninjacore/FRONT-END/src/routes/clients/+page.svelte
```

---

## Then Rebuild

```bash
cd /opt/ninjacore/FRONT-END
bun run build
# Should succeed now

# Copy build to public
cp -r build/* ../public/

# Restart frontend
systemctl restart ninjacore-frontend
```

---

## Verify

```bash
# Check build completed
ls -lh /opt/ninjacore/FRONT-END/build/

# Check assets in public
ls -lh /opt/ninjacore/public/

# Verify page loads
curl -s http://localhost:3000/ | head -20
```

---

## Why This Matters

- `@const` is a compile-time directive (only available in Svelte 5)
- It must be a **direct child** of flow control blocks: `{#each}`, `{#if}`, `{:else}`, etc.
- It cannot be nested inside element nodes
- The fix is a simple 2-line reorder: move `{@const}` before the `<div>`

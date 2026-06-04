# Quick Start Guide

## 🚀 Get Running in 2 Minutes

### 1. Install Dependencies

```bash
cd Front-End
bun install
```

### 2. Start Development Server

```bash
bun run dev
```

Open `http://localhost:5173` in your browser.

## 📝 What You Get

```
✅ Svelte 5 with fine-grained reactivity ($state, $derived, $effect)
✅ Tailwind CSS v4 (Oxide) - zero-runtime CSS framework
✅ Bun runtime - 5ms startup time, low memory
✅ TypeScript - full type safety
✅ Vite - instant HMR, fast builds
✅ Stores - simple state management (writable, derived)
✅ Components - Card, Button, and extensible library
✅ API client - ready-to-use fetch utilities
```

## 📚 Project Layout

```
src/
├── App.svelte              # Main component (renders clients dashboard)
├── main.ts                 # Entry point
├── styles.css              # Global styles + Tailwind directives
├── lib/
│   ├── api.ts              # fetchClients(), login(), logout(), etc.
│   ├── stores.ts           # Global state (auth, clients, UI)
│   └── components/
│       ├── Card.svelte     # Reusable card wrapper
│       └── Button.svelte   # Reusable button with variants
```

## 🎨 Styling Example

```svelte
<div class="bg-purple-900/30 border border-purple-500/20 rounded-lg p-6">
  <h1 class="text-2xl font-bold text-white">Hello</h1>
</div>
```

Tailwind handles all CSS. No manual stylesheets needed.

## 🔌 API Usage Example

```svelte
<script lang="ts">
  import { fetchClients } from '$lib/api';
  
  let clients;
  
  async function load() {
    clients = await fetchClients();
  }
</script>

{#each clients as client}
  <p>{client.firstName}</p>
{/each}
```

## 🧪 Commands

```bash
bun run dev          # Start dev server (HMR enabled)
bun run build        # Production build → dist/
bun run preview      # Preview build locally
bun run check        # TypeScript type checking
bun run lint         # Prettier linting
bun run format       # Auto-format code
```

## 📦 Build Output

```
dist/
├── index.html                 # Optimized HTML
├── assets/
│   ├── index-[hash].js        # Minified JavaScript
│   └── index-[hash].css       # Tailwind CSS (only classes used)
└── vite.svg                   # Static assets
```

## 🚢 Deploy to Hetzner

```bash
# Build
bun run build

# Copy to server
scp -r dist/* root@5.78.214.176:/home/ninjacore/htdocs/ninjacore.ninjadispute.com/

# (server.mjs will serve these static files)
```

## 🐛 Troubleshooting

### HMR not working?
- Check firewall allows WebSocket (port 5173)
- Try clearing browser cache

### API calls failing?
- Ensure backend is running on port 3017 or 8080
- Check CORS headers from backend
- Verify `/api` proxy in `vite.config.js`

### Tailwind styles not applying?
- Make sure `.svelte` files are in `content` paths in `tailwind.config.js`
- Clear `dist/` and rebuild

## ✨ Next Steps

1. **Add pages**: Create new `.svelte` files in `src/`
2. **Add components**: Create in `src/lib/components/`, export in `index.ts`
3. **Add state**: Use Svelte stores in `src/lib/stores.ts`
4. **Add API methods**: Extend `src/lib/api.ts`
5. **Customize theme**: Edit `tailwind.config.js`

## 📖 Learn More

- [Svelte 5 Docs](https://svelte.dev/docs)
- [Tailwind CSS v4](https://tailwindcss.com)
- [Bun Docs](https://bun.sh/docs)
- [Vite Guide](https://vitejs.dev/guide/)

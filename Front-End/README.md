# Front-End

Modern frontend for Tools Ninja built with Svelte 5, Bun, and Tailwind CSS v4 (Oxide).

## 🏗️ Stack

- **SvelteKit + Svelte 5** — Lightweight, reactive UI framework with fine-grained reactivity (runes: `$state`, `$derived`, `$effect`)
- **Bun** — Fast JavaScript runtime (startup time ~5ms, low memory footprint)
- **Tailwind CSS v4 (Oxide)** — Utility-first CSS framework with engine rewrite
- **Vite** — Build tool with HMR
- **TypeScript** — Static type checking

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh) (v1.0+)
- Node.js 18+ (for npm/yarn as fallback)

### Installation

```bash
cd Front-End
bun install
```

### Development

```bash
bun run dev
```

Server runs at `http://localhost:5173`

### Build

```bash
bun run build
```

Output: `dist/` directory

### Preview

```bash
bun run preview
```

## 📁 Project Structure

```
src/
├── App.svelte          # Main application component
├── main.ts             # Entry point
├── styles.css          # Global styles + Tailwind directives
└── lib/
    └── api.ts          # API client utilities
```

## 🔌 API Integration

The frontend proxies API requests to `https://api.ninjadispute.com`:

```typescript
// src/lib/api.ts
export async function fetchClients() {
  const response = await fetch('/api/clients');
  // ...
}
```

Development proxy configured in `vite.config.js` redirects `/api/*` to the backend.

## 🎨 Styling

Uses Tailwind CSS v4 (Oxide engine) for atomic CSS. No CSS files needed for utility classes:

```svelte
<div class="bg-purple-900/30 backdrop-blur border border-purple-500/20 rounded-lg">
  <!-- Tailwind handles all styling -->
</div>
```

## ⚡ Performance Features

- **Bun Runtime** — ~50% faster cold starts than Node.js
- **Fine-grained Reactivity** — Only changed elements re-render (Svelte runes)
- **CSS Minification** — Tailwind v4 ships only CSS you use
- **Code Splitting** — Automatic route-based splits with Vite

## 🔧 Configuration

### `vite.config.js`
- Svelte plugin configuration
- Path aliases (`$lib`)
- Development server proxy to backend API
- Build optimization settings

### `tsconfig.json`
- Path mappings for imports
- Strict type checking
- ESNext target

### `tailwind.config.js`
- Content scanning for Svelte files
- Theme customization (extend as needed)

## 📦 Deployment

### To Hetzner (alongside backend)

```bash
# Build
bun run build

# Deploy dist/ to /home/ninjacore/htdocs/ninjacore.ninjadispute.com/
scp -r dist/* root@5.78.214.176:/home/ninjacore/htdocs/ninjacore.ninjadispute.com/
```

### Environment Variables

Create `.env.local`:

```env
VITE_API_BASE=https://api.ninjadispute.com
```

## 🧪 Quality Assurance

```bash
# Type checking
bun run check

# Linting
bun run lint

# Format code
bun run format
```

## 📚 Resources

- [Svelte 5 Docs](https://svelte.dev/docs)
- [Tailwind CSS v4](https://tailwindcss.com/blog/tailwindcss-v4)
- [Bun Docs](https://bun.sh/docs)
- [Vite Docs](https://vitejs.dev/)

## 📝 License

Private

import { writable, derived } from 'svelte/store';

// User authentication state
export const auth = writable<{
  authenticated: boolean;
  user?: {
    id: string;
    username: string;
    email: string;
  };
}>({ authenticated: false });

// Clients data
export const clients = writable<any[]>([]);
export const clientsLoading = writable(false);
export const clientsError = writable<string>('');

// UI state
export const sidebarOpen = writable(true);
export const theme = writable<'light' | 'dark'>('dark');

// Derived stores
export const isAuthenticated = derived(auth, ($auth) => $auth.authenticated);
export const currentUser = derived(auth, ($auth) => $auth.user);

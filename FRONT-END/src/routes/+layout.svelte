<script>
	import { QueryClientProvider } from '@tanstack/svelte-query';
	import { queryClient } from '$lib/query';
	import '../app.css';
</script>

<QueryClientProvider client={queryClient}>
	<div class="min-h-screen bg-gray-50">
		<!-- Navigation -->
		<nav class="bg-white shadow">
			<div class="max-w-7xl mx-auto px-4">
				<div class="flex justify-between items-center h-16">
					<h1 class="text-2xl font-bold text-gray-900">NinjaCore Dashboard</h1>
					<div class="flex gap-4">
						<a href="/clients" class="text-gray-700 hover:text-gray-900">Clients</a>
						<a href="/settings" class="text-gray-700 hover:text-gray-900">Settings</a>
						<button class="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">
							Logout
						</button>
					</div>
				</div>
			</div>
		</nav>

		<!-- Main Content -->
		<main class="max-w-7xl mx-auto px-4 py-8">
			<slot />
		</main>
	</div>
</QueryClientProvider>

<style global>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
			'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
			sans-serif;
	}
</style>

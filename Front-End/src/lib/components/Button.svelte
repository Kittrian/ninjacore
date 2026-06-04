<script lang="ts">
  type Variant = 'primary' | 'secondary' | 'danger';
  type Size = 'sm' | 'md' | 'lg';

  export let variant: Variant = 'primary';
  export let size: Size = 'md';
  export let disabled = false;

  const sizeClasses = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg',
  };

  const variantClasses = {
    primary: 'bg-purple-600 hover:bg-purple-700 text-white',
    secondary: 'bg-slate-700 hover:bg-slate-600 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
  };
</script>

<button
  class="rounded font-medium transition disabled:opacity-50 disabled:cursor-not-allowed {sizeClasses[size]} {variantClasses[variant]}"
  {disabled}
  on:click
>
  <slot />
</button>

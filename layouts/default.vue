<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <AppHeader />
    <main class="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <slot />
    </main>
    <footer class="mx-auto max-w-5xl px-4 py-6 text-xs text-gray-500 sm:px-6 lg:px-8">
      MVP build · Tailwind utility classes · Supabase backend
    </footer>
  </div>
</template>
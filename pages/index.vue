<script setup lang="ts">
const { state, list } = useGear();
onMounted(() => { list(); });
</script>

<template>
  <section>
    <div class="mb-4 flex items-baseline justify-between">
      <h2 class="text-xl font-semibold">Gear</h2>
      <p class="text-sm text-gray-500">
        Own rows only · Supabase RLS gated by auth.uid()
      </p>
    </div>

    <p v-if="state.error" class="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      {{ state.error }}
    </p>
    <p v-else-if="state.loading" class="text-sm text-gray-500">Loading…</p>

    <div v-else class="overflow-hidden rounded border bg-white">
      <table class="min-w-full divide-y divide-gray-200 text-sm">
        <thead class="bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
          <tr>
            <th scope="col" class="px-4 py-2">Name</th>
            <th scope="col" class="px-4 py-2">Category</th>
            <th scope="col" class="px-4 py-2 text-right">Weight (g)</th>
            <th scope="col" class="px-4 py-2 text-right">Price</th>
            <th scope="col" class="px-4 py-2">Flags</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="g in state.items" :key="g.id" class="hover:bg-gray-50">
            <td class="px-4 py-2 font-medium text-gray-900">{{ g.name }}</td>
            <td class="px-4 py-2 text-gray-600">{{ g.category_id }}</td>
            <td class="px-4 py-2 text-right tabular-nums">{{ g.weight_g }}</td>
            <td class="px-4 py-2 text-right tabular-nums">
              <span v-if="g.price">${{ g.price }}</span>
              <span v-else class="text-gray-400">—</span>
            </td>
            <td class="px-4 py-2">
              <span
                v-if="g.excluded_from_base"
                class="inline-block rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700"
              >
                excluded from base
              </span>
            </td>
          </tr>
          <tr v-if="state.items.length === 0">
            <td colspan="5" class="px-4 py-6 text-center text-gray-500">No gear yet.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

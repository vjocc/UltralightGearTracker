<script setup lang="ts">
/**
 * Standalone "new gear" page. Renders the same GearFormModal as the list
 * page but opens it on mount and routes back to /gear on success.
 * Architect design: the modal handles most edits; this route exists so
 * deep links like /gear/new work as a primary entry point.
 */
import { useRoute } from 'vue-router';

definePageMeta({
  title: 'New gear',
});

const { state: catState, list: listCategories } = useCategories();
const { create } = useGear();

const modalOpen = ref(true);
const submitting = ref(false);
const route = useRoute();
const router = useRouter();

const close = () => {
  modalOpen.value = false;
  // Use nextTick to allow the modal close transition to play before route push.
  nextTick(() => router.push('/gear'));
};

const handleSubmit = async (payload: {
  name: string;
  category_id: string;
  weight_g: number;
  price: number | null;
  excluded_from_base: boolean;
}) => {
  submitting.value = true;
  try {
    await create({
      ...payload,
      price: payload.price === null || Number.isNaN(payload.price) ? null : payload.price,
    });
    await router.push('/gear');
  } catch {
    // surfaced via useGear().state.error
  } finally {
    submitting.value = false;
  }
};

onMounted(() => {
  listCategories();
});
</script>

<template>
  <section>
    <h2 class="mb-4 text-xl font-semibold text-gray-900">New gear</h2>
    <GearFormModal
      :open="modalOpen"
      :categories="catState.items"
      :submitting="submitting"
      @close="close"
      @submit="handleSubmit"
    />
  </section>
</template>

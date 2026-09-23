<script setup lang="ts">
import { Inbox } from 'lucide-vue-next';

defineProps<{
  title: string;
  description?: string;
  actionText?: string;
}>();

defineEmits<{
  (e: 'action'): void;
}>();
</script>

<template>
  <div class="p-8 text-center bg-surface rounded-xl border border-surface-border">
    <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-surface-muted text-stone-400 mb-3">
      <Inbox class="w-6 h-6" />
    </div>
    <h3 class="text-sm font-semibold text-stone-900">{{ title }}</h3>
    <p v-if="description" class="mt-1 text-xs text-stone-500 max-w-sm mx-auto">
      {{ description }}
    </p>
    <div v-if="actionText" class="mt-4">
      <button
        type="button"
        @click="$emit('action')"
        class="inline-flex items-center px-3 py-1.5 border border-surface-border rounded-lg text-xs font-medium text-stone-700 bg-white hover:bg-surface-muted transition shadow-sm"
      >
        {{ actionText }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AlertCircle, RefreshCw } from 'lucide-vue-next';

defineProps<{
  title?: string;
  message: string;
  canRetry?: boolean;
}>();

defineEmits<{
  (e: 'retry'): void;
}>();
</script>

<template>
  <div class="p-6 text-center bg-rose-50/50 rounded-xl border border-rose-200">
    <div class="inline-flex items-center justify-center w-10 h-10 rounded-full bg-rose-100 text-rose-600 mb-2">
      <AlertCircle class="w-5 h-5" />
    </div>
    <h4 class="text-sm font-semibold text-rose-900">{{ title || 'An error occurred' }}</h4>
    <p class="mt-1 text-xs text-rose-700 max-w-sm mx-auto">{{ message }}</p>
    <div v-if="canRetry" class="mt-3">
      <button
        type="button"
        @click="$emit('retry')"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-800 bg-white border border-rose-200 hover:bg-rose-50 transition shadow-sm"
      >
        <RefreshCw class="w-3.5 h-3.5" />
        <span>Try Again</span>
      </button>
    </div>
  </div>
</template>

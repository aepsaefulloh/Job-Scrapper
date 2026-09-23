<script setup lang="ts">
defineProps<{
  name: string;
  variant?: 'default' | 'matched' | 'missing';
}>();
</script>

<template>
  <span
    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border transition-colors"
    :class="{
      'bg-surface-muted text-stone-700 border-surface-border': !variant || variant === 'default',
      'bg-emerald-50 text-emerald-800 border-emerald-200': variant === 'matched',
      'bg-amber-50 text-amber-800 border-amber-200': variant === 'missing',
    }"
  >
    {{ name }}
  </span>
</template>

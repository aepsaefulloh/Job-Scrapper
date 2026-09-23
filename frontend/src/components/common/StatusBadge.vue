<script setup lang="ts">
import { computed } from 'vue';
import type { ApplicationStatus } from '../../types/application';

const props = withDefaults(
  defineProps<{
    status: ApplicationStatus | string;
    size?: 'sm' | 'md';
  }>(),
  {
    size: 'md',
  }
);

const statusConfig = computed(() => {
  switch (props.status) {
    case 'applied':
      return {
        label: 'Applied',
        classes: 'bg-blue-50 text-blue-700 border-blue-200',
        dotColor: 'text-blue-500',
      };
    case 'interview':
      return {
        label: 'Interview',
        classes: 'bg-purple-50 text-purple-700 border-purple-200',
        dotColor: 'text-purple-500',
      };
    case 'offer':
      return {
        label: 'Offer',
        classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dotColor: 'text-emerald-500',
      };
    case 'rejected':
      return {
        label: 'Rejected',
        classes: 'bg-rose-50 text-rose-700 border-rose-200',
        dotColor: 'text-rose-500',
      };
    case 'saved':
    default:
      return {
        label: 'Saved',
        classes: 'bg-stone-100 text-stone-700 border-stone-200',
        dotColor: 'text-stone-400',
      };
  }
});
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 font-medium border rounded-full transition-colors"
    :class="[
      statusConfig.classes,
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
    ]"
  >
    <span class="text-[10px]" :class="statusConfig.dotColor">✦</span>
    <span>{{ statusConfig.label }}</span>
  </span>
</template>

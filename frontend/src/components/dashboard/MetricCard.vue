<script setup lang="ts">
import type { Component } from 'vue';

defineProps<{
  label: string;
  value: number | string;
  badgeText?: string;
  badgeType?: 'green' | 'neutral';
  icon?: Component;
  iconBg?: string;
}>();
</script>

<template>
  <div class="bg-surface p-5 rounded-xl border border-surface-border shadow-subtle flex flex-col justify-between">
    <div class="flex items-center justify-between">
      <span class="text-2xl font-bold tracking-tight text-stone-900">{{ value }}</span>
      <div v-if="badgeText" class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        {{ badgeText }}
      </div>
      <div v-else-if="icon" class="p-2 rounded-lg bg-surface-muted text-stone-600">
        <component :is="icon" class="w-4 h-4" />
      </div>
    </div>
    <div class="mt-2 text-xs font-medium text-stone-500">
      {{ label }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    score: number; // 0..100 or 0..1
    size?: number;
    showLabel?: boolean;
    variant?: 'compact' | 'ring-only' | 'donut';
  }>(),
  {
    size: 32,
    showLabel: true,
    variant: 'compact',
  }
);

const percentage = computed(() => {
  if (props.score <= 1 && props.score > 0) {
    return Math.round(props.score * 100);
  }
  return Math.min(100, Math.max(0, Math.round(props.score)));
});

const strokeColor = computed(() => {
  if (percentage.value >= 85) return 'stroke-emerald-600';
  if (percentage.value >= 70) return 'stroke-emerald-500';
  if (percentage.value >= 50) return 'stroke-amber-500';
  return 'stroke-stone-400';
});

const radius = 14;
const circumference = 2 * Math.PI * radius;
const dashOffset = computed(() => {
  return circumference - (percentage.value / 100) * circumference;
});
</script>

<template>
  <div v-if="variant === 'donut'" class="flex flex-col items-center justify-center">
    <div class="relative flex items-center justify-center" :style="{ width: `${size}px`, height: `${size}px` }">
      <svg :width="size" :height="size" viewBox="0 0 36 36" class="rotate-[-90deg]">
        <!-- Track -->
        <circle
          cx="18"
          cy="18"
          :r="radius"
          fill="none"
          stroke="#EAEAE5"
          stroke-width="3"
        />
        <!-- Progress -->
        <circle
          cx="18"
          cy="18"
          :r="radius"
          fill="none"
          :class="strokeColor"
          stroke-width="3"
          stroke-linecap="round"
          :stroke-dasharray="circumference"
          :stroke-dashoffset="dashOffset"
        />
      </svg>
      <span class="absolute text-sm font-bold text-stone-900 tracking-tight">
        {{ percentage }}%
      </span>
    </div>
  </div>

  <div v-else class="inline-flex items-center gap-2">
    <div class="relative flex items-center justify-center" :style="{ width: `${size}px`, height: `${size}px` }">
      <svg :width="size" :height="size" viewBox="0 0 36 36" class="rotate-[-90deg]">
        <!-- Track -->
        <circle
          cx="18"
          cy="18"
          :r="radius"
          fill="none"
          stroke="#EAEAE5"
          stroke-width="3.5"
        />
        <!-- Progress -->
        <circle
          cx="18"
          cy="18"
          :r="radius"
          fill="none"
          :class="strokeColor"
          stroke-width="3.5"
          stroke-linecap="round"
          :stroke-dasharray="circumference"
          :stroke-dashoffset="dashOffset"
        />
      </svg>
    </div>

    <div v-if="showLabel && variant !== 'ring-only'" class="flex flex-col text-left leading-none">
      <span class="text-xs font-bold text-stone-900">{{ percentage }}%</span>
      <span class="text-[10px] text-stone-500 font-medium">Match</span>
    </div>
  </div>
</template>

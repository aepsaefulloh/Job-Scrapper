<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'row' | 'card' | 'metrics' | 'detail';
    count?: number;
  }>(),
  {
    variant: 'row',
    count: 3,
  }
);
</script>

<template>
  <div class="space-y-3 animate-pulse">
    <!-- Metrics Skeleton -->
    <div v-if="variant === 'metrics'" class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div
        v-for="i in 4"
        :key="i"
        class="bg-surface p-5 rounded-xl border border-surface-border space-y-3"
      >
        <div class="h-4 bg-stone-200 rounded w-20"></div>
        <div class="h-7 bg-stone-200 rounded w-16"></div>
      </div>
    </div>

    <!-- Row Skeleton -->
    <div v-else-if="variant === 'row'" class="space-y-3">
      <div
        v-for="i in count"
        :key="i"
        class="bg-surface p-4 rounded-xl border border-surface-border flex items-center justify-between gap-4"
      >
        <div class="flex items-center gap-3 flex-1">
          <div class="w-10 h-10 rounded-lg bg-stone-200 flex-shrink-0"></div>
          <div class="space-y-2 flex-1">
            <div class="h-4 bg-stone-200 rounded w-1/3"></div>
            <div class="h-3 bg-stone-200 rounded w-1/4"></div>
          </div>
        </div>
        <div class="w-20 h-6 bg-stone-200 rounded-full"></div>
      </div>
    </div>

    <!-- Detail Skeleton -->
    <div v-else-if="variant === 'detail'" class="space-y-6">
      <div class="bg-surface p-6 rounded-xl border border-surface-border space-y-4">
        <div class="h-6 bg-stone-200 rounded w-1/2"></div>
        <div class="h-4 bg-stone-200 rounded w-1/3"></div>
        <div class="h-32 bg-stone-200 rounded w-full"></div>
      </div>
    </div>

    <!-- Generic Card Skeleton -->
    <div v-else class="space-y-3">
      <div
        v-for="i in count"
        :key="i"
        class="bg-surface p-5 rounded-xl border border-surface-border space-y-3"
      >
        <div class="h-4 bg-stone-200 rounded w-2/5"></div>
        <div class="h-3 bg-stone-200 rounded w-4/5"></div>
      </div>
    </div>
  </div>
</template>

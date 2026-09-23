<script setup lang="ts">
import { Briefcase } from 'lucide-vue-next';
</script>

<template>
  <div class="min-h-screen bg-canvas flex flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md text-center">
      <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-sidebar text-white shadow-subtle mb-4">
        <Briefcase class="w-6 h-6 text-emerald-400" />
      </div>
      <h2 class="text-2xl font-bold tracking-tight text-stone-900">
        JobToolkit
      </h2>
      <p class="mt-1 text-sm text-stone-500">
        AI-powered Job Search & Application Assistant
      </p>
    </div>

    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
      <div class="bg-surface py-8 px-6 shadow-subtle border border-surface-border rounded-xl sm:px-10">
        <slot />
      </div>
    </div>
  </div>
</template>

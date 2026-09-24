<script setup lang="ts">
import { ref } from 'vue';
import { Search, Building2, Globe, SlidersHorizontal } from 'lucide-vue-next';
import { useJobSources } from '../../composables/useJobSources';

const emit = defineEmits<{
  (e: 'filter', filters: { keyword: string; company: string; source: string }): void;
}>();

const { availableSources } = useJobSources();

const keyword = ref('');
const company = ref('');
const source = ref('');

function triggerFilter() {
  emit('filter', {
    keyword: keyword.value,
    company: company.value,
    source: source.value,
  });
}

function handleReset() {
  keyword.value = '';
  company.value = '';
  source.value = '';
  triggerFilter();
}
</script>

<template>
  <div class="bg-surface p-4 rounded-xl border border-surface-border shadow-subtle space-y-3">
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <!-- Keyword search -->
      <div class="relative">
        <Search class="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          v-model="keyword"
          @keyup.enter="triggerFilter"
          type="text"
          placeholder="Search jobs, title, keywords..."
          class="w-full pl-9 pr-3 py-2 text-sm bg-surface-muted/50 border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 transition"
        />
      </div>

      <!-- Company filter -->
      <div class="relative">
        <Building2 class="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          v-model="company"
          @keyup.enter="triggerFilter"
          type="text"
          placeholder="Company name..."
          class="w-full pl-9 pr-3 py-2 text-sm bg-surface-muted/50 border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 transition"
        />
      </div>

      <!-- Source select -->
      <div class="relative">
        <Globe class="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <select
          v-model="source"
          @change="triggerFilter"
          class="w-full pl-9 pr-3 py-2 text-sm bg-surface-muted/50 border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 transition appearance-none cursor-pointer text-stone-700"
        >
          <option value="">All Sources</option>
          <option v-for="src in availableSources" :key="src.id" :value="src.id">
            {{ src.name }}
          </option>
          <option value="manual">Manual</option>
        </select>
      </div>
    </div>

    <div class="flex items-center justify-between pt-1 text-xs">
      <button
        type="button"
        @click="handleReset"
        class="text-stone-500 hover:text-stone-800 transition font-medium"
      >
        Clear filters
      </button>

      <button
        type="button"
        @click="triggerFilter"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-700 hover:bg-brand-800 text-white rounded-lg font-medium transition shadow-xs"
      >
        <SlidersHorizontal class="w-3.5 h-3.5" />
        <span>Apply Filters</span>
      </button>
    </div>
  </div>
</template>

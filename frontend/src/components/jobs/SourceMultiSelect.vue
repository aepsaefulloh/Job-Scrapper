<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useJobSources } from '../../composables/useJobSources';
import { ChevronDown, Search } from 'lucide-vue-next';

const props = defineProps<{
  modelValue: string[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void;
}>();

const { jobSources, availableSources, fetchJobSources } = useJobSources();

onMounted(() => {
  fetchJobSources();
  document.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
});

const isOpen = ref(false);
const searchQuery = ref('');
const containerRef = ref<HTMLElement | null>(null);

function handleClickOutside(event: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    isOpen.value = false;
  }
}

function toggleDropdown() {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    searchQuery.value = '';
  }
}

const filteredSources = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return jobSources.value;
  return jobSources.value.filter(
    (s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
  );
});

const selectedNames = computed(() => {
  const names = props.modelValue.map((id) => {
    const found = jobSources.value.find((s) => s.id === id);
    return found ? found.name : id;
  });
  return names;
});

const summaryText = computed(() => {
  if (selectedNames.value.length === 0) return 'Select job portals...';
  if (selectedNames.value.length <= 2) return selectedNames.value.join(', ');
  return `${selectedNames.value.slice(0, 2).join(', ')} +${selectedNames.value.length - 2}`;
});

function toggleSource(sourceId: string, available: boolean) {
  if (!available) return;
  const current = [...props.modelValue];
  const index = current.indexOf(sourceId);
  if (index >= 0) {
    current.splice(index, 1);
  } else {
    current.push(sourceId);
  }
  emit('update:modelValue', current);
}

function selectAllAvailable() {
  const allAvailableIds = availableSources.value.map((s) => s.id);
  emit('update:modelValue', allAvailableIds);
}

function clearAll() {
  emit('update:modelValue', []);
}
</script>

<template>
  <div ref="containerRef" class="relative w-full text-xs">
    <!-- Trigger Button -->
    <button
      type="button"
      @click="toggleDropdown"
      class="source-select-trigger w-full flex items-center justify-between px-3 py-2 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 transition-colors shadow-subtle text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
      :aria-expanded="isOpen"
    >
      <div class="flex items-center gap-2 truncate">
        <span
          :class="[
            'truncate font-medium',
            modelValue.length === 0 ? 'text-stone-400' : 'text-stone-900',
          ]"
        >
          {{ summaryText }}
        </span>
      </div>

      <div class="flex items-center gap-1.5 shrink-0 ml-2">
        <span
          v-if="modelValue.length > 0"
          class="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold"
        >
          {{ modelValue.length }}
        </span>
        <ChevronDown
          class="w-3.5 h-3.5 text-stone-500 transition-transform duration-150"
          :class="{ 'rotate-180': isOpen }"
        />
      </div>
    </button>

    <!-- Dropdown Menu -->
    <div
      v-if="isOpen"
      class="source-select-menu absolute z-50 mt-1 w-full rounded-xl border border-surface-border bg-surface shadow-elevated overflow-hidden animate-in fade-in duration-100 flex flex-col max-h-72"
    >
      <!-- Search Input -->
      <div class="p-2 border-b border-surface-border bg-stone-50/50">
        <div class="relative flex items-center">
          <Search class="w-3.5 h-3.5 text-stone-400 absolute left-2.5 pointer-events-none" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search sources..."
            class="source-search-input w-full pl-8 pr-3 py-1.5 text-xs bg-white rounded-md border border-stone-200 focus:outline-none focus:border-emerald-700"
          />
        </div>
      </div>

      <!-- Quick Action Toolbar -->
      <div
        class="px-3 py-1.5 border-b border-surface-border flex items-center justify-between text-[11px] bg-stone-50/30 text-stone-600"
      >
        <span>{{ modelValue.length }} of {{ availableSources.length }} available</span>
        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="selectAllAvailable"
            class="btn-select-all font-semibold text-emerald-700 hover:text-emerald-900 cursor-pointer"
          >
            Select all available
          </button>
          <span class="text-stone-300">|</span>
          <button
            type="button"
            @click="clearAll"
            class="btn-clear font-semibold text-stone-500 hover:text-stone-800 cursor-pointer"
          >
            Clear
          </button>
        </div>
      </div>

      <!-- Sources List -->
      <div class="overflow-y-auto p-1.5 space-y-1 flex-1">
        <div
          v-for="source in filteredSources"
          :key="source.id"
          @click="toggleSource(source.id, source.available)"
          :class="[
            'source-item-row flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors select-none',
            source.available
              ? 'cursor-pointer hover:bg-stone-100'
              : 'opacity-50 cursor-not-allowed bg-stone-50/50',
          ]"
        >
          <div class="flex items-center gap-2.5">
            <input
              type="checkbox"
              :id="`source-${source.id}`"
              :checked="modelValue.includes(source.id)"
              :disabled="!source.available"
              class="rounded border-stone-300 text-emerald-700 focus:ring-emerald-700 pointer-events-none"
            />
            <div>
              <span class="font-medium text-stone-900">{{ source.name }}</span>
              <p v-if="source.description" class="text-[10px] text-stone-400">
                {{ source.description }}
              </p>
            </div>
          </div>

          <div>
            <span
              v-if="source.available"
              class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/60"
            >
              Available
            </span>
            <span
              v-else
              class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 text-stone-500 border border-stone-200"
            >
              Coming soon
            </span>
          </div>
        </div>

        <div
          v-if="filteredSources.length === 0"
          class="p-4 text-center text-stone-400 text-xs italic"
        >
          No sources match "{{ searchQuery }}"
        </div>
      </div>
    </div>
  </div>
</template>

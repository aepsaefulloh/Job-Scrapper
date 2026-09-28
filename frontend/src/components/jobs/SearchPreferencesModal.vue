<script setup lang="ts">
import { ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { X, Plus, AlertCircle, Loader2, Check, Play, Briefcase } from 'lucide-vue-next';
import SourceMultiSelect from './SourceMultiSelect.vue';
import type {
  JobSearchPreferences,
  SupportedJobSource,
  WorkModePreference,
  EmploymentTypePreference,
  UnknownDatePolicy,
} from '../../types/search-preferences';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    preferences: JobSearchPreferences;
    saving?: boolean;
    triggering?: boolean;
    targetRoles?: string[];
    mode?: 'edit' | 'confirm_search';
  }>(),
  {
    saving: false,
    triggering: false,
    targetRoles: () => [],
    mode: 'edit',
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'save', preferences: JobSearchPreferences): void;
  (e: 'save-and-search', preferences: JobSearchPreferences): void;
}>();

const formSources = ref<SupportedJobSource[]>(['jobstreet', 'loker-id']);
const formLocations = ref<string[]>([]);
const newLocation = ref('');
const formWorkModes = ref<WorkModePreference[]>([]);
const formEmploymentTypes = ref<EmploymentTypePreference[]>([]);
const formMaxPostingAgeDays = ref(7);
const formUnknownPostingDatePolicy = ref<UnknownDatePolicy>('exclude');
const validationError = ref<string | null>(null);

watch(
  () => props.preferences,
  (val) => {
    if (!val) return;
    formSources.value = [...(val.sources || ['jobstreet', 'loker-id'])];
    formLocations.value = [...(val.locations || [])];
    formWorkModes.value = [...(val.workModes || [])];
    formEmploymentTypes.value = [...(val.employmentTypes || [])];
    formMaxPostingAgeDays.value = val.maxPostingAgeDays || 7;
    formUnknownPostingDatePolicy.value = val.unknownPostingDatePolicy || 'exclude';
  },
  { immediate: true, deep: true }
);

function addLocation() {
  const loc = newLocation.value.trim();
  if (!loc) return;
  const exists = formLocations.value.some((l) => l.toLowerCase() === loc.toLowerCase());
  if (!exists) {
    formLocations.value.push(loc);
  }
  newLocation.value = '';
}

function removeLocation(index: number) {
  formLocations.value.splice(index, 1);
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault();
    addLocation();
  }
}

function toggleSource(source: SupportedJobSource) {
  const idx = formSources.value.indexOf(source);
  if (idx >= 0) {
    if (formSources.value.length === 1) {
      validationError.value = 'At least one search source must be selected.';
      return;
    }
    formSources.value.splice(idx, 1);
  } else {
    formSources.value.push(source);
  }
  validationError.value = null;
}

function toggleWorkMode(mode: WorkModePreference) {
  const idx = formWorkModes.value.indexOf(mode);
  if (idx >= 0) {
    formWorkModes.value.splice(idx, 1);
  } else {
    formWorkModes.value.push(mode);
  }
}

function toggleEmploymentType(type: EmploymentTypePreference) {
  const idx = formEmploymentTypes.value.indexOf(type);
  if (idx >= 0) {
    formEmploymentTypes.value.splice(idx, 1);
  } else {
    formEmploymentTypes.value.push(type);
  }
}

function close() {
  emit('update:modelValue', false);
}

function getFormPayload(): JobSearchPreferences | null {
  if (formSources.value.length === 0) {
    validationError.value = 'At least one search source must be enabled.';
    return null;
  }
  validationError.value = null;

  return {
    sources: formSources.value,
    locations: formLocations.value,
    workModes: formWorkModes.value,
    employmentTypes: formEmploymentTypes.value,
    maxPostingAgeDays: Number(formMaxPostingAgeDays.value),
    unknownPostingDatePolicy: formUnknownPostingDatePolicy.value,
  };
}

function submit() {
  const payload = getFormPayload();
  if (payload) {
    emit('save', payload);
  }
}

function submitAndSearch() {
  const payload = getFormPayload();
  if (payload) {
    emit('save-and-search', payload);
  }
}
</script>

<template>
  <div
    v-if="modelValue"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm"
    role="dialog"
    aria-modal="true"
  >
    <div
      class="bg-surface rounded-xl border border-surface-border shadow-elevated max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh] text-stone-800"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-surface-border">
        <div>
          <h3 class="text-sm font-bold text-stone-900">
            {{ mode === 'confirm_search' ? 'Konfirmasi Target & Mulai Scraping' : 'Job Search Preferences' }}
          </h3>
          <p class="text-xs text-stone-500 mt-0.5">
            {{
              mode === 'confirm_search'
                ? 'Pilih portal kerja, lokasi target, dan batas waktu sebelum scraping dijalankan.'
                : 'Configure agent search portals, target locations, and posting freshness.'
            }}
          </p>
        </div>
        <button
          type="button"
          @click="close"
          class="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          aria-label="Close"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Scrollable Form Body -->
      <div class="px-5 py-4 overflow-y-auto space-y-5 text-xs">
        <div
          v-if="validationError"
          class="flex items-center gap-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800"
        >
          <AlertCircle class="w-4 h-4 text-rose-600 shrink-0" />
          <span>{{ validationError }}</span>
        </div>

        <!-- Target Roles Summary Banner -->
        <div v-if="targetRoles && targetRoles.length > 0" class="p-3 rounded-lg bg-stone-50 border border-stone-200/80">
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-[10px] font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
              <Briefcase class="w-3 h-3 text-stone-400" />
              Target Role & Keyword (Profil)
            </span>
            <RouterLink to="/profile" class="text-[10px] text-brand-700 hover:underline">
              Ubah di Profil →
            </RouterLink>
          </div>
          <div class="flex flex-wrap gap-1">
            <span
              v-for="role in targetRoles"
              :key="role"
              class="px-2 py-0.5 rounded text-[11px] font-medium bg-white border border-stone-200 text-stone-800"
            >
              {{ role }}
            </span>
          </div>
        </div>

        <!-- 1. Search Sources -->
        <div>
          <label class="block text-xs font-semibold text-stone-900 mb-1.5">
            Job Portals & Sources
          </label>
          <SourceMultiSelect v-model="formSources as any" />
          <p class="text-[11px] text-stone-400 mt-1">
            Only verified live scrapers are selectable.
          </p>
        </div>

        <!-- 2. Target Locations -->
        <div>
          <label class="block text-xs font-semibold text-stone-900 mb-1.5">
            Search Locations
          </label>
          <div class="flex flex-wrap gap-1.5 mb-2">
            <span
              v-for="(loc, index) in formLocations"
              :key="loc"
              class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-stone-100 border border-stone-200 text-stone-800 text-xs font-medium"
            >
              {{ loc }}
              <button
                type="button"
                @click="removeLocation(index)"
                class="text-stone-400 hover:text-stone-700 p-0.5 rounded-full"
                aria-label="Remove location"
              >
                <X class="w-3 h-3" />
              </button>
            </span>
            <span
              v-if="formLocations.length === 0"
              class="text-stone-400 text-xs italic py-1"
            >
              No specific locations configured (agent searches all locations).
            </span>
          </div>

          <div class="flex items-center gap-2">
            <input
              v-model="newLocation"
              type="text"
              placeholder="e.g. Jakarta, Bogor, Remote"
              @keydown="handleKeyDown"
              class="flex-1 px-3 py-1.5 rounded-lg border border-stone-200 text-xs focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
            <button
              type="button"
              @click="addLocation"
              :disabled="!newLocation.trim()"
              class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-medium text-stone-700 bg-stone-50 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus class="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>
        </div>

        <!-- 3. Freshness / Posting Age -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-stone-900 mb-1.5">
              Maximum Posting Age
            </label>
            <select
              v-model="formMaxPostingAgeDays"
              class="w-full px-3 py-1.5 rounded-lg border border-stone-200 text-xs focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-white"
            >
              <option :value="1">Last 1 day (Strict)</option>
              <option :value="3">Last 3 days</option>
              <option :value="7">Last 7 days (Recommended)</option>
              <option :value="14">Last 14 days</option>
              <option :value="30">Last 30 days</option>
            </select>
            <p class="text-[11px] text-stone-400 mt-1">
              Stale listings older than this threshold are filtered out.
            </p>
          </div>

          <div>
            <label class="block text-xs font-semibold text-stone-900 mb-1.5">
              Unknown Posting Date Policy
            </label>
            <select
              v-model="formUnknownPostingDatePolicy"
              class="w-full px-3 py-1.5 rounded-lg border border-stone-200 text-xs focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-white"
            >
              <option value="exclude">Exclude (Strict Freshness)</option>
              <option value="allow">Allow listings without date</option>
            </select>
            <p class="text-[11px] text-stone-400 mt-1">
              Controls behavior when a site does not provide date metadata.
            </p>
          </div>
        </div>

        <!-- 4. Work Modes -->
        <div>
          <label class="block text-xs font-semibold text-stone-900 mb-1.5">
            Work Mode Preferences (Optional)
          </label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="wm in (['remote', 'hybrid', 'onsite'] as const)"
              :key="wm"
              type="button"
              @click="toggleWorkMode(wm)"
              class="px-3 py-1 rounded-full border text-xs capitalize transition-colors"
              :class="
                formWorkModes.includes(wm)
                  ? 'border-brand-600 bg-brand-50 text-brand-900 font-semibold'
                  : 'border-stone-200 text-stone-600 bg-white hover:bg-stone-50'
              "
            >
              {{ wm }}
            </button>
          </div>
        </div>

        <!-- 5. Employment Types -->
        <div>
          <label class="block text-xs font-semibold text-stone-900 mb-1.5">
            Employment Types (Optional)
          </label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="et in (['full-time', 'part-time', 'contract', 'internship', 'freelance'] as const)"
              :key="et"
              type="button"
              @click="toggleEmploymentType(et)"
              class="px-3 py-1 rounded-full border text-xs capitalize transition-colors"
              :class="
                formEmploymentTypes.includes(et)
                  ? 'border-brand-600 bg-brand-50 text-brand-900 font-semibold'
                  : 'border-stone-200 text-stone-600 bg-white hover:bg-stone-50'
              "
            >
              {{ et }}
            </button>
          </div>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="flex items-center justify-between gap-2 px-5 py-3 border-t border-surface-border bg-stone-50/50">
        <button
          type="button"
          @click="close"
          class="px-3.5 py-1.5 rounded-lg border border-stone-200 text-xs font-medium text-stone-600 hover:bg-stone-100 transition-colors"
        >
          {{ mode === 'confirm_search' ? 'Batal' : 'Cancel' }}
        </button>

        <div class="flex items-center gap-2">
          <!-- Optional save-only button in confirm mode -->
          <button
            v-if="mode === 'confirm_search'"
            type="button"
            :disabled="saving || triggering"
            @click="submit"
            class="px-3 py-1.5 rounded-lg border border-stone-200 bg-white text-xs font-medium text-stone-700 hover:bg-stone-50 transition-colors"
          >
            {{ saving ? 'Menyimpan...' : 'Simpan Target Saja' }}
          </button>

          <!-- Primary Save button for normal edit mode -->
          <button
            v-if="mode === 'edit'"
            type="button"
            :disabled="saving"
            @click="submit"
            class="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg border border-stone-300 bg-white text-stone-800 text-xs font-semibold hover:bg-stone-50 disabled:opacity-50 transition-colors shadow-2xs"
          >
            <Loader2 v-if="saving" class="w-3.5 h-3.5 animate-spin" />
            <span>{{ saving ? 'Saving...' : 'Save Preferences' }}</span>
          </button>

          <!-- Primary Start Scraping button (present in both, prominent in confirm_search) -->
          <button
            type="button"
            :disabled="saving || triggering"
            @click="submitAndSearch"
            class="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-brand-700 text-white text-xs font-semibold hover:bg-brand-800 disabled:opacity-50 transition-colors shadow-sm"
          >
            <Loader2 v-if="saving || triggering" class="w-3.5 h-3.5 animate-spin" />
            <Play v-else class="w-3.5 h-3.5 fill-current" />
            <span>{{ triggering ? 'Menjalankan...' : (mode === 'confirm_search' ? 'Konfirmasi & Mulai Scraping' : 'Save & Start Search') }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

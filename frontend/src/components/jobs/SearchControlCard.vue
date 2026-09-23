<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  Play,
  RotateCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  History,
  Briefcase,
  MapPin,
  Globe,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-vue-next';
import { useSearchProfile } from '../../composables/useSearchProfile';
import { useScrapeRuns } from '../../composables/useScrapeRuns';
import SkillTag from '../common/SkillTag.vue';

const emit = defineEmits<{
  (e: 'search-completed'): void;
}>();

const { searchProfile, loading: profileLoading, fetchSearchProfile } = useSearchProfile();
const {
  latestRun,
  recentRuns,
  loading: runsLoading,
  triggering,
  isRunning,
  error,
  fetchLatestRun,
  fetchRecentRuns,
  triggerSearch,
  startPolling,
  onRunCompleted,
  offRunCompleted,
} = useScrapeRuns();

const showHistory = ref(false);

const hasUsableProfile = computed(() => {
  return !!searchProfile.value && searchProfile.value.targetRoles.length > 0;
});

const activeSources = computed(() => {
  // Only show supported sources (jobstreet)
  if (!searchProfile.value) return ['Jobstreet'];
  const supported = searchProfile.value.sources.filter((s) => s.toLowerCase() === 'jobstreet');
  return supported.length > 0 ? supported.map((s) => s.charAt(0).toUpperCase() + s.slice(1)) : ['Jobstreet'];
});

function formatDate(isoString: string): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) {
    return `Today, ${timeStr}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday, ${timeStr}`;
  }
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
}

async function handleSearch() {
  const result = await triggerSearch({ maxPages: 1 });
  if (result) {
    emit('search-completed');
  }
}

onMounted(async () => {
  await Promise.all([
    fetchSearchProfile(),
    fetchLatestRun(),
    fetchRecentRuns(5),
  ]);

  // If latest run is currently active, start polling automatically
  if (isRunning.value) {
    startPolling();
  }

  onRunCompleted(() => {
    emit('search-completed');
  });
});
</script>

<template>
  <div class="bg-surface rounded-xl border border-surface-border p-5 shadow-subtle space-y-4">
    <!-- Top Row: Title, Action, and Running State -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-border/60">
      <div>
        <div class="flex items-center gap-2">
          <Search class="w-4 h-4 text-brand-700" />
          <h2 class="text-sm font-bold text-stone-900">Job Discovery Agent</h2>
          <span
            v-if="isRunning"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200"
          >
            <Loader2 class="w-2.5 h-2.5 animate-spin text-amber-600" />
            Searching
          </span>
          <span
            v-else-if="latestRun?.status === 'completed'"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"
          >
            <CheckCircle2 class="w-2.5 h-2.5 text-emerald-600" />
            Ready
          </span>
        </div>
        <p class="text-xs text-stone-500 mt-0.5">
          Autonomous search driven by your candidate profile preferences.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          :disabled="isRunning || triggering || !hasUsableProfile || profileLoading"
          @click="handleSearch"
          class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-brand-700 text-white shadow-sm hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Loader2 v-if="triggering || isRunning" class="w-3.5 h-3.5 animate-spin" />
          <Play v-else class="w-3.5 h-3.5 fill-current" />
          <span>{{ isRunning ? 'Searching...' : 'Search Jobs Now' }}</span>
        </button>
      </div>
    </div>

    <!-- Error / Notice Banner -->
    <div
      v-if="error"
      class="flex items-center gap-2 p-3 rounded-lg text-xs bg-rose-50 border border-rose-200 text-rose-800"
    >
      <AlertCircle class="w-4 h-4 text-rose-600 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <!-- Empty Profile State Notice -->
    <div
      v-else-if="!profileLoading && !hasUsableProfile"
      class="flex items-center gap-2 p-3 rounded-lg text-xs bg-stone-50 border border-stone-200 text-stone-700"
    >
      <Clock class="w-4 h-4 text-stone-500 shrink-0" />
      <span>
        Your job search profile is not ready yet. Complete or update your candidate profile first to activate discovery.
      </span>
    </div>

    <!-- Main Content: Transparency & Operational Summary Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
      <!-- Left Column: Search Profile Transparency -->
      <div class="space-y-2.5 bg-stone-50/50 p-3 rounded-lg border border-surface-border/50">
        <span class="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
          Agent Search Parameters
        </span>

        <div v-if="searchProfile">
          <!-- Target Roles -->
          <div class="flex items-start gap-2 mb-2">
            <Briefcase class="w-3.5 h-3.5 text-stone-400 mt-0.5 shrink-0" />
            <div>
              <span class="text-stone-500 font-medium text-[11px] block">Searching for:</span>
              <div class="flex flex-wrap gap-1 mt-0.5">
                <span
                  v-for="role in (searchProfile?.targetRoles || [])"
                  :key="role"
                  class="px-1.5 py-0.5 rounded bg-white border border-stone-200 text-[11px] font-medium text-stone-800"
                >
                  {{ role }}
                </span>
                <span
                  v-for="alias in (searchProfile?.roleAliases?.slice(0, 3) || [])"
                  :key="alias"
                  class="px-1.5 py-0.5 rounded bg-stone-100 text-[10px] text-stone-600"
                >
                  {{ alias }}
                </span>
              </div>
            </div>
          </div>

          <!-- Locations -->
          <div class="flex items-start gap-2 mb-2">
            <MapPin class="w-3.5 h-3.5 text-stone-400 mt-0.5 shrink-0" />
            <div>
              <span class="text-stone-500 font-medium text-[11px] block">Locations:</span>
              <div class="flex flex-wrap gap-1 mt-0.5">
                <span
                  v-if="!searchProfile?.preferredLocations || searchProfile.preferredLocations.length === 0"
                  class="text-stone-600 text-[11px]"
                >
                  All Indonesia / Remote
                </span>
                <span
                  v-else
                  v-for="loc in searchProfile.preferredLocations"
                  :key="loc"
                  class="px-1.5 py-0.5 rounded bg-white border border-stone-200 text-[11px] text-stone-700"
                >
                  {{ loc }}
                </span>
              </div>
            </div>
          </div>

          <!-- Active Sources -->
          <div class="flex items-center gap-2">
            <Globe class="w-3.5 h-3.5 text-stone-400 shrink-0" />
            <div class="flex items-center gap-1.5">
              <span class="text-stone-500 font-medium text-[11px]">Sources:</span>
              <span
                v-for="src in activeSources"
                :key="src"
                class="px-1.5 py-0.5 rounded bg-brand-50 border border-brand-200 text-[10px] font-semibold text-brand-700"
              >
                {{ src }}
              </span>
            </div>
          </div>
        </div>
        <div v-else class="text-stone-400 text-[11px] py-2">
          Profile parameters loading...
        </div>
      </div>

      <!-- Right Column: Operational State & Last Search Summary -->
      <div class="space-y-2.5 bg-stone-50/50 p-3 rounded-lg border border-surface-border/50 flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Latest Execution Status
            </span>
            <span
              v-if="latestRun"
              class="text-[10px] font-medium text-stone-400"
            >
              Trigger: {{ latestRun.trigger === 'scheduled' ? 'Scheduled' : 'Manual' }}
            </span>
          </div>

          <!-- When a run is in progress -->
          <div v-if="isRunning" class="py-2 space-y-1.5">
            <div class="flex items-center gap-2 text-stone-800 font-semibold text-xs">
              <Loader2 class="w-3.5 h-3.5 animate-spin text-brand-700" />
              <span>Searching Jobstreet...</span>
            </div>
            <p class="text-[11px] text-stone-500">
              Ingesting and evaluating candidate compatibility in real-time.
            </p>
          </div>

          <!-- When latest run exists -->
          <div v-else-if="latestRun" class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs text-stone-600 font-medium">
                Last search: {{ formatDate(latestRun.finishedAt || latestRun.startedAt) }}
              </span>
              <span
                class="text-[10px] font-semibold uppercase px-2 py-0.5 rounded"
                :class="{
                  'bg-emerald-100 text-emerald-800': latestRun.status === 'completed',
                  'bg-amber-100 text-amber-800': latestRun.status === 'partial',
                  'bg-rose-100 text-rose-800': latestRun.status === 'failed',
                }"
              >
                {{ latestRun.status }}
              </span>
            </div>

            <!-- Stats Grid -->
            <div class="grid grid-cols-4 gap-2 pt-1 border-t border-stone-200/60 text-center">
              <div>
                <span class="block text-stone-900 font-bold text-sm">{{ latestRun.discovered }}</span>
                <span class="text-[10px] text-stone-500 uppercase">Found</span>
              </div>
              <div>
                <span class="block text-emerald-700 font-bold text-sm">{{ latestRun.inserted }}</span>
                <span class="text-[10px] text-stone-500 uppercase">New</span>
              </div>
              <div>
                <span class="block text-stone-600 font-bold text-sm">{{ latestRun.duplicates }}</span>
                <span class="text-[10px] text-stone-500 uppercase">Dupes</span>
              </div>
              <div>
                <span class="block text-rose-600 font-bold text-sm">{{ latestRun.failed }}</span>
                <span class="text-[10px] text-stone-500 uppercase">Failed</span>
              </div>
            </div>
          </div>

          <div v-else class="text-stone-400 text-[11px] py-3">
            No searches recorded yet. Click "Search Jobs Now" to start.
          </div>
        </div>

        <!-- History Toggle -->
        <button
          type="button"
          @click="showHistory = !showHistory"
          class="flex items-center justify-between w-full pt-1.5 border-t border-stone-200/60 text-[11px] font-semibold text-stone-600 hover:text-stone-900 transition-colors"
        >
          <span class="flex items-center gap-1.5">
            <History class="w-3 h-3 text-stone-400" />
            Recent Searches ({{ recentRuns.length }})
          </span>
          <component :is="showHistory ? ChevronUp : ChevronDown" class="w-3 h-3 text-stone-400" />
        </button>
      </div>
    </div>

    <!-- Collapsible Recent Search History -->
    <div v-if="showHistory" class="pt-2 border-t border-surface-border/60">
      <div v-if="recentRuns.length === 0" class="text-xs text-stone-400 py-2 text-center">
        No recent search history.
      </div>
      <div v-else class="space-y-1.5">
        <div
          v-for="run in recentRuns"
          :key="run.id"
          class="flex items-center justify-between p-2 rounded-md bg-stone-50/70 border border-stone-200/60 text-xs"
        >
          <div class="flex items-center gap-2">
            <span
              class="w-1.5 h-1.5 rounded-full"
              :class="{
                'bg-emerald-500': run.status === 'completed',
                'bg-amber-500': run.status === 'partial',
                'bg-rose-500': run.status === 'failed',
                'bg-blue-500': run.status === 'running' || run.status === 'pending',
              }"
            />
            <span class="font-medium text-stone-800 capitalize">{{ run.source }}</span>
            <span v-if="run.keyword" class="text-stone-500 text-[11px]">"{{ run.keyword }}"</span>
          </div>

          <div class="flex items-center gap-3 text-[11px]">
            <span class="text-emerald-700 font-medium">+{{ run.inserted }} new</span>
            <span class="text-stone-400">{{ formatDate(run.finishedAt || run.startedAt) }}</span>
            <span class="px-1.5 py-0.2 rounded text-[9px] font-semibold uppercase bg-stone-200/60 text-stone-600">
              {{ run.trigger === 'scheduled' ? 'Sched' : 'Manual' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

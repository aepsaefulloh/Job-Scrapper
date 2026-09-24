<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import AppLayout from '../layouts/AppLayout.vue';
import LoadingSkeleton from '../components/common/LoadingSkeleton.vue';
import EmptyState from '../components/common/EmptyState.vue';
import { useSearchExecution } from '../composables/useSearchExecution';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  Search,
  Sparkles,
  Briefcase,
  Layers,
  ArrowRight,
  ShieldAlert,
  Info,
} from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const runId = computed(() => String(route.params.id || ''));

const {
  execution,
  loading,
  error,
  elapsedSeconds,
  isRunning,
  startPolling,
  formatDuration,
} = useSearchExecution();

onMounted(() => {
  if (runId.value) {
    startPolling(runId.value);
  }
});

function formatSourceName(src: string): string {
  if (src.toLowerCase() === 'loker-id' || src.toLowerCase() === 'loker.id') return 'Loker.id';
  return src.charAt(0).toUpperCase() + src.slice(1);
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return iso;
  }
}
</script>

<template>
  <AppLayout>
    <div class="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <!-- Breadcrumb & Back Link -->
      <div class="flex items-center justify-between">
        <RouterLink
          to="/jobs"
          class="inline-flex items-center gap-1.5 text-xs text-stone-700 hover:text-stone-900 transition-colors uppercase tracking-wider font-semibold"
        >
          <ArrowLeft class="w-3.5 h-3.5" />
          Back to Jobs
        </RouterLink>

        <span v-if="execution" class="text-xs font-mono text-stone-600 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
          ID: {{ execution.id }}
        </span>
      </div>

      <!-- Loading State -->
      <div v-if="loading && !execution" class="space-y-4">
        <LoadingSkeleton class="h-10 w-1/3" />
        <LoadingSkeleton class="h-48 w-full" />
        <LoadingSkeleton class="h-64 w-full" />
      </div>

      <!-- Error State -->
      <div v-else-if="error && !execution" class="p-8 bg-stone-50 border border-stone-200 rounded-lg text-center">
        <EmptyState
          title="Search Run Not Found"
          :description="error"
          action-label="Return to Jobs"
          @action="router.push('/jobs')"
        />
      </div>

      <!-- Detail View -->
      <template v-else-if="execution">
        <!-- Header Banner -->
        <div class="bg-white border border-stone-200 rounded-lg p-6 space-y-4 shadow-sm">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="text-xs uppercase tracking-widest text-stone-600 font-semibold font-mono">
                  Execution Run
                </span>
                <span
                  class="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border"
                  :class="execution.trigger === 'manual' ? 'bg-stone-100 text-stone-700 border-stone-300' : 'bg-blue-50 text-blue-700 border-blue-200'"
                >
                  {{ execution.trigger === 'manual' ? 'Manual' : 'Scheduled' }}
                </span>
              </div>
              <h1 class="text-2xl font-serif text-stone-900 font-normal">
                Search Run Progress & Telemetry
              </h1>
            </div>

            <!-- Status & Duration Badges -->
            <div class="flex items-center gap-3">
              <!-- Duration Badge -->
              <div class="flex items-center gap-1.5 px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-md text-xs font-mono text-stone-700">
                <Clock class="w-3.5 h-3.5 text-stone-600" />
                <span>{{ formatDuration(elapsedSeconds) }}</span>
              </div>

              <!-- Status Badge -->
              <div
                v-if="execution.status === 'running'"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200"
              >
                <Loader2 class="w-3.5 h-3.5 animate-spin text-amber-600" />
                Running
              </div>
              <div
                v-else-if="execution.status === 'completed'"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200"
              >
                <CheckCircle2 class="w-3.5 h-3.5 text-emerald-600" />
                Completed
              </div>
              <div
                v-else-if="execution.status === 'partial'"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200"
              >
                <AlertCircle class="w-3.5 h-3.5 text-amber-600" />
                Partial Completion
              </div>
              <div
                v-else
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-rose-50 text-rose-800 border border-rose-200"
              >
                <AlertCircle class="w-3.5 h-3.5 text-rose-600" />
                Failed
              </div>
            </div>
          </div>

          <!-- Partial Completion Warning -->
          <div
            v-if="execution.status === 'partial'"
            class="p-4 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-3"
          >
            <ShieldAlert class="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div class="text-xs text-amber-900 space-y-1">
              <p class="font-semibold">Partial Completion Notice</p>
              <p>
                AI evaluation encountered an issue (e.g. provider downtime or quota), but all jobs discovered during scraping remain safely saved in your database.
              </p>
              <p v-if="execution.errorMessage" class="font-mono text-amber-800 bg-amber-100/60 p-1.5 rounded text-[11px]">
                {{ execution.errorMessage }}
              </p>
            </div>
          </div>

          <!-- Summary Metrics Cards -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div class="p-3 bg-stone-50 border border-stone-200 rounded-md">
              <span class="text-[11px] uppercase tracking-wider text-stone-600 font-semibold block">Discovered</span>
              <span class="text-xl font-serif text-stone-900 font-normal">{{ execution.summary.discovered }}</span>
            </div>
            <div class="p-3 bg-stone-50 border border-stone-200 rounded-md">
              <span class="text-[11px] uppercase tracking-wider text-stone-600 font-semibold block">Inserted New</span>
              <span class="text-xl font-serif text-emerald-700 font-normal">+{{ execution.summary.inserted }}</span>
            </div>
            <div class="p-3 bg-stone-50 border border-stone-200 rounded-md">
              <span class="text-[11px] uppercase tracking-wider text-stone-600 font-semibold block">Duplicates</span>
              <span class="text-xl font-serif text-stone-600 font-normal">{{ execution.summary.duplicates }}</span>
            </div>
            <div class="p-3 bg-stone-50 border border-stone-200 rounded-md">
              <div class="flex items-center gap-1.5">
                <span class="text-[11px] uppercase tracking-wider text-stone-600 font-semibold block">AI Evaluated</span>
                <span data-test="ai-badge" class="text-[9px] font-bold px-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">✦ AI</span>
              </div>
              <span class="text-xl font-serif text-indigo-900 font-normal">{{ execution.summary.aiEvaluated }}</span>
            </div>
          </div>
        </div>

        <!-- Multi-Source Breakdown -->
        <div v-if="execution.sources && execution.sources.length > 0" class="bg-white border border-stone-200 rounded-lg p-6 space-y-4 shadow-sm">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-semibold text-stone-900 uppercase tracking-wider flex items-center gap-2">
              <Layers class="w-4 h-4 text-stone-600" />
              Source Ingestion Breakdown
            </h2>
            <span class="text-xs text-stone-600">{{ execution.sources.length }} sources queried</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              v-for="source in execution.sources"
              :key="source.source"
              class="border border-stone-200 rounded-md p-4 bg-stone-50/50 space-y-3"
            >
              <div class="flex items-center justify-between">
                <span class="font-serif text-stone-900 font-medium text-base">
                  {{ formatSourceName(source.source) }}
                </span>
                <span
                  class="text-[11px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border"
                  :class="source.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : source.status === 'failed' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'"
                >
                  {{ source.status }}
                </span>
              </div>

              <div class="grid grid-cols-4 gap-2 text-center pt-1 border-t border-stone-200/60">
                <div>
                  <span class="text-[10px] text-stone-600 block uppercase">Found</span>
                  <span class="font-mono text-xs font-semibold text-stone-800">{{ source.discovered }}</span>
                </div>
                <div>
                  <span class="text-[10px] text-stone-600 block uppercase">New</span>
                  <span class="font-mono text-xs font-semibold text-emerald-700">+{{ source.inserted }}</span>
                </div>
                <div>
                  <span class="text-[10px] text-stone-600 block uppercase">Dupes</span>
                  <span class="font-mono text-xs font-semibold text-stone-700">{{ source.duplicates }}</span>
                </div>
                <div>
                  <span class="text-[10px] text-stone-600 block uppercase">Duration</span>
                  <span class="font-mono text-xs font-semibold text-stone-700">
                    {{ source.durationMs !== undefined ? formatDuration(Math.round(source.durationMs / 1000)) : '—' }}
                  </span>
                </div>
              </div>

              <div v-if="source.error" class="text-[11px] text-rose-700 bg-rose-50 p-2 rounded border border-rose-200 font-mono">
                {{ source.error }}
              </div>
            </div>
          </div>
        </div>

        <!-- Stage Checklist (Strict AI Provenance) -->
        <div class="bg-white border border-stone-200 rounded-lg p-6 space-y-4 shadow-sm">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-semibold text-stone-900 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 class="w-4 h-4 text-stone-600" />
              Pipeline Execution Stages
            </h2>
            <span class="text-xs text-stone-600">Deterministic vs AI Workflow</span>
          </div>

          <div data-test="stages-list" class="divide-y divide-stone-100">
            <div
              v-for="stage in execution.stages"
              :key="stage.id"
              data-test="stage-item"
              class="py-3 flex items-center justify-between gap-4"
            >
              <div class="flex items-center gap-3">
                <!-- Status Icon -->
                <div class="shrink-0">
                  <CheckCircle2 v-if="stage.status === 'completed'" class="w-4 h-4 text-emerald-600" />
                  <Loader2 v-else-if="stage.status === 'running'" class="w-4 h-4 text-amber-600 animate-spin" />
                  <AlertCircle v-else-if="stage.status === 'failed'" class="w-4 h-4 text-rose-600" />
                  <Clock v-else class="w-4 h-4 text-stone-300" />
                </div>

                <div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-medium text-stone-900">
                      {{ stage.name }}
                    </span>
                    <!-- AI Badge only on genuine AI stages -->
                    <span
                      v-if="stage.isAi"
                      data-test="ai-badge"
                      class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wider"
                    >
                      ✦ AI
                    </span>
                  </div>
                  <p v-if="stage.details" class="text-[11px] text-stone-600">
                    {{ stage.details }}
                  </p>
                </div>
              </div>

              <div class="text-right">
                <span
                  class="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded"
                  :class="stage.status === 'completed' ? 'text-emerald-700 bg-emerald-50' : stage.status === 'running' ? 'text-amber-700 bg-amber-50' : stage.status === 'failed' ? 'text-rose-700 bg-rose-50' : 'text-stone-600 bg-stone-100'"
                >
                  {{ stage.status }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Operational Timeline -->
        <div v-if="execution.timeline && execution.timeline.length > 0" class="bg-white border border-stone-200 rounded-lg p-6 space-y-4 shadow-sm">
          <h2 class="text-sm font-semibold text-stone-900 uppercase tracking-wider flex items-center gap-2">
            <Clock class="w-4 h-4 text-stone-600" />
            Execution Timeline
          </h2>

          <div class="space-y-2 border-l border-stone-200 ml-2 pl-4">
            <div
              v-for="(event, idx) in execution.timeline"
              :key="idx"
              class="relative flex items-start gap-3 py-1"
            >
              <div class="absolute -left-[21px] top-2 w-2 h-2 rounded-full bg-stone-300 border border-white" />
              <span class="text-[11px] font-mono text-stone-600 shrink-0">
                {{ formatTimestamp(event.timestamp) }}
              </span>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-xs text-stone-800">
                  {{ event.message }}
                </span>
                <span
                  v-if="event.isAi"
                  data-test="ai-badge"
                  class="text-[9px] font-bold px-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200"
                >
                  ✦ AI
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Completion Actions -->
        <div class="flex items-center justify-between pt-4 border-t border-stone-200">
          <RouterLink
            to="/jobs"
            class="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 text-stone-50 rounded-md text-xs font-semibold hover:bg-stone-800 transition-colors shadow-sm"
          >
            Browse Discovered Jobs
            <ArrowRight class="w-3.5 h-3.5" />
          </RouterLink>

          <button
            type="button"
            class="text-xs text-stone-600 hover:text-stone-900 transition-colors"
            @click="router.push('/jobs')"
          >
            Start Another Search
          </button>
        </div>
      </template>
    </div>
  </AppLayout>
</template>

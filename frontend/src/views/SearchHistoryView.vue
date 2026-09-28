<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import AppLayout from '../layouts/AppLayout.vue';
import LoadingSkeleton from '../components/common/LoadingSkeleton.vue';
import EmptyState from '../components/common/EmptyState.vue';
import { useSearchExecutions } from '../composables/useSearchExecutions';
import { useJobSources } from '../composables/useJobSources';
import type { SearchExecutionRecord, SearchExecutionSource } from '../types/search-execution';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  Search,
  Filter,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  History,
  Layers,
  Compass,
  Trash2,
  AlertTriangle,
  X,
} from 'lucide-vue-next';

const router = useRouter();

const {
  executions,
  total,
  loading,
  error,
  filters,
  page,
  pageSize,
  totalPages,
  fetchExecutions,
  setFilter,
  setPage,
  deleteExecution,
  clearAllExecutions,
  formatDuration,
} = useSearchExecutions();

const { availableSources } = useJobSources();

const showClearModal = ref(false);
const clearingAll = ref(false);
const deletingId = ref<string | null>(null);
const notification = ref<{ message: string; type: 'success' | 'error' } | null>(null);

function showToast(message: string, type: 'success' | 'error' = 'success', duration = 4000) {
  notification.value = { message, type };
  setTimeout(() => {
    if (notification.value?.message === message) {
      notification.value = null;
    }
  }, duration);
}

async function handleDeleteOne(id: string, e?: Event) {
  e?.stopPropagation();
  e?.preventDefault();
  deletingId.value = id;
  try {
    const ok = await deleteExecution(id);
    if (ok) {
      showToast('Sesi riwayat scraping berhasil dihapus.');
    } else {
      showToast('Gagal menghapus sesi riwayat scraping.', 'error');
    }
  } finally {
    deletingId.value = null;
  }
}

async function handleConfirmClearAll() {
  clearingAll.value = true;
  try {
    const ok = await clearAllExecutions();
    showClearModal.value = false;
    if (ok) {
      showToast('Seluruh riwayat scraping berhasil dibersihkan.');
    } else {
      showToast('Gagal membersihkan riwayat scraping.', 'error');
    }
  } finally {
    clearingAll.value = false;
  }
}

onMounted(async () => {
  await fetchExecutions();
});

function formatSourceName(src: string): string {
  if (src.toLowerCase() === 'loker-id' || src.toLowerCase() === 'loker.id') return 'Loker.id';
  return src.charAt(0).toUpperCase() + src.slice(1);
}

function formatSourcesSummary(run: SearchExecutionRecord): string {
  if (run.sources && run.sources.length > 0) {
    return run.sources.map((s) => formatSourceName(s.source)).join(' + ');
  }
  const prefsSources = (run.preferencesSnapshot?.sources as string[] | undefined) ?? [];
  if (prefsSources.length > 0) {
    return prefsSources.map(formatSourceName).join(' + ');
  }
  return 'All configured sources';
}

function formatDateTimestamp(isoString: string): string {
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

function calculateDuration(run: SearchExecutionRecord): number {
  if (!run.startedAt) return 0;
  const start = new Date(run.startedAt).getTime();
  const finish = run.finishedAt ? new Date(run.finishedAt).getTime() : Date.now();
  return Math.max(0, Math.round((finish - start) / 1000));
}
</script>

<template>
  <AppLayout>
    <div class="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <!-- Breadcrumb & Top Bar -->
      <div class="flex items-center justify-between">
        <RouterLink
          to="/jobs"
          class="inline-flex items-center gap-1.5 text-xs text-stone-700 hover:text-stone-900 transition-colors uppercase tracking-wider font-semibold"
        >
          <ArrowLeft class="w-3.5 h-3.5" />
          Back to Jobs
        </RouterLink>

        <span v-if="total > 0" class="text-xs text-stone-600 bg-stone-100 px-2.5 py-0.5 rounded-full border border-stone-200 font-mono">
          {{ total }} total runs recorded
        </span>
      </div>

      <!-- Page Header -->
      <div class="border-b border-stone-200 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 mb-1 text-stone-600">
            <History class="w-4 h-4 text-brand-700" />
            <span class="text-xs font-mono uppercase tracking-widest font-semibold">Activity & Telemetry</span>
          </div>
          <h1 class="text-2xl font-serif text-stone-900 font-normal">
            Search History
          </h1>
          <p class="text-xs text-stone-600 mt-1 max-w-2xl">
            Review riwayat sesi scraping, inspeksi hasil temuan batch tiap sumber, dan lacak telemetri AI.
          </p>
        </div>

        <div class="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            v-if="total > 0"
            @click="showClearModal = true"
            class="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-700 bg-surface border border-surface-border rounded-lg hover:bg-stone-50 hover:text-rose-700 transition shadow-subtle"
            title="Bersihkan seluruh riwayat sesi scraping"
          >
            <Trash2 class="w-3.5 h-3.5 text-stone-400" />
            <span>Bersihkan Semua</span>
          </button>

          <RouterLink
            to="/scraper"
            class="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-stone-900 rounded-lg hover:bg-stone-800 transition shadow-subtle shrink-0"
          >
            <Compass class="w-3.5 h-3.5 text-stone-300" />
            <span>Run Scrap Baru</span>
          </RouterLink>
        </div>
      </div>

      <!-- Notification Toast Banner -->
      <div
        v-if="notification"
        class="p-3.5 rounded-xl border flex items-center justify-between gap-3 text-sm transition-all"
        :class="
          notification.type === 'success'
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
            : 'bg-rose-50/70 border-rose-200 text-rose-800'
        "
      >
        <div class="flex items-center gap-2">
          <CheckCircle2 v-if="notification.type === 'success'" class="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <AlertTriangle v-else class="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{{ notification.message }}</span>
        </div>
        <button
          type="button"
          @click="notification = null"
          class="text-stone-400 hover:text-stone-600 p-0.5 rounded transition"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Filter Controls Bar -->
      <div class="bg-white border border-stone-200 rounded-lg p-3.5 shadow-subtle flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-1.5 text-xs font-medium text-stone-700 mr-1">
          <Filter class="w-3.5 h-3.5 text-stone-500" />
          <span>Filters:</span>
        </div>

        <!-- Status Filter -->
        <select
          data-test="status-filter"
          :value="filters.status || ''"
          @change="setFilter('status', ($event.target as HTMLSelectElement).value)"
          class="text-xs bg-stone-50 border border-stone-200 rounded-md px-2.5 py-1.5 text-stone-800 focus:outline-none focus:ring-1 focus:ring-stone-400"
        >
          <option value="">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="partial">Partial</option>
          <option value="failed">Failed</option>
          <option value="running">Running</option>
        </select>

        <!-- Source Filter -->
        <select
          data-test="source-filter"
          :value="filters.source || ''"
          @change="setFilter('source', ($event.target as HTMLSelectElement).value)"
          class="text-xs bg-stone-50 border border-stone-200 rounded-md px-2.5 py-1.5 text-stone-800 focus:outline-none focus:ring-1 focus:ring-stone-400"
        >
          <option value="">All Sources</option>
          <option v-for="src in availableSources" :key="src.id" :value="src.id">
            {{ src.name }}
          </option>
        </select>

        <!-- Trigger Filter -->
        <select
          data-test="trigger-filter"
          :value="filters.trigger || ''"
          @change="setFilter('trigger', ($event.target as HTMLSelectElement).value as any)"
          class="text-xs bg-stone-50 border border-stone-200 rounded-md px-2.5 py-1.5 text-stone-800 focus:outline-none focus:ring-1 focus:ring-stone-400"
        >
          <option value="">All Triggers</option>
          <option value="manual">Manual</option>
          <option value="scheduled">Scheduled</option>
        </select>

        <!-- Date Range Filter -->
        <select
          data-test="date-filter"
          :value="filters.dateRange || 'all'"
          @change="setFilter('dateRange', ($event.target as HTMLSelectElement).value as any)"
          class="text-xs bg-stone-50 border border-stone-200 rounded-md px-2.5 py-1.5 text-stone-800 focus:outline-none focus:ring-1 focus:ring-stone-400"
        >
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </select>
      </div>

      <!-- Loading State -->
      <div v-if="loading && executions.length === 0" class="space-y-3">
        <LoadingSkeleton class="h-20 w-full" />
        <LoadingSkeleton class="h-20 w-full" />
        <LoadingSkeleton class="h-20 w-full" />
      </div>

      <!-- Empty State -->
      <div v-else-if="!loading && executions.length === 0" class="bg-white border border-stone-200 rounded-lg p-10 text-center shadow-subtle">
        <EmptyState
          title="No search runs yet"
          description="Run your first job search to start building search history."
          action-label="Search Jobs Now"
          @action="router.push('/jobs')"
        />
      </div>

      <!-- Executions List -->
      <div v-else class="space-y-3">
        <div
          v-for="run in executions"
          :key="run.id"
          class="bg-white border border-stone-200 rounded-lg p-4 hover:border-stone-300 transition-colors shadow-subtle space-y-3"
        >
          <!-- Top Row: Status, Trigger, Duration, and Detail Action -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-2.5">
            <div class="flex items-center gap-2.5 flex-wrap">
              <!-- Status Badge -->
              <span
                v-if="run.status === 'running'"
                class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200"
              >
                <Loader2 class="w-3 h-3 animate-spin text-amber-600" />
                Running
              </span>
              <span
                v-else-if="run.status === 'completed'"
                class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"
              >
                <CheckCircle2 class="w-3 h-3 text-emerald-600" />
                Completed
              </span>
              <span
                v-else-if="run.status === 'partial'"
                class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200"
              >
                <AlertCircle class="w-3 h-3 text-amber-600" />
                Partial Completion
              </span>
              <span
                v-else
                class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200"
              >
                <AlertCircle class="w-3 h-3 text-rose-600" />
                Failed
              </span>

              <!-- Trigger & Timestamp -->
              <span class="text-xs text-stone-700 font-medium">
                {{ run.trigger === 'manual' ? 'Manual' : 'Scheduled' }} · {{ formatDateTimestamp(run.startedAt) }}
              </span>

              <!-- Duration -->
              <div class="inline-flex items-center gap-1 text-xs font-mono text-stone-600 bg-stone-50 px-2 py-0.5 rounded border border-stone-200">
                <Clock class="w-3 h-3 text-stone-500" />
                <span>{{ formatDuration(calculateDuration(run)) }}</span>
              </div>
            </div>

            <!-- Detail Action Link & Delete Action -->
            <div class="flex items-center gap-3 shrink-0">
              <RouterLink
                :to="`/search-runs/${run.id}`"
                class="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900 transition-colors"
              >
                <span>{{ run.status === 'running' ? 'View Live Progress →' : 'View Run →' }}</span>
              </RouterLink>

              <button
                type="button"
                @click="handleDeleteOne(run.id, $event)"
                :disabled="deletingId === run.id"
                class="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                title="Hapus riwayat sesi ini"
              >
                <Loader2 v-if="deletingId === run.id" class="w-3.5 h-3.5 animate-spin text-stone-500" />
                <Trash2 v-else class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <!-- Middle Row: Source Breakdown & Snapshot Metadata -->
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <span class="font-medium text-stone-900">
                  {{ formatSourcesSummary(run) }}
                </span>
              </div>

              <!-- Snapshot Context Tags (locations, posting age) -->
              <div class="flex items-center gap-2 text-[11px] text-stone-500 flex-wrap">
                <span v-if="run.preferencesSnapshot?.locations && (run.preferencesSnapshot.locations as string[]).length > 0">
                  {{ (run.preferencesSnapshot.locations as string[]).join(', ') }}
                </span>
                <span v-if="run.preferencesSnapshot?.maxPostingAgeDays">
                  · Last {{ run.preferencesSnapshot.maxPostingAgeDays }} days
                </span>
              </div>
            </div>

            <!-- Stats Counters & AI Provenance -->
            <div class="flex items-center gap-4 text-xs font-mono shrink-0">
              <span class="text-stone-700">
                <strong>{{ run.summary.discovered }}</strong> found
              </span>
              <span class="text-emerald-700 font-semibold">
                +{{ run.summary.inserted }} new
              </span>
              <span class="text-stone-500">
                {{ run.summary.duplicates }} dupes
              </span>

              <!-- AI Provenance badge only when aiEvaluated > 0 -->
              <span
                v-if="run.summary.aiEvaluated > 0"
                data-test="ai-evaluated-badge"
                class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wider"
              >
                ✦ AI evaluated
              </span>
            </div>
          </div>

          <!-- Safe error message for partial/failed runs -->
          <div
            v-if="(run.status === 'partial' || run.status === 'failed') && run.errorMessage"
            class="text-[11px] text-amber-800 bg-amber-50/70 border border-amber-200 rounded p-2 font-mono"
          >
            {{ run.errorMessage }}
          </div>
        </div>
      </div>

      <!-- Pagination Controls -->
      <div v-if="totalPages > 1" class="flex items-center justify-between pt-4 border-t border-stone-200 text-xs">
        <span class="text-stone-600 font-medium">
          Page {{ page }} of {{ totalPages }} ({{ total }} runs)
        </span>

        <div class="flex items-center gap-2">
          <button
            type="button"
            data-test="prev-page-btn"
            :disabled="page <= 1 || loading"
            @click="setPage(page - 1)"
            class="px-3 py-1.5 border border-stone-200 rounded-md text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <button
            type="button"
            data-test="next-page-btn"
            :disabled="page >= totalPages || loading"
            @click="setPage(page + 1)"
            class="px-3 py-1.5 border border-stone-200 rounded-md text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <!-- Clear History Confirmation Modal -->
    <div
      v-if="showClearModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div
        class="bg-surface rounded-2xl max-w-md w-full border border-surface-border shadow-xl p-6 space-y-5 animate-in zoom-in-95 duration-150"
      >
        <div class="flex items-start gap-4">
          <div class="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center flex-shrink-0">
            <AlertTriangle class="w-5 h-5" />
          </div>
          <div class="space-y-1">
            <h3 class="text-base font-semibold text-stone-900">Bersihkan Riwayat Scraping?</h3>
            <p class="text-xs text-stone-500 leading-relaxed">
              Tindakan ini akan menghapus semua riwayat sesi scraping beserta log scraping terkait. Lowongan yang telah Anda simpan ke katalog <strong>Jobs</strong> tidak akan terpengaruh.
            </p>
          </div>
        </div>

        <div class="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            @click="showClearModal = false"
            :disabled="clearingAll"
            class="px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 rounded-lg transition"
          >
            Batal
          </button>
          <button
            type="button"
            @click="handleConfirmClearAll"
            :disabled="clearingAll"
            class="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition shadow-sm disabled:opacity-50"
          >
            <Loader2 v-if="clearingAll" class="w-3.5 h-3.5 animate-spin" />
            <span>{{ clearingAll ? 'Membersihkan...' : 'Ya, Hapus Semua' }}</span>
          </button>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

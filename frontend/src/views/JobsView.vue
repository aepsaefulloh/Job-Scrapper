<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import AppLayout from '../layouts/AppLayout.vue';
import JobFilterBar from '../components/jobs/JobFilterBar.vue';
import JobRow from '../components/jobs/JobRow.vue';
import LoadingSkeleton from '../components/common/LoadingSkeleton.vue';
import EmptyState from '../components/common/EmptyState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import { useJobs } from '../composables/useJobs';
import { useApplications } from '../composables/useApplications';
import { useMatching } from '../composables/useMatching';
import type { JobListItem } from '../types/job';
import {
  ChevronLeft,
  ChevronRight,
  Trash2,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Sparkles,
  Bookmark,
  Compass,
  X,
} from 'lucide-vue-next';

const { jobs, total, loading, error, fetchJobs, deleteJob, cleanupJobs } = useJobs();
const { savedJobIds, saveJob } = useApplications();
const { recommendations, fetchRecommendations } = useMatching();

type CurationTab = 'curated' | 'saved' | 'recommended' | 'all';
const activeTab = ref<CurationTab>('curated');

const limit = 20;
const offset = ref(0);
const activeFilters = ref({ keyword: '', company: '', source: '' });

const showCleanupModal = ref(false);
const cleaningUp = ref(false);
const notification = ref<{ message: string; type: 'success' | 'error' } | null>(null);

function showToast(message: string, type: 'success' | 'error' = 'success', duration = 4000) {
  notification.value = { message, type };
  setTimeout(() => {
    if (notification.value?.message === message) {
      notification.value = null;
    }
  }, duration);
}

async function loadJobs() {
  await fetchJobs({
    limit,
    offset: offset.value,
    ...activeFilters.value,
  });

  if (recommendations.value.length === 0) {
    try {
      await fetchRecommendations(50, 0);
    } catch {
      // Graceful fallback if matching not available
    }
  }

  if (recommendations.value.length > 0) {
    const scoreMap = new Map(recommendations.value.map((r) => [r.job_id, Math.round(r.rule_score)]));
    jobs.value = jobs.value.map((j) => ({
      ...j,
      matchScore: scoreMap.get(j.id) ?? j.matchScore,
    }));
  }
}

const savedCount = computed(() => jobs.value.filter((j) => savedJobIds.value.has(j.id)).length);
const recommendedCount = computed(() => jobs.value.filter((j) => (j.matchScore ?? 0) >= 60).length);
const curatedCount = computed(
  () => jobs.value.filter((j) => savedJobIds.value.has(j.id) || (j.matchScore !== undefined && j.matchScore >= 50)).length
);

const displayedJobs = computed(() => {
  if (activeTab.value === 'saved') {
    return jobs.value.filter((j) => savedJobIds.value.has(j.id));
  }
  if (activeTab.value === 'recommended') {
    return jobs.value.filter((j) => (j.matchScore ?? 0) >= 60);
  }
  if (activeTab.value === 'curated') {
    const filtered = jobs.value.filter(
      (j) => savedJobIds.value.has(j.id) || (j.matchScore !== undefined && j.matchScore >= 50)
    );
    // If no jobs have been curated/saved yet, show the full list so user doesn't face an empty screen
    return filtered.length > 0 ? filtered : jobs.value;
  }
  return jobs.value;
});

function handleFilter(filters: { keyword: string; company: string; source: string }) {
  activeFilters.value = filters;
  offset.value = 0;
  loadJobs();
}

function handlePageChange(direction: 'prev' | 'next') {
  if (direction === 'prev' && offset.value >= limit) {
    offset.value -= limit;
    loadJobs();
  } else if (direction === 'next' && offset.value + limit < total.value) {
    offset.value += limit;
    loadJobs();
  }
}

async function handleSaveJob(job: JobListItem) {
  await saveJob(job.id);
}

async function handleDeleteJob(job: JobListItem) {
  const ok = await deleteJob(job.id);
  if (ok) {
    showToast(`"${job.title}" berhasil dihapus.`);
  } else {
    showToast(`Gagal menghapus lowongan.`, 'error');
  }
}

async function handleConfirmCleanup() {
  cleaningUp.value = true;
  try {
    const res = await cleanupJobs();
    showCleanupModal.value = false;
    offset.value = 0;
    showToast(
      `Pembersihan selesai: ${res.deletedJobsCount} lowongan & ${res.deletedScrapeRunsCount} log dihapus (${res.preservedJobsCount} lowongan tersimpan dipertahankan).`
    );
  } catch (err: any) {
    showToast(err?.message || 'Gagal menjalankan pembersihan data.', 'error');
  } finally {
    cleaningUp.value = false;
  }
}

onMounted(() => {
  loadJobs();
});
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-stone-900">Jobs</h1>
          <p class="text-sm text-stone-500 mt-0.5">
            Discover opportunities ingested and matched to your profile.
          </p>
        </div>
        <div class="flex items-center gap-3">
          <RouterLink
            to="/scraper"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-stone-900 rounded-lg hover:bg-stone-800 transition shadow-subtle"
          >
            <Compass class="w-3.5 h-3.5 text-stone-300" />
            <span>Run Scrap</span>
          </RouterLink>

          <button
            type="button"
            @click="showCleanupModal = true"
            :disabled="total === 0"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-surface border border-surface-border rounded-lg hover:bg-stone-50 hover:text-stone-900 transition shadow-subtle disabled:opacity-50 disabled:cursor-not-allowed"
            title="Bersihkan lowongan yang belum disimpan untuk menghemat ruang Supabase"
          >
            <Trash2 class="w-3.5 h-3.5 text-stone-400" />
            <span>Bersihkan Data</span>
          </button>
          <div class="text-xs text-stone-500 font-medium">
            Showing {{ jobs.length }} of {{ total }} jobs
          </div>
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

      <!-- Filter Bar -->
      <JobFilterBar @filter="handleFilter" />

      <!-- Guidance Banner: Separation of Scraped Batches vs Curated Jobs -->
      <div class="p-3 bg-stone-50 border border-stone-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-stone-600">
        <div class="flex items-center gap-2">
          <Sparkles class="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Pemisahan Data:</strong> Halaman ini mengelola lowongan terkurasi & tersimpan. Lowongan hasil batch scraping mentah disimpan terpisah dan dapat ditinjau di riwayat sesi scraping.
          </span>
        </div>
        <RouterLink
          to="/search-runs"
          class="font-semibold text-stone-900 hover:text-stone-700 underline underline-offset-2 shrink-0 flex items-center gap-1"
        >
          Riwayat Scraping →
        </RouterLink>
      </div>

      <!-- Curation Tabs Filter Bar -->
      <div class="flex items-center gap-2 border-b border-surface-border pb-1 overflow-x-auto text-xs font-medium">
        <button
          type="button"
          @click="activeTab = 'curated'"
          class="px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
          :class="activeTab === 'curated' ? 'bg-stone-900 text-stone-50 font-semibold' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'"
        >
          <span>Semua Terkurasi</span>
          <span
            class="text-[10px] px-1.5 py-0.2 rounded-full font-mono font-semibold"
            :class="activeTab === 'curated' ? 'bg-stone-700 text-stone-200' : 'bg-stone-200 text-stone-700'"
          >
            {{ curatedCount > 0 ? curatedCount : jobs.length }}
          </span>
        </button>

        <button
          type="button"
          @click="activeTab = 'saved'"
          class="px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
          :class="activeTab === 'saved' ? 'bg-stone-900 text-stone-50 font-semibold' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'"
        >
          <span>Tersimpan (Bookmark)</span>
          <span
            class="text-[10px] px-1.5 py-0.2 rounded-full font-mono font-semibold"
            :class="activeTab === 'saved' ? 'bg-stone-700 text-stone-200' : 'bg-stone-200 text-stone-700'"
          >
            {{ savedCount }}
          </span>
        </button>

        <button
          type="button"
          @click="activeTab = 'recommended'"
          class="px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
          :class="activeTab === 'recommended' ? 'bg-stone-900 text-stone-50 font-semibold' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'"
        >
          <span>Rekomendasi AI</span>
          <span
            class="text-[10px] px-1.5 py-0.2 rounded-full font-mono font-semibold"
            :class="activeTab === 'recommended' ? 'bg-stone-700 text-stone-200' : 'bg-stone-200 text-stone-700'"
          >
            {{ recommendedCount }}
          </span>
        </button>

        <button
          type="button"
          @click="activeTab = 'all'"
          class="px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
          :class="activeTab === 'all' ? 'bg-stone-900 text-stone-50 font-semibold' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'"
        >
          <span>Semua Database</span>
          <span
            class="text-[10px] px-1.5 py-0.2 rounded-full font-mono font-semibold"
            :class="activeTab === 'all' ? 'bg-stone-700 text-stone-200' : 'bg-stone-200 text-stone-700'"
          >
            {{ total }}
          </span>
        </button>
      </div>

      <!-- Error State -->
      <ErrorState
        v-if="error"
        :message="error"
        can-retry
        @retry="loadJobs"
      />

      <!-- Loading State -->
      <LoadingSkeleton v-else-if="loading" variant="row" :count="5" />

      <!-- Empty State -->
      <EmptyState
        v-else-if="jobs.length === 0"
        title="No jobs found"
        description="Try adjusting your search keywords, company name, or source filter."
        action-text="Reset filters"
        @action="handleFilter({ keyword: '', company: '', source: '' })"
      />

      <!-- Empty State for specific tab -->
      <div
        v-else-if="displayedJobs.length === 0"
        class="p-8 text-center bg-stone-50 border border-stone-200 rounded-xl space-y-3"
      >
        <p class="text-sm font-medium text-stone-800">
          {{ activeTab === 'saved' ? 'Belum ada lowongan yang disimpan (bookmark).' : activeTab === 'recommended' ? 'Belum ada lowongan dengan rekomendasi AI di halaman ini.' : 'Belum ada lowongan terkurasi di halaman ini.' }}
        </p>
        <p class="text-xs text-stone-500 max-w-md mx-auto">
          Anda dapat meninjau semua lowongan di tab "Semua Database" atau simpan lowongan dari hasil scraping di Riwayat Scraping.
        </p>
        <button
          type="button"
          @click="activeTab = 'all'"
          class="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-stone-900 text-white hover:bg-stone-800 transition"
        >
          Lihat Semua Database
        </button>
      </div>

      <!-- Jobs List -->
      <div v-else class="space-y-3">
        <JobRow
          v-for="job in displayedJobs"
          :key="job.id"
          :job="job"
          :is-saved="savedJobIds.has(job.id)"
          @save="handleSaveJob"
          @delete="handleDeleteJob"
        />

        <!-- Pagination Controls -->
        <div class="flex items-center justify-between pt-4 border-t border-surface-border text-xs text-stone-600">
          <div>
            Showing <span class="font-semibold text-stone-900">{{ offset + 1 }}</span> to
            <span class="font-semibold text-stone-900">{{ Math.min(offset + limit, total) }}</span> of
            <span class="font-semibold text-stone-900">{{ total }}</span> results
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              :disabled="offset === 0"
              @click="handlePageChange('prev')"
              class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-surface-border bg-surface hover:bg-surface-muted disabled:opacity-40 disabled:cursor-not-allowed transition font-medium"
            >
              <ChevronLeft class="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <button
              type="button"
              :disabled="offset + limit >= total"
              @click="handlePageChange('next')"
              class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-surface-border bg-surface hover:bg-surface-muted disabled:opacity-40 disabled:cursor-not-allowed transition font-medium"
            >
              <span>Next</span>
              <ChevronRight class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Cleanup Confirmation Modal -->
    <div
      v-if="showCleanupModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div
        class="bg-surface rounded-2xl max-w-md w-full border border-surface-border shadow-xl p-6 space-y-5 animate-in zoom-in-95 duration-150"
      >
        <div class="flex items-start gap-4">
          <div class="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center flex-shrink-0">
            <AlertTriangle class="w-5 h-5" />
          </div>
          <div class="space-y-1">
            <h3 class="text-base font-semibold text-stone-900">Bersihkan Data Lowongan?</h3>
            <p class="text-xs text-stone-500 leading-relaxed">
              Tindakan ini akan menghapus lowongan yang <strong>belum disimpan ke daftar Lamaran</strong> beserta payload data mentah scraping dan riwayat log untuk menghemat kuota penyimpanan database Supabase.
            </p>
          </div>
        </div>

        <div class="bg-surface-muted/60 border border-surface-border rounded-xl p-3 text-xs text-stone-600 space-y-1.5">
          <div class="flex items-center gap-2 font-medium text-emerald-800">
            <CheckCircle2 class="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>Lowongan yang Anda simpan/lamar tetap aman.</span>
          </div>
          <div class="flex items-center gap-2 text-stone-500">
            <Trash2 class="w-4 h-4 text-stone-400 flex-shrink-0" />
            <span>Payload HTML/JSON scraper yang besar akan dibersihkan.</span>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            :disabled="cleaningUp"
            @click="showCleanupModal = false"
            class="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            :disabled="cleaningUp"
            @click="handleConfirmCleanup"
            class="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition shadow-sm disabled:opacity-60"
          >
            <Loader2 v-if="cleaningUp" class="w-3.5 h-3.5 animate-spin" />
            <Trash2 v-else class="w-3.5 h-3.5" />
            <span>{{ cleaningUp ? 'Membersihkan...' : 'Ya, Bersihkan Data' }}</span>
          </button>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

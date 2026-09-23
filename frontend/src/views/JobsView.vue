<script setup lang="ts">
import { ref, onMounted } from 'vue';
import AppLayout from '../layouts/AppLayout.vue';
import JobFilterBar from '../components/jobs/JobFilterBar.vue';
import JobRow from '../components/jobs/JobRow.vue';
import LoadingSkeleton from '../components/common/LoadingSkeleton.vue';
import EmptyState from '../components/common/EmptyState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import { useJobs } from '../composables/useJobs';
import { useApplications } from '../composables/useApplications';
import type { JobListItem } from '../types/job';
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';

const { jobs, total, loading, error, fetchJobs } = useJobs();
const { savedJobIds, saveJob } = useApplications();

const limit = 20;
const offset = ref(0);
const activeFilters = ref({ keyword: '', company: '', source: '' });

async function loadJobs() {
  await fetchJobs({
    limit,
    offset: offset.value,
    ...activeFilters.value,
  });
}

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
        <div class="text-xs text-stone-500 font-medium">
          Showing {{ jobs.length }} of {{ total }} jobs
        </div>
      </div>

      <!-- Filter Bar -->
      <JobFilterBar @filter="handleFilter" />

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

      <!-- Jobs List -->
      <div v-else class="space-y-3">
        <JobRow
          v-for="job in jobs"
          :key="job.id"
          :job="job"
          :is-saved="savedJobIds.has(job.id)"
          @save="handleSaveJob"
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
  </AppLayout>
</template>

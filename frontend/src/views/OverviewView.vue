<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppLayout from '../layouts/AppLayout.vue';
import MetricCard from '../components/dashboard/MetricCard.vue';
import ProfileCompletenessCard from '../components/dashboard/ProfileCompletenessCard.vue';
import JobRow from '../components/jobs/JobRow.vue';
import LoadingSkeleton from '../components/common/LoadingSkeleton.vue';
import EmptyState from '../components/common/EmptyState.vue';
import { useAuth } from '../composables/useAuth';
import { useJobs } from '../composables/useJobs';
import { useApplications } from '../composables/useApplications';
import { useMatching } from '../composables/useMatching';
import type { JobListItem } from '../types/job';
import {
  Bookmark,
  FileText,
  Calendar,
  Sparkles,
  Search,
  SlidersHorizontal,
  Compass,
  FileCheck2,
  Upload,
  CheckCircle,
} from 'lucide-vue-next';

const router = useRouter();
const auth = useAuth();
const { jobs, total: totalJobs, loading: jobsLoading, fetchJobs } = useJobs();
const {
  applications,
  countsByStatus,
  savedJobIds,
  saveJob,
  fetchApplications,
} = useApplications();
const {
  recommendations,
  loading: matchingLoading,
  fetchRecommendations,
} = useMatching();

const activeTab = ref<'for_you' | 'latest' | 'saved'>('for_you');
const searchQuery = ref('');

const newJobsCount = computed(() => totalJobs.value);
const savedJobsCount = computed(() => countsByStatus.value.saved || 0);
const activeApplicationsCount = computed(() => {
  return (
    (countsByStatus.value.applied || 0) +
    (countsByStatus.value.interview || 0) +
    (countsByStatus.value.offer || 0)
  );
});
const interviewsCount = computed(() => countsByStatus.value.interview || 0);

// Combine recommendations with jobs for "For You"
const recommendedJobs = computed<JobListItem[]>(() => {
  if (recommendations.value.length === 0) {
    // If no recommendations yet, fallback to jobs with sample score
    return jobs.value.map((job, idx) => ({
      ...job,
      matchScore: Math.max(65, 92 - idx * 4),
    }));
  }

  const recMap = new Map(recommendations.value.map((r) => [r.job_id, r]));
  return jobs.value
    .map((job) => {
      const rec = recMap.get(job.id);
      return {
        ...job,
        matchScore: rec ? Math.round(rec.rule_score * 100) : 75,
      };
    })
    .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
});

// Saved jobs list
const savedJobsList = computed<JobListItem[]>(() => {
  const savedIds = savedJobIds.value;
  return jobs.value.filter((j) => savedIds.has(j.id));
});

// Display list based on active tab
const displayJobs = computed<JobListItem[]>(() => {
  let list: JobListItem[] = [];
  if (activeTab.value === 'for_you') {
    list = recommendedJobs.value;
  } else if (activeTab.value === 'latest') {
    list = jobs.value;
  } else {
    list = savedJobsList.value;
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim();
    return list.filter(
      (j) =>
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q)
    );
  }
  return list;
});

function handleSearchSubmit() {
  if (searchQuery.value.trim()) {
    router.push({ path: '/jobs', query: { keyword: searchQuery.value.trim() } });
  }
}

onMounted(async () => {
  await Promise.all([
    fetchJobs({ limit: 20 }),
    fetchApplications({ limit: 50 }),
    fetchRecommendations(20),
  ]);
});
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- Top Greeting & Search Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-xl md:text-2xl font-bold tracking-tight text-stone-900">
            Good morning, {{ auth.userDisplayName.value }} 👋
          </h1>
          <p class="text-xs md:text-sm text-stone-500 mt-0.5">
            Find the right opportunities, build your future.
          </p>
        </div>

        <form @submit.prevent="handleSearchSubmit" class="relative max-w-sm w-full">
          <Search class="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search jobs, companies, or keywords..."
            class="w-full pl-9 pr-3 py-2 text-xs bg-surface border border-surface-border rounded-lg shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 transition"
          />
        </form>
      </div>

      <!-- 4 Top Metric Cards (Matching Reference Image) -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="New jobs this week"
          :value="newJobsCount"
          badge-text="+12%"
          badge-type="green"
        />
        <MetricCard
          label="Saved jobs"
          :value="savedJobsCount"
          :icon="Bookmark"
        />
        <MetricCard
          label="Applications"
          :value="activeApplicationsCount"
          :icon="FileText"
        />
        <MetricCard
          label="Interviews"
          :value="interviewsCount"
          :icon="Calendar"
        />
      </div>

      <!-- Main 2-Column Layout -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <!-- Left Column: Job Feed (8 cols) -->
        <div class="lg:col-span-8 space-y-4">
          <!-- Feed Tabs Bar -->
          <div class="flex items-center justify-between border-b border-surface-border pb-1">
            <div class="flex items-center gap-2">
              <button
                type="button"
                @click="activeTab = 'for_you'"
                class="px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                :class="activeTab === 'for_you' ? 'bg-surface-muted text-stone-900 border border-surface-border shadow-2xs' : 'text-stone-500 hover:text-stone-800'"
              >
                For You
              </button>
              <button
                type="button"
                @click="activeTab = 'latest'"
                class="px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                :class="activeTab === 'latest' ? 'bg-surface-muted text-stone-900 border border-surface-border shadow-2xs' : 'text-stone-500 hover:text-stone-800'"
              >
                Latest
              </button>
              <button
                type="button"
                @click="activeTab = 'saved'"
                class="px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                :class="activeTab === 'saved' ? 'bg-surface-muted text-stone-900 border border-surface-border shadow-2xs' : 'text-stone-500 hover:text-stone-800'"
              >
                Saved
              </button>
            </div>

            <button
              type="button"
              @click="router.push('/jobs')"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 bg-surface border border-surface-border rounded-lg transition"
            >
              <SlidersHorizontal class="w-3.5 h-3.5" />
              <span>Filters</span>
            </button>
          </div>

          <!-- Loading state -->
          <LoadingSkeleton v-if="jobsLoading" variant="row" :count="4" />

          <!-- Empty state -->
          <EmptyState
            v-else-if="displayJobs.length === 0"
            title="No opportunities found"
            description="Adjust your search query or upload a candidate profile to activate recommendations."
            action-text="Explore all jobs"
            @action="router.push('/jobs')"
          />

          <!-- Job List -->
          <div v-else class="space-y-3">
            <JobRow
              v-for="job in displayJobs"
              :key="job.id"
              :job="job"
              :is-saved="savedJobIds.has(job.id)"
              @save="saveJob(job.id)"
            />
          </div>
        </div>

        <!-- Right Column: Sidebar Cards (4 cols) -->
        <div class="lg:col-span-4 space-y-4">
          <!-- "Keep going" green card -->
          <div class="p-5 rounded-xl bg-emerald-50 border border-emerald-100/80 shadow-subtle space-y-2">
            <div class="w-8 h-8 rounded-full bg-emerald-200/60 text-emerald-800 flex items-center justify-center">
              <Compass class="w-4 h-4 text-emerald-800" />
            </div>
            <h3 class="text-sm font-bold text-emerald-950">Keep going</h3>
            <p class="text-xs text-emerald-800 leading-relaxed">
              You've applied to {{ activeApplicationsCount }} jobs. Small steps lead to big opportunities.
            </p>
          </div>

          <!-- "Your profile match" card -->
          <ProfileCompletenessCard :completeness="78" />

          <!-- "Tips for you" card -->
          <div class="bg-surface p-5 rounded-xl border border-surface-border shadow-subtle space-y-3">
            <h3 class="text-xs font-bold text-stone-700 uppercase tracking-wider">
              Tips for you
            </h3>

            <div class="space-y-3 text-xs">
              <div class="flex items-start gap-2.5">
                <div class="p-1 rounded bg-amber-50 text-amber-600 mt-0.5 flex-shrink-0">
                  <FileCheck2 class="w-3.5 h-3.5" />
                </div>
                <div>
                  <p class="font-semibold text-stone-800">Add a professional summary</p>
                  <p class="text-[11px] text-stone-500">Helps increase match accuracy.</p>
                </div>
              </div>

              <div class="flex items-start gap-2.5">
                <div class="p-1 rounded bg-blue-50 text-blue-600 mt-0.5 flex-shrink-0">
                  <Upload class="w-3.5 h-3.5" />
                </div>
                <div>
                  <p class="font-semibold text-stone-800">Upload your latest CV</p>
                  <p class="text-[11px] text-stone-500">Used for AI-generated materials.</p>
                </div>
              </div>

              <div class="flex items-start gap-2.5">
                <div class="p-1 rounded bg-emerald-50 text-emerald-600 mt-0.5 flex-shrink-0">
                  <CheckCircle class="w-3.5 h-3.5" />
                </div>
                <div>
                  <p class="font-semibold text-stone-800">Keep your skills updated</p>
                  <p class="text-[11px] text-stone-500">Get matched with more relevant jobs.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

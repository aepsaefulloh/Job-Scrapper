<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppLayout from '../layouts/AppLayout.vue';
import MatchScoreRing from '../components/common/MatchScoreRing.vue';
import SkillTag from '../components/common/SkillTag.vue';
import StatusBadge from '../components/common/StatusBadge.vue';
import LoadingSkeleton from '../components/common/LoadingSkeleton.vue';
import ErrorState from '../components/common/ErrorState.vue';
import { useJobs } from '../composables/useJobs';
import { useApplications } from '../composables/useApplications';
import {
  ArrowLeft,
  Bookmark,
  ExternalLink,
  MapPin,
  Briefcase,
  Building2,
  FileText,
  MessageSquare,
  HelpCircle,
  Sparkles,
  CheckCircle2,
} from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const jobId = String(route.params.id);

const { activeJob, detailLoading, detailError, fetchJobDetail } = useJobs();
const { applications, createApplication, saveJob, fetchApplications } = useApplications();

const activeTab = ref<'overview' | 'about' | 'requirements' | 'benefits'>('overview');
const isDescriptionExpanded = ref(false);
const isSaving = ref(false);

const existingApplication = computed(() => {
  return applications.value.find((app) => app.jobId === jobId);
});

const isSaved = computed(() => {
  return existingApplication.value?.status === 'saved';
});

const isApplied = computed(() => {
  return existingApplication.value && existingApplication.value.status !== 'saved';
});

async function handleSave() {
  isSaving.value = true;
  try {
    await saveJob(jobId);
  } finally {
    isSaving.value = false;
  }
}

async function handleApply() {
  if (existingApplication.value) {
    router.push(`/applications/${existingApplication.value.id}`);
  } else {
    isSaving.value = true;
    try {
      const app = await createApplication(jobId, 'applied');
      router.push(`/applications/${app.id}`);
    } finally {
      isSaving.value = false;
    }
  }
}

function handleStartAIAssistant(type: 'cover_letter' | 'introduction' | 'recruiter_answer') {
  if (existingApplication.value) {
    router.push({
      path: `/applications/${existingApplication.value.id}`,
      query: { tool: type },
    });
  } else {
    // create draft application first then redirect
    createApplication(jobId, 'saved').then((app) => {
      router.push({
        path: `/applications/${app.id}`,
        query: { tool: type },
      });
    });
  }
}

onMounted(async () => {
  await fetchJobDetail(jobId);
  if (applications.value.length === 0) {
    fetchApplications();
  }
});
</script>

<template>
  <AppLayout>
    <div class="space-y-6 max-w-5xl mx-auto">
      <!-- Breadcrumb -->
      <nav class="flex items-center gap-2 text-xs text-stone-500 font-medium">
        <router-link to="/jobs" class="inline-flex items-center gap-1 hover:text-stone-900 transition">
          <ArrowLeft class="w-3.5 h-3.5" />
          <span>Jobs</span>
        </router-link>
        <span>/</span>
        <span class="text-stone-900 truncate max-w-xs">{{ activeJob?.title || 'Job Detail' }}</span>
      </nav>

      <!-- Loading / Error -->
      <LoadingSkeleton v-if="detailLoading" variant="detail" />
      <ErrorState v-else-if="detailError" :message="detailError" can-retry @retry="fetchJobDetail(jobId)" />

      <!-- Job Content -->
      <div v-else-if="activeJob" class="space-y-6">
        <!-- Hero Card -->
        <div class="bg-surface rounded-xl border border-surface-border p-6 shadow-subtle space-y-6">
          <div class="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div class="flex items-start gap-4">
              <div class="w-16 h-16 rounded-2xl bg-surface-muted border border-surface-border text-emerald-800 font-bold text-xl flex items-center justify-center flex-shrink-0 shadow-xs">
                {{ activeJob.company.charAt(0).toUpperCase() }}
              </div>

              <div class="space-y-2">
                <div class="flex items-center gap-2 flex-wrap">
                  <h1 class="text-xl md:text-2xl font-bold tracking-tight text-stone-900">
                    {{ activeJob.title }}
                  </h1>
                  <StatusBadge v-if="existingApplication" :status="existingApplication.status" />
                </div>

                <div class="flex items-center gap-2 text-xs md:text-sm text-stone-500 font-medium flex-wrap">
                  <span class="text-stone-800 font-semibold">{{ activeJob.company }}</span>
                  <span>•</span>
                  <span class="flex items-center gap-1">
                    <MapPin class="w-3.5 h-3.5 text-stone-400" />
                    {{ activeJob.location || 'Location Unspecified' }}
                  </span>
                </div>

                <!-- Badges -->
                <div class="flex items-center gap-2 flex-wrap pt-1">
                  <span v-if="activeJob.employmentType" class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-muted text-stone-700 border border-surface-border">
                    {{ activeJob.employmentType }}
                  </span>
                  <span v-if="activeJob.workplaceType" class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-muted text-stone-700 border border-surface-border">
                    {{ activeJob.workplaceType }}
                  </span>
                  <span class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-muted text-stone-700 border border-surface-border uppercase text-[10px]">
                    Source: {{ activeJob.source }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Header Actions -->
            <div class="flex items-center gap-3 flex-shrink-0">
              <div v-if="activeJob.matchScore !== undefined" class="pr-2 border-r border-surface-border">
                <MatchScoreRing :score="activeJob.matchScore" :size="36" />
              </div>

              <button
                type="button"
                @click="handleSave"
                :disabled="isSaving || isSaved"
                class="p-2.5 rounded-lg border border-surface-border hover:bg-surface-muted transition text-stone-600 hover:text-stone-900 disabled:opacity-50"
                :title="isSaved ? 'Job Saved' : 'Save Job'"
              >
                <Bookmark class="w-4 h-4" :class="{ 'fill-emerald-700 text-emerald-700': isSaved }" />
              </button>

              <button
                type="button"
                @click="handleApply"
                class="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-700 hover:bg-brand-800 text-white text-xs md:text-sm font-medium rounded-lg transition shadow-xs"
              >
                <CheckCircle2 v-if="isApplied" class="w-4 h-4" />
                <span>{{ isApplied ? 'View Application' : 'Create Application' }}</span>
              </button>
            </div>
          </div>

          <!-- Editorial Tabs -->
          <div class="border-t border-surface-border pt-4">
            <div class="flex items-center gap-6 border-b border-surface-border text-sm font-medium">
              <button
                type="button"
                @click="activeTab = 'overview'"
                class="pb-3 border-b-2 transition"
                :class="activeTab === 'overview' ? 'border-brand-700 text-stone-900 font-semibold' : 'border-transparent text-stone-500 hover:text-stone-800'"
              >
                Overview
              </button>
              <button
                type="button"
                @click="activeTab = 'about'"
                class="pb-3 border-b-2 transition"
                :class="activeTab === 'about' ? 'border-brand-700 text-stone-900 font-semibold' : 'border-transparent text-stone-500 hover:text-stone-800'"
              >
                About
              </button>
              <button
                type="button"
                @click="activeTab = 'requirements'"
                class="pb-3 border-b-2 transition"
                :class="activeTab === 'requirements' ? 'border-brand-700 text-stone-900 font-semibold' : 'border-transparent text-stone-500 hover:text-stone-800'"
              >
                Requirements
              </button>
              <button
                type="button"
                @click="activeTab = 'benefits'"
                class="pb-3 border-b-2 transition"
                :class="activeTab === 'benefits' ? 'border-brand-700 text-stone-900 font-semibold' : 'border-transparent text-stone-500 hover:text-stone-800'"
              >
                Benefits
              </button>
            </div>
          </div>
        </div>

        <!-- Two Column Details Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Left 2/3: Description & Skills -->
          <div class="lg:col-span-2 space-y-6">
            <div class="bg-surface rounded-xl border border-surface-border p-6 shadow-subtle space-y-4">
              <h2 class="text-base font-semibold text-stone-900">Job Description</h2>
              <div
                class="text-sm text-stone-700 leading-relaxed whitespace-pre-line transition-all duration-200"
                :class="{ 'line-clamp-6': !isDescriptionExpanded }"
              >
                {{ activeJob.description }}
              </div>
              <button
                type="button"
                @click="isDescriptionExpanded = !isDescriptionExpanded"
                class="text-xs font-semibold text-brand-700 hover:text-brand-800 pt-1"
              >
                {{ isDescriptionExpanded ? 'Show less ▲' : 'Show more ▼' }}
              </button>
            </div>

            <!-- Required Skills -->
            <div class="bg-surface rounded-xl border border-surface-border p-6 shadow-subtle space-y-3">
              <h2 class="text-base font-semibold text-stone-900">Required Skills & Technologies</h2>
              <div class="flex items-center gap-2 flex-wrap">
                <SkillTag
                  v-for="skill in activeJob.skills"
                  :key="skill.canonicalName"
                  :name="skill.displayName"
                />
                <span v-if="activeJob.skills.length === 0" class="text-xs text-stone-500 italic">
                  No specific skill hints extracted from this job.
                </span>
              </div>
            </div>
          </div>

          <!-- Right 1/3: Company Card & Meta -->
          <div class="space-y-6">
            <div class="bg-surface rounded-xl border border-surface-border p-6 shadow-subtle space-y-4">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-semibold text-stone-900">About {{ activeJob.company }}</h3>
                <a
                  :href="activeJob.jobUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
                >
                  <span>Original Post</span>
                  <ExternalLink class="w-3 h-3" />
                </a>
              </div>

              <div class="space-y-2.5 text-xs text-stone-600 border-t border-surface-border pt-3">
                <div class="flex justify-between py-1">
                  <span class="text-stone-400">Location</span>
                  <span class="font-medium text-stone-800">{{ activeJob.location || 'Remote' }}</span>
                </div>
                <div class="flex justify-between py-1 border-t border-surface-border/50">
                  <span class="text-stone-400">Workplace</span>
                  <span class="font-medium text-stone-800">{{ activeJob.workplaceType || 'Standard' }}</span>
                </div>
                <div class="flex justify-between py-1 border-t border-surface-border/50">
                  <span class="text-stone-400">Employment</span>
                  <span class="font-medium text-stone-800">{{ activeJob.employmentType || 'Full-time' }}</span>
                </div>
                <div class="flex justify-between py-1 border-t border-surface-border/50">
                  <span class="text-stone-400">Status</span>
                  <span class="font-medium text-stone-800 capitalize">{{ activeJob.status }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- AI Assistant Action Section (Matching Reference Image) -->
        <div class="bg-surface rounded-xl border border-surface-border p-6 shadow-subtle space-y-4">
          <div class="flex items-center gap-2">
            <Sparkles class="w-5 h-5 text-emerald-700" />
            <div>
              <h2 class="text-base font-bold text-stone-900">AI Assistant</h2>
              <p class="text-xs text-stone-500">Create application materials tailored for this job.</p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <!-- Cover Letter Card -->
            <div
              @click="handleStartAIAssistant('cover_letter')"
              class="group p-4 rounded-xl border border-surface-border hover:border-emerald-600/50 hover:bg-emerald-50/20 cursor-pointer transition shadow-xs flex items-start gap-3"
            >
              <div class="p-2 rounded-lg bg-surface-muted group-hover:bg-emerald-100 text-stone-700 group-hover:text-emerald-800 transition">
                <FileText class="w-5 h-5" />
              </div>
              <div>
                <h4 class="text-sm font-semibold text-stone-900 group-hover:text-emerald-900">Cover Letter</h4>
                <p class="text-xs text-stone-500 mt-0.5">Generate a personalized cover letter</p>
              </div>
            </div>

            <!-- Introduction Card -->
            <div
              @click="handleStartAIAssistant('introduction')"
              class="group p-4 rounded-xl border border-surface-border hover:border-emerald-600/50 hover:bg-emerald-50/20 cursor-pointer transition shadow-xs flex items-start gap-3"
            >
              <div class="p-2 rounded-lg bg-surface-muted group-hover:bg-emerald-100 text-stone-700 group-hover:text-emerald-800 transition">
                <MessageSquare class="w-5 h-5" />
              </div>
              <div>
                <h4 class="text-sm font-semibold text-stone-900 group-hover:text-emerald-900">Introduction</h4>
                <p class="text-xs text-stone-500 mt-0.5">Write a short intro for recruiter</p>
              </div>
            </div>

            <!-- Answer Questions Card -->
            <div
              @click="handleStartAIAssistant('recruiter_answer')"
              class="group p-4 rounded-xl border border-surface-border hover:border-emerald-600/50 hover:bg-emerald-50/20 cursor-pointer transition shadow-xs flex items-start gap-3"
            >
              <div class="p-2 rounded-lg bg-surface-muted group-hover:bg-emerald-100 text-stone-700 group-hover:text-emerald-800 transition">
                <HelpCircle class="w-5 h-5" />
              </div>
              <div>
                <h4 class="text-sm font-semibold text-stone-900 group-hover:text-emerald-900">Answer Questions</h4>
                <p class="text-xs text-stone-500 mt-0.5">Get AI help for common questions</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

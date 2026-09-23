<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import AppLayout from '../layouts/AppLayout.vue';
import ApplicationRow from '../components/applications/ApplicationRow.vue';
import ApplicationModal from '../components/applications/ApplicationModal.vue';
import LoadingSkeleton from '../components/common/LoadingSkeleton.vue';
import EmptyState from '../components/common/EmptyState.vue';
import ErrorState from '../components/common/ErrorState.vue';
import { useApplications } from '../composables/useApplications';
import type { ApplicationStatus } from '../types/application';
import { Plus, Leaf } from 'lucide-vue-next';

const {
  applications,
  loading,
  error,
  countsByStatus,
  fetchApplications,
  updateApplication,
} = useApplications();

const activeTab = ref<string>('all');
const isAddModalOpen = ref(false);

const filteredApplications = computed(() => {
  if (activeTab.value === 'all') return applications.value;
  return applications.value.filter((app) => app.status === activeTab.value);
});

const statusTabs = computed(() => [
  { id: 'all', label: 'All', count: applications.value.length },
  { id: 'saved', label: 'Saved', count: countsByStatus.value.saved || 0 },
  { id: 'applied', label: 'Applied', count: countsByStatus.value.applied || 0 },
  { id: 'interview', label: 'Interview', count: countsByStatus.value.interview || 0 },
  { id: 'offer', label: 'Offer', count: countsByStatus.value.offer || 0 },
  { id: 'rejected', label: 'Rejected', count: countsByStatus.value.rejected || 0 },
]);

async function handleStatusUpdate(id: string, status: string) {
  await updateApplication(id, {
    status: status as ApplicationStatus,
    appliedAt: status !== 'saved' ? new Date().toISOString() : undefined,
  });
}

onMounted(() => {
  fetchApplications();
});
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-stone-900">Applications</h1>
          <p class="text-sm text-stone-500 mt-0.5">
            Track your progress and manage your job applications.
          </p>
        </div>

        <button
          type="button"
          @click="isAddModalOpen = true"
          class="inline-flex items-center gap-2 px-4 py-2.5 bg-stone-900 hover:bg-black text-white text-xs md:text-sm font-semibold rounded-lg transition shadow-sm self-start sm:self-auto"
        >
          <Plus class="w-4 h-4" />
          <span>Add Application</span>
        </button>
      </div>

      <!-- Status Filter Tabs -->
      <div class="flex items-center gap-2 overflow-x-auto pb-1 text-xs border-b border-surface-border">
        <button
          v-for="tab in statusTabs"
          :key="tab.id"
          type="button"
          @click="activeTab = tab.id"
          class="flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition whitespace-nowrap"
          :class="[
            activeTab === tab.id
              ? 'border-stone-900 text-stone-900 font-bold'
              : 'border-transparent text-stone-500 hover:text-stone-800',
          ]"
        >
          <span>{{ tab.label }}</span>
          <span
            class="px-1.5 py-0.2 rounded-full text-[10px]"
            :class="activeTab === tab.id ? 'bg-stone-200 text-stone-900' : 'bg-surface-muted text-stone-500'"
          >
            {{ tab.count }}
          </span>
        </button>
      </div>

      <!-- Content -->
      <ErrorState v-if="error" :message="error" can-retry @retry="fetchApplications()" />
      <LoadingSkeleton v-else-if="loading" variant="row" :count="4" />

      <EmptyState
        v-else-if="filteredApplications.length === 0"
        title="No applications in this category"
        description="Save opportunities from the Jobs feed or create an application to track here."
        action-text="Browse Jobs"
        @action="$router.push('/jobs')"
      />

      <div v-else class="space-y-3">
        <ApplicationRow
          v-for="app in filteredApplications"
          :key="app.id"
          :application="app"
          @update-status="handleStatusUpdate"
        />
      </div>

      <!-- Bottom Motivation Banner (Matching Reference Image) -->
      <div class="mt-8 p-4 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-center gap-3.5">
        <div class="w-9 h-9 rounded-lg bg-emerald-100/80 text-emerald-700 flex items-center justify-center flex-shrink-0">
          <Leaf class="w-5 h-5 text-emerald-800" />
        </div>
        <div class="space-y-0.5">
          <p class="text-xs font-bold text-emerald-950">Progress, not perfection.</p>
          <p class="text-[11px] text-emerald-800/80">Every application is a step forward in your career journey.</p>
        </div>
      </div>
    </div>

    <!-- Add Application Modal -->
    <ApplicationModal
      :is-open="isAddModalOpen"
      @close="isAddModalOpen = false"
      @created="fetchApplications()"
    />
  </AppLayout>
</template>

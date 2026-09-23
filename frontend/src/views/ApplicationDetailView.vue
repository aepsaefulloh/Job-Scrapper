<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppLayout from '../layouts/AppLayout.vue';
import MaterialGenerator from '../components/materials/MaterialGenerator.vue';
import MaterialCard from '../components/materials/MaterialCard.vue';
import StatusBadge from '../components/common/StatusBadge.vue';
import LoadingSkeleton from '../components/common/LoadingSkeleton.vue';
import ErrorState from '../components/common/ErrorState.vue';
import { useApplications } from '../composables/useApplications';
import type { ApplicationStatus, MaterialType } from '../types/application';
import { ArrowLeft, ExternalLink, Calendar, Save, Check } from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const applicationId = String(route.params.id);

const {
  activeApplication,
  detailLoading,
  detailError,
  fetchApplicationDetail,
  updateApplication,
} = useApplications();

const notesText = ref('');
const isUpdating = ref(false);
const hasSavedNotes = ref(false);
const initialTool = ref<MaterialType>(
  (route.query.tool as MaterialType) || 'cover_letter'
);

async function loadDetail() {
  const app = await fetchApplicationDetail(applicationId);
  if (app) {
    notesText.value = app.notes || '';
  }
}

async function handleStatusChange(newStatus: string) {
  await updateApplication(applicationId, {
    status: newStatus as ApplicationStatus,
    appliedAt: newStatus !== 'saved' ? new Date().toISOString() : undefined,
  });
}

async function handleSaveNotes() {
  isUpdating.value = true;
  hasSavedNotes.value = false;
  try {
    await updateApplication(applicationId, {
      notes: notesText.value,
    });
    hasSavedNotes.value = true;
    setTimeout(() => (hasSavedNotes.value = false), 2000);
  } finally {
    isUpdating.value = false;
  }
}

onMounted(() => {
  loadDetail();
});
</script>

<template>
  <AppLayout>
    <div class="space-y-6 max-w-5xl mx-auto">
      <!-- Breadcrumb -->
      <nav class="flex items-center gap-2 text-xs text-stone-500 font-medium">
        <router-link to="/applications" class="inline-flex items-center gap-1 hover:text-stone-900 transition">
          <ArrowLeft class="w-3.5 h-3.5" />
          <span>Applications</span>
        </router-link>
        <span>/</span>
        <span class="text-stone-900 truncate max-w-xs">{{ activeApplication?.jobTitle || 'Application Detail' }}</span>
      </nav>

      <LoadingSkeleton v-if="detailLoading" variant="detail" />
      <ErrorState v-else-if="detailError" :message="detailError" can-retry @retry="loadDetail" />

      <div v-else-if="activeApplication" class="space-y-6">
        <!-- Application Summary Header Card -->
        <div class="bg-surface rounded-xl border border-surface-border p-6 shadow-subtle space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h1 class="text-xl md:text-2xl font-bold tracking-tight text-stone-900">
                  {{ activeApplication.jobTitle }}
                </h1>
                <StatusBadge :status="activeApplication.status" />
              </div>

              <div class="flex items-center gap-2 text-xs md:text-sm text-stone-500 font-medium mt-1">
                <span class="text-stone-800 font-semibold">{{ activeApplication.companyName }}</span>
                <span>•</span>
                <span>{{ activeApplication.location || 'Remote' }}</span>
                <span>•</span>
                <router-link
                  :to="`/jobs/${activeApplication.jobId}`"
                  class="text-brand-700 hover:underline inline-flex items-center gap-1 font-semibold"
                >
                  <span>View Original Job</span>
                  <ExternalLink class="w-3 h-3" />
                </router-link>
              </div>
            </div>

            <!-- Status Changer -->
            <div class="flex items-center gap-2">
              <label class="text-xs font-semibold text-stone-600">Status:</label>
              <select
                :value="activeApplication.status"
                @change="handleStatusChange(($event.target as HTMLSelectElement).value)"
                class="text-xs font-semibold bg-surface-muted border border-surface-border rounded-lg px-3 py-1.5 text-stone-800 focus:outline-none cursor-pointer"
              >
                <option value="saved">Saved</option>
                <option value="applied">Applied</option>
                <option value="interview">Interview</option>
                <option value="offer">Offer</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          <!-- Notes Field -->
          <div class="pt-3 border-t border-surface-border space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-xs font-bold text-stone-700 uppercase tracking-wider">
                Application Notes & Log
              </label>
              <button
                type="button"
                @click="handleSaveNotes"
                :disabled="isUpdating"
                class="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800 transition"
              >
                <Check v-if="hasSavedNotes" class="w-3.5 h-3.5 text-emerald-600" />
                <Save v-else class="w-3.5 h-3.5" />
                <span>{{ hasSavedNotes ? 'Saved' : isUpdating ? 'Saving...' : 'Save Notes' }}</span>
              </button>
            </div>
            <textarea
              v-model="notesText"
              rows="2"
              placeholder="Record recruiter contacts, interview dates, or application notes..."
              class="w-full p-2.5 text-xs bg-surface-muted/40 border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 font-sans"
            ></textarea>
          </div>
        </div>

        <!-- AI Assistant Generator Section -->
        <MaterialGenerator
          :application-id="activeApplication.id"
          :job-title="activeApplication.jobTitle"
          :company-name="activeApplication.companyName"
          :initial-tool="initialTool"
          @material-created="loadDetail"
        />

        <!-- Historical Generated Materials -->
        <div v-if="activeApplication.materials && activeApplication.materials.length > 0" class="space-y-4 pt-4">
          <h3 class="text-sm font-bold text-stone-900 uppercase tracking-wider">
            Material History ({{ activeApplication.materials.length }})
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MaterialCard
              v-for="mat in activeApplication.materials"
              :key="mat.id"
              :material="mat"
            />
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

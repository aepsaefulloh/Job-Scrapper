<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useJobs } from '../../composables/useJobs';
import type { ApplicationStatus } from '../../types/application';
import { X, Loader2 } from 'lucide-vue-next';

defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'created'): void;
}>();

const { jobs, fetchJobs } = useJobs();

const selectedJobId = ref('');
const status = ref<ApplicationStatus>('applied');
const notes = ref('');
const isSubmitting = ref(false);
const errorMsg = ref('');

onMounted(async () => {
  await fetchJobs({ limit: 50 });
});

import { useApplications } from '../../composables/useApplications';
const { createApplication } = useApplications();

async function handleSubmit() {
  if (!selectedJobId.value) {
    errorMsg.value = 'Please select a job opportunity.';
    return;
  }
  isSubmitting.value = true;
  errorMsg.value = '';

  try {
    await createApplication(
      selectedJobId.value,
      status.value,
      notes.value || undefined,
      status.value !== 'saved' ? new Date().toISOString() : undefined
    );
    selectedJobId.value = '';
    notes.value = '';
    emit('created');
    emit('close');
  } catch (err: any) {
    errorMsg.value = err?.message || 'Failed to create application.';
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
  >
    <div class="bg-surface w-full max-w-lg rounded-xl border border-surface-border shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-surface-border">
        <h3 class="text-base font-bold text-stone-900">Add New Application</h3>
        <button
          type="button"
          @click="$emit('close')"
          class="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-surface-muted transition"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Form -->
      <form @submit.prevent="handleSubmit" class="p-6 space-y-4">
        <div v-if="errorMsg" class="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
          {{ errorMsg }}
        </div>

        <div>
          <label class="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
            Job Position
          </label>
          <select
            v-model="selectedJobId"
            required
            class="w-full px-3 py-2 text-sm bg-surface-muted/50 border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
          >
            <option value="" disabled>Select an ingested job...</option>
            <option v-for="job in jobs" :key="job.id" :value="job.id">
              {{ job.title }} ({{ job.company }})
            </option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
            Application Status
          </label>
          <select
            v-model="status"
            class="w-full px-3 py-2 text-sm bg-surface-muted/50 border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
          >
            <option value="saved">Saved</option>
            <option value="applied">Applied</option>
            <option value="interview">Interview</option>
            <option value="offer">Offer</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
            Notes (Optional)
          </label>
          <textarea
            v-model="notes"
            rows="3"
            placeholder="Add referral notes, job post details, or reminders..."
            class="w-full px-3 py-2 text-sm bg-surface-muted/50 border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
          ></textarea>
        </div>

        <!-- Buttons -->
        <div class="flex items-center justify-end gap-3 pt-3 border-t border-surface-border">
          <button
            type="button"
            @click="$emit('close')"
            class="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-surface-muted rounded-lg transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="isSubmitting"
            class="inline-flex items-center gap-2 px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50"
          >
            <Loader2 v-if="isSubmitting" class="w-3.5 h-3.5 animate-spin" />
            <span>Save Application</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

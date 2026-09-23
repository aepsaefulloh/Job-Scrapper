<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import type { ApplicationListItem } from '../../types/application';
import StatusBadge from '../common/StatusBadge.vue';
import { MapPin, Calendar, MoreVertical } from 'lucide-vue-next';

const props = defineProps<{
  application: ApplicationListItem;
}>();

const emit = defineEmits<{
  (e: 'update-status', id: string, status: string): void;
}>();

const router = useRouter();

function navigateToDetail() {
  router.push(`/applications/${props.application.id}`);
}

const companyInitial = computed(() => {
  return props.application.companyName
    ? props.application.companyName.charAt(0).toUpperCase()
    : 'A';
});

const formattedDate = computed(() => {
  if (!props.application.appliedAt) return '—';
  const d = new Date(props.application.appliedAt);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
});
</script>

<template>
  <div
    class="bg-surface hover:bg-surface-muted/30 p-4 rounded-xl border border-surface-border transition shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4"
  >
    <!-- Left: Company Logo, Job Title, Company & Location -->
    <div class="flex items-center gap-3.5 min-w-0 flex-1">
      <div
        class="w-10 h-10 rounded-xl bg-surface-muted border border-surface-border text-emerald-800 font-bold text-sm flex items-center justify-center flex-shrink-0"
      >
        {{ companyInitial }}
      </div>

      <div class="space-y-0.5 min-w-0 flex-1">
        <h4
          @click="navigateToDetail"
          class="text-sm font-semibold text-stone-900 hover:text-emerald-800 cursor-pointer transition truncate"
        >
          {{ application.jobTitle }}
        </h4>
        <div class="flex items-center gap-1.5 text-xs text-stone-500 font-medium truncate">
          <span class="text-stone-700">{{ application.companyName }}</span>
          <span>•</span>
          <span class="flex items-center gap-1">
            <MapPin class="w-3 h-3 text-stone-400" />
            {{ application.location || 'Remote' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Center: Status Badge -->
    <div class="flex items-center gap-3 sm:gap-6 flex-shrink-0">
      <div class="w-24 flex justify-start">
        <StatusBadge :status="application.status" />
      </div>

      <!-- Applied Date -->
      <div class="text-xs text-stone-500 font-medium min-w-[90px] hidden md:block">
        {{ formattedDate }}
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-2">
        <button
          type="button"
          @click="navigateToDetail"
          class="px-3 py-1.5 rounded-lg border border-surface-border text-xs font-semibold text-stone-700 bg-white hover:bg-surface-muted transition shadow-xs"
        >
          View
        </button>

        <!-- Status quick changer -->
        <select
          :value="application.status"
          @change="$emit('update-status', application.id, ($event.target as HTMLSelectElement).value)"
          class="text-xs bg-surface-muted border border-surface-border rounded-lg px-2 py-1 text-stone-700 focus:outline-none cursor-pointer"
        >
          <option value="saved">Saved</option>
          <option value="applied">Applied</option>
          <option value="interview">Interview</option>
          <option value="offer">Offer</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { Bookmark, Building2, MapPin } from 'lucide-vue-next';
import type { JobListItem } from '../../types/job';
import MatchScoreRing from '../common/MatchScoreRing.vue';
import SkillTag from '../common/SkillTag.vue';
import StatusBadge from '../common/StatusBadge.vue';

const props = defineProps<{
  job: JobListItem;
  isSaved?: boolean;
}>();

const emit = defineEmits<{
  (e: 'save', job: JobListItem): void;
}>();

const router = useRouter();

function navigateToDetail() {
  router.push(`/jobs/${props.job.id}`);
}

const companyInitial = computed(() => {
  return props.job.company ? props.job.company.charAt(0).toUpperCase() : 'J';
});

const formattedTime = computed(() => {
  if (!props.job.publishedAt) return null;
  const date = new Date(props.job.publishedAt);
  if (isNaN(date.getTime())) return null;
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 3600 * 24));
  if (diffDays <= 0) return 'Posted today';
  if (diffDays === 1) return 'Posted 1d ago';
  if (diffDays < 7) return `Posted ${diffDays}d ago`;
  if (diffDays < 30) return `Posted ${Math.floor(diffDays / 7)}w ago`;
  return `Posted ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
});
</script>

<template>
  <div
    @click="navigateToDetail"
    class="group bg-surface hover:bg-surface-muted/30 p-4 md:p-5 rounded-xl border border-surface-border transition-all duration-150 shadow-subtle hover:shadow-card cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
  >
    <!-- Left: Logo & Job Details -->
    <div class="flex items-start gap-3.5 min-w-0 flex-1">
      <div class="w-11 h-11 rounded-xl bg-surface-muted border border-surface-border text-stone-700 flex items-center justify-center font-bold text-sm flex-shrink-0 group-hover:border-stone-300 transition-colors">
        {{ companyInitial }}
      </div>

      <div class="space-y-1.5 min-w-0 flex-1">
        <div class="flex items-center gap-2 flex-wrap">
          <h3 class="text-sm font-semibold text-stone-900 group-hover:text-emerald-800 transition-colors truncate">
            {{ job.title }}
          </h3>
          <StatusBadge v-if="job.applicationStatus" :status="job.applicationStatus" size="sm" />
        </div>

        <div class="flex items-center gap-2 text-xs text-stone-500 font-medium truncate">
          <span class="text-stone-700 font-medium">{{ job.company }}</span>
          <span>•</span>
          <span class="flex items-center gap-1">
            <MapPin class="w-3 h-3 text-stone-400" />
            {{ job.location || 'Remote / Unspecified' }}
          </span>
          <span>•</span>
          <span class="text-stone-400 uppercase text-[10px]">{{ job.source }}</span>
        </div>

        <!-- Skills / Pills -->
        <div class="flex items-center gap-1.5 flex-wrap pt-1">
          <SkillTag
            v-for="skill in (job.skills || []).slice(0, 4)"
            :key="skill.canonicalName"
            :name="skill.displayName"
          />
          <span
            v-if="(job.skills || []).length > 4"
            class="text-[10px] text-stone-400 font-medium"
          >
            +{{ (job.skills || []).length - 4 }} more
          </span>
        </div>
      </div>
    </div>

    <!-- Right: Time, Save button, Match score -->
    <div class="flex items-center sm:flex-col sm:items-end justify-between sm:justify-center gap-3 flex-shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-surface-border/50">
      <div class="flex items-center gap-2">
        <span class="text-[11px] text-stone-400 font-medium">{{ formattedTime ?? 'Date unknown' }}</span>
        <button
          type="button"
          @click.stop="emit('save', job)"
          :title="isSaved ? 'Saved' : 'Save job'"
          class="p-1.5 rounded-lg border border-transparent hover:border-surface-border hover:bg-surface-muted transition text-stone-400 hover:text-stone-700"
          :class="{ 'text-emerald-700': isSaved }"
        >
          <Bookmark class="w-4 h-4" :class="{ 'fill-emerald-700': isSaved }" />
        </button>
      </div>

      <div v-if="job.matchScore !== undefined">
        <MatchScoreRing :score="job.matchScore" :size="30" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { Search, MapPin, Briefcase, Monitor, Tag, ShieldOff, Database } from 'lucide-vue-next';
import { useSearchProfile } from '../../composables/useSearchProfile';
import LoadingSkeleton from '../common/LoadingSkeleton.vue';
import SkillTag from '../common/SkillTag.vue';

const { searchProfile, loading, error, fetchSearchProfile } = useSearchProfile();

onMounted(() => {
  fetchSearchProfile();
});
</script>

<template>
  <div class="bg-surface rounded-xl border border-surface-border p-6 shadow-subtle space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-sm font-bold text-stone-900 flex items-center gap-2">
          <Search class="w-4 h-4 text-brand-700" />
          Active Job Search Profile
        </h3>
        <p class="text-xs text-stone-500 mt-0.5">What the agent is searching for on your behalf.</p>
      </div>
      <span v-if="searchProfile" class="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200">Active</span>
    </div>

    <LoadingSkeleton v-if="loading" />

    <div v-else-if="!searchProfile && !error" class="text-xs text-stone-500 py-2">
      No search profile generated yet. Upload a candidate profile to activate automated job discovery.
    </div>

    <div v-else-if="error" class="text-xs text-rose-600 py-2">{{ error }}</div>

    <div v-else-if="searchProfile" class="space-y-4">
      <div v-if="searchProfile.targetRoles.length > 0">
        <p class="text-[10px] font-semibold text-stone-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
          <Briefcase class="w-3 h-3" /> Target Roles
        </p>
        <div class="flex flex-wrap gap-1.5">
          <span v-for="role in searchProfile.targetRoles" :key="role"
            class="px-2 py-0.5 rounded-md bg-brand-50 border border-brand-200 text-[11px] font-semibold text-brand-800">
            {{ role }}
          </span>
        </div>
      </div>

      <div v-if="searchProfile.roleAliases.length > 0">
        <p class="text-[10px] font-semibold text-stone-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
          <Tag class="w-3 h-3" /> Search Terms
        </p>
        <div class="flex flex-wrap gap-1.5">
          <SkillTag v-for="alias in searchProfile.roleAliases" :key="alias" :name="alias" />
        </div>
      </div>

      <div v-if="searchProfile.preferredLocations.length > 0">
        <p class="text-[10px] font-semibold text-stone-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
          <MapPin class="w-3 h-3" /> Preferred Locations
        </p>
        <div class="flex flex-wrap gap-1.5">
          <SkillTag v-for="loc in searchProfile.preferredLocations" :key="loc" :name="loc" />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div v-if="searchProfile.workModes.length > 0">
          <p class="text-[10px] font-semibold text-stone-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
            <Monitor class="w-3 h-3" /> Work Mode
          </p>
          <div class="flex flex-wrap gap-1.5">
            <SkillTag v-for="mode in searchProfile.workModes" :key="mode" :name="mode" />
          </div>
        </div>
        <div v-if="searchProfile.employmentTypes.length > 0">
          <p class="text-[10px] font-semibold text-stone-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
            <Briefcase class="w-3 h-3" /> Employment
          </p>
          <div class="flex flex-wrap gap-1.5">
            <SkillTag v-for="type in searchProfile.employmentTypes" :key="type" :name="type" />
          </div>
        </div>
      </div>

      <div v-if="searchProfile.sources.length > 0">
        <p class="text-[10px] font-semibold text-stone-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
          <Database class="w-3 h-3" /> Active Sources
        </p>
        <div class="flex flex-wrap gap-1.5">
          <SkillTag v-for="src in searchProfile.sources" :key="src" :name="src" />
        </div>
      </div>

      <div v-if="searchProfile.excludedRoles.length > 0 || searchProfile.excludedKeywords.length > 0 || searchProfile.excludedCompanies.length > 0">
        <p class="text-[10px] font-semibold text-stone-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
          <ShieldOff class="w-3 h-3" /> Excluded
        </p>
        <div class="flex flex-wrap gap-1.5">
          <span v-for="item in [...searchProfile.excludedRoles, ...searchProfile.excludedKeywords, ...searchProfile.excludedCompanies]" :key="item"
            class="px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-[11px] text-rose-700">
            {{ item }}
          </span>
        </div>
      </div>

      <p class="text-[10px] text-stone-400 border-t border-surface-border pt-3">
        Generated {{ new Date(searchProfile.generatedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) }}
      </p>
    </div>
  </div>
</template>

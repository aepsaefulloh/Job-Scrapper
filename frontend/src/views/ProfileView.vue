<script setup lang="ts">
import { ref, onMounted } from 'vue';
import AppLayout from '../layouts/AppLayout.vue';
import ProfileUploader from '../components/profile/ProfileUploader.vue';
import ProfileEditModal from '../components/profile/ProfileEditModal.vue';
import SearchProfileCard from '../components/profile/SearchProfileCard.vue';
import SkillTag from '../components/common/SkillTag.vue';
import LoadingSkeleton from '../components/common/LoadingSkeleton.vue';
import ErrorState from '../components/common/ErrorState.vue';
import { useProfile } from '../composables/useProfile';
import { User, Briefcase, Award, Compass, Calendar, Pencil } from 'lucide-vue-next';

const { profile, loading, error, fetchProfile } = useProfile();
const isEditModalOpen = ref(false);

onMounted(() => {
  fetchProfile();
});
</script>

<template>
  <AppLayout>
    <div class="space-y-6 max-w-5xl mx-auto">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-stone-900">Candidate Profile</h1>
          <p class="text-sm text-stone-500 mt-0.5">
            Your human-maintained career profile is the primary source of truth.
          </p>
        </div>
        <button
          v-if="profile"
          id="openEditProfileBtn"
          type="button"
          @click="isEditModalOpen = true"
          class="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-surface-border bg-surface text-stone-800 hover:bg-stone-50 text-xs font-semibold shadow-subtle transition-colors cursor-pointer"
        >
          <Pencil class="w-3.5 h-3.5 text-stone-600" />
          Edit Profile
        </button>
      </div>

      <!-- Markdown Uploader -->
      <ProfileUploader @uploaded="fetchProfile" />

      <!-- Search Profile Card -->
      <SearchProfileCard />

      <!-- Loading / Error states -->
      <LoadingSkeleton v-if="loading" variant="detail" />
      <ErrorState v-else-if="error" :message="error" can-retry @retry="fetchProfile" />

      <!-- Empty Profile State -->
      <div
        v-else-if="!profile"
        class="p-8 text-center bg-surface rounded-xl border border-surface-border space-y-3"
      >
        <div class="w-12 h-12 rounded-full bg-surface-muted mx-auto flex items-center justify-center text-stone-400">
          <User class="w-6 h-6" />
        </div>
        <h3 class="text-sm font-bold text-stone-900">No Active Profile Found</h3>
        <p class="text-xs text-stone-500 max-w-sm mx-auto">
          Upload your candidate.md profile above to populate your career summary, experience, and verified skills.
        </p>
      </div>

      <!-- Profile View Content -->
      <div v-else class="space-y-6">
        <!-- Main Info Card -->
        <div class="bg-surface rounded-xl border border-surface-border p-6 shadow-subtle space-y-4">
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 rounded-2xl bg-emerald-800 text-white font-bold text-xl flex items-center justify-center border border-emerald-600/40">
              {{ profile.displayName.charAt(0) }}
            </div>
            <div>
              <h2 class="text-xl font-bold text-stone-900">{{ profile.displayName }}</h2>
              <p class="text-xs text-stone-500 font-medium">{{ profile.headline || 'Full Stack Engineer' }}</p>
              <p class="text-[10px] text-stone-400 mt-1 flex items-center gap-1">
                <Calendar class="w-3 h-3" />
                Last updated {{ new Date(profile.updatedAt).toLocaleDateString() }}
              </p>
            </div>
          </div>

          <div v-if="profile.summary" class="pt-3 border-t border-surface-border text-xs text-stone-700 leading-relaxed whitespace-pre-line">
            <h4 class="text-xs font-bold text-stone-900 uppercase tracking-wider mb-1">Professional Summary</h4>
            <p>{{ profile.summary }}</p>
          </div>
        </div>

        <!-- Skills Section -->
        <div class="bg-surface rounded-xl border border-surface-border p-6 shadow-subtle space-y-4">
          <div class="flex items-center gap-2">
            <Award class="w-4 h-4 text-emerald-700" />
            <h3 class="text-sm font-bold text-stone-900">Verified Skills ({{ profile.skills.length }})</h3>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <SkillTag
              v-for="skill in profile.skills"
              :key="skill.canonicalName"
              :name="skill.displayName"
              variant="matched"
            />
          </div>
        </div>

        <!-- Experience & Preferences Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Experience -->
          <div class="bg-surface rounded-xl border border-surface-border p-6 shadow-subtle space-y-3">
            <div class="flex items-center gap-2">
              <Briefcase class="w-4 h-4 text-stone-700" />
              <h3 class="text-sm font-bold text-stone-900">Work Experience</h3>
            </div>
            <div class="text-xs text-stone-700 leading-relaxed whitespace-pre-line max-h-60 overflow-y-auto">
              {{ profile.experience || 'No experience details specified in profile document.' }}
            </div>
          </div>

          <!-- Preferences -->
          <div class="bg-surface rounded-xl border border-surface-border p-6 shadow-subtle space-y-3">
            <div class="flex items-center gap-2">
              <Compass class="w-4 h-4 text-stone-700" />
              <h3 class="text-sm font-bold text-stone-900">Career Preferences</h3>
            </div>
            <div class="text-xs text-stone-700 leading-relaxed whitespace-pre-line max-h-60 overflow-y-auto">
              {{ profile.careerPreferences || 'No career preferences specified in profile document.' }}
            </div>
          </div>
        </div>
      </div>

      <!-- Edit Profile Modal -->
      <ProfileEditModal
        v-if="isEditModalOpen && profile"
        :profile="profile"
        @close="isEditModalOpen = false"
        @saved="fetchProfile"
      />
    </div>
  </AppLayout>
</template>

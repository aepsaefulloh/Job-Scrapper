<script setup lang="ts">
import { ref } from 'vue';
import type { CandidateProfile, UpdateProfilePayload } from '../../types/profile';
import { useProfile } from '../../composables/useProfile';
import { useSearchProfile } from '../../composables/useSearchProfile';
import {
  X,
  User,
  FileText,
  Award,
  Briefcase,
  Loader2,
  AlertCircle,
} from 'lucide-vue-next';

const props = defineProps<{
  profile: CandidateProfile;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'saved', updated: CandidateProfile): void;
}>();

const { updateProfile, saving, saveError } = useProfile();
const { fetchSearchProfile } = useSearchProfile();

type TabId = 'general' | 'summary' | 'skills' | 'experience';
const activeTab = ref<TabId>('general');

// Form state
const displayName = ref(props.profile.displayName);
const targetRoles = ref(splitStoredTargetRoles(props.profile.headline));
const newTargetRoleInput = ref('');
const summary = ref(props.profile.summary ?? '');
const experience = ref(props.profile.experience ?? '');
const careerPreferences = ref(props.profile.careerPreferences ?? '');
const skills = ref<string[]>(props.profile.skills.map((s) => s.displayName));

// New skill input
const newSkillInput = ref('');
const localValidation = ref<string | null>(null);

function addSkill() {
  for (const value of newSkillInput.value.split(',')) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const canonical = trimmed.toLowerCase();
    const exists = skills.value.some((skill) => skill.toLowerCase() === canonical);
    if (!exists) {
      skills.value.push(trimmed);
    }
  }
  newSkillInput.value = '';
}

function handleSkillKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault();
    addSkill();
  }
}

function splitStoredTargetRoles(headline: string | null): string[] {
  if (!headline) return [];
  return headline
    .split(/[,/|;•·]/)
    .map((role) => role.trim())
    .filter((role, index, roles) => role.length > 0 && roles.findIndex((item) => item.toLowerCase() === role.toLowerCase()) === index);
}

function addTargetRole() {
  for (const value of newTargetRoleInput.value.split(',')) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const exists = targetRoles.value.some((role) => role.toLowerCase() === trimmed.toLowerCase());
    if (!exists) targetRoles.value.push(trimmed);
  }
  newTargetRoleInput.value = '';
}

function handleTargetRoleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault();
    addTargetRole();
  }
}

function removeTargetRole(index: number) {
  targetRoles.value.splice(index, 1);
}

function removeSkill(index: number) {
  skills.value.splice(index, 1);
}

const tabs: { id: TabId; label: string; icon: any }[] = [
  { id: 'general', label: 'General', icon: User },
  { id: 'summary', label: 'Summary', icon: FileText },
  { id: 'skills', label: 'Skills', icon: Award },
  { id: 'experience', label: 'Experience & Preferences', icon: Briefcase },
];

async function handleSave() {
  localValidation.value = null;
  const trimmedName = displayName.value.trim();
  if (!trimmedName) {
    localValidation.value = 'Display Name cannot be empty.';
    activeTab.value = 'general';
    return;
  }

  const payload: UpdateProfilePayload = {
    displayName: trimmedName,
    headline: targetRoles.value.join(', ') || null,
    summary: summary.value.trim() || null,
    experience: experience.value.trim() || null,
    careerPreferences: careerPreferences.value.trim() || null,
    skills: skills.value,
  };

  try {
    const updated = await updateProfile(payload);
    await fetchSearchProfile().catch(() => undefined);
    emit('saved', updated);
    emit('close');
  } catch {
    // Handled by saveError
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
    <div
      class="bg-surface rounded-2xl border border-surface-border shadow-elevated w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-150"
    >
      <!-- Modal Header -->
      <div class="px-6 py-4 border-b border-surface-border flex items-center justify-between">
        <div>
          <h2 class="text-base font-bold text-stone-900">Edit Candidate Profile</h2>
          <p class="text-xs text-stone-500 mt-0.5">
            Fine-tune parsed details, headline, skills, and background.
          </p>
        </div>
        <button
          type="button"
          @click="emit('close')"
          class="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Navigation Tabs -->
      <div class="flex items-center gap-1 px-6 border-b border-surface-border bg-stone-50/50 overflow-x-auto">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          @click="activeTab = tab.id"
          :class="[
            'flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap',
            activeTab === tab.id
              ? 'border-emerald-700 text-emerald-900 bg-white shadow-subtle'
              : 'border-transparent text-stone-500 hover:text-stone-800',
          ]"
        >
          <component :is="tab.icon" class="w-3.5 h-3.5" />
          {{ tab.label }}
          <span
            v-if="tab.id === 'skills'"
            class="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-stone-200 text-stone-700 font-bold"
          >
            {{ skills.length }}
          </span>
        </button>
      </div>

      <!-- Body Form -->
      <div class="p-6 overflow-y-auto space-y-5 flex-1">
        <!-- Error Alerts -->
        <div
          v-if="localValidation || saveError"
          class="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2"
        >
          <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
          <span>{{ localValidation || saveError }}</span>
        </div>

        <!-- Tab 1: General -->
        <div v-show="activeTab === 'general'" class="space-y-4">
          <div>
            <label for="displayName" class="block text-xs font-bold text-stone-900 mb-1">
              Full Name <span class="text-red-500">*</span>
            </label>
            <input
              id="displayName"
              v-model="displayName"
              type="text"
              maxlength="120"
              class="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              placeholder="e.g. Ada Lovelace"
            />
          </div>

          <div>
            <label for="newTargetRole" class="block text-xs font-bold text-stone-900 mb-1">
              Target Roles ({{ targetRoles.length }})
            </label>
            <div
              class="flex min-h-24 flex-wrap items-center gap-2 rounded-lg border border-stone-300 bg-stone-50/50 p-3 transition-colors focus-within:border-emerald-700 focus-within:ring-2 focus-within:ring-emerald-700/20"
            >
              <span
                v-for="(role, idx) in targetRoles"
                :key="role"
                class="target-role-tag inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-800"
              >
                {{ role }}
                <button
                  type="button"
                  :aria-label="`Remove ${role}`"
                  @click="removeTargetRole(idx)"
                  class="rounded-sm text-stone-500 hover:text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/40"
                >
                  <X class="w-3 h-3" />
                </button>
              </span>
              <input
                id="newTargetRole"
                v-model="newTargetRoleInput"
                type="text"
                @keydown="handleTargetRoleKeydown"
                @blur="addTargetRole"
                class="min-w-48 flex-1 bg-transparent px-1 py-1.5 text-sm text-stone-800 outline-none placeholder:text-stone-400"
                placeholder="Add a target role"
              />
              <span v-if="targetRoles.length === 0" class="text-xs italic text-stone-400">
                Add the positions you want to search for.
              </span>
            </div>
            <p class="mt-2 text-[11px] text-stone-500">
              Type a role, then press Enter or comma to add it. These roles guide your job search.
            </p>
          </div>
        </div>

        <!-- Tab 2: Summary -->
        <div v-show="activeTab === 'summary'" class="space-y-4">
          <div>
            <label for="summary" class="block text-xs font-bold text-stone-900 mb-1">
              Professional Summary
            </label>
            <textarea
              id="summary"
              v-model="summary"
              rows="8"
              class="w-full px-3 py-2 text-xs text-stone-800 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 leading-relaxed font-sans"
              placeholder="Summarize your career highlights, strengths, and primary domain focus..."
            ></textarea>
            <p class="text-[11px] text-stone-400 mt-1">
              Feeds directly into your AI matching vector embeddings and cover letter generators.
            </p>
          </div>
        </div>

        <!-- Tab 3: Skills -->
        <div v-show="activeTab === 'skills'" class="space-y-4">
          <div>
            <label for="newSkill" class="block text-xs font-bold text-stone-900 mb-1">
              Verified Skills ({{ skills.length }})
            </label>
            <div
              class="flex min-h-24 flex-wrap items-center gap-2 rounded-lg border border-stone-300 bg-stone-50/50 p-3 transition-colors focus-within:border-emerald-700 focus-within:ring-2 focus-within:ring-emerald-700/20"
            >
              <span
                v-for="(skill, idx) in skills"
                :key="skill"
                class="skill-chip inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-900"
              >
                {{ skill }}
                <button
                  type="button"
                  :aria-label="`Remove ${skill}`"
                  @click="removeSkill(idx)"
                  class="skill-chip-remove rounded-sm text-emerald-800 hover:text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-700/40"
                >
                  <X class="w-3 h-3" />
                </button>
              </span>
              <input
                id="newSkill"
                v-model="newSkillInput"
                type="text"
                @keydown="handleSkillKeydown"
                @blur="addSkill"
                class="min-w-40 flex-1 bg-transparent px-1 py-1.5 text-xs text-stone-800 outline-none placeholder:text-stone-400"
                placeholder="Add a skill"
              />
              <span v-if="skills.length === 0" class="text-xs italic text-stone-400">
                Add core technical or professional competencies.
              </span>
            </div>
            <p class="mt-2 text-[11px] text-stone-500">
              Type a skill, then press Enter or comma to add it. Click × on a tag to remove it.
            </p>
          </div>
        </div>

        <!-- Tab 4: Experience & Preferences -->
        <div v-show="activeTab === 'experience'" class="space-y-4">
          <div>
            <label for="experience" class="block text-xs font-bold text-stone-900 mb-1">
              Work Experience
            </label>
            <textarea
              id="experience"
              v-model="experience"
              rows="6"
              class="w-full px-3 py-2 text-xs text-stone-800 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 leading-relaxed font-sans"
              placeholder="Detail your roles, companies, dates, and achievements..."
            ></textarea>
          </div>

          <div>
            <label for="careerPreferences" class="block text-xs font-bold text-stone-900 mb-1">
              Career Preferences
            </label>
            <textarea
              id="careerPreferences"
              v-model="careerPreferences"
              rows="4"
              class="w-full px-3 py-2 text-xs text-stone-800 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 leading-relaxed font-sans"
              placeholder="e.g. Remote work, minimum salary expectations, preferred industries..."
            ></textarea>
          </div>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="px-6 py-4 border-t border-surface-border bg-stone-50/50 flex items-center justify-end gap-3">
        <button
          id="cancelBtn"
          type="button"
          @click="emit('close')"
          :disabled="saving"
          class="px-4 py-2 text-xs font-bold text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          id="saveBtn"
          type="button"
          @click="handleSave"
          :disabled="saving"
          class="px-4 py-2 bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-subtle cursor-pointer"
        >
          <Loader2 v-if="saving" class="w-3.5 h-3.5 animate-spin" />
          <span>{{ saving ? 'Saving Changes...' : 'Save Changes' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

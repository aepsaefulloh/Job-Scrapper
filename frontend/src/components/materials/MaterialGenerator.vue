<script setup lang="ts">
import { ref, computed } from 'vue';
import { useApplications } from '../../composables/useApplications';
import type { MaterialType } from '../../types/application';
import {
  Sparkles,
  Copy,
  Check,
  Info,
  Lightbulb,
  Loader2,
  FileText,
  MessageSquare,
  HelpCircle,
} from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{
    applicationId: string;
    jobTitle: string;
    companyName: string;
    initialTool?: MaterialType;
  }>(),
  {
    initialTool: 'cover_letter',
  }
);

const emit = defineEmits<{
  (e: 'material-created'): void;
}>();

const {
  generateCoverLetter,
  generateIntroduction,
  generateRecruiterAnswer,
} = useApplications();

const currentTool = ref<MaterialType>(props.initialTool);
const selectedTone = ref<string>('Professional');
const focusInput = ref<string>('');
const questionInput = ref<string>('');

const generatedDraft = ref<string>('');
const isGenerating = ref<boolean>(false);
const errorMsg = ref<string>('');
const hasCopied = ref<boolean>(false);

const tones = [
  { id: 'Professional', label: 'Professional' },
  { id: 'Conversational', label: 'Conversational' },
  { id: 'Enthusiastic', label: 'Enthusiastic' },
  { id: 'Concise', label: 'Concise' },
];

const titleText = computed(() => {
  switch (currentTool.value) {
    case 'cover_letter':
      return 'Create your cover letter';
    case 'introduction':
      return 'Create recruiter introduction';
    case 'recruiter_answer':
      return 'Answer recruiter questions';
  }
});

const subtitleText = computed(() => {
  switch (currentTool.value) {
    case 'cover_letter':
      return 'Generate a personalized cover letter based on your profile and the job description.';
    case 'introduction':
      return 'Draft a concise, high-impact intro message tailored for LinkedIn or email.';
    case 'recruiter_answer':
      return 'Craft thoughtful, candidate-aligned responses to common recruiter questions.';
  }
});

async function handleGenerate() {
  isGenerating.value = true;
  errorMsg.value = '';
  hasCopied.value = false;

  try {
    if (currentTool.value === 'cover_letter') {
      const res = await generateCoverLetter(props.applicationId, {
        tone: selectedTone.value.toLowerCase(),
        customInstructions: focusInput.value || undefined,
      });
      generatedDraft.value = res.content;
    } else if (currentTool.value === 'introduction') {
      const res = await generateIntroduction(props.applicationId, {
        tone: selectedTone.value.toLowerCase(),
        customInstructions: focusInput.value || undefined,
      });
      generatedDraft.value = res.content;
    } else {
      if (!questionInput.value.trim()) {
        errorMsg.value = 'Please provide the recruiter question to answer.';
        isGenerating.value = false;
        return;
      }
      const res = await generateRecruiterAnswer(props.applicationId, {
        question: questionInput.value.trim(),
        context: focusInput.value || undefined,
      });
      generatedDraft.value = res.content;
    }

    emit('material-created');
  } catch (err: any) {
    errorMsg.value = err?.message || 'Failed to generate material. Please check that candidate profile has skills.';
  } finally {
    isGenerating.value = false;
  }
}

async function copyToClipboard() {
  if (!generatedDraft.value) return;
  try {
    await navigator.clipboard.writeText(generatedDraft.value);
    hasCopied.value = true;
    setTimeout(() => {
      hasCopied.value = false;
    }, 2000);
  } catch {
    // Fallback if clipboard api denied
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header info -->
    <div>
      <h2 class="text-xl md:text-2xl font-bold tracking-tight text-stone-900">
        {{ titleText }}
      </h2>
      <p class="text-sm text-stone-500 mt-1">
        {{ subtitleText }}
      </p>
    </div>

    <!-- Material Type Tabs -->
    <div class="inline-flex items-center gap-1.5 p-1 bg-surface-muted border border-surface-border rounded-xl">
      <button
        type="button"
        @click="currentTool = 'cover_letter'"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
        :class="currentTool === 'cover_letter' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-800'"
      >
        <FileText class="w-3.5 h-3.5" />
        <span>Cover Letter</span>
      </button>
      <button
        type="button"
        @click="currentTool = 'introduction'"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
        :class="currentTool === 'introduction' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-800'"
      >
        <MessageSquare class="w-3.5 h-3.5" />
        <span>Introduction</span>
      </button>
      <button
        type="button"
        @click="currentTool = 'recruiter_answer'"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
        :class="currentTool === 'recruiter_answer' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-800'"
      >
        <HelpCircle class="w-3.5 h-3.5" />
        <span>Answer Questions</span>
      </button>
    </div>

    <!-- Two-Panel Grid (Matching Reference Image) -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- Left Panel: Form Controls (5 cols) -->
      <form @submit.prevent="handleGenerate" class="lg:col-span-5 space-y-5 bg-surface p-6 rounded-xl border border-surface-border shadow-subtle">
        <!-- Tone Selector -->
        <div>
          <label class="block text-xs font-bold text-stone-800 uppercase tracking-wider mb-2">
            Tone
          </label>
          <div class="space-y-2">
            <label
              v-for="tone in tones"
              :key="tone.id"
              class="flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition select-none"
              :class="[
                selectedTone === tone.id
                  ? 'border-stone-900 bg-surface-muted/60'
                  : 'border-surface-border hover:bg-surface-muted/30',
              ]"
            >
              <input
                type="radio"
                name="tone"
                :value="tone.id"
                v-model="selectedTone"
                class="hidden"
              />
              <div
                class="w-4 h-4 rounded-full border flex items-center justify-center transition-colors"
                :class="selectedTone === tone.id ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300'"
              >
                <div v-if="selectedTone === tone.id" class="w-1.5 h-1.5 rounded-full bg-white"></div>
              </div>
              <span class="text-xs font-medium text-stone-800">{{ tone.label }}</span>
            </label>
          </div>
        </div>

        <!-- Recruiter Question (only for recruiter answer) -->
        <div v-if="currentTool === 'recruiter_answer'">
          <label class="block text-xs font-bold text-stone-800 uppercase tracking-wider mb-1">
            Recruiter Question
          </label>
          <textarea
            v-model="questionInput"
            required
            rows="3"
            placeholder="e.g. Why are you interested in this role? or Tell me about a time you handled a difficult project."
            class="w-full p-3 text-xs bg-surface-muted/50 border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
          ></textarea>
        </div>

        <!-- Focus (Optional) -->
        <div>
          <label class="block text-xs font-bold text-stone-800 uppercase tracking-wider mb-1">
            Focus (Optional)
          </label>
          <textarea
            v-model="focusInput"
            rows="3"
            placeholder="e.g. frontend experience, leadership, specific skills you want highlighted..."
            class="w-full p-3 text-xs bg-surface-muted/50 border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
          ></textarea>
        </div>

        <!-- Error alert -->
        <div v-if="errorMsg" class="p-3 rounded-lg text-xs bg-rose-50 text-rose-700 border border-rose-200">
          {{ errorMsg }}
        </div>

        <!-- Generate Button -->
        <button
          type="submit"
          :disabled="isGenerating"
          class="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-lg transition shadow-sm disabled:opacity-50"
        >
          <Loader2 v-if="isGenerating" class="w-4 h-4 animate-spin" />
          <Sparkles v-else class="w-4 h-4 text-emerald-400" />
          <span>{{ isGenerating ? 'Generating with AI...' : 'Generate with AI' }}</span>
        </button>

        <!-- Tip Box -->
        <div class="p-3 rounded-lg bg-surface-muted border border-surface-border/80 flex items-start gap-2.5">
          <Lightbulb class="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p class="text-[11px] text-stone-600 leading-normal">
            <span class="font-semibold text-stone-900">Tip:</span> You can always edit or refine the generated result directly in the editor before using it.
          </p>
        </div>
      </form>

      <!-- Right Panel: Output & Editor (7 cols) -->
      <div class="lg:col-span-7 bg-surface rounded-xl border border-surface-border p-6 shadow-subtle space-y-4 min-h-[460px] flex flex-col justify-between">
        <div class="space-y-3 flex-1 flex flex-col">
          <div class="flex items-center justify-between pb-3 border-b border-surface-border">
            <h3 class="text-sm font-bold text-stone-900">
              {{ generatedDraft ? 'Generated ' + (currentTool === 'cover_letter' ? 'Cover Letter' : currentTool === 'introduction' ? 'Introduction' : 'Response') : 'Material Preview' }}
            </h3>

            <button
              v-if="generatedDraft"
              type="button"
              @click="copyToClipboard"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-border bg-white hover:bg-surface-muted text-xs font-semibold text-stone-700 transition shadow-xs"
            >
              <Check v-if="hasCopied" class="w-3.5 h-3.5 text-emerald-600" />
              <Copy v-else class="w-3.5 h-3.5 text-stone-500" />
              <span>{{ hasCopied ? 'Copied!' : 'Copy' }}</span>
            </button>
          </div>

          <!-- Empty State before generation -->
          <div
            v-if="!generatedDraft && !isGenerating"
            class="flex-1 flex flex-col items-center justify-center text-center p-8 text-stone-400 space-y-2"
          >
            <div class="w-12 h-12 rounded-full bg-surface-muted flex items-center justify-center text-stone-400">
              <Sparkles class="w-6 h-6 text-stone-400" />
            </div>
            <p class="text-xs font-semibold text-stone-700">Ready to draft your material</p>
            <p class="text-[11px] text-stone-400 max-w-xs">
              Select your preferred tone and click "Generate with AI" to generate customized material tailored to {{ companyName }}.
            </p>
          </div>

          <!-- Loading state -->
          <div
            v-else-if="isGenerating"
            class="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3"
          >
            <Loader2 class="w-7 h-7 text-emerald-700 animate-spin" />
            <p class="text-xs font-semibold text-stone-800">Synthesizing candidate profile with job requirements...</p>
            <p class="text-[11px] text-stone-400">SumoPod AI is crafting your tailored draft.</p>
          </div>

          <!-- Editable draft textarea -->
          <div v-else class="flex-1 flex flex-col">
            <textarea
              v-model="generatedDraft"
              rows="14"
              class="w-full flex-1 p-3 text-xs leading-relaxed text-stone-800 bg-surface-muted/30 border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 font-sans resize-y"
            ></textarea>
          </div>
        </div>

        <!-- Disclaimer Footer (Matching Reference Image) -->
        <div class="pt-3 border-t border-surface-border flex items-center gap-2 text-[11px] text-stone-400">
          <Info class="w-3.5 h-3.5 flex-shrink-0" />
          <span>This is an AI-generated draft. Please review and personalize before sending.</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import MatchScoreRing from '../common/MatchScoreRing.vue';
import { ArrowRight } from 'lucide-vue-next';

defineProps<{
  completeness: number; // 0..100
}>();

const router = useRouter();
</script>

<template>
  <div class="bg-surface p-5 rounded-xl border border-surface-border shadow-subtle space-y-4 text-center">
    <h3 class="text-xs font-bold text-stone-700 uppercase tracking-wider text-left">
      Your profile match
    </h3>

    <div class="py-2">
      <MatchScoreRing :score="completeness" :size="72" variant="donut" />
    </div>

    <div>
      <p class="text-xs font-bold text-stone-900">Profile completeness</p>
      <p class="text-[11px] text-stone-500 mt-0.5">
        A stronger profile gets better matches.
      </p>
    </div>

    <button
      type="button"
      @click="router.push('/profile')"
      class="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-stone-900 hover:bg-black text-white text-xs font-semibold rounded-lg transition"
    >
      <span>Edit profile</span>
      <ArrowRight class="w-3.5 h-3.5" />
    </button>
  </div>
</template>

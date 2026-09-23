<script setup lang="ts">
import { ref } from 'vue';
import type { ApplicationMaterial } from '../../types/application';
import { Copy, Check, FileText, MessageSquare, HelpCircle } from 'lucide-vue-next';

const props = defineProps<{
  material: ApplicationMaterial;
}>();

const hasCopied = ref(false);

async function copyText() {
  await navigator.clipboard.writeText(props.material.content);
  hasCopied.value = true;
  setTimeout(() => (hasCopied.value = false), 2000);
}
</script>

<template>
  <div class="bg-surface p-4 rounded-xl border border-surface-border shadow-subtle space-y-3">
    <div class="flex items-center justify-between pb-2 border-b border-surface-border">
      <div class="flex items-center gap-2">
        <div class="p-1 rounded bg-surface-muted text-stone-600">
          <FileText v-if="material.type === 'cover_letter'" class="w-3.5 h-3.5" />
          <MessageSquare v-else-if="material.type === 'introduction'" class="w-3.5 h-3.5" />
          <HelpCircle v-else class="w-3.5 h-3.5" />
        </div>
        <span class="text-xs font-semibold text-stone-900 capitalize">
          {{ material.type.replace('_', ' ') }}
        </span>
      </div>

      <div class="flex items-center gap-2">
        <span class="text-[10px] text-stone-400">
          {{ new Date(material.createdAt).toLocaleDateString() }}
        </span>
        <button
          type="button"
          @click="copyText"
          class="p-1 rounded text-stone-400 hover:text-stone-700 hover:bg-surface-muted transition"
          title="Copy content"
        >
          <Check v-if="hasCopied" class="w-3.5 h-3.5 text-emerald-600" />
          <Copy v-else class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <div class="text-xs text-stone-700 whitespace-pre-line leading-relaxed max-h-48 overflow-y-auto">
      {{ material.content }}
    </div>
  </div>
</template>

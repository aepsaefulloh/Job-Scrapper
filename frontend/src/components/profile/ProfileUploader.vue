<script setup lang="ts">
import { ref } from 'vue';
import { useProfile } from '../../composables/useProfile';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-vue-next';

const emit = defineEmits<{
  (e: 'uploaded'): void;
}>();

const { uploading, uploadResult, uploadError, uploadMarkdownDocument } = useProfile();

const isDragging = ref(false);
const selectedFile = ref<File | null>(null);
const localError = ref('');
const fileInput = ref<HTMLInputElement | null>(null);

function triggerFileInput() {
  fileInput.value?.click();
}

function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    processFile(target.files[0]);
  }
}

function handleDrop(e: DragEvent) {
  isDragging.value = false;
  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    processFile(e.dataTransfer.files[0]);
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function processFile(file: File) {
  localError.value = '';
  uploadError.value = null;
  if (!file.name.toLowerCase().endsWith('.md')) {
    localError.value = 'Silakan pilih berkas dokumen Markdown (.md).';
    return;
  }
  if (file.size === 0) {
    localError.value = 'Berkas terdeteksi kosong (0 B). Hal ini terjadi jika berkas di-drag langsung dari sidebar VS Code/IDE karena izin keamanan browser. Silakan drag dari Windows File Explorer biasa atau gunakan "Click to browse".';
    return;
  }
  selectedFile.value = file;
}

async function handleUpload() {
  if (!selectedFile.value) return;
  localError.value = '';

  try {
    let text = '';
    try {
      text = await selectedFile.value.text();
    } catch {
      localError.value = 'Berkas tidak dapat dibaca oleh browser. Silakan gunakan tombol "Click to browse" dan pilih berkas langsung dari File Explorer.';
      return;
    }

    if (!text.trim()) {
      localError.value = 'Isi berkas Markdown kosong (0 B). Silakan pilih berkas yang memiliki teks profil.';
      return;
    }

    const safeFile = new File([text], selectedFile.value.name, { type: 'text/markdown' });
    await uploadMarkdownDocument(safeFile);
    selectedFile.value = null;
    emit('uploaded');
  } catch (err: any) {
    // uploadError in composable captures this
  }
}

</script>

<template>
  <div class="bg-surface rounded-xl border border-surface-border p-6 shadow-subtle space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-sm font-bold text-stone-900">Upload Markdown Profile</h3>
        <p class="text-xs text-stone-500 mt-0.5">
          Upload your human-maintained CV/profile Markdown document.
        </p>
      </div>
      <span class="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
        Markdown (.md)
      </span>
    </div>

    <!-- Drop Zone -->
    <div
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="handleDrop"
      class="border-2 border-dashed rounded-xl p-6 text-center transition cursor-pointer"
      :class="[
        isDragging
          ? 'border-brand-700 bg-brand-50/20'
          : 'border-surface-border hover:border-stone-400 bg-surface-muted/30',
      ]"
      @click="triggerFileInput"
    >

      <input
        ref="fileInput"
        type="file"
        accept=".md"
        class="hidden"
        @change="handleFileSelect"
      />

      <div class="flex flex-col items-center justify-center space-y-2 pointer-events-none select-none">
        <div class="w-10 h-10 rounded-full bg-surface-muted flex items-center justify-center text-stone-500">
          <UploadCloud class="w-5 h-5 text-stone-600" />
        </div>

        <div class="space-y-0.5">
          <p class="text-xs font-semibold text-stone-800">
            <span class="text-brand-700 hover:underline">Click to browse</span> or drag & drop candidate.md
          </p>
          <p class="text-[10px] text-stone-400">Maximum file size: 1 MB</p>
        </div>
      </div>
    </div>

    <!-- Selected File & Action -->
    <div v-if="selectedFile" class="p-3 bg-surface-muted rounded-lg flex items-center justify-between text-xs">
      <div class="flex items-center gap-2 truncate">
        <FileText class="w-4 h-4 text-emerald-700 flex-shrink-0" />
        <span class="font-semibold text-stone-800 truncate">{{ selectedFile.name }}</span>
        <span class="text-[10px] text-stone-400">({{ formatFileSize(selectedFile.size) }})</span>
      </div>


      <button
        type="button"
        @click="handleUpload"
        :disabled="uploading"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-700 hover:bg-brand-800 text-white rounded-lg font-semibold transition disabled:opacity-50"
      >
        <Loader2 v-if="uploading" class="w-3.5 h-3.5 animate-spin" />
        <span>{{ uploading ? 'Uploading...' : 'Process Profile' }}</span>
      </button>
    </div>

    <!-- Alerts -->
    <div v-if="localError || uploadError" class="p-3 rounded-lg text-xs bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2">
      <AlertCircle class="w-4 h-4 flex-shrink-0 mt-0.5" />
      <span>{{ localError || uploadError }}</span>
    </div>

    <div v-if="uploadResult" class="p-3 rounded-lg text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-2">
      <CheckCircle2 class="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-600" />
      <div>
        <p class="font-bold">Profile revision created successfully!</p>
        <p class="text-[11px] text-emerald-700 mt-0.5">
          Extracted {{ uploadResult.skillCount }} skills. Checksum: {{ uploadResult.checksum ? uploadResult.checksum.substring(0, 12) + '...' : 'Saved' }}
        </p>
      </div>
    </div>
  </div>
</template>

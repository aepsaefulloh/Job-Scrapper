<script setup lang="ts">
import { useRouter, RouterLink } from 'vue-router';
import AppLayout from '../layouts/AppLayout.vue';
import SearchControlCard from '../components/jobs/SearchControlCard.vue';
import {
  History,
  Briefcase,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-vue-next';

const router = useRouter();

function handleSearchCompleted() {
  // Option to redirect to history or let user inspect results
}
</script>

<template>
  <AppLayout>
    <div class="max-w-5xl mx-auto space-y-6 py-2">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-border pb-5">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-stone-900">Run Scrap</h1>
          <p class="text-sm text-stone-500 mt-1">
            Konfigurasi dan jalankan scraping lowongan dari berbagai portal kerja.
          </p>
        </div>

        <div class="flex items-center gap-3">
          <RouterLink
            to="/search-runs"
            class="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-surface border border-surface-border text-stone-700 hover:bg-stone-50 hover:text-stone-900 transition shadow-subtle"
          >
            <History class="w-4 h-4 text-stone-500" />
            <span>Riwayat & Hasil Scraping</span>
          </RouterLink>

          <RouterLink
            to="/jobs"
            class="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-stone-900 text-stone-50 hover:bg-stone-800 transition shadow-subtle"
          >
            <Briefcase class="w-4 h-4 text-stone-300" />
            <span>Katalog Jobs</span>
          </RouterLink>
        </div>
      </div>

      <!-- Main Scraper Launcher & Controls -->
      <SearchControlCard @search-completed="handleSearchCompleted" />

      <!-- Information & Workflow Flowchart -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div class="p-4 rounded-xl border border-surface-border bg-surface space-y-2">
          <div class="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center font-bold text-xs">
            1
          </div>
          <h3 class="text-xs font-semibold text-stone-900">Pilih Target & Jalankan</h3>
          <p class="text-[11px] text-stone-500 leading-relaxed">
            Pilih portal sumber (Jobstreet / Loker.id), lokasi target, dan batas waktu sebelum menjalankan scraping deterministik (0 LLM).
          </p>
        </div>

        <div class="p-4 rounded-xl border border-surface-border bg-surface space-y-2">
          <div class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center font-bold text-xs">
            2
          </div>
          <h3 class="text-xs font-semibold text-stone-900">Tinjau Temuan di Riwayat</h3>
          <p class="text-[11px] text-stone-500 leading-relaxed">
            Lihat hasil temuan batch scraping dan skor kesesuaian AI di halaman <RouterLink to="/search-runs" class="text-indigo-600 underline font-medium">Riwayat Scraping</RouterLink>.
          </p>
        </div>

        <div class="p-4 rounded-xl border border-surface-border bg-surface space-y-2">
          <div class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold text-xs">
            3
          </div>
          <h3 class="text-xs font-semibold text-stone-900">Simpan ke Katalog Jobs</h3>
          <p class="text-[11px] text-stone-500 leading-relaxed">
            Bookmark lowongan dari sesi scraping untuk memasukkannya ke katalog terkurasi di halaman <RouterLink to="/jobs" class="text-emerald-700 underline font-medium">Jobs</RouterLink>.
          </p>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

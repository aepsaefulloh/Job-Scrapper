<script setup lang="ts">
import { ref } from 'vue';
import Sidebar from '../components/navigation/Sidebar.vue';
import { Menu, X } from 'lucide-vue-next';

const isMobileMenuOpen = ref(false);

function toggleMobileMenu() {
  isMobileMenuOpen.value = !isMobileMenuOpen.value;
}
</script>

<template>
  <div class="min-h-screen bg-canvas flex">
    <!-- Desktop Persistent Sidebar -->
    <div class="hidden md:block fixed inset-y-0 left-0 z-30">
      <Sidebar />
    </div>

    <!-- Mobile Drawer Overlay -->
    <div
      v-if="isMobileMenuOpen"
      class="fixed inset-0 z-40 bg-black/60 md:hidden backdrop-blur-xs transition-opacity"
      @click="isMobileMenuOpen = false"
    ></div>

    <!-- Mobile Drawer -->
    <div
      class="fixed inset-y-0 left-0 z-50 transform md:hidden transition-transform duration-200 ease-in-out"
      :class="isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="relative">
        <button
          type="button"
          @click="isMobileMenuOpen = false"
          class="absolute top-4 right-[-44px] p-2 bg-sidebar text-white rounded-r-lg border-y border-r border-sidebar-border"
        >
          <X class="w-5 h-5" />
        </button>
        <Sidebar @click="isMobileMenuOpen = false" />
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="flex-1 md:pl-64 flex flex-col min-w-0">
      <!-- Mobile Top Bar with Hamburger -->
      <header class="md:hidden flex items-center justify-between px-4 py-3 bg-surface border-b border-surface-border sticky top-0 z-20">
        <button
          type="button"
          @click="toggleMobileMenu"
          class="p-1.5 rounded-lg text-stone-600 hover:bg-surface-muted"
        >
          <Menu class="w-6 h-6" />
        </button>
        <span class="font-bold text-stone-900 tracking-tight">JobToolkit</span>
        <div class="w-6"></div>
      </header>

      <!-- Page Content View -->
      <main class="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        <slot />
      </main>
    </div>
  </div>
</template>

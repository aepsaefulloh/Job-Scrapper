<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  User,
  Settings,
  LogOut,
  Hexagon,
  History,
  Compass,
} from 'lucide-vue-next';
import { useAuth } from '../../composables/useAuth';

const route = useRoute();
const router = useRouter();
const auth = useAuth();

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Jobs', path: '/jobs', icon: Briefcase },
  { name: 'Run Scrap', path: '/scraper', icon: Compass },
  { name: 'History Scraping', path: '/search-runs', icon: History },
  { name: 'Applications', path: '/applications', icon: FileText },
  { name: 'Profile', path: '/profile', icon: User },
];

function isActive(path: string) {
  if (path === '/') return route.path === '/';
  return route.path.startsWith(path);
}

const userInitial = computed(() => {
  return auth.userDisplayName.value.charAt(0).toUpperCase();
});

async function handleLogout() {
  await auth.signOut();
  router.push('/login');
}
</script>

<template>
  <aside class="w-64 bg-sidebar flex flex-col justify-between h-screen text-sidebar-text border-r border-sidebar-border select-none">
    <!-- Top Brand & Nav -->
    <div class="p-4 space-y-6">
      <!-- Brand Logo -->
      <div class="flex items-center gap-2.5 px-3 py-2">
        <div class="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
          <Hexagon class="w-5 h-5 fill-emerald-500/20 text-emerald-400" />
        </div>
        <span class="text-base font-bold text-white tracking-tight">JobToolkit</span>
      </div>

      <!-- Navigation Links -->
      <nav class="space-y-1">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
          :class="[
            isActive(item.path)
              ? 'bg-sidebar-active text-white shadow-sm'
              : 'text-sidebar-text hover:bg-sidebar-hover hover:text-white',
          ]"
        >
          <component :is="item.icon" class="w-4 h-4 flex-shrink-0" />
          <span>{{ item.name }}</span>
        </router-link>
      </nav>
    </div>

    <!-- Bottom Settings & Profile -->
    <div class="p-4 border-t border-sidebar-border space-y-2">
      <router-link
        to="/settings"
        class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-sidebar-text hover:bg-sidebar-hover hover:text-white"
        :class="{ 'bg-sidebar-active text-white': route.path === '/settings' }"
      >
        <Settings class="w-4 h-4" />
        <span>Settings</span>
      </router-link>

      <!-- User row -->
      <div class="pt-2 flex items-center justify-between px-3 py-2 rounded-lg bg-sidebar-hover/40 border border-sidebar-border/40">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-8 h-8 rounded-full bg-emerald-800 text-white font-semibold text-xs flex items-center justify-center flex-shrink-0 border border-emerald-600/40">
            {{ userInitial }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-xs font-semibold text-white truncate">
              {{ auth.userDisplayName.value }}
            </p>
            <p class="text-[10px] text-stone-400 truncate">Candidate</p>
          </div>
        </div>

        <button
          type="button"
          @click="handleLogout"
          title="Sign out"
          class="text-stone-400 hover:text-rose-400 transition p-1.5 rounded"
        >
          <LogOut class="w-4 h-4" />
        </button>
      </div>
    </div>
  </aside>
</template>

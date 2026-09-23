<script setup lang="ts">
import AppLayout from '../layouts/AppLayout.vue';
import { useAuth } from '../composables/useAuth';
import { Settings, Shield, Server, Cpu, Database } from 'lucide-vue-next';

const auth = useAuth();
</script>

<template>
  <AppLayout>
    <div class="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-stone-900">Settings</h1>
        <p class="text-sm text-stone-500 mt-0.5">
          System configuration and connection statuses.
        </p>
      </div>

      <!-- Account Settings -->
      <div class="bg-surface rounded-xl border border-surface-border p-6 shadow-subtle space-y-4">
        <div class="flex items-center gap-2">
          <Shield class="w-4 h-4 text-emerald-700" />
          <h3 class="text-sm font-bold text-stone-900">Authenticated Session</h3>
        </div>

        <div class="space-y-2 text-xs text-stone-700">
          <div class="flex justify-between py-1.5 border-b border-surface-border/60">
            <span class="text-stone-400">User Email</span>
            <span class="font-medium text-stone-900">{{ auth.user.value?.email || 'N/A' }}</span>
          </div>
          <div class="flex justify-between py-1.5 border-b border-surface-border/60">
            <span class="text-stone-400">Candidate ID</span>
            <span class="font-mono text-stone-900">{{ auth.user.value?.id || 'N/A' }}</span>
          </div>
          <div class="flex justify-between py-1.5">
            <span class="text-stone-400">Session Status</span>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Active Supabase JWT
            </span>
          </div>
        </div>
      </div>

      <!-- System Connectivity -->
      <div class="bg-surface rounded-xl border border-surface-border p-6 shadow-subtle space-y-4">
        <div class="flex items-center gap-2">
          <Server class="w-4 h-4 text-emerald-700" />
          <h3 class="text-sm font-bold text-stone-900">Backend Services</h3>
        </div>

        <div class="space-y-3 text-xs">
          <div class="flex items-center justify-between p-3 rounded-lg bg-surface-muted/50 border border-surface-border">
            <div class="flex items-center gap-2.5">
              <Cpu class="w-4 h-4 text-stone-600" />
              <div>
                <p class="font-semibold text-stone-900">AI Provider (SumoPod AI)</p>
                <p class="text-[10px] text-stone-500">Embedding: text-embedding-3-small | Chat: glm-5.3-flash</p>
              </div>
            </div>
            <span class="text-emerald-700 font-semibold text-[11px]">Connected</span>
          </div>

          <div class="flex items-center justify-between p-3 rounded-lg bg-surface-muted/50 border border-surface-border">
            <div class="flex items-center gap-2.5">
              <Database class="w-4 h-4 text-stone-600" />
              <div>
                <p class="font-semibold text-stone-900">Supabase PostgreSQL</p>
                <p class="text-[10px] text-stone-500">pgvector, RLS row-level security enabled</p>
              </div>
            </div>
            <span class="text-emerald-700 font-semibold text-[11px]">Connected</span>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

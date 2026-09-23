<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import AuthLayout from '../layouts/AuthLayout.vue';
import { useAuth } from '../composables/useAuth';
import { Sparkles, ArrowRight, AlertCircle, Loader2 } from 'lucide-vue-next';

const router = useRouter();
const route = useRoute();
const auth = useAuth();

const email = ref(import.meta.env.VITE_DEV_TEST_USER_EMAIL || '');
const password = ref(import.meta.env.VITE_DEV_TEST_USER_PASSWORD || '');
const isSubmitting = ref(false);
const errorMessage = ref('');

const devUserA = {
  email: import.meta.env.VITE_DEV_TEST_USER_EMAIL || 'jobscrapper.test.1790150347491@gmail.com',
  password: import.meta.env.VITE_DEV_TEST_USER_PASSWORD || 'TestUserPass123!',
};

function fillDevUserA() {
  email.value = devUserA.email;
  password.value = devUserA.password;
  errorMessage.value = '';
}

async function handleLogin() {
  if (!email.value || !password.value) {
    errorMessage.value = 'Please provide both email and password.';
    return;
  }

  isSubmitting.value = true;
  errorMessage.value = '';

  try {
    await auth.signInWithPassword(email.value, password.value);
    const redirect = (route.query.redirect as string) || '/';
    router.push(redirect);
  } catch (err: any) {
    errorMessage.value = err?.message || 'Invalid login credentials.';
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <AuthLayout>
    <div class="space-y-6">
      <div v-if="errorMessage" class="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2">
        <AlertCircle class="w-5 h-5 flex-shrink-0 text-rose-500 mt-0.5" />
        <span>{{ errorMessage }}</span>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <label for="email" class="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
            Email Address
          </label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            autocomplete="email"
            placeholder="you@domain.com"
            class="w-full px-3 py-2 border border-surface-border rounded-lg text-sm bg-surface-muted/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 transition"
          />
        </div>

        <div>
          <label for="password" class="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
            Password
          </label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
            placeholder="••••••••"
            class="w-full px-3 py-2 border border-surface-border rounded-lg text-sm bg-surface-muted/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 transition"
          />
        </div>

        <button
          type="submit"
          :disabled="isSubmitting"
          class="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-700 hover:bg-brand-800 text-white font-medium text-sm rounded-lg transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Loader2 v-if="isSubmitting" class="w-4 h-4 animate-spin" />
          <span v-else>Sign In</span>
          <ArrowRight v-if="!isSubmitting" class="w-4 h-4" />
        </button>
      </form>

      <!-- Local dev pre-fill helper -->
      <div class="pt-4 border-t border-surface-border">
        <div class="flex items-center justify-between">
          <span class="text-xs text-stone-500 font-medium flex items-center gap-1.5">
            <Sparkles class="w-3.5 h-3.5 text-amber-500" /> Dev Mode Helper
          </span>
          <button
            type="button"
            @click="fillDevUserA"
            class="text-xs text-brand-700 hover:text-brand-900 font-medium underline underline-offset-2"
          >
            Pre-fill Test User
          </button>
        </div>
      </div>
    </div>
  </AuthLayout>
</template>

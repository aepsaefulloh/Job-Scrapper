import { ref } from 'vue';
import { apiClient } from '../lib/api';
import {
  DEFAULT_SEARCH_PREFERENCES,
  type JobSearchPreferences,
} from '../types/search-preferences';

const preferences = ref<JobSearchPreferences>({ ...DEFAULT_SEARCH_PREFERENCES });
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);

export function useSearchPreferences() {
  async function fetchPreferences() {
    loading.value = true;
    error.value = null;
    try {
      const res = await apiClient.get<JobSearchPreferences>('/search-preferences');
      preferences.value = res ?? { ...DEFAULT_SEARCH_PREFERENCES };
      return preferences.value;
    } catch (e: any) {
      error.value = e?.message || 'Failed to load search preferences.';
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function updatePreferences(input: Partial<JobSearchPreferences>) {
    saving.value = true;
    error.value = null;
    try {
      const res = await apiClient.put<JobSearchPreferences>('/search-preferences', input);
      preferences.value = res;
      return res;
    } catch (e: any) {
      error.value = e?.message || 'Failed to save search preferences.';
      throw e;
    } finally {
      saving.value = false;
    }
  }

  return {
    preferences,
    loading,
    saving,
    error,
    fetchPreferences,
    updatePreferences,
  };
}

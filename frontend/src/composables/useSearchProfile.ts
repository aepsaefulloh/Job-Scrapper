import { ref } from 'vue';
import { apiClient } from '../lib/api';
import type { CandidateSearchProfile } from '../types/search-profile';

const searchProfile = ref<CandidateSearchProfile | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

export function useSearchProfile() {
  async function fetchSearchProfile() {
    loading.value = true;
    error.value = null;
    try {
      const res = await apiClient.get<CandidateSearchProfile>('/search-profile');
      searchProfile.value = res;
      return res;
    } catch (e: any) {
      if (e?.status === 404) {
        searchProfile.value = null;
      } else {
        error.value = e?.message || 'Failed to load search profile.';
      }
      return null;
    } finally {
      loading.value = false;
    }
  }

  return { searchProfile, loading, error, fetchSearchProfile };
}

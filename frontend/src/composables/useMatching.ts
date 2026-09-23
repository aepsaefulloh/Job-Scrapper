import { ref } from 'vue';
import { apiClient } from '../lib/api';
import type { JobRecommendation } from '../types/job';
import { useAuth } from './useAuth';

export function useMatching() {
  const recommendations = ref<JobRecommendation[]>([]);
  const loading = ref<boolean>(false);
  const error = ref<string | null>(null);

  const auth = useAuth();

  async function fetchRecommendations(limit = 20, threshold = 0) {
    if (!auth.user.value?.id) return [];

    loading.value = true;
    error.value = null;

    try {
      const candidateId = auth.user.value.id;
      const res = await apiClient.get<JobRecommendation[]>(
        `/matching/jobs/${candidateId}?limit=${limit}&threshold=${threshold}`
      );
      recommendations.value = res;
      return res;
    } catch (e: any) {
      // Matching can fail gracefully if vector search is empty or profile has no embeddings
      error.value = e?.message || 'Matching recommendations unavailable.';
      recommendations.value = [];
      return [];
    } finally {
      loading.value = false;
    }
  }

  return {
    recommendations,
    loading,
    error,
    fetchRecommendations,
  };
}

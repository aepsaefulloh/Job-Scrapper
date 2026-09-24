import { ref, computed } from 'vue';
import { apiClient } from '../lib/api';
import type { JobSourceDefinition } from '../types/job-source';

export const STATIC_FALLBACK_SOURCES: readonly JobSourceDefinition[] = [
  { id: 'jobstreet', name: 'Jobstreet', available: true, supportsLocation: true, supportsFreshness: true, supportsWorkMode: true, description: 'Southeast Asia jobs portal' },
  { id: 'loker-id', name: 'Loker.id', available: true, supportsLocation: true, supportsFreshness: true, supportsWorkMode: false, description: 'Indonesian job vacancy network' },
  { id: 'dealls', name: 'Dealls', available: true, supportsLocation: true, supportsFreshness: true, supportsWorkMode: true, description: 'Tech & business jobs in SEA' },
  { id: 'glints', name: 'Glints', available: true, supportsLocation: true, supportsFreshness: true, supportsWorkMode: true, description: 'Career discovery platform' },
  { id: 'indeed', name: 'Indeed', available: false, supportsLocation: false, supportsFreshness: false, supportsWorkMode: false, description: 'Global job search engine' },
  { id: 'linkedin', name: 'LinkedIn', available: false, supportsLocation: false, supportsFreshness: false, supportsWorkMode: false, description: 'Professional networking & jobs' },
  { id: 'kitalulus', name: 'KitaLulus', available: false, supportsLocation: false, supportsFreshness: false, supportsWorkMode: false, description: 'Indonesian workforce portal' },
  { id: 'kalibrr', name: 'Kalibrr', available: false, supportsLocation: false, supportsFreshness: false, supportsWorkMode: false, description: 'Southeast Asia recruitment platform' },
  { id: 'karir-com', name: 'Karir.com', available: false, supportsLocation: false, supportsFreshness: false, supportsWorkMode: false, description: 'Indonesian job portal' },
];

const jobSources = ref<JobSourceDefinition[]>([...STATIC_FALLBACK_SOURCES]);
const loading = ref<boolean>(false);
const error = ref<string | null>(null);

export function useJobSources() {
  const availableSources = computed(() => jobSources.value.filter((s) => s.available));

  async function fetchJobSources() {
    loading.value = true;
    error.value = null;
    try {
      const res = await apiClient.get<JobSourceDefinition[]>('/job-sources');
      if (Array.isArray(res) && res.length > 0) {
        jobSources.value = res;
      }
      return res;
    } catch (e: any) {
      error.value = e?.message || 'Failed to load job sources.';
      return jobSources.value;
    } finally {
      loading.value = false;
    }
  }

  return {
    jobSources,
    availableSources,
    loading,
    error,
    fetchJobSources,
  };
}

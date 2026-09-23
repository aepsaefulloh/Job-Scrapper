import { ref, computed, onUnmounted, getCurrentInstance } from 'vue';
import { apiClient } from '../lib/api';
import type {
  ScrapeRunRecord,
  LatestScrapeRunResponse,
  ScrapeRunsListResponse,
  SearchRunTriggerResponse,
} from '../types/scrape-run';

const latestRun = ref<ScrapeRunRecord | null>(null);
const recentRuns = ref<ScrapeRunRecord[]>([]);
const loading = ref(false);
const triggering = ref(false);
const error = ref<string | null>(null);
const runCompletedCallbacks = new Set<() => void>();

let pollInterval: ReturnType<typeof setInterval> | null = null;

export function useScrapeRuns() {
  const isRunning = computed(() => {
    return latestRun.value?.status === 'running' || latestRun.value?.status === 'pending';
  });

  async function fetchLatestRun(): Promise<ScrapeRunRecord | null> {
    try {
      const res = await apiClient.get<LatestScrapeRunResponse>('/scrape-runs/latest');
      latestRun.value = res.latest;
      return res.latest;
    } catch {
      return null;
    }
  }

  async function fetchRecentRuns(limit = 5): Promise<ScrapeRunRecord[]> {
    loading.value = true;
    try {
      const res = await apiClient.get<ScrapeRunsListResponse>(`/scrape-runs?limit=${limit}`);
      recentRuns.value = res.items;
      return res.items;
    } catch (e: any) {
      error.value = e?.message || 'Failed to load recent search runs.';
      return [];
    } finally {
      loading.value = false;
    }
  }

  function startPolling() {
    stopPolling();
    pollInterval = setInterval(async () => {
      const updated = await fetchLatestRun();
      if (!updated || (updated.status !== 'running' && updated.status !== 'pending')) {
        stopPolling();
        await fetchRecentRuns(5);
        for (const cb of runCompletedCallbacks) {
          cb();
        }
      }
    }, 2500);
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  async function triggerSearch(options: { maxPages?: number } = {}): Promise<SearchRunTriggerResponse | null> {
    triggering.value = true;
    error.value = null;

    try {
      const res = await apiClient.post<SearchRunTriggerResponse>('/search/run', options);
      // Immediately fetch latest and start polling
      await fetchLatestRun();
      startPolling();
      return res;
    } catch (e: any) {
      if (e?.code === 'SEARCH_ALREADY_RUNNING' || e?.status === 409) {
        error.value = 'A search is already running for this profile.';
      } else if (e?.code === 'SEARCH_PROFILE_NOT_READY' || e?.status === 400) {
        error.value = 'Your job search profile is not ready yet. Complete or update your candidate profile first.';
      } else {
        error.value = e?.message || 'We could not start this search. Try again in a moment.';
      }
      return null;
    } finally {
      triggering.value = false;
    }
  }

  function onRunCompleted(cb: () => void) {
    runCompletedCallbacks.add(cb);
  }

  function offRunCompleted(cb: () => void) {
    runCompletedCallbacks.delete(cb);
  }

  if (getCurrentInstance()) {
    onUnmounted(() => {
      // Only stop polling if component unmounts and not running
      if (!isRunning.value) {
        stopPolling();
      }
    });
  }

  return {
    latestRun,
    recentRuns,
    loading,
    triggering,
    isRunning,
    error,
    fetchLatestRun,
    fetchRecentRuns,
    triggerSearch,
    startPolling,
    stopPolling,
    onRunCompleted,
    offRunCompleted,
  };
}

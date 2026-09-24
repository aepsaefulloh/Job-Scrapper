import { ref, computed, onUnmounted, getCurrentInstance } from 'vue';
import { apiClient } from '../lib/api';
import type { SearchExecutionRecord } from '../types/search-execution';

export function useSearchExecution() {
  const execution = ref<SearchExecutionRecord | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const elapsedSeconds = ref(0);
  const completedCallbacks = new Set<() => void>();

  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let timerInterval: ReturnType<typeof setInterval> | null = null;

  const isRunning = computed(() => {
    return execution.value?.status === 'running' || execution.value?.status === 'pending';
  });

  function calculateElapsed(): number {
    if (!execution.value?.startedAt) return 0;
    const start = new Date(execution.value.startedAt).getTime();
    if (isNaN(start)) return 0;

    if (execution.value.finishedAt) {
      const finish = new Date(execution.value.finishedAt).getTime();
      return Math.max(0, Math.round((finish - start) / 1000));
    }

    return Math.max(0, Math.round((Date.now() - start) / 1000));
  }

  function updateElapsed() {
    elapsedSeconds.value = calculateElapsed();
  }

  function formatDuration(seconds: number): string {
    if (seconds <= 0) return '0s';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }

  async function fetchExecution(id: string): Promise<SearchExecutionRecord | null> {
    loading.value = true;
    error.value = null;
    try {
      const data = await apiClient.get<SearchExecutionRecord>(`/search-runs/${id}`);
      execution.value = data;
      updateElapsed();
      return data;
    } catch (e: any) {
      error.value = e?.message || 'Failed to load search execution details.';
      execution.value = null;
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function startPolling(id: string, intervalMs = 2500) {
    stopPolling();
    const initial = await fetchExecution(id);
    if (!initial || (initial.status !== 'running' && initial.status !== 'pending')) {
      return;
    }

    // Start timer tick for live second-by-second updates
    timerInterval = setInterval(() => {
      if (isRunning.value) {
        updateElapsed();
      }
    }, 1000);

    // Poll execution status
    pollInterval = setInterval(async () => {
      const updated = await fetchExecution(id);
      if (!updated || (updated.status !== 'running' && updated.status !== 'pending')) {
        stopPolling();
        for (const cb of completedCallbacks) {
          cb();
        }
      }
    }, intervalMs);
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function onExecutionCompleted(cb: () => void) {
    completedCallbacks.add(cb);
  }

  function offExecutionCompleted(cb: () => void) {
    completedCallbacks.delete(cb);
  }

  if (getCurrentInstance()) {
    onUnmounted(() => {
      stopPolling();
    });
  }

  return {
    execution,
    loading,
    error,
    elapsedSeconds,
    isRunning,
    fetchExecution,
    startPolling,
    stopPolling,
    formatDuration,
    onExecutionCompleted,
    offExecutionCompleted,
  };
}

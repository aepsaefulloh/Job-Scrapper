import { ref, computed } from 'vue';
import { apiClient } from '../lib/api';
import type {
  SearchExecutionRecord,
  SearchExecutionsListResponse,
  SearchExecutionFilters,
} from '../types/search-execution';

export function useSearchExecutions() {
  const executions = ref<SearchExecutionRecord[]>([]);
  const total = ref(0);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const filters = ref<SearchExecutionFilters>({
    status: '',
    source: '',
    trigger: '',
    dateRange: 'all',
  });

  const page = ref(1);
  const pageSize = ref(20);

  const totalPages = computed(() => {
    return Math.max(1, Math.ceil(total.value / pageSize.value));
  });

  function getDateRangeFrom(): string | undefined {
    if (!filters.value.dateRange || filters.value.dateRange === 'all') {
      return undefined;
    }
    const now = new Date();
    if (filters.value.dateRange === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return startOfDay.toISOString();
    }
    if (filters.value.dateRange === '7d') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return sevenDaysAgo.toISOString();
    }
    if (filters.value.dateRange === '30d') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return thirtyDaysAgo.toISOString();
    }
    return undefined;
  }

  function formatDuration(seconds: number): string {
    if (seconds <= 0) return '0s';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }

  async function fetchExecutions(): Promise<SearchExecutionRecord[]> {
    loading.value = true;
    error.value = null;

    try {
      const params = new URLSearchParams();
      params.set('limit', String(pageSize.value));
      params.set('offset', String((page.value - 1) * pageSize.value));

      if (filters.value.status) {
        params.set('status', filters.value.status);
      }
      if (filters.value.source) {
        params.set('source', filters.value.source);
      }
      if (filters.value.trigger) {
        params.set('trigger', filters.value.trigger);
      }

      const from = getDateRangeFrom();
      if (from) {
        params.set('from', from);
      }

      const url = `/search-runs?${params.toString()}`;
      const res = await apiClient.get<SearchExecutionsListResponse>(url);

      executions.value = res.items || [];
      total.value = res.pagination?.total ?? (res.items?.length || 0);
      return executions.value;
    } catch (e: any) {
      error.value = e?.message || 'Failed to load search executions history.';
      executions.value = [];
      return [];
    } finally {
      loading.value = false;
    }
  }

  async function setFilter<K extends keyof SearchExecutionFilters>(
    key: K,
    value: SearchExecutionFilters[K]
  ) {
    filters.value[key] = value;
    page.value = 1;
    await fetchExecutions();
  }

  async function setPage(newPage: number) {
    if (newPage < 1) newPage = 1;
    if (total.value > 0 && newPage > totalPages.value) {
      newPage = totalPages.value;
    }
    page.value = newPage;
    await fetchExecutions();
  }

  return {
    executions,
    total,
    loading,
    error,
    filters,
    page,
    pageSize,
    totalPages,
    fetchExecutions,
    setFilter,
    setPage,
    formatDuration,
  };
}

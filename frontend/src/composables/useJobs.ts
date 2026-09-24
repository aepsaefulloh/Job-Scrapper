import { ref } from 'vue';
import { apiClient } from '../lib/api';
import type { JobListItem, JobDetail } from '../types/job';
import type { PaginatedResponse } from '../types/api';

export type JobFilterParams = {
  limit?: number;
  offset?: number;
  keyword?: string;
  company?: string;
  source?: string;
};

export function useJobs() {
  const jobs = ref<JobListItem[]>([]);
  const total = ref<number>(0);
  const loading = ref<boolean>(false);
  const error = ref<string | null>(null);

  const activeJob = ref<JobDetail | null>(null);
  const detailLoading = ref<boolean>(false);
  const detailError = ref<string | null>(null);

  async function fetchJobs(params: JobFilterParams = {}) {
    loading.value = true;
    error.value = null;

    try {
      const searchParams = new URLSearchParams();
      searchParams.set('limit', String(params.limit ?? 20));
      searchParams.set('offset', String(params.offset ?? 0));
      if (params.keyword?.trim()) searchParams.set('keyword', params.keyword.trim());
      if (params.company?.trim()) searchParams.set('company', params.company.trim());
      if (params.source?.trim()) searchParams.set('source', params.source.trim());

      const res = await apiClient.get<PaginatedResponse<JobListItem>>(
        `/jobs?${searchParams.toString()}`
      );
      jobs.value = res.items;
      total.value = res.pagination.total;
      return res;
    } catch (e: any) {
      error.value = e?.message || 'Failed to fetch jobs.';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function fetchJobDetail(id: string) {
    detailLoading.value = true;
    detailError.value = null;

    try {
      const res = await apiClient.get<JobDetail>(`/jobs/${id}`);
      activeJob.value = res;
      return res;
    } catch (e: any) {
      detailError.value = e?.message || 'Failed to load job details.';
      throw e;
    } finally {
      detailLoading.value = false;
    }
  }

  async function updateJobStatus(id: string, status: 'active' | 'expired' | 'closed') {
    try {
      const updated = await apiClient.patch<JobDetail>(`/jobs/${id}`, { status });
      if (activeJob.value && activeJob.value.id === id) {
        activeJob.value.status = updated.status;
      }
      return updated;
    } catch (e: any) {
      throw e;
    }
  }

  async function deleteJob(id: string): Promise<boolean> {
    try {
      await apiClient.delete<{ success: boolean; jobId: string }>(`/jobs/${id}`);
      jobs.value = jobs.value.filter((j) => j.id !== id);
      total.value = Math.max(0, total.value - 1);
      return true;
    } catch (e: any) {
      error.value = e?.message || 'Failed to delete job.';
      return false;
    }
  }

  async function cleanupJobs() {
    loading.value = true;
    error.value = null;
    try {
      const res = await apiClient.post<import('../lib/api').CleanupResult>('/jobs/cleanup');
      await fetchJobs();
      return res;
    } catch (e: any) {
      error.value = e?.message || 'Failed to cleanup jobs.';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  return {
    jobs,
    total,
    loading,
    error,
    activeJob,
    detailLoading,
    detailError,
    fetchJobs,
    fetchJobDetail,
    updateJobStatus,
    deleteJob,
    cleanupJobs,
  };
}

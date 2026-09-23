import { ref, computed } from 'vue';
import { apiClient } from '../lib/api';
import type {
  ApplicationListItem,
  ApplicationDetail,
  ApplicationStatus,
  ApplicationMaterial,
} from '../types/application';
import type { PaginatedResponse } from '../types/api';

const applications = ref<ApplicationListItem[]>([]);
const total = ref<number>(0);
const loading = ref<boolean>(false);
const error = ref<string | null>(null);

const activeApplication = ref<ApplicationDetail | null>(null);
const detailLoading = ref<boolean>(false);
const detailError = ref<string | null>(null);

export function useApplications() {
  const savedJobIds = computed(() => {
    return new Set(
      applications.value
        .filter((app) => app.status === 'saved')
        .map((app) => app.jobId)
    );
  });

  const appliedJobIds = computed(() => {
    return new Set(
      applications.value
        .filter((app) => app.status !== 'saved')
        .map((app) => app.jobId)
    );
  });

  const countsByStatus = computed(() => {
    const counts: Record<string, number> = {
      all: total.value,
      saved: 0,
      applied: 0,
      interview: 0,
      offer: 0,
      rejected: 0,
    };
    for (const app of applications.value) {
      if (counts[app.status] !== undefined) {
        counts[app.status]++;
      }
    }
    return counts;
  });

  async function fetchApplications(params: {
    status?: ApplicationStatus;
    limit?: number;
    offset?: number;
  } = {}) {
    loading.value = true;
    error.value = null;

    try {
      const searchParams = new URLSearchParams();
      searchParams.set('limit', String(params.limit ?? 20));
      searchParams.set('offset', String(params.offset ?? 0));
      if (params.status) {
        searchParams.set('status', params.status);
      }

      const res = await apiClient.get<PaginatedResponse<ApplicationListItem>>(
        `/applications?${searchParams.toString()}`
      );
      applications.value = res.items;
      total.value = res.pagination.total;
      return res;
    } catch (e: any) {
      error.value = e?.message || 'Failed to fetch applications.';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function fetchApplicationDetail(id: string) {
    detailLoading.value = true;
    detailError.value = null;

    try {
      const res = await apiClient.get<ApplicationDetail>(`/applications/${id}`);
      activeApplication.value = res;
      return res;
    } catch (e: any) {
      detailError.value = e?.message || 'Failed to load application.';
      throw e;
    } finally {
      detailLoading.value = false;
    }
  }

  async function createApplication(
    jobId: string,
    status: ApplicationStatus = 'applied',
    notes?: string,
    appliedAt?: string
  ) {
    try {
      const res = await apiClient.post<ApplicationListItem>('/applications', {
        jobId,
        status,
        notes,
        appliedAt,
      });
      // Add or update locally
      const idx = applications.value.findIndex((a) => a.id === res.id);
      if (idx >= 0) {
        applications.value[idx] = res;
      } else {
        applications.value.unshift(res);
        total.value++;
      }
      return res;
    } catch (e: any) {
      throw e;
    }
  }

  async function saveJob(jobId: string) {
    // If existing saved, do nothing or toggle
    const existing = applications.value.find((a) => a.jobId === jobId);
    if (existing) {
      return existing;
    }
    return createApplication(jobId, 'saved');
  }

  async function updateApplication(
    id: string,
    updates: {
      status?: ApplicationStatus;
      notes?: string;
      appliedAt?: string | null;
    }
  ) {
    try {
      const res = await apiClient.patch<ApplicationListItem>(
        `/applications/${id}`,
        updates
      );
      const idx = applications.value.findIndex((a) => a.id === id);
      if (idx >= 0) {
        applications.value[idx] = { ...applications.value[idx], ...res };
      }
      if (activeApplication.value && activeApplication.value.id === id) {
        activeApplication.value = { ...activeApplication.value, ...res };
      }
      return res;
    } catch (e: any) {
      throw e;
    }
  }

  async function generateCoverLetter(
    applicationId: string,
    options: {
      tone?: string;
      highlightSkills?: string[];
      customInstructions?: string;
    }
  ) {
    const res = await apiClient.post<ApplicationMaterial>(
      `/applications/${applicationId}/generate-cover-letter`,
      options
    );
    if (activeApplication.value && activeApplication.value.id === applicationId) {
      activeApplication.value.materials.unshift(res);
    }
    return res;
  }

  async function generateIntroduction(
    applicationId: string,
    options: {
      tone?: string;
      platform?: string;
      customInstructions?: string;
    }
  ) {
    const res = await apiClient.post<ApplicationMaterial>(
      `/applications/${applicationId}/generate-introduction`,
      options
    );
    if (activeApplication.value && activeApplication.value.id === applicationId) {
      activeApplication.value.materials.unshift(res);
    }
    return res;
  }

  async function generateRecruiterAnswer(
    applicationId: string,
    options: {
      question: string;
      context?: string;
    }
  ) {
    const res = await apiClient.post<ApplicationMaterial>(
      `/applications/${applicationId}/generate-answer`,
      options
    );
    if (activeApplication.value && activeApplication.value.id === applicationId) {
      activeApplication.value.materials.unshift(res);
    }
    return res;
  }

  return {
    applications,
    total,
    loading,
    error,
    activeApplication,
    detailLoading,
    detailError,
    savedJobIds,
    appliedJobIds,
    countsByStatus,
    fetchApplications,
    fetchApplicationDetail,
    createApplication,
    saveJob,
    updateApplication,
    generateCoverLetter,
    generateIntroduction,
    generateRecruiterAnswer,
  };
}

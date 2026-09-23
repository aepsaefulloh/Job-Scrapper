import { ref } from 'vue';
import { apiClient } from '../lib/api';
import type { CandidateProfile, ProfileUploadResponse } from '../types/profile';

const profile = ref<CandidateProfile | null>(null);
const loading = ref<boolean>(false);
const error = ref<string | null>(null);

const uploading = ref<boolean>(false);
const uploadResult = ref<ProfileUploadResponse | null>(null);
const uploadError = ref<string | null>(null);

export function useProfile() {
  async function fetchProfile() {
    loading.value = true;
    error.value = null;

    try {
      const res = await apiClient.get<CandidateProfile>('/profile');
      profile.value = res;
      return res;
    } catch (e: any) {
      if (e?.status === 404) {
        profile.value = null;
      } else {
        error.value = e?.message || 'Failed to fetch candidate profile.';
      }
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function uploadMarkdownDocument(file: File) {
    uploading.value = true;
    uploadError.value = null;
    uploadResult.value = null;

    try {
      const formData = new FormData();
      formData.append('document', file);

      const res = await apiClient.postFormData<ProfileUploadResponse>(
        '/v1/profile/document',
        formData
      );
      uploadResult.value = res;
      await fetchProfile();
      return res;
    } catch (e: any) {
      const issues = Array.isArray(e?.issues) && e.issues.length > 0 ? ` (${e.issues.join('; ')})` : '';
      uploadError.value = `${e?.message || 'Failed to upload and parse candidate markdown profile.'}${issues}`;
      throw e;
    } finally {

      uploading.value = false;
    }
  }

  return {
    profile,
    loading,
    error,
    uploading,
    uploadResult,
    uploadError,
    fetchProfile,
    uploadMarkdownDocument,
  };
}

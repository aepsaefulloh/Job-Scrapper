import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useProfile } from '../useProfile';
import { apiClient } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  apiClient: {
    get: vi.fn(),
    postFormData: vi.fn(),
    put: vi.fn(),
  },
}));

describe('useProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches candidate profile', async () => {
    const mockProfile = {
      id: 'profile-1',
      candidateId: 'candidate-1',
      displayName: 'Aep Saefulloh',
      headline: 'Senior Full Stack Engineer',
      summary: 'Passionate builder',
      experience: '5+ years experience',
      careerPreferences: 'Remote',
      skills: [{ displayName: 'Vue.js', canonicalName: 'vuejs' }],
      updatedAt: '2026-09-23T00:00:00.000Z',
    };

    (apiClient.get as any).mockResolvedValue(mockProfile);

    const { profile, loading, fetchProfile } = useProfile();
    await fetchProfile();

    expect(loading.value).toBe(false);
    expect(profile.value).toEqual(mockProfile);
    expect(apiClient.get).toHaveBeenCalledWith('/profile');
  });

  it('uploads markdown document and refreshes profile', async () => {
    const uploadRes = {
      documentId: 'doc-1',
      profileId: 'profile-1',
      checksum: 'abc',
      uploadedAt: '2026-09-23T00:00:00.000Z',
      skillCount: 5,
    };

    (apiClient.postFormData as any).mockResolvedValue(uploadRes);
    (apiClient.get as any).mockResolvedValue({ id: 'profile-1', skills: [] });

    const { uploadMarkdownDocument, uploadResult } = useProfile();
    const fakeFile = new File(['# Name\nAep'], 'candidate.md', { type: 'text/markdown' });

    const res = await uploadMarkdownDocument(fakeFile);
    expect(res).toEqual(uploadRes);
    expect(uploadResult.value).toEqual(uploadRes);
    expect(apiClient.postFormData).toHaveBeenCalledWith(
      '/v1/profile/document',
      expect.any(FormData)
    );
  });

  it('successfully updates profile via updateProfile', async () => {
    const updatedMock = {
      id: 'prof-1',
      candidateId: 'cand-1',
      displayName: 'Aep Saefulloh Updated',
      headline: 'Lead Architect',
      summary: 'Senior Engineer',
      experience: '8+ years',
      careerPreferences: 'Remote',
      skills: [{ displayName: 'Vue.js', canonicalName: 'vue.js' }],
      updatedAt: '2026-09-24T12:00:00Z',
    };

    (apiClient.put as any).mockResolvedValueOnce(updatedMock);

    const { updateProfile, profile, saving, saveError } = useProfile();

    const promise = (updateProfile as any)({
      displayName: 'Aep Saefulloh Updated',
      headline: 'Lead Architect',
      skills: ['Vue.js'],
    });

    expect(saving.value).toBe(true);
    const result = await promise;

    expect(saving.value).toBe(false);
    expect(saveError.value).toBeNull();
    expect(result.displayName).toBe('Aep Saefulloh Updated');
    expect(profile.value?.displayName).toBe('Aep Saefulloh Updated');
    expect(apiClient.put).toHaveBeenCalledWith('/profile', {
      displayName: 'Aep Saefulloh Updated',
      headline: 'Lead Architect',
      skills: ['Vue.js'],
    });
  });
});

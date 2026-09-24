import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';

describe('PUT /api/profile', () => {
  const mockCandidateId = 'cand-123';
  const mockAccessToken = 'valid-token';

  it('updates profile and returns 200 with updated profile data', async () => {
    const mockUpdateProfile = vi.fn().mockResolvedValue({
      id: 'prof-1',
      candidateId: mockCandidateId,
      displayName: 'Alex Smith',
      headline: 'Staff Engineer',
      summary: 'Tech Lead',
      experience: '12 years exp',
      careerPreferences: 'Remote',
      skills: [{ displayName: 'Go', canonicalName: 'go' }],
      updatedAt: '2026-09-24T12:00:00Z',
    });

    const app = createApp({
      authenticate: vi.fn().mockResolvedValue({ userId: mockCandidateId, accessToken: mockAccessToken }),
      profileDocumentMaxBytes: 1024 * 1024,
      createProfileService: vi.fn().mockReturnValue({
        getProfile: vi.fn(),
        upload: vi.fn(),
        updateProfile: mockUpdateProfile,
      } as never),
    });

    const res = await request(app)
      .put('/profile')
      .set('Authorization', `Bearer ${mockAccessToken}`)
      .send({
        displayName: 'Alex Smith',
        headline: 'Staff Engineer',
        summary: 'Tech Lead',
        skills: ['Go'],
      });

    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe('Alex Smith');
    expect(res.body.headline).toBe('Staff Engineer');
    expect(mockUpdateProfile).toHaveBeenCalledWith(
      mockCandidateId,
      expect.objectContaining({ displayName: 'Alex Smith' })
    );
  });

  it('returns 400 when displayName is empty or missing', async () => {
    const app = createApp({
      authenticate: vi.fn().mockResolvedValue({ userId: mockCandidateId, accessToken: mockAccessToken }),
      profileDocumentMaxBytes: 1024 * 1024,
      createProfileService: vi.fn().mockReturnValue({
        updateProfile: vi.fn(),
      } as never),
    });

    const res = await request(app)
      .put('/profile')
      .set('Authorization', `Bearer ${mockAccessToken}`)
      .send({ displayName: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 when active profile is not found', async () => {
    const app = createApp({
      authenticate: vi.fn().mockResolvedValue({ userId: mockCandidateId, accessToken: mockAccessToken }),
      profileDocumentMaxBytes: 1024 * 1024,
      createProfileService: vi.fn().mockReturnValue({
        updateProfile: vi.fn().mockRejectedValue(new Error('Active profile not found.')),
      } as never),
    });

    const res = await request(app)
      .put('/profile')
      .set('Authorization', `Bearer ${mockAccessToken}`)
      .send({ displayName: 'Alex' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PROFILE_NOT_FOUND');
  });
});

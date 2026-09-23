import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../../src/app.js';

describe('GET /api/profile and /profile', () => {
  const mockProfile = {
    id: 'profile-1',
    candidateId: 'candidate-1',
    displayName: 'Aep Saefulloh',
    headline: 'Senior Full Stack Engineer',
    summary: 'Experienced developer',
    experience: '5 years building web apps',
    careerPreferences: 'Remote',
    skills: [
      { displayName: 'TypeScript', canonicalName: 'typescript' },
      { displayName: 'Vue.js', canonicalName: 'vuejs' },
    ],
    updatedAt: '2026-09-23T10:00:00.000Z',
  };

  it('retrieves active candidate profile on /api/profile', async () => {
    const app = createApp({
      createProfileService: () => ({
        upload: async () => { throw new Error('Not implemented'); },
        getProfile: async (candidateId: string) => {
          if (candidateId === 'candidate-1') return mockProfile;
          return null;
        },
      }),
      authenticate: async (accessToken) => ({ userId: 'candidate-1', accessToken }),
      profileDocumentMaxBytes: 1024,
    });

    const response = await request(app)
      .get('/api/profile')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockProfile);
  });

  it('retrieves active candidate profile on /profile for backward compatibility', async () => {
    const app = createApp({
      createProfileService: () => ({
        upload: async () => { throw new Error('Not implemented'); },
        getProfile: async (candidateId: string) => {
          if (candidateId === 'candidate-1') return mockProfile;
          return null;
        },
      }),
      authenticate: async (accessToken) => ({ userId: 'candidate-1', accessToken }),
      profileDocumentMaxBytes: 1024,
    });

    const response = await request(app)
      .get('/profile')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockProfile);
  });

  it('returns 404 when active profile is not found', async () => {
    const app = createApp({
      createProfileService: () => ({
        upload: async () => { throw new Error('Not implemented'); },
        getProfile: async () => null,
      }),
      authenticate: async (accessToken) => ({ userId: 'candidate-unknown', accessToken }),
      profileDocumentMaxBytes: 1024,
    });

    const response = await request(app)
      .get('/api/profile')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('PROFILE_NOT_FOUND');
  });

  it('requires authentication on /api/profile', async () => {
    const app = createApp({
      createProfileService: () => ({
        upload: async () => { throw new Error('Not implemented'); },
        getProfile: async () => mockProfile,
      }),
      authenticate: async () => { throw new Error('Invalid token'); },
      profileDocumentMaxBytes: 1024,
    });

    const response = await request(app).get('/api/profile');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });
});

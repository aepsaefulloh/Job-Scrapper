import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';

function app() {
  const jobs = {
    delete: vi.fn().mockResolvedValue(true),
    cleanup: vi.fn().mockResolvedValue({
      deletedJobsCount: 5,
      deletedRawCount: 5,
      deletedScrapeRunsCount: 1,
      preservedJobsCount: 2,
    }),
  };

  return {
    app: createApp({
      profileDocumentMaxBytes: 1024,
      authenticate: async (token) => ({ userId: 'candidate-a', accessToken: token }),
      createProfileService: () => ({ upload: async () => ({}) }),
      createJobService: () => jobs as never,
    }),
    jobs,
  };
}

describe('Job Cleanup and Deletion API', () => {
  it('requires authentication for DELETE /jobs/:id and POST /jobs/cleanup', async () => {
    const { app: expressApp } = app();
    await request(expressApp).delete('/jobs/job-1').expect(401);
    await request(expressApp).post('/jobs/cleanup').expect(401);
  });

  it('deletes single job successfully or returns 404', async () => {
    const { app: expressApp, jobs } = app();

    const res = await request(expressApp)
      .delete('/jobs/job-1')
      .set('Authorization', 'Bearer token')
      .expect(200);

    expect(res.body).toEqual({ success: true, jobId: 'job-1' });
    expect(jobs.delete).toHaveBeenCalledWith('candidate-a', 'job-1');

    jobs.delete.mockResolvedValueOnce(false);
    await request(expressApp)
      .delete('/jobs/job-not-found')
      .set('Authorization', 'Bearer token')
      .expect(404);
  });

  it('executes bulk storage cleanup and returns stats', async () => {
    const { app: expressApp, jobs } = app();

    const res = await request(expressApp)
      .post('/jobs/cleanup')
      .set('Authorization', 'Bearer token')
      .expect(200);

    expect(res.body).toEqual({
      deletedJobsCount: 5,
      deletedRawCount: 5,
      deletedScrapeRunsCount: 1,
      preservedJobsCount: 2,
    });
    expect(jobs.cleanup).toHaveBeenCalledWith('candidate-a');
  });
});

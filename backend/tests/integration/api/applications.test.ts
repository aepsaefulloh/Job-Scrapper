import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import {
  ApplicationConflictError,
  ApplicationMaterialGenerationError,
  ApplicationNotFoundError,
} from '../../../src/domain/application/application-errors.js';

function setupApp(overrides: Record<string, unknown> = {}) {
  const applicationService = {
    create: vi.fn().mockResolvedValue({
      id: 'app-1',
      candidateId: 'candidate-a',
      jobId: 'job-1',
      status: 'saved',
      notes: 'Initial interest',
      createdAt: '2026-09-23T12:00:00Z',
      updatedAt: '2026-09-23T12:00:00Z',
    }),
    list: vi.fn().mockResolvedValue({
      items: [
        {
          id: 'app-1',
          candidateId: 'candidate-a',
          jobId: 'job-1',
          status: 'saved',
          job: {
            id: 'job-1',
            title: 'Backend Engineer',
            companyName: 'TechCorp',
            location: 'Jakarta',
            source: 'jobstreet',
            canonicalUrl: 'https://id.jobstreet.com/job/1',
          },
        },
      ],
      total: 1,
    }),
    detail: vi.fn().mockResolvedValue({
      id: 'app-1',
      candidateId: 'candidate-a',
      jobId: 'job-1',
      status: 'saved',
      materials: [
        {
          id: 'mat-1',
          applicationId: 'app-1',
          candidateId: 'candidate-a',
          materialType: 'cover_letter',
          content: 'Dear Hiring Manager...',
          createdAt: '2026-09-23T12:05:00Z',
        },
      ],
      job: {
        id: 'job-1',
        title: 'Backend Engineer',
        companyName: 'TechCorp',
        location: 'Jakarta',
      },
    }),
    update: vi.fn().mockResolvedValue({
      id: 'app-1',
      candidateId: 'candidate-a',
      jobId: 'job-1',
      status: 'applied',
      appliedAt: '2026-09-23T13:00:00Z',
    }),
    generateCoverLetter: vi.fn().mockResolvedValue({
      id: 'mat-1',
      applicationId: 'app-1',
      candidateId: 'candidate-a',
      materialType: 'cover_letter',
      content: 'Dear Hiring Manager, I am thrilled to apply...',
      createdAt: '2026-09-23T12:05:00Z',
    }),
    generateIntroduction: vi.fn().mockResolvedValue({
      id: 'mat-2',
      applicationId: 'app-1',
      candidateId: 'candidate-a',
      materialType: 'introduction',
      content: 'Hello, I came across the Backend Engineer role...',
      createdAt: '2026-09-23T12:06:00Z',
    }),
    generateRecruiterAnswer: vi.fn().mockResolvedValue({
      id: 'mat-3',
      applicationId: 'app-1',
      candidateId: 'candidate-a',
      materialType: 'recruiter_answer',
      content: 'Regarding high concurrency, in my previous role...',
      createdAt: '2026-09-23T12:07:00Z',
    }),
  };

  const app = createApp({
    profileDocumentMaxBytes: 1024,
    authenticate: async (token) => ({
      userId: token === 'token-b' ? 'candidate-b' : 'candidate-a',
      accessToken: token,
    }),
    createProfileService: () => ({ upload: async () => ({}) }) as never,
    createApplicationService: () => applicationService as never,
    ...overrides,
  } as never);

  return { app, applicationService };
}

describe('Applications API routes', () => {
  it('requires authentication for all endpoints', async () => {
    const { app } = setupApp();
    await request(app).get('/applications').expect(401);
    await request(app).post('/applications').send({ jobId: 'job-1' }).expect(401);
    await request(app).get('/applications/app-1').expect(401);
    await request(app).patch('/applications/app-1').send({ status: 'applied' }).expect(401);
    await request(app).post('/applications/app-1/generate-cover-letter').expect(401);
    await request(app).post('/applications/app-1/generate-introduction').expect(401);
    await request(app).post('/applications/app-1/generate-answer').send({ question: 'Why us?' }).expect(401);
  });

  it('lists applications with pagination and optional status filter', async () => {
    const { app, applicationService } = setupApp();
    const res = await request(app)
      .get('/applications?limit=10&offset=0&status=saved')
      .set('Authorization', 'Bearer token-a')
      .expect(200);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.pagination).toMatchObject({ limit: 10, offset: 0, total: 1 });
    expect(applicationService.list).toHaveBeenCalledWith('candidate-a', {
      limit: 10,
      offset: 0,
      status: 'saved',
    });
  });

  it('creates an application and rejects invalid payload or duplicate', async () => {
    const { app, applicationService } = setupApp();

    const res = await request(app)
      .post('/applications')
      .set('Authorization', 'Bearer token-a')
      .send({ jobId: 'job-1', status: 'saved', notes: 'Initial interest' })
      .expect(201);

    expect(res.body.id).toBe('app-1');
    expect(applicationService.create).toHaveBeenCalledWith('candidate-a', {
      jobId: 'job-1',
      status: 'saved',
      notes: 'Initial interest',
    });

    // Invalid body
    await request(app)
      .post('/applications')
      .set('Authorization', 'Bearer token-a')
      .send({ status: 'invalid-status' })
      .expect(400);

    // Duplicate conflict
    applicationService.create.mockRejectedValueOnce(new ApplicationConflictError());
    await request(app)
      .post('/applications')
      .set('Authorization', 'Bearer token-a')
      .send({ jobId: 'job-1' })
      .expect(409);
  });

  it('retrieves application detail with reviewable materials or returns 404', async () => {
    const { app, applicationService } = setupApp();

    const res = await request(app)
      .get('/applications/app-1')
      .set('Authorization', 'Bearer token-a')
      .expect(200);

    expect(res.body.id).toBe('app-1');
    expect(res.body.materials).toHaveLength(1);

    applicationService.detail.mockResolvedValueOnce(null);
    await request(app)
      .get('/applications/nonexistent')
      .set('Authorization', 'Bearer token-a')
      .expect(404);
  });

  it('updates application status and handles 404/400', async () => {
    const { app, applicationService } = setupApp();

    const res = await request(app)
      .patch('/applications/app-1')
      .set('Authorization', 'Bearer token-a')
      .send({ status: 'applied', appliedAt: '2026-09-23T13:00:00Z' })
      .expect(200);

    expect(res.body.status).toBe('applied');

    // Invalid status
    await request(app)
      .patch('/applications/app-1')
      .set('Authorization', 'Bearer token-a')
      .send({ status: 'bogus' })
      .expect(400);

    // Not found
    applicationService.update.mockResolvedValueOnce(null);
    await request(app)
      .patch('/applications/other')
      .set('Authorization', 'Bearer token-a')
      .send({ status: 'interview' })
      .expect(404);
  });

  it('generates cover letter reviewable material', async () => {
    const { app, applicationService } = setupApp();

    const res = await request(app)
      .post('/applications/app-1/generate-cover-letter')
      .set('Authorization', 'Bearer token-a')
      .send({ notes: 'Emphasize cloud architecture' })
      .expect(201);

    expect(res.body.materialType).toBe('cover_letter');
    expect(res.body.content).toContain('Dear Hiring Manager');
    expect(applicationService.generateCoverLetter).toHaveBeenCalledWith(
      'candidate-a',
      'app-1',
      { notes: 'Emphasize cloud architecture' }
    );
  });

  it('generates introduction reviewable material', async () => {
    const { app, applicationService } = setupApp();

    const res = await request(app)
      .post('/applications/app-1/generate-introduction')
      .set('Authorization', 'Bearer token-a')
      .send({ platform: 'linkedin' })
      .expect(201);

    expect(res.body.materialType).toBe('introduction');
    expect(res.body.content).toContain('Backend Engineer');
  });

  it('generates recruiter answer reviewable material and requires question', async () => {
    const { app, applicationService } = setupApp();

    const res = await request(app)
      .post('/applications/app-1/generate-answer')
      .set('Authorization', 'Bearer token-a')
      .send({ question: 'How do you handle microservices?' })
      .expect(201);

    expect(res.body.materialType).toBe('recruiter_answer');

    // Missing question
    await request(app)
      .post('/applications/app-1/generate-answer')
      .set('Authorization', 'Bearer token-a')
      .send({})
      .expect(400);
  });

  it('preserves application and returns 503/502 when AI generation fails', async () => {
    const { app, applicationService } = setupApp();

    applicationService.generateCoverLetter.mockRejectedValueOnce(
      new ApplicationMaterialGenerationError('AI provider unavailable')
    );

    await request(app)
      .post('/applications/app-1/generate-cover-letter')
      .set('Authorization', 'Bearer token-a')
      .expect(503);
  });

  it('returns 404 when generating material for non-existent application', async () => {
    const { app, applicationService } = setupApp();

    applicationService.generateCoverLetter.mockRejectedValueOnce(
      new ApplicationNotFoundError()
    );

    await request(app)
      .post('/applications/nonexistent/generate-cover-letter')
      .set('Authorization', 'Bearer token-a')
      .expect(404);
  });
});

import express, { type ErrorRequestHandler, type Express, type RequestHandler } from 'express';
import multer from 'multer';

import { MarkdownProfileValidationError } from './domain/profile/profile-errors.js';
import type { ProfileUploadResult } from './infrastructure/supabase/profile-repository.js';
import type { MatchingService } from './services/matching-service.js';
import { MatchingError } from './matching/types.js';
import type { JobService } from './services/job-service.js';
import type { JobIngestionService } from './services/job-ingestion-service.js';
import type { ApplicationService } from './services/application-service.js';
import {
  ApplicationConflictError,
  ApplicationMaterialGenerationError,
  ApplicationNotFoundError,
  ApplicationValidationError,
} from './domain/application/application-errors.js';
import { APPLICATION_STATUSES, type ApplicationStatus } from './domain/application/application-types.js';
import type { Logger } from './logging/logger.interface.js';

type ProfileUploadService = {
  upload(input: { candidateId: string; fileName: string; contents: string }): Promise<ProfileUploadResult>;
};

type Authenticator = (accessToken: string) => Promise<{ userId: string; accessToken: string }>;

export type AppDependencies = {
  createProfileService: (accessToken: string) => ProfileUploadService;
  authenticate: Authenticator;
  profileDocumentMaxBytes: number;
  matchingService?: MatchingService;
  createMatchingService?: (accessToken: string) => MatchingService;
  jobService?: { scrape(input: { candidateId: string; source: string; keyword?: string; location?: string; remote?: boolean }, accessToken: string): Promise<unknown> };
  createJobService?: (accessToken: string) => JobService;
  createJobIngestionService?: (accessToken: string) => JobIngestionService;
  createJobEmbeddingService?: (accessToken: string, candidateId: string) => { embed(jobId: string): Promise<void> };
  createApplicationService?: (accessToken: string) => ApplicationService;
  logger?: Logger;
};

type InvalidUploadError = Error & { code: 'INVALID_UPLOAD' };

export function createApp(dependencies: AppDependencies): Express {
  const app = express();
  const upload = multer({ storage: multer.memoryStorage(), limits: { files: 1, fileSize: dependencies.profileDocumentMaxBytes } });
  const authenticate: RequestHandler = async (req, res, next) => {
    const token = /^Bearer\s+(.+)$/i.exec(req.header('authorization') ?? '')?.[1];
    if (!token) return void res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } });
    try {
      res.locals.auth = await dependencies.authenticate(token);
      next();
    } catch {
      res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } });
    }
  };

  app.use(express.json());
  if (dependencies.createJobService) {
    app.get('/jobs', authenticate, async (req, res, next) => { const started = Date.now(); try { const limit = req.query.limit === undefined ? 20 : Number(req.query.limit); const offset = req.query.offset === undefined ? 0 : Number(req.query.offset); if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) return void res.status(400).json({ error: { code: 'INVALID_JOB_QUERY', message: 'Job pagination is invalid.' } }); const q = (key: string) => typeof req.query[key] === 'string' && req.query[key].trim() ? req.query[key].trim() : undefined; const result = await dependencies.createJobService!(res.locals.auth.accessToken).list(res.locals.auth.userId, { limit, offset, source: q('source'), company: q('company'), keyword: q('keyword') }); dependencies.logger?.info({ event: 'job.list.completed', candidateId: res.locals.auth.userId, limit, offset, resultCount: result.items.length, durationMs: Date.now() - started }); res.json({ items: (result.items as any[]).map((j) => ({ id: j.id, title: j.title, company: j.company_name, source: j.source, location: j.location, jobUrl: j.canonical_url, publishedAt: j.published_at, createdAt: j.created_at })), pagination: { limit, offset, total: result.total } }); } catch (e) { dependencies.logger?.error({ event: 'job.list.failed', durationMs: Date.now() - started }); next(e); } });
    app.get('/jobs/:id', authenticate, async (req, res, next) => { try { const job = await dependencies.createJobService!(res.locals.auth.accessToken).detail(res.locals.auth.userId, String(req.params.id)); if (!job) return void res.status(404).json({ error: { code: 'JOB_NOT_FOUND', message: 'Job was not found.' } }); const j = job as any; dependencies.logger?.info({ event: 'job.detail.completed', candidateId: res.locals.auth.userId, jobId: j.id }); res.json({ id: j.id, title: j.title, company: j.company_name, source: j.source, location: j.location, jobUrl: j.canonical_url, description: j.description, employmentType: j.employment_type, workplaceType: j.workplace_type, publishedAt: j.published_at, status: j.status, skills: j.job_skills?.map((s: any) => ({ displayName: s.display_name, canonicalName: s.canonical_name })) ?? [] }); } catch (e) { dependencies.logger?.error({ event: 'job.detail.failed', jobId: String(req.params.id) }); next(e); } });
    app.patch('/jobs/:id', authenticate, async (req, res, next) => { try { const keys = Object.keys(req.body ?? {}); if (keys.length !== 1 || !['status'].includes(keys[0] ?? '') || !['active', 'expired', 'closed'].includes(req.body.status)) return void res.status(400).json({ error: { code: 'INVALID_JOB_UPDATE', message: 'Job update is invalid.' } }); const job = await dependencies.createJobService!(res.locals.auth.accessToken).update(res.locals.auth.userId, String(req.params.id), { status: req.body.status }); if (!job) return void res.status(404).json({ error: { code: 'JOB_NOT_FOUND', message: 'Job was not found.' } }); dependencies.logger?.info({ event: 'job.update.completed', candidateId: res.locals.auth.userId, jobId: String(req.params.id) }); res.json(job); } catch (e) { dependencies.logger?.error({ event: 'job.update.failed', jobId: String(req.params.id) }); next(e); } });
  }
  if (dependencies.createJobIngestionService) app.post('/jobs/ingest', authenticate, async (req, res, next) => { try { const body = req.body as any; if (!body || typeof body.source !== 'string' || typeof body.url !== 'string' || typeof body.fetchedAt !== 'string' || !body.payload || typeof body.payload !== 'object') return void res.status(400).json({ error: { code: 'INVALID_JOB_PAYLOAD', message: 'Job payload is invalid.' } }); const result = await dependencies.createJobIngestionService!(res.locals.auth.accessToken).ingest(body, res.locals.auth.userId); let embeddingStatus = 'skipped'; if (result.changed && dependencies.createJobEmbeddingService) try { await dependencies.createJobEmbeddingService(res.locals.auth.accessToken, res.locals.auth.userId).embed(result.jobId); embeddingStatus = 'completed'; } catch { embeddingStatus = 'failed'; } const event = embeddingStatus === 'failed' ? 'job.ingestion.partial' : 'job.ingestion.completed'; dependencies.logger?.info({ event, candidateId: res.locals.auth.userId, jobId: result.jobId, source: body.source, ...(embeddingStatus === 'failed' ? { stage: 'embedding', errorCode: 'EMBEDDING_FAILED' } : {}) }); res.status(201).json({ status: result.created ? 'inserted' : result.changed ? 'updated' : 'duplicate', jobId: result.jobId, embeddingStatus }); } catch (e) { dependencies.logger?.error({ event: 'job.ingestion.failed' }); next(e); } });
  const jobService = dependencies.jobService;
  if (jobService) app.post('/jobs/scrape', authenticate, async (req, res, next) => {
    try {
      const { source, keyword, location, remote } = req.body as Record<string, unknown>;
      if (typeof source !== 'string' || !source.trim() || (keyword !== undefined && typeof keyword !== 'string') || (location !== undefined && typeof location !== 'string') || (remote !== undefined && typeof remote !== 'boolean')) return void res.status(400).json({ error: { code: 'INVALID_SCRAPE_REQUEST', message: 'Scrape request is invalid.' } });
      res.status(202).json(await jobService.scrape({ candidateId: res.locals.auth.userId, source: source.trim(), ...(typeof keyword === 'string' ? { keyword } : {}), ...(typeof location === 'string' ? { location } : {}), ...(typeof remote === 'boolean' ? { remote } : {}) }, res.locals.auth.accessToken));
    } catch (error) { next(error); }
  });
  app.post('/v1/profile/document', authenticate, upload.single('document'), async (req, res, next) => {
    try {
      if (!req.file) throw invalidUpload('A document file is required.');
      if (!/\.md$/i.test(req.file.originalname)) throw invalidUpload('The document must use a .md filename.');
      const contents = new TextDecoder('utf-8', { fatal: true }).decode(req.file.buffer);
      const result = await dependencies.createProfileService(res.locals.auth.accessToken).upload({
        candidateId: res.locals.auth.userId,
        fileName: req.file.originalname,
        contents
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });
  if (dependencies.matchingService || dependencies.createMatchingService) {
    app.get('/matching/jobs/:candidateId', authenticate, async (req, res, next) => {
      try {
        const candidateId = String(req.params.candidateId ?? '');
        if (candidateId !== res.locals.auth.userId) return void res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Candidate access is forbidden.' } });
        const limit = req.query.limit === undefined ? 20 : Number(req.query.limit);
        const threshold = req.query.threshold === undefined ? 0 : Number(req.query.threshold);
        if (!Number.isInteger(limit) || limit < 1 || limit > 200 || !Number.isFinite(threshold) || threshold < -1 || threshold > 1) return void res.status(400).json({ error: { code: 'INVALID_MATCHING_QUERY', message: 'Matching limit or threshold is invalid.' } });
        const matchingService = dependencies.createMatchingService?.(res.locals.auth.accessToken) ?? dependencies.matchingService;
        if (!matchingService) throw new MatchingError('VECTOR_SEARCH_FAILED', 'Matching service is unavailable.');
        const recommendations = await matchingService.recommend(candidateId, limit, threshold, res.locals.auth.accessToken);
        res.json(recommendations.map((recommendation) => ({ job_id: recommendation.jobId, similarity: recommendation.similarity, rule_score: recommendation.ruleScore, breakdown: recommendation.breakdown, ai_analysis: recommendation.aiAnalysis, recommendation: recommendation.recommendation })));
      } catch (error) { next(error); }
    });
  }

  if (dependencies.createApplicationService) {
    app.get('/applications', authenticate, async (req, res, next) => {
      try {
        const limit = req.query.limit === undefined ? 20 : Number(req.query.limit);
        const offset = req.query.offset === undefined ? 0 : Number(req.query.offset);
        const status = typeof req.query.status === 'string' && req.query.status.trim() ? (req.query.status.trim() as ApplicationStatus) : undefined;
        if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) {
          return void res.status(400).json({ error: { code: 'INVALID_APPLICATION_QUERY', message: 'Application pagination is invalid.' } });
        }
        if (status && !APPLICATION_STATUSES.includes(status)) {
          return void res.status(400).json({ error: { code: 'INVALID_APPLICATION_QUERY', message: 'Application status filter is invalid.' } });
        }
        const service = dependencies.createApplicationService!(res.locals.auth.accessToken);
        const result = await service.list(res.locals.auth.userId, { limit, offset, status });
        res.json({
          items: result.items,
          pagination: { limit, offset, total: result.total },
        });
      } catch (error) { next(error); }
    });

    app.post('/applications', authenticate, async (req, res, next) => {
      try {
        const body = req.body as Record<string, unknown>;
        if (!body || typeof body.jobId !== 'string' || !body.jobId.trim()) {
          return void res.status(400).json({ error: { code: 'INVALID_APPLICATION_REQUEST', message: 'Job ID is required.' } });
        }
        if (body.status !== undefined && (!APPLICATION_STATUSES.includes(body.status as ApplicationStatus))) {
          return void res.status(400).json({ error: { code: 'INVALID_APPLICATION_REQUEST', message: 'Invalid application status.' } });
        }
        const service = dependencies.createApplicationService!(res.locals.auth.accessToken);
        const application = await service.create(res.locals.auth.userId, {
          jobId: body.jobId.trim(),
          status: body.status as ApplicationStatus | undefined,
          notes: typeof body.notes === 'string' ? body.notes : undefined,
          appliedAt: typeof body.appliedAt === 'string' ? body.appliedAt : undefined,
        });
        res.status(201).json(application);
      } catch (error) { next(error); }
    });

    app.get('/applications/:id', authenticate, async (req, res, next) => {
      try {
        const service = dependencies.createApplicationService!(res.locals.auth.accessToken);
        const application = await service.detail(res.locals.auth.userId, String(req.params.id));
        if (!application) {
          return void res.status(404).json({ error: { code: 'APPLICATION_NOT_FOUND', message: 'Application was not found.' } });
        }
        res.json(application);
      } catch (error) { next(error); }
    });

    app.patch('/applications/:id', authenticate, async (req, res, next) => {
      try {
        const body = req.body as Record<string, unknown>;
        const keys = Object.keys(body ?? {});
        if (keys.length === 0 || keys.some((k) => !['status', 'notes', 'appliedAt'].includes(k))) {
          return void res.status(400).json({ error: { code: 'INVALID_APPLICATION_UPDATE', message: 'Application update fields are invalid.' } });
        }
        if (body.status !== undefined && !APPLICATION_STATUSES.includes(body.status as ApplicationStatus)) {
          return void res.status(400).json({ error: { code: 'INVALID_APPLICATION_UPDATE', message: 'Invalid application status.' } });
        }
        const service = dependencies.createApplicationService!(res.locals.auth.accessToken);
        const updated = await service.update(res.locals.auth.userId, String(req.params.id), {
          status: body.status as ApplicationStatus | undefined,
          notes: typeof body.notes === 'string' ? body.notes : undefined,
          appliedAt: typeof body.appliedAt === 'string' || body.appliedAt === null ? body.appliedAt : undefined,
        });
        if (!updated) {
          return void res.status(404).json({ error: { code: 'APPLICATION_NOT_FOUND', message: 'Application was not found.' } });
        }
        res.json(updated);
      } catch (error) { next(error); }
    });

    app.post('/applications/:id/generate-cover-letter', authenticate, async (req, res, next) => {
      try {
        const service = dependencies.createApplicationService!(res.locals.auth.accessToken);
        const material = await service.generateCoverLetter(res.locals.auth.userId, String(req.params.id), req.body);
        res.status(201).json(material);
      } catch (error) { next(error); }
    });

    app.post('/applications/:id/generate-introduction', authenticate, async (req, res, next) => {
      try {
        const service = dependencies.createApplicationService!(res.locals.auth.accessToken);
        const material = await service.generateIntroduction(res.locals.auth.userId, String(req.params.id), req.body);
        res.status(201).json(material);
      } catch (error) { next(error); }
    });

    app.post('/applications/:id/generate-answer', authenticate, async (req, res, next) => {
      try {
        const body = req.body as Record<string, unknown>;
        if (!body || typeof body.question !== 'string' || !body.question.trim()) {
          return void res.status(400).json({ error: { code: 'INVALID_APPLICATION_REQUEST', message: 'Recruiter question is required.' } });
        }
        const service = dependencies.createApplicationService!(res.locals.auth.accessToken);
        const material = await service.generateRecruiterAnswer(res.locals.auth.userId, String(req.params.id), {
          question: body.question.trim(),
          context: typeof body.context === 'string' ? body.context : undefined,
        });
        res.status(201).json(material);
      } catch (error) { next(error); }
    });
  }

  app.use(errorHandler);
  return app;
}

function invalidUpload(message: string): InvalidUploadError {
  return Object.assign(new Error(message), { code: 'INVALID_UPLOAD' as const });
}

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof MarkdownProfileValidationError) {
    return void res.status(422).json({ error: { code: 'INVALID_PROFILE_MARKDOWN', message: error.message }, issues: error.issues });
  }
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return void res.status(413).json({ error: { code: 'FILE_TOO_LARGE', message: 'The document exceeds the configured size limit.' } });
  }
  if ((error as Partial<InvalidUploadError>).code === 'INVALID_UPLOAD') {
    return void res.status(400).json({ error: { code: 'INVALID_UPLOAD', message: error.message } });
  }
  if (error instanceof ApplicationNotFoundError) {
    return void res.status(404).json({ error: { code: 'APPLICATION_NOT_FOUND', message: error.message } });
  }
  if (error instanceof ApplicationConflictError) {
    return void res.status(409).json({ error: { code: 'APPLICATION_CONFLICT', message: error.message } });
  }
  if (error instanceof ApplicationValidationError) {
    return void res.status(400).json({ error: { code: 'INVALID_APPLICATION_REQUEST', message: error.message } });
  }
  if (error instanceof ApplicationMaterialGenerationError) {
    return void res.status(503).json({ error: { code: 'MATERIAL_GENERATION_FAILED', message: error.message } });
  }
  if (error instanceof MatchingError) return void res.status(503).json({ error: { code: error.code, message: error.message } });
  res.status(502).json({ error: { code: 'PROFILE_STORAGE_FAILED', message: 'The candidate profile could not be saved.' } });
};

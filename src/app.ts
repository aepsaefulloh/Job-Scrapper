import express, { type ErrorRequestHandler, type Express, type RequestHandler } from 'express';
import multer from 'multer';

import { MarkdownProfileValidationError } from './domain/profile/profile-errors.js';
import type { ProfileUploadResult } from './infrastructure/supabase/profile-repository.js';
import type { MatchingService } from './services/matching-service.js';
import { MatchingError } from './matching/types.js';

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
  if (error instanceof MatchingError) return void res.status(503).json({ error: { code: error.code, message: error.message } });
  res.status(502).json({ error: { code: 'PROFILE_STORAGE_FAILED', message: 'The candidate profile could not be saved.' } });
};

import { describe, expect, it, vi } from 'vitest';
import { ApplicationService } from '../../../src/services/application-service.js';
import type { ApplicationRepository } from '../../../src/infrastructure/supabase/application-repository.js';
import type { MatchingRepository } from '../../../src/matching/matching.repository.js';
import type { ApplicationAssistant } from '../../../src/ai/assistant/application-assistant.service.js';
import {
  ApplicationConflictError,
  ApplicationNotFoundError,
  ApplicationValidationError,
} from '../../../src/domain/application/application-errors.js';

describe('ApplicationService', () => {
  const mockRepo: Record<keyof ApplicationRepository, any> = {
    create: vi.fn(),
    findById: vi.fn(),
    findByJobId: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    saveMaterial: vi.fn(),
    listMaterials: vi.fn(),
  };

  const mockMatchingRepo: Record<keyof Pick<MatchingRepository, 'getCandidateContext' | 'getJobContext'>, any> = {
    getCandidateContext: vi.fn(),
    getJobContext: vi.fn(),
  };

  const mockAssistant: Record<keyof ApplicationAssistant, any> = {
    generateCoverLetter: vi.fn(),
    generateIntroduction: vi.fn(),
    generateRecruiterAnswer: vi.fn(),
  };

  const service = new ApplicationService(
    mockRepo as unknown as ApplicationRepository,
    mockMatchingRepo as unknown as MatchingRepository,
    mockAssistant as unknown as ApplicationAssistant
  );

  it('creates an application when job exists and no active application is present', async () => {
    mockMatchingRepo.getJobContext.mockResolvedValueOnce({ text: 'job text', scoring: {} });
    mockRepo.findByJobId.mockResolvedValueOnce(null);
    mockRepo.create.mockResolvedValueOnce({
      id: 'app-1',
      candidateId: 'cand-1',
      jobId: 'job-1',
      status: 'saved',
    });

    const result = await service.create('cand-1', { jobId: 'job-1', status: 'saved' });
    expect(result.id).toBe('app-1');
  });

  it('rejects duplicate active application for the same job with ApplicationConflictError', async () => {
    mockMatchingRepo.getJobContext.mockResolvedValueOnce({ text: 'job text', scoring: {} });
    mockRepo.findByJobId.mockResolvedValueOnce({ id: 'app-existing' });

    await expect(
      service.create('cand-1', { jobId: 'job-1' })
    ).rejects.toThrow(ApplicationConflictError);
  });

  it('generates and persists cover letter without mutating application record', async () => {
    mockRepo.findById.mockResolvedValueOnce({
      id: 'app-1',
      candidateId: 'cand-1',
      jobId: 'job-1',
      status: 'saved',
    });
    mockMatchingRepo.getCandidateContext.mockResolvedValueOnce({ text: 'candidate profile', scoring: {} });
    mockMatchingRepo.getJobContext.mockResolvedValueOnce({ text: 'job details', scoring: {} });
    mockAssistant.generateCoverLetter.mockResolvedValueOnce('Dear Team,\n\nI love this role.');
    mockRepo.saveMaterial.mockResolvedValueOnce({
      id: 'mat-1',
      applicationId: 'app-1',
      candidateId: 'cand-1',
      materialType: 'cover_letter',
      content: 'Dear Team,\n\nI love this role.',
      createdAt: '2026-09-23T12:00:00Z',
    });

    const result = await service.generateCoverLetter('cand-1', 'app-1', { notes: 'focus on Go' });
    expect(result.content).toContain('Dear Team');
    expect(mockRepo.update).not.toHaveBeenCalled();
    expect(mockRepo.saveMaterial).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: 'app-1',
        candidateId: 'cand-1',
        materialType: 'cover_letter',
      })
    );
  });

  it('rejects generating recruiter answer if question is empty', async () => {
    await expect(
      service.generateRecruiterAnswer('cand-1', 'app-1', { question: '' })
    ).rejects.toThrow(ApplicationValidationError);
  });

  it('throws ApplicationNotFoundError when generating material for non-existent application', async () => {
    mockRepo.findById.mockResolvedValueOnce(null);

    await expect(
      service.generateCoverLetter('cand-1', 'nonexistent-app')
    ).rejects.toThrow(ApplicationNotFoundError);
  });
});

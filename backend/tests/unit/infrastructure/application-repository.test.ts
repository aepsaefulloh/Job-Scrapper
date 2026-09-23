import { describe, expect, it, vi } from 'vitest';
import { SupabaseApplicationRepository } from '../../../src/infrastructure/supabase/application-repository.js';

describe('SupabaseApplicationRepository', () => {
  it('creates an application row scoped to candidate and job', async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'app-1',
        candidate_id: 'cand-1',
        job_id: 'job-1',
        status: 'saved',
        notes: 'Interested',
        applied_at: null,
        created_at: '2026-09-23T12:00:00Z',
        updated_at: '2026-09-23T12:00:00Z',
      },
      error: null,
    });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
    const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });

    const repo = new SupabaseApplicationRepository({ from: mockFrom } as never);
    const result = await repo.create('cand-1', {
      jobId: 'job-1',
      status: 'saved',
      notes: 'Interested',
    });

    expect(result.id).toBe('app-1');
    expect(result.status).toBe('saved');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        candidate_id: 'cand-1',
        job_id: 'job-1',
        status: 'saved',
        notes: 'Interested',
      })
    );
  });

  it('updates application status with candidate scope', async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'app-1',
        candidate_id: 'cand-1',
        job_id: 'job-1',
        status: 'applied',
        notes: 'Applied via site',
        applied_at: '2026-09-23T13:00:00Z',
        created_at: '2026-09-23T12:00:00Z',
        updated_at: '2026-09-23T13:00:00Z',
      },
      error: null,
    });
    const mockSelect = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqId = vi.fn().mockReturnValue({ select: mockSelect });
    const mockEqCandidate = vi.fn().mockReturnValue({ eq: mockEqId });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqCandidate });
    const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

    const repo = new SupabaseApplicationRepository({ from: mockFrom } as never);
    const result = await repo.update('cand-1', 'app-1', {
      status: 'applied',
      appliedAt: '2026-09-23T13:00:00Z',
      notes: 'Applied via site',
    });

    expect(result?.status).toBe('applied');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'applied',
        applied_at: '2026-09-23T13:00:00Z',
      })
    );
  });

  it('persists generated application material and lists by application', async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'mat-1',
        application_id: 'app-1',
        candidate_id: 'cand-1',
        material_type: 'cover_letter',
        content: 'Dear team...',
        prompt_input: 'extra info',
        metadata: {},
        created_at: '2026-09-23T12:30:00Z',
      },
      error: null,
    });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
    const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });

    const repo = new SupabaseApplicationRepository({ from: mockFrom } as never);
    const saved = await repo.saveMaterial({
      applicationId: 'app-1',
      candidateId: 'cand-1',
      materialType: 'cover_letter',
      content: 'Dear team...',
      promptInput: 'extra info',
    });

    expect(saved.id).toBe('mat-1');
    expect(saved.materialType).toBe('cover_letter');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        application_id: 'app-1',
        candidate_id: 'cand-1',
        material_type: 'cover_letter',
        content: 'Dear team...',
      })
    );
  });
});

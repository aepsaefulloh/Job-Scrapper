import { describe, it, expect, vi } from 'vitest';
import { SearchProfileService } from '../../../src/search/search-profile.service.js';
import type { SearchProfileRepository } from '../../../src/search/search-profile.repository.js';
import type { CandidateProfileDetail } from '../../../src/infrastructure/supabase/profile-repository.js';
import type { CandidateSearchProfile } from '../../../src/search/search-types.js';

const financeProfile: CandidateProfileDetail = {
  id: 'prof-1',
  candidateId: 'cand-1',
  displayName: 'Budi Santoso',
  headline: 'Staf Akuntansi',
  summary: 'Pengalaman 3 tahun sebagai akuntan di perusahaan manufaktur.',
  experience: 'PT ABC Manufacturing | Akuntan | 2021-2024',
  careerPreferences: null,
  skills: [
    { displayName: 'Microsoft Excel', canonicalName: 'microsoft excel' },
    { displayName: 'Laporan Keuangan', canonicalName: 'laporan keuangan' },
    { displayName: 'Rekonsiliasi', canonicalName: 'rekonsiliasi' },
  ],
  updatedAt: '2026-01-01T00:00:00Z',
};

const mockEmptyRepo: SearchProfileRepository = {
  save: vi.fn().mockResolvedValue(undefined),
  get: vi.fn().mockResolvedValue(null),
};

describe('SearchProfileService', () => {
  describe('deriveFromProfile', () => {
    const service = new SearchProfileService(mockEmptyRepo);

    it('extracts primary skills from profile skills', () => {
      const result = service.deriveFromProfile(financeProfile, 'cand-1');
      expect(result.primarySkills).toContain('Microsoft Excel');
      expect(result.primarySkills).toContain('Laporan Keuangan');
    });

    it('derives target roles from headline', () => {
      const result = service.deriveFromProfile(financeProfile, 'cand-1');
      expect(result.targetRoles.length).toBeGreaterThan(0);
      expect(result.targetRoles[0]).toContain('Staf Akuntansi');
    });

    it('sets candidateId correctly', () => {
      const result = service.deriveFromProfile(financeProfile, 'cand-1');
      expect(result.candidateId).toBe('cand-1');
    });

    it('sets generatedAt to a recent ISO timestamp', () => {
      const before = Date.now();
      const result = service.deriveFromProfile(financeProfile, 'cand-1');
      const after = Date.now();
      const ts = new Date(result.generatedAt).getTime();
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });

    it('defaults sources to ["jobstreet"]', () => {
      const result = service.deriveFromProfile(financeProfile, 'cand-1');
      expect(result.sources).toContain('jobstreet');
    });

    it('handles profile with no skills gracefully', () => {
      const result = service.deriveFromProfile({ ...financeProfile, skills: [] }, 'cand-1');
      expect(result.primarySkills).toEqual([]);
      expect(result.secondarySkills).toEqual([]);
    });

    it('returns empty targetRoles for null headline', () => {
      const result = service.deriveFromProfile({ ...financeProfile, headline: null }, 'cand-1');
      expect(result.targetRoles).toEqual([]);
    });
  });

  describe('getOrDerive', () => {
    it('returns existing profile from repo without saving', async () => {
      const existing: CandidateSearchProfile = {
        candidateId: 'cand-1',
        targetRoles: ['Accountant'],
        roleAliases: [],
        primarySkills: ['Excel'],
        secondarySkills: [],
        industries: [],
        seniority: [],
        preferredLocations: [],
        workModes: [],
        employmentTypes: ['full-time'],
        excludedRoles: [],
        excludedKeywords: [],
        excludedCompanies: [],
        languages: [],
        sources: ['jobstreet'],
        generatedAt: '2026-01-01T00:00:00Z',
      };
      const repoWithExisting: SearchProfileRepository = {
        save: vi.fn(),
        get: vi.fn().mockResolvedValue(existing),
      };
      const svc = new SearchProfileService(repoWithExisting);
      const result = await svc.getOrDerive('cand-1', financeProfile);
      expect(result.candidateId).toBe('cand-1');
      expect(repoWithExisting.save).not.toHaveBeenCalled();
    });

    it('derives and saves when no profile exists', async () => {
      const saveRepo: SearchProfileRepository = {
        save: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue(null),
      };
      const svc = new SearchProfileService(saveRepo);
      const result = await svc.getOrDerive('cand-1', financeProfile);
      expect(result.candidateId).toBe('cand-1');
      expect(saveRepo.save).toHaveBeenCalledOnce();
    });
  });
});

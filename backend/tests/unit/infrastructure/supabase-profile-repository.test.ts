import { describe, expect, it, vi } from 'vitest';
import { SupabaseProfileRepository } from '../../../src/infrastructure/supabase/profile-repository.js';

describe('SupabaseProfileRepository', () => {
  it('updates the active profile and updates skills', async () => {
    const candidateId = 'cand-123';
    const profileId = 'prof-456';

    const mockProfileRow = {
      id: profileId,
      candidate_id: candidateId,
      display_name: 'Jane Doe Updated',
      headline: 'Lead Architect',
      summary: 'Experienced system designer',
      experience: '10 years experience',
      career_preferences: 'Remote only',
      updated_at: '2026-09-24T12:00:00Z',
    };

    const mockSkillsRows = [
      { display_name: 'TypeScript', canonical_name: 'typescript' },
      { display_name: 'Vue.js', canonical_name: 'vue.js' },
    ];

    // Mock query chains
    const mockFrom = vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: mockProfileRow,
                    error: null,
                  }),
                })),
              })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
        };
      }
      if (table === 'profile_skills') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({
              data: mockSkillsRows,
              error: null,
            }),
          })),
          delete: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const repo = new SupabaseProfileRepository({ from: mockFrom } as never);

    const result = await repo.updateActiveProfile(candidateId, {
      displayName: 'Jane Doe Updated',
      headline: 'Lead Architect',
      summary: 'Experienced system designer',
      experience: '10 years experience',
      careerPreferences: 'Remote only',
      skills: [
        { displayName: 'TypeScript', canonicalName: 'typescript' },
        { displayName: 'Vue.js', canonicalName: 'vue.js' },
      ],
    });

    expect(result.id).toBe(profileId);
    expect(result.displayName).toBe('Jane Doe Updated');
    expect(result.skills).toHaveLength(2);
    expect(result.skills[0].displayName).toBe('TypeScript');
  });

  it('throws error when active profile does not exist', async () => {
    const candidateId = 'cand-not-found';
    const mockFrom = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            })),
          })),
        })),
      })),
    }));

    const repo = new SupabaseProfileRepository({ from: mockFrom } as never);

    await expect(
      repo.updateActiveProfile(candidateId, { displayName: 'Jane' })
    ).rejects.toThrow('Active profile not found.');
  });
});

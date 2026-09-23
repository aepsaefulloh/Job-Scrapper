import { describe, expect, it, vi } from 'vitest';
import { ApplicationAssistantService } from '../../../src/ai/assistant/application-assistant.service.js';
import type { LlmService } from '../../../src/ai/completion/llm.service.js';
import { ApplicationMaterialGenerationError } from '../../../src/domain/application/application-errors.js';

describe('ApplicationAssistantService', () => {
  const mockLlm: Pick<LlmService, 'completeJson'> = {
    completeJson: vi.fn(),
  };

  const service = new ApplicationAssistantService(mockLlm as LlmService, 'test-model');

  it('generates a cover letter based on candidate profile and job details', async () => {
    (mockLlm.completeJson as any).mockResolvedValueOnce({
      content: 'Dear Hiring Manager,\n\nI am writing to express my interest in the Software Engineer position...',
    });

    const result = await service.generateCoverLetter(
      'Headline: Senior Go Developer\nSkills: Go, Docker',
      'Title: Go Engineer\nCompany: TechCorp',
      { notes: 'Highlight concurrent backend experience' }
    );

    expect(result).toContain('Dear Hiring Manager');
    expect(mockLlm.completeJson).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'test-model',
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('Highlight concurrent backend experience'),
          }),
        ]),
      }),
      expect.anything()
    );
  });

  it('generates an introduction pitch for recruiter outreach', async () => {
    (mockLlm.completeJson as any).mockResolvedValueOnce({
      content: 'Hi recruiter, I noticed the Go Engineer opening at TechCorp...',
    });

    const result = await service.generateIntroduction(
      'Headline: Senior Go Developer',
      'Title: Go Engineer\nCompany: TechCorp',
      { platform: 'linkedin' }
    );

    expect(result).toContain('TechCorp');
  });

  it('generates an authentic answer to a recruiter question', async () => {
    (mockLlm.completeJson as any).mockResolvedValueOnce({
      content: 'In my past experience with Go, I handled high-throughput pipelines...',
    });

    const result = await service.generateRecruiterAnswer(
      'Headline: Senior Go Developer',
      'Title: Go Engineer\nCompany: TechCorp',
      { question: 'Tell me about a time you optimized database queries.' }
    );

    expect(result).toContain('In my past experience');
  });

  it('throws ApplicationMaterialGenerationError when LLM fails without corrupting caller', async () => {
    (mockLlm.completeJson as any).mockRejectedValueOnce(new Error('LLM connection timeout'));

    await expect(
      service.generateCoverLetter('profile', 'job')
    ).rejects.toThrow(ApplicationMaterialGenerationError);
  });
});

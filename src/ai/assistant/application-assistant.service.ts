import { z } from 'zod';
import type { LlmService } from '../completion/llm.service.js';
import { ApplicationMaterialGenerationError } from '../../domain/application/application-errors.js';
import type {
  GenerateAnswerInput,
  GenerateCoverLetterInput,
  GenerateIntroductionInput,
} from '../../domain/application/application-types.js';

const materialResponseSchema = z.object({
  content: z.string().trim().min(10),
});

export interface ApplicationAssistant {
  generateCoverLetter(
    candidateContext: string,
    jobContext: string,
    input?: GenerateCoverLetterInput
  ): Promise<string>;
  generateIntroduction(
    candidateContext: string,
    jobContext: string,
    input?: GenerateIntroductionInput
  ): Promise<string>;
  generateRecruiterAnswer(
    candidateContext: string,
    jobContext: string,
    input: GenerateAnswerInput
  ): Promise<string>;
}

export class ApplicationAssistantService implements ApplicationAssistant {
  public constructor(
    private readonly llm: Pick<LlmService, 'completeJson'>,
    private readonly model: string
  ) {}

  public async generateCoverLetter(
    candidateContext: string,
    jobContext: string,
    input?: GenerateCoverLetterInput
  ): Promise<string> {
    const systemPrompt =
      'You are an expert career advisor. Generate a compelling, professional cover letter tailored for the candidate applying to the given job. Focus on matching the candidate\'s authentic skills and experience to the role requirements without fabricating facts. Return JSON with the key "content".';

    const userPrompt = [
      'Candidate Profile:',
      candidateContext,
      '',
      'Job Details:',
      jobContext,
      input?.notes ? `\nCandidate Preferences / Notes: ${input.notes}` : '',
    ].join('\n');

    return this.completePrompt(systemPrompt, userPrompt);
  }

  public async generateIntroduction(
    candidateContext: string,
    jobContext: string,
    input?: GenerateIntroductionInput
  ): Promise<string> {
    const platform = input?.platform ?? 'general';
    const systemPrompt = `You are an expert career advisor. Generate a concise, engaging professional introduction/self-pitch for the candidate to introduce themselves for the role via ${platform}. Highlight genuine relevance to the opportunity. Return JSON with the key "content".`;

    const userPrompt = [
      'Candidate Profile:',
      candidateContext,
      '',
      'Job Details:',
      jobContext,
      input?.notes ? `\nCandidate Preferences / Notes: ${input.notes}` : '',
    ].join('\n');

    return this.completePrompt(systemPrompt, userPrompt);
  }

  public async generateRecruiterAnswer(
    candidateContext: string,
    jobContext: string,
    input: GenerateAnswerInput
  ): Promise<string> {
    const systemPrompt =
      'You are an expert career advisor. Generate a targeted, articulate answer to the recruiter\'s screening or interview question. Strictly ground the answer in the candidate\'s actual background and connect it directly to the target role. Return JSON with the key "content".';

    const userPrompt = [
      'Candidate Profile:',
      candidateContext,
      '',
      'Job Details:',
      jobContext,
      '',
      `Recruiter Question: ${input.question}`,
      input.context ? `Additional Question Context: ${input.context}` : '',
    ].join('\n');

    return this.completePrompt(systemPrompt, userPrompt);
  }

  private async completePrompt(systemPrompt: string, userPrompt: string): Promise<string> {
    try {
      const result = await this.llm.completeJson(
        {
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        },
        materialResponseSchema
      );
      return result.content;
    } catch (error) {
      throw new ApplicationMaterialGenerationError('Failed to generate application material.', {
        cause: error,
      });
    }
  }
}

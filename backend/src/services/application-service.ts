import type { ApplicationRepository } from '../infrastructure/supabase/application-repository.js';
import type { MatchingRepository } from '../matching/matching.repository.js';
import type { ApplicationAssistant } from '../ai/assistant/application-assistant.service.js';
import type { Logger } from '../logging/logger.interface.js';
import {
  ApplicationConflictError,
  ApplicationNotFoundError,
  ApplicationValidationError,
} from '../domain/application/application-errors.js';
import {
  APPLICATION_STATUSES,
  type ApplicationRecord,
  type ApplicationStatus,
  type CreateApplicationInput,
  type GenerateAnswerInput,
  type GenerateCoverLetterInput,
  type GenerateIntroductionInput,
  type GeneratedMaterial,
  type UpdateApplicationInput,
} from '../domain/application/application-types.js';

export class ApplicationService {
  public constructor(
    private readonly repository: ApplicationRepository,
    private readonly matchingRepo: Pick<MatchingRepository, 'getCandidateContext' | 'getJobContext'>,
    private readonly assistant: ApplicationAssistant,
    private readonly logger?: Logger
  ) {}

  public async create(candidateId: string, input: CreateApplicationInput): Promise<ApplicationRecord> {
    if (!input.jobId || typeof input.jobId !== 'string' || !input.jobId.trim()) {
      throw new ApplicationValidationError('Job ID is required.');
    }

    if (input.status && !APPLICATION_STATUSES.includes(input.status)) {
      throw new ApplicationValidationError(`Invalid application status: ${input.status}`);
    }

    // Ensure the job exists and belongs to the candidate
    try {
      await this.matchingRepo.getJobContext(candidateId, input.jobId);
    } catch (err: any) {
      throw new ApplicationValidationError('Referenced job was not found for this candidate.');
    }

    // Check for existing active application
    const existing = await this.repository.findByJobId(candidateId, input.jobId);
    if (existing) {
      throw new ApplicationConflictError();
    }

    const application = await this.repository.create(candidateId, input);
    this.logger?.info({
      event: 'application.created',
      candidateId,
      applicationId: application.id,
      jobId: application.jobId,
      status: application.status,
    });
    return application;
  }

  public async list(
    candidateId: string,
    query: { limit: number; offset: number; status?: ApplicationStatus }
  ): Promise<{ items: ApplicationRecord[]; total: number }> {
    return this.repository.list(candidateId, query);
  }

  public async detail(
    candidateId: string,
    applicationId: string
  ): Promise<(ApplicationRecord & { materials: GeneratedMaterial[] }) | null> {
    const application = await this.repository.findById(candidateId, applicationId);
    if (!application) return null;

    const materials = await this.repository.listMaterials(candidateId, applicationId);
    return { ...application, materials };
  }

  public async update(
    candidateId: string,
    applicationId: string,
    patch: UpdateApplicationInput
  ): Promise<ApplicationRecord | null> {
    if (patch.status && !APPLICATION_STATUSES.includes(patch.status)) {
      throw new ApplicationValidationError(`Invalid application status: ${patch.status}`);
    }

    const updated = await this.repository.update(candidateId, applicationId, patch);
    if (updated) {
      this.logger?.info({
        event: 'application.updated',
        candidateId,
        applicationId,
        status: updated.status,
      });
    }
    return updated;
  }

  public async generateCoverLetter(
    candidateId: string,
    applicationId: string,
    input?: GenerateCoverLetterInput
  ): Promise<GeneratedMaterial> {
    const { candidateContext, jobContext } = await this.getContexts(candidateId, applicationId);

    const content = await this.assistant.generateCoverLetter(
      candidateContext.text,
      jobContext.text,
      input
    );

    const material = await this.repository.saveMaterial({
      applicationId,
      candidateId,
      materialType: 'cover_letter',
      content,
      promptInput: input?.notes,
    });

    this.logger?.info({
      event: 'application.material.generated',
      candidateId,
      applicationId,
      materialType: 'cover_letter',
      materialId: material.id,
    });

    return material;
  }

  public async generateIntroduction(
    candidateId: string,
    applicationId: string,
    input?: GenerateIntroductionInput
  ): Promise<GeneratedMaterial> {
    const { candidateContext, jobContext } = await this.getContexts(candidateId, applicationId);

    const content = await this.assistant.generateIntroduction(
      candidateContext.text,
      jobContext.text,
      input
    );

    const material = await this.repository.saveMaterial({
      applicationId,
      candidateId,
      materialType: 'introduction',
      content,
      promptInput: input?.notes ?? input?.platform,
    });

    this.logger?.info({
      event: 'application.material.generated',
      candidateId,
      applicationId,
      materialType: 'introduction',
      materialId: material.id,
    });

    return material;
  }

  public async generateRecruiterAnswer(
    candidateId: string,
    applicationId: string,
    input: GenerateAnswerInput
  ): Promise<GeneratedMaterial> {
    if (!input.question || typeof input.question !== 'string' || !input.question.trim()) {
      throw new ApplicationValidationError('Recruiter question is required.');
    }

    const { candidateContext, jobContext } = await this.getContexts(candidateId, applicationId);

    const content = await this.assistant.generateRecruiterAnswer(
      candidateContext.text,
      jobContext.text,
      input
    );

    const material = await this.repository.saveMaterial({
      applicationId,
      candidateId,
      materialType: 'recruiter_answer',
      content,
      promptInput: input.question,
      metadata: input.context ? { context: input.context } : undefined,
    });

    this.logger?.info({
      event: 'application.material.generated',
      candidateId,
      applicationId,
      materialType: 'recruiter_answer',
      materialId: material.id,
    });

    return material;
  }

  private async getContexts(candidateId: string, applicationId: string) {
    const application = await this.repository.findById(candidateId, applicationId);
    if (!application) {
      throw new ApplicationNotFoundError();
    }

    const [candidateContext, jobContext] = await Promise.all([
      this.matchingRepo.getCandidateContext(candidateId),
      this.matchingRepo.getJobContext(candidateId, application.jobId),
    ]);

    return { application, candidateContext, jobContext };
  }
}

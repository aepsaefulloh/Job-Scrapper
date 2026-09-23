import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types.js';
import type {
  ApplicationRecord,
  ApplicationStatus,
  CreateApplicationInput,
  GeneratedMaterial,
  MaterialType,
  UpdateApplicationInput,
} from '../../domain/application/application-types.js';

export interface ApplicationRepository {
  create(candidateId: string, input: CreateApplicationInput): Promise<ApplicationRecord>;
  findById(candidateId: string, applicationId: string): Promise<ApplicationRecord | null>;
  findByJobId(candidateId: string, jobId: string): Promise<ApplicationRecord | null>;
  list(
    candidateId: string,
    query: { limit: number; offset: number; status?: ApplicationStatus }
  ): Promise<{ items: ApplicationRecord[]; total: number }>;
  update(
    candidateId: string,
    applicationId: string,
    patch: UpdateApplicationInput
  ): Promise<ApplicationRecord | null>;
  saveMaterial(input: {
    applicationId: string;
    candidateId: string;
    materialType: MaterialType;
    content: string;
    promptInput?: string;
    metadata?: Record<string, unknown>;
  }): Promise<GeneratedMaterial>;
  listMaterials(candidateId: string, applicationId: string): Promise<GeneratedMaterial[]>;
}

export class SupabaseApplicationRepository implements ApplicationRepository {
  public constructor(private readonly client: SupabaseClient<Database>) {}

  public async create(candidateId: string, input: CreateApplicationInput): Promise<ApplicationRecord> {
    const { data, error } = await (this.client as any)
      .from('applications')
      .insert({
        candidate_id: candidateId,
        job_id: input.jobId,
        status: input.status ?? 'saved',
        notes: input.notes ?? null,
        applied_at: input.appliedAt ?? null,
      })
      .select('id, candidate_id, job_id, status, notes, applied_at, created_at, updated_at')
      .single();

    if (error || !data) {
      throw new Error(`Failed to create application: ${error?.message ?? 'unknown'}`);
    }

    return mapApplicationRow(data);
  }

  public async findById(candidateId: string, applicationId: string): Promise<ApplicationRecord | null> {
    const { data, error } = await (this.client as any)
      .from('applications')
      .select('id, candidate_id, job_id, status, notes, applied_at, created_at, updated_at, jobs(id, title, company_name, location, source, canonical_url)')
      .eq('candidate_id', candidateId)
      .eq('id', applicationId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find application: ${error.message}`);
    }

    return data ? mapApplicationRow(data) : null;
  }

  public async findByJobId(candidateId: string, jobId: string): Promise<ApplicationRecord | null> {
    const { data, error } = await (this.client as any)
      .from('applications')
      .select('id, candidate_id, job_id, status, notes, applied_at, created_at, updated_at')
      .eq('candidate_id', candidateId)
      .eq('job_id', jobId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find application by job ID: ${error.message}`);
    }

    return data ? mapApplicationRow(data) : null;
  }

  public async list(
    candidateId: string,
    query: { limit: number; offset: number; status?: ApplicationStatus }
  ): Promise<{ items: ApplicationRecord[]; total: number }> {
    let req = (this.client as any)
      .from('applications')
      .select('id, candidate_id, job_id, status, notes, applied_at, created_at, updated_at, jobs(id, title, company_name, location, source, canonical_url)', { count: 'exact' })
      .eq('candidate_id', candidateId)
      .is('deleted_at', null)
      .range(query.offset, query.offset + query.limit - 1)
      .order('created_at', { ascending: false });

    if (query.status) {
      req = req.eq('status', query.status);
    }

    const { data, count, error } = await req;

    if (error) {
      throw new Error(`Failed to list applications: ${error.message}`);
    }

    return {
      items: (data ?? []).map(mapApplicationRow),
      total: count ?? 0,
    };
  }

  public async update(
    candidateId: string,
    applicationId: string,
    patch: UpdateApplicationInput
  ): Promise<ApplicationRecord | null> {
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (patch.status !== undefined) updatePayload.status = patch.status;
    if (patch.notes !== undefined) updatePayload.notes = patch.notes;
    if (patch.appliedAt !== undefined) updatePayload.applied_at = patch.appliedAt;

    const { data, error } = await (this.client as any)
      .from('applications')
      .update(updatePayload)
      .eq('candidate_id', candidateId)
      .eq('id', applicationId)
      .select('id, candidate_id, job_id, status, notes, applied_at, created_at, updated_at, jobs(id, title, company_name, location, source, canonical_url)')
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update application: ${error.message}`);
    }

    return data ? mapApplicationRow(data) : null;
  }

  public async saveMaterial(input: {
    applicationId: string;
    candidateId: string;
    materialType: MaterialType;
    content: string;
    promptInput?: string;
    metadata?: Record<string, unknown>;
  }): Promise<GeneratedMaterial> {
    const { data, error } = await (this.client as any)
      .from('application_materials')
      .insert({
        application_id: input.applicationId,
        candidate_id: input.candidateId,
        material_type: input.materialType,
        content: input.content,
        prompt_input: input.promptInput ?? null,
        metadata: input.metadata ?? {},
      })
      .select('id, application_id, candidate_id, material_type, content, prompt_input, metadata, created_at')
      .single();

    if (error || !data) {
      throw new Error(`Failed to save application material: ${error?.message ?? 'unknown'}`);
    }

    return mapMaterialRow(data);
  }

  public async listMaterials(candidateId: string, applicationId: string): Promise<GeneratedMaterial[]> {
    const { data, error } = await (this.client as any)
      .from('application_materials')
      .select('id, application_id, candidate_id, material_type, content, prompt_input, metadata, created_at')
      .eq('candidate_id', candidateId)
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list application materials: ${error.message}`);
    }

    return (data ?? []).map(mapMaterialRow);
  }
}

function mapApplicationRow(row: any): ApplicationRecord {
  return {
    id: row.id,
    candidateId: row.candidate_id,
    jobId: row.job_id,
    status: row.status,
    notes: row.notes ?? undefined,
    appliedAt: row.applied_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    job: row.jobs
      ? {
          id: row.jobs.id,
          title: row.jobs.title,
          companyName: row.jobs.company_name,
          location: row.jobs.location ?? undefined,
          source: row.jobs.source,
          canonicalUrl: row.jobs.canonical_url,
        }
      : undefined,
  };
}

function mapMaterialRow(row: any): GeneratedMaterial {
  return {
    id: row.id,
    applicationId: row.application_id,
    candidateId: row.candidate_id,
    materialType: row.material_type,
    content: row.content,
    promptInput: row.prompt_input ?? undefined,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

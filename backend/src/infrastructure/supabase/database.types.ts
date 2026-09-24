export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_match_evaluations: {
        Row: {
          candidate_id: string
          created_at: string
          evaluation: Json
          id: string
          job_checksum: string
          job_id: string
          model: string
          profile_checksum: string
          prompt_version: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          evaluation: Json
          id?: string
          job_checksum: string
          job_id: string
          model: string
          profile_checksum: string
          prompt_version: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          evaluation?: Json
          id?: string
          job_checksum?: string
          job_id?: string
          model?: string
          profile_checksum?: string
          prompt_version?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_match_evaluations_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_match_evaluations_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      application_materials: {
        Row: {
          application_id: string
          candidate_id: string
          content: string
          created_at: string
          id: string
          material_type: string
          metadata: Json
          prompt_input: string | null
        }
        Insert: {
          application_id: string
          candidate_id: string
          content: string
          created_at?: string
          id?: string
          material_type: string
          metadata?: Json
          prompt_input?: string | null
        }
        Update: {
          application_id?: string
          candidate_id?: string
          content?: string
          created_at?: string
          id?: string
          material_type?: string
          metadata?: Json
          prompt_input?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "application_materials_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_materials_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          applied_at: string | null
          candidate_id: string
          created_at: string
          deleted_at: string | null
          id: string
          job_id: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          applied_at?: string | null
          candidate_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          job_id: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          applied_at?: string | null
          candidate_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          job_id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_job_search_preferences: {
        Row: {
          candidate_id: string
          created_at: string
          employment_types: Json
          id: string
          locations: Json
          max_posting_age_days: number
          sources: Json
          unknown_posting_date_policy: string
          updated_at: string
          work_modes: Json
        }
        Insert: {
          candidate_id: string
          created_at?: string
          employment_types?: Json
          id?: string
          locations?: Json
          max_posting_age_days?: number
          sources?: Json
          unknown_posting_date_policy?: string
          updated_at?: string
          work_modes?: Json
        }
        Update: {
          candidate_id?: string
          created_at?: string
          employment_types?: Json
          id?: string
          locations?: Json
          max_posting_age_days?: number
          sources?: Json
          unknown_posting_date_policy?: string
          updated_at?: string
          work_modes?: Json
        }
        Relationships: [
          {
            foreignKeyName: "candidate_job_search_preferences_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: true
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_search_profiles: {
        Row: {
          candidate_id: string
          created_at: string
          generated_at: string
          id: string
          profile_data: Json
          source_profile_id: string | null
          source_profile_updated_at: string | null
          updated_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          generated_at?: string
          id?: string
          profile_data: Json
          source_profile_id?: string | null
          source_profile_updated_at?: string | null
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          generated_at?: string
          id?: string
          profile_data?: Json
          source_profile_id?: string | null
          source_profile_updated_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_search_profiles_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: true
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_search_profiles_source_profile_id_fkey"
            columns: ["source_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          created_at: string
          id: string
        }
        Insert: {
          created_at?: string
          id: string
        }
        Update: {
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      job_skills: {
        Row: {
          candidate_id: string
          canonical_name: string
          created_at: string
          display_name: string
          id: string
          job_id: string
          match_method: string
        }
        Insert: {
          candidate_id: string
          canonical_name: string
          created_at?: string
          display_name: string
          id?: string
          job_id: string
          match_method?: string
        }
        Update: {
          candidate_id?: string
          canonical_name?: string
          created_at?: string
          display_name?: string
          id?: string
          job_id?: string
          match_method?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_skills_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_skills_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          candidate_id: string
          canonical_url: string
          company_name: string
          content_checksum: string
          created_at: string
          deleted_at: string | null
          description: string
          embedding: string | null
          embedding_content_checksum: string | null
          embedding_dimensions: number | null
          embedding_error: string | null
          embedding_model: string | null
          embedding_status: string
          embedding_updated_at: string | null
          employment_type: string | null
          expires_at: string | null
          external_id: string | null
          id: string
          location: string | null
          published_at: string | null
          source: string
          source_payload_id: string
          status: string
          title: string
          updated_at: string
          workplace_type: string | null
        }
        Insert: {
          candidate_id: string
          canonical_url: string
          company_name: string
          content_checksum: string
          created_at?: string
          deleted_at?: string | null
          description: string
          embedding?: string | null
          embedding_content_checksum?: string | null
          embedding_dimensions?: number | null
          embedding_error?: string | null
          embedding_model?: string | null
          embedding_status?: string
          embedding_updated_at?: string | null
          employment_type?: string | null
          expires_at?: string | null
          external_id?: string | null
          id?: string
          location?: string | null
          published_at?: string | null
          source: string
          source_payload_id: string
          status?: string
          title: string
          updated_at?: string
          workplace_type?: string | null
        }
        Update: {
          candidate_id?: string
          canonical_url?: string
          company_name?: string
          content_checksum?: string
          created_at?: string
          deleted_at?: string | null
          description?: string
          embedding?: string | null
          embedding_content_checksum?: string | null
          embedding_dimensions?: number | null
          embedding_error?: string | null
          embedding_model?: string | null
          embedding_status?: string
          embedding_updated_at?: string | null
          employment_type?: string | null
          expires_at?: string | null
          external_id?: string | null
          id?: string
          location?: string | null
          published_at?: string | null
          source?: string
          source_payload_id?: string
          status?: string
          title?: string
          updated_at?: string
          workplace_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_source_payload_id_fkey"
            columns: ["source_payload_id"]
            isOneToOne: false
            referencedRelation: "jobs_raw"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs_raw: {
        Row: {
          candidate_id: string
          canonical_url: string
          created_at: string
          deleted_at: string | null
          external_id: string | null
          fetched_at: string
          id: string
          payload: Json
          payload_checksum: string
          source: string
        }
        Insert: {
          candidate_id: string
          canonical_url: string
          created_at?: string
          deleted_at?: string | null
          external_id?: string | null
          fetched_at: string
          id?: string
          payload: Json
          payload_checksum: string
          source: string
        }
        Update: {
          candidate_id?: string
          canonical_url?: string
          created_at?: string
          deleted_at?: string | null
          external_id?: string | null
          fetched_at?: string
          id?: string
          payload?: Json
          payload_checksum?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_raw_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_documents: {
        Row: {
          byte_size: number
          candidate_id: string
          checksum: string
          deleted_at: string | null
          id: string
          parser_version: string
          storage_path: string
          uploaded_at: string
        }
        Insert: {
          byte_size: number
          candidate_id: string
          checksum: string
          deleted_at?: string | null
          id?: string
          parser_version: string
          storage_path: string
          uploaded_at?: string
        }
        Update: {
          byte_size?: number
          candidate_id?: string
          checksum?: string
          deleted_at?: string | null
          id?: string
          parser_version?: string
          storage_path?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_documents_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_skills: {
        Row: {
          canonical_name: string
          category: string | null
          created_at: string
          display_name: string
          id: string
          proficiency: string | null
          profile_id: string
        }
        Insert: {
          canonical_name: string
          category?: string | null
          created_at?: string
          display_name: string
          id?: string
          proficiency?: string | null
          profile_id: string
        }
        Update: {
          canonical_name?: string
          category?: string | null
          created_at?: string
          display_name?: string
          id?: string
          proficiency?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_skills_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          candidate_id: string
          career_preferences: string | null
          created_at: string
          deleted_at: string | null
          display_name: string
          embedding: string | null
          embedding_content_checksum: string | null
          embedding_dimensions: number | null
          embedding_error: string | null
          embedding_model: string | null
          embedding_status: string
          embedding_updated_at: string | null
          experience: string | null
          headline: string | null
          id: string
          is_active: boolean
          source_document_id: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          candidate_id: string
          career_preferences?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name: string
          embedding?: string | null
          embedding_content_checksum?: string | null
          embedding_dimensions?: number | null
          embedding_error?: string | null
          embedding_model?: string | null
          embedding_status?: string
          embedding_updated_at?: string | null
          experience?: string | null
          headline?: string | null
          id?: string
          is_active?: boolean
          source_document_id: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          career_preferences?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string
          embedding?: string | null
          embedding_content_checksum?: string | null
          embedding_dimensions?: number | null
          embedding_error?: string | null
          embedding_model?: string | null
          embedding_status?: string
          embedding_updated_at?: string | null
          experience?: string | null
          headline?: string | null
          id?: string
          is_active?: boolean
          source_document_id?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: true
            referencedRelation: "profile_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      scrape_runs: {
        Row: {
          candidate_id: string
          created_at: string
          discovered_count: number
          duplicate_count: number
          error_code: string | null
          error_message: string | null
          failed_count: number
          finished_at: string | null
          id: string
          inserted_count: number
          keyword: string | null
          location: string | null
          metadata: Json
          search_execution_id: string | null
          source: string
          started_at: string
          status: string
          updated_count: number
        }
        Insert: {
          candidate_id: string
          created_at?: string
          discovered_count?: number
          duplicate_count?: number
          error_code?: string | null
          error_message?: string | null
          failed_count?: number
          finished_at?: string | null
          id?: string
          inserted_count?: number
          keyword?: string | null
          location?: string | null
          metadata?: Json
          search_execution_id?: string | null
          source: string
          started_at?: string
          status: string
          updated_count?: number
        }
        Update: {
          candidate_id?: string
          created_at?: string
          discovered_count?: number
          duplicate_count?: number
          error_code?: string | null
          error_message?: string | null
          failed_count?: number
          finished_at?: string | null
          id?: string
          inserted_count?: number
          keyword?: string | null
          location?: string | null
          metadata?: Json
          search_execution_id?: string | null
          source?: string
          started_at?: string
          status?: string
          updated_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "scrape_runs_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scrape_runs_search_execution_id_fkey"
            columns: ["search_execution_id"]
            isOneToOne: false
            referencedRelation: "search_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      search_executions: {
        Row: {
          candidate_id: string
          created_at: string
          error_code: string | null
          error_message: string | null
          finished_at: string | null
          id: string
          intents_snapshot: Json
          preferences_snapshot: Json
          stages: Json
          started_at: string
          status: string
          summary: Json
          timeline: Json
          trigger: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          intents_snapshot?: Json
          preferences_snapshot?: Json
          stages?: Json
          started_at?: string
          status: string
          summary?: Json
          timeline?: Json
          trigger?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          intents_snapshot?: Json
          preferences_snapshot?: Json
          stages?: Json
          started_at?: string
          status?: string
          summary?: Json
          timeline?: Json
          trigger?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_executions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_profile_revision: {
        Args: {
          p_byte_size: number
          p_career_preferences: string
          p_checksum: string
          p_display_name: string
          p_experience: string
          p_headline: string
          p_parser_version: string
          p_skills: Json
          p_storage_path: string
          p_summary: string
        }
        Returns: {
          checksum: string
          document_id: string
          profile_id: string
          skill_count: number
          uploaded_at: string
        }[]
      }
      match_candidate_job_subset: {
        Args: {
          p_candidate_id: string
          p_job_ids: string[]
          p_match_count?: number
          p_match_threshold?: number
          p_query_embedding: string
        }
        Returns: {
          job_id: string
          similarity: number
        }[]
      }
      match_candidate_jobs: {
        Args: {
          p_candidate_id: string
          p_match_count?: number
          p_match_threshold?: number
          p_query_embedding: string
        }
        Returns: {
          job_id: string
          similarity: number
        }[]
      }
      upsert_job_ingestion: {
        Args: {
          p_candidate_id: string
          p_canonical_url: string
          p_company_name: string
          p_content_checksum: string
          p_description: string
          p_employment_type: string
          p_expires_at: string
          p_external_id: string
          p_fetched_at: string
          p_location: string
          p_payload: Json
          p_payload_checksum: string
          p_published_at: string
          p_skills: Json
          p_source: string
          p_title: string
          p_workplace_type: string
        }
        Returns: {
          changed: boolean
          job_id: string
          raw_id: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

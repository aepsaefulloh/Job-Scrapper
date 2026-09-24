import { supabase } from './supabase';
import type { ApiErrorResponse } from '../types/api';

export class ApiClientError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly issues?: unknown[]
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export type ApiClientConfig = {
  baseUrl?: string;
  getToken?: () => Promise<string | null>;
};

export class ApiClient {
  private readonly baseUrl: string;
  private readonly getToken: () => Promise<string | null>;

  public constructor(config?: ApiClientConfig) {
    this.baseUrl = config?.baseUrl ?? '/api';
    this.getToken =
      config?.getToken ??
      (async () => {
        try {
          const { data } = await supabase.auth.getSession();
          return data.session?.access_token ?? null;
        } catch {
          return null;
        }
      });
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const token = await this.getToken();

    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
      });
    } catch (err: any) {
      throw new ApiClientError(
        'NETWORK_ERROR',
        'Gagal mengirim permintaan ke server. Jika backend sudah aktif, pastikan berkas valid dan tidak terkunci oleh sistem/browser.',
        0
      );
    }


    if (!response.ok) {
      let code = 'HTTP_ERROR';
      let message = `Request failed with status ${response.status}`;
      let issues: unknown[] | undefined;

      try {
        const errorData = (await response.json()) as ApiErrorResponse;
        if (errorData?.error) {
          code = errorData.error.code || code;
          message = errorData.error.message || message;
          issues = errorData.issues;
        }
      } catch {
        // Fall back to default message if response body is not JSON
      }

      throw new ApiClientError(code, message, response.status, issues);
    }

    if (response.status === 204) {
      return undefined as unknown as T;
    }

    return (await response.json()) as T;
  }

  public async get<T>(path: string, options?: RequestInit): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  public async post<T>(
    path: string,
    body?: unknown,
    options?: RequestInit
  ): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  public async put<T>(
    path: string,
    body?: unknown,
    options?: RequestInit
  ): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  public async patch<T>(
    path: string,
    body?: unknown,
    options?: RequestInit
  ): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  public async delete<T>(path: string, options?: RequestInit): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }

  public async postFormData<T>(
    path: string,
    formData: FormData,
    options?: RequestInit
  ): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'POST',
      body: formData,
    });
  }
}

export interface CleanupResult {
  deletedJobsCount: number;
  deletedRawCount: number;
  deletedScrapeRunsCount: number;
  preservedJobsCount: number;
}

export const apiClient = new ApiClient();


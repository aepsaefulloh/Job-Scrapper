# Candidate Profile Visual Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide an in-app visual editor modal (`ProfileEditModal.vue`) and update API (`PUT /api/profile`) on the `/profile` page, allowing candidates to fine-tune parsed profile data, verified skills, and experience with automatic cascade sync to search profiles and vector embeddings.

**Architecture:** Candidate-scoped authenticated `PUT /api/profile` updates the active record in `profiles` and `profile_skills` atomically via `SupabaseProfileRepository`. `ProfileService` coordinates updating the database and immediately invokes `SearchProfileService.getOrDerive` to refresh search target roles and skills. Frontend composable `useProfile.ts` exposes `updateProfile` and reactive `saving` state, integrated with a JobToolkit-styled editorial modal `ProfileEditModal.vue` with tabbed navigation (General, Summary, Skills, Experience & Preferences) and inline tag management.

**Tech Stack:** Node.js, Express, TypeScript, Vitest, Supabase (PostgreSQL), Vue 3, Vite, Tailwind CSS, Lucide icons.

## Global Constraints

- Strict candidate isolation: `candidate_id = auth.uid()`.
- Active profile only: `is_active = true` and `deleted_at IS NULL`.
- Deterministic skill canonicalization: `displayName.trim()` and `displayName.toLocaleLowerCase('en-US')`.
- No fake AI badges: Only genuine vector embeddings or LLM features carry AI provenance; deterministic profile editing remains clean.
- Design consistency: JobToolkit editorial aesthetic (warm stone palette, emerald accents, subtle borders).
- Verification commands before claiming completion:
  - `bun test` in `backend/`
  - `bun run typecheck` in `backend/`
  - `bun run build` in `backend/`
  - `bun run test` in `frontend/`
  - `bun run typecheck` in `frontend/`
  - `bun run build` in `frontend/`

---

### Task 1: Profile Repository - `updateActiveProfile` Method and Unit Tests

**Files:**
- Modify: `backend/src/infrastructure/supabase/profile-repository.ts`
- Test: `backend/tests/unit/infrastructure/supabase-profile-repository.test.ts`

**Interfaces:**
- Consumes: Supabase database client (`profiles` and `profile_skills` tables).
- Produces: `updateActiveProfile(candidateId: string, input: UpdateProfileInput): Promise<CandidateProfileDetail>`

- [ ] **Step 1: Write the failing unit tests for `SupabaseProfileRepository`**

Create `backend/tests/unit/infrastructure/supabase-profile-repository.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && bun test tests/unit/infrastructure/supabase-profile-repository.test.ts`
Expected: FAIL with `repo.updateActiveProfile is not a function`.

- [ ] **Step 3: Implement `updateActiveProfile` in `SupabaseProfileRepository`**

In `backend/src/infrastructure/supabase/profile-repository.ts`:
Add `UpdateProfileInput` type and `updateActiveProfile` to `ProfileRepository` interface and `SupabaseProfileRepository` class:
```typescript
export type UpdateProfileInput = {
  displayName: string;
  headline?: string | null;
  summary?: string | null;
  experience?: string | null;
  careerPreferences?: string | null;
  skills?: Array<{ displayName: string; canonicalName: string }>;
};

// In ProfileRepository interface:
updateActiveProfile(candidateId: string, input: UpdateProfileInput): Promise<CandidateProfileDetail>;

// In SupabaseProfileRepository class:
public async updateActiveProfile(
  candidateId: string,
  input: UpdateProfileInput
): Promise<CandidateProfileDetail> {
  const { data: profile, error } = await this.client
    .from('profiles')
    .select('id')
    .eq('candidate_id', candidateId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new Error('Candidate profile could not be loaded.');
  if (!profile) throw new Error('Active profile not found.');

  const { error: updateError } = await this.client
    .from('profiles')
    .update({
      display_name: input.displayName,
      headline: input.headline !== undefined ? input.headline : null,
      summary: input.summary !== undefined ? input.summary : null,
      experience: input.experience !== undefined ? input.experience : null,
      career_preferences: input.careerPreferences !== undefined ? input.careerPreferences : null,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', profile.id);

  if (updateError) throw new Error('Failed to update candidate profile.');

  if (input.skills !== undefined) {
    const { error: delError } = await this.client
      .from('profile_skills')
      .delete()
      .eq('profile_id', profile.id);
    if (delError) throw new Error('Failed to update profile skills.');

    if (input.skills.length > 0) {
      const { error: insError } = await this.client
        .from('profile_skills')
        .insert(
          input.skills.map((s) => ({
            profile_id: profile.id,
            display_name: s.displayName,
            canonical_name: s.canonicalName,
            category: null,
            proficiency: null,
          })) as never
        );
      if (insError) throw new Error('Failed to insert updated profile skills.');
    }
  }

  const updated = await this.getActiveProfile(candidateId);
  if (!updated) throw new Error('Failed to reload updated profile.');
  return updated;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && bun test tests/unit/infrastructure/supabase-profile-repository.test.ts`
Expected: PASS (2 tests passed).

- [ ] **Step 5: Commit**

```bash
git add backend/src/infrastructure/supabase/profile-repository.ts backend/tests/unit/infrastructure/supabase-profile-repository.test.ts
git commit -m "feat(backend): add updateActiveProfile method to SupabaseProfileRepository"
```

---

### Task 2: Profile Service - `updateProfile` with Cascade Search Profile Sync

**Files:**
- Modify: `backend/src/services/profile-service.ts`
- Modify: `backend/src/server.ts`
- Modify: `backend/tests/unit/services/profile-service.test.ts`

**Interfaces:**
- Consumes: `ProfileRepository`, `SearchProfileService` (optional dependency).
- Produces: `updateProfile(candidateId: string, input: UpdateProfileRequest): Promise<CandidateProfileDetail>`

- [ ] **Step 1: Write the failing unit tests for `ProfileService.updateProfile`**

Add tests to `backend/tests/unit/services/profile-service.test.ts`:
```typescript
it('updates profile and invokes search profile getOrDerive for cascade sync', async () => {
  const storage = new FakeStorage();
  const repository = new FakeRepository();
  const mockUpdatedProfile = {
    id: 'profile-id',
    candidateId,
    displayName: 'Ada Lovelace Updated',
    headline: 'Computing Pioneer',
    summary: 'First programmer',
    experience: 'Engine development',
    careerPreferences: 'Mathematical work',
    skills: [{ displayName: 'Algorithms', canonicalName: 'algorithms' }],
    updatedAt: '2026-09-24T12:00:00.000Z',
  };

  repository.updateActiveProfile = vi.fn().mockResolvedValue(mockUpdatedProfile);
  const mockSearchProfileService = {
    getOrDerive: vi.fn().mockResolvedValue({ candidateId, targetRoles: ['Computing Pioneer'] }),
  };

  const service = new ProfileService(storage, repository as never, mockSearchProfileService as never);

  const result = await service.updateProfile(candidateId, {
    displayName: 'Ada Lovelace Updated',
    headline: 'Computing Pioneer',
    summary: 'First programmer',
    skills: ['Algorithms', 'algorithms'], // includes duplicate to verify deduplication
  });

  expect(repository.updateActiveProfile).toHaveBeenCalledWith(
    candidateId,
    expect.objectContaining({
      displayName: 'Ada Lovelace Updated',
      headline: 'Computing Pioneer',
      skills: [{ displayName: 'Algorithms', canonicalName: 'algorithms' }],
    })
  );
  expect(mockSearchProfileService.getOrDerive).toHaveBeenCalledWith(candidateId, mockUpdatedProfile);
  expect(result.displayName).toBe('Ada Lovelace Updated');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && bun test tests/unit/services/profile-service.test.ts`
Expected: FAIL with `service.updateProfile is not a function`.

- [ ] **Step 3: Implement `updateProfile` in `ProfileService`**

In `backend/src/services/profile-service.ts`:
```typescript
import type { SearchProfileService } from '../search/search-profile.service.js';
import type { CandidateProfileDetail, UpdateProfileInput } from '../infrastructure/supabase/profile-repository.js';

export type UpdateProfileServiceInput = {
  displayName: string;
  headline?: string | null;
  summary?: string | null;
  experience?: string | null;
  careerPreferences?: string | null;
  skills?: string[];
};

export class ProfileService {
  public constructor(
    private readonly storage: ProfileDocumentStorage,
    private readonly repository: ProfileRepository,
    private readonly searchProfileService?: Pick<SearchProfileService, 'getOrDerive'>
  ) {}

  // ... existing upload and getProfile methods ...

  public async updateProfile(
    candidateId: string,
    input: UpdateProfileServiceInput
  ): Promise<CandidateProfileDetail> {
    const rawSkills = input.skills ?? [];
    const skillMap = new Map<string, { displayName: string; canonicalName: string }>();

    for (const raw of rawSkills) {
      const displayName = raw.trim();
      const canonicalName = displayName.toLocaleLowerCase('en-US');
      if (canonicalName.length > 0 && !skillMap.has(canonicalName)) {
        skillMap.set(canonicalName, { displayName, canonicalName });
      }
    }

    const updated = await this.repository.updateActiveProfile(candidateId, {
      displayName: input.displayName.trim(),
      headline: input.headline !== undefined ? (input.headline ? input.headline.trim() : null) : undefined,
      summary: input.summary !== undefined ? (input.summary ? input.summary.trim() : null) : undefined,
      experience: input.experience !== undefined ? (input.experience ? input.experience.trim() : null) : undefined,
      careerPreferences: input.careerPreferences !== undefined ? (input.careerPreferences ? input.careerPreferences.trim() : null) : undefined,
      skills: input.skills !== undefined ? Array.from(skillMap.values()) : undefined,
    });

    if (this.searchProfileService) {
      try {
        await this.searchProfileService.getOrDerive(candidateId, updated);
      } catch {
        // Search profile refresh failure is non-fatal to profile update
      }
    }

    return updated;
  }
}
```

In `backend/src/server.ts`, pass `searchProfileService` into `ProfileService` inside `createProfileService`:
```typescript
createProfileService: (accessToken) => {
  const client = createUserSupabaseClient(accessToken, env);
  const searchProfileService = new SearchProfileService(new SupabaseSearchProfileRepository(client));
  return new ProfileService(
    new SupabaseProfileDocumentStorage(client),
    new SupabaseProfileRepository(client),
    searchProfileService
  );
},
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && bun test tests/unit/services/profile-service.test.ts`
Expected: PASS (all tests pass).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/profile-service.ts backend/src/server.ts backend/tests/unit/services/profile-service.test.ts
git commit -m "feat(backend): add updateProfile with search profile cascade sync to ProfileService"
```

---

### Task 3: Backend API Endpoint - `PUT /api/profile`

**Files:**
- Modify: `backend/src/app.ts`
- Test: `backend/tests/integration/profile-endpoints.test.ts`

**Interfaces:**
- Consumes: `ProfileService.updateProfile`
- Produces: `PUT /api/profile` HTTP endpoint

- [ ] **Step 1: Write integration tests for `PUT /api/profile`**

Create `backend/tests/integration/profile-endpoints.test.ts`:
```typescript
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';

describe('PUT /api/profile', () => {
  const mockCandidateId = 'cand-123';
  const mockAccessToken = 'valid-token';

  it('updates profile and returns 200 with updated profile data', async () => {
    const mockUpdateProfile = vi.fn().mockResolvedValue({
      id: 'prof-1',
      candidateId: mockCandidateId,
      displayName: 'Alex Smith',
      headline: 'Staff Engineer',
      summary: 'Tech Lead',
      experience: '12 years exp',
      careerPreferences: 'Remote',
      skills: [{ displayName: 'Go', canonicalName: 'go' }],
      updatedAt: '2026-09-24T12:00:00Z',
    });

    const app = createApp({
      authenticate: vi.fn().mockResolvedValue({ userId: mockCandidateId, accessToken: mockAccessToken }),
      profileDocumentMaxBytes: 1024 * 1024,
      createProfileService: vi.fn().mockReturnValue({
        getProfile: vi.fn(),
        upload: vi.fn(),
        updateProfile: mockUpdateProfile,
      } as never),
    });

    const res = await request(app)
      .put('/profile')
      .set('Authorization', `Bearer ${mockAccessToken}`)
      .send({
        displayName: 'Alex Smith',
        headline: 'Staff Engineer',
        summary: 'Tech Lead',
        skills: ['Go'],
      });

    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe('Alex Smith');
    expect(res.body.headline).toBe('Staff Engineer');
    expect(mockUpdateProfile).toHaveBeenCalledWith(
      mockCandidateId,
      expect.objectContaining({ displayName: 'Alex Smith' })
    );
  });

  it('returns 400 when displayName is empty or missing', async () => {
    const app = createApp({
      authenticate: vi.fn().mockResolvedValue({ userId: mockCandidateId, accessToken: mockAccessToken }),
      profileDocumentMaxBytes: 1024 * 1024,
      createProfileService: vi.fn().mockReturnValue({
        updateProfile: vi.fn(),
      } as never),
    });

    const res = await request(app)
      .put('/profile')
      .set('Authorization', `Bearer ${mockAccessToken}`)
      .send({ displayName: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 when active profile is not found', async () => {
    const app = createApp({
      authenticate: vi.fn().mockResolvedValue({ userId: mockCandidateId, accessToken: mockAccessToken }),
      profileDocumentMaxBytes: 1024 * 1024,
      createProfileService: vi.fn().mockReturnValue({
        updateProfile: vi.fn().mockRejectedValue(new Error('Active profile not found.')),
      } as never),
    });

    const res = await request(app)
      .put('/profile')
      .set('Authorization', `Bearer ${mockAccessToken}`)
      .send({ displayName: 'Alex' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PROFILE_NOT_FOUND');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && bun test tests/integration/profile-endpoints.test.ts`
Expected: FAIL with 404 or method not found.

- [ ] **Step 3: Implement `PUT /profile` route in `backend/src/app.ts`**

Update `ProfileServiceType` in `backend/src/app.ts`:
```typescript
type ProfileServiceType = {
  upload(input: UploadProfileInput): Promise<ProfileUploadResult>;
  getProfile?(candidateId: string): Promise<CandidateProfileDetail | null>;
  updateProfile?(candidateId: string, input: any): Promise<CandidateProfileDetail>;
};
```

In `backend/src/app.ts`, register `PUT /profile`:
```typescript
  router.put('/profile', authenticate, async (req, res, next) => {
    try {
      const { displayName, headline, summary, experience, careerPreferences, skills } = req.body ?? {};
      if (typeof displayName !== 'string' || displayName.trim().length === 0) {
        return void res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Display name is required and cannot be empty.' },
        });
      }
      if (displayName.trim().length > 120) {
        return void res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Display name exceeds maximum length of 120 characters.' },
        });
      }
      if (skills !== undefined && !Array.isArray(skills)) {
        return void res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Skills must be an array of strings.' },
        });
      }

      const service = dependencies.createProfileService(res.locals.auth.accessToken);
      if (!service.updateProfile) {
        return void res.status(501).json({
          error: { code: 'NOT_IMPLEMENTED', message: 'Profile update not implemented.' },
        });
      }

      const updated = await service.updateProfile(res.locals.auth.userId, {
        displayName: displayName.trim(),
        headline: typeof headline === 'string' ? headline.trim() : headline,
        summary: typeof summary === 'string' ? summary.trim() : summary,
        experience: typeof experience === 'string' ? experience.trim() : experience,
        careerPreferences: typeof careerPreferences === 'string' ? careerPreferences.trim() : careerPreferences,
        skills: Array.isArray(skills) ? skills.map((s) => String(s)) : undefined,
      });

      res.json(updated);
    } catch (error: any) {
      if (error?.message === 'Active profile not found.') {
        return void res.status(404).json({
          error: { code: 'PROFILE_NOT_FOUND', message: 'Active profile was not found.' },
        });
      }
      next(error);
    }
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && bun test tests/integration/profile-endpoints.test.ts`
Expected: PASS (all 3 tests pass).

- [ ] **Step 5: Run full backend verification**

Run:
```bash
cd backend
bun test
bun run typecheck
bun run build
```
Expected: All backend tests pass, clean typecheck, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add backend/src/app.ts backend/tests/integration/profile-endpoints.test.ts
git commit -m "feat(api): add PUT /api/profile endpoint with validation and error handling"
```

---

### Task 4: Frontend Types and Composable - `updateProfile` in `useProfile`

**Files:**
- Modify: `frontend/src/types/profile.ts`
- Modify: `frontend/src/composables/useProfile.ts`
- Modify: `frontend/src/composables/__tests__/useProfile.test.ts`

**Interfaces:**
- Consumes: `apiClient.put('/profile', payload)`
- Produces: `updateProfile(payload: UpdateProfilePayload): Promise<CandidateProfile>`, `saving: Ref<boolean>`, `saveError: Ref<string | null>`

- [ ] **Step 1: Write the failing tests in `useProfile.test.ts`**

Update `frontend/src/composables/__tests__/useProfile.test.ts`:
```typescript
it('successfully updates profile via updateProfile', async () => {
  const updatedMock = {
    id: 'prof-1',
    candidateId: 'cand-1',
    displayName: 'Aep Saefulloh Updated',
    headline: 'Lead Architect',
    summary: 'Senior Engineer',
    experience: '8+ years',
    careerPreferences: 'Remote',
    skills: [{ displayName: 'Vue.js', canonicalName: 'vue.js' }],
    updatedAt: '2026-09-24T12:00:00Z',
  };

  vi.mocked(apiClient.put).mockResolvedValueOnce(updatedMock);

  const { updateProfile, profile, saving, saveError } = useProfile();

  const promise = updateProfile({
    displayName: 'Aep Saefulloh Updated',
    headline: 'Lead Architect',
    skills: ['Vue.js'],
  });

  expect(saving.value).toBe(true);
  const result = await promise;

  expect(saving.value).toBe(false);
  expect(saveError.value).toBeNull();
  expect(result.displayName).toBe('Aep Saefulloh Updated');
  expect(profile.value?.displayName).toBe('Aep Saefulloh Updated');
  expect(apiClient.put).toHaveBeenCalledWith('/profile', {
    displayName: 'Aep Saefulloh Updated',
    headline: 'Lead Architect',
    skills: ['Vue.js'],
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && bun run test src/composables/__tests__/useProfile.test.ts`
Expected: FAIL with `updateProfile is not defined`.

- [ ] **Step 3: Update `frontend/src/types/profile.ts` and `frontend/src/composables/useProfile.ts`**

In `frontend/src/types/profile.ts`:
```typescript
export type UpdateProfilePayload = {
  displayName: string;
  headline?: string | null;
  summary?: string | null;
  experience?: string | null;
  careerPreferences?: string | null;
  skills?: string[];
};
```

In `frontend/src/composables/useProfile.ts`:
```typescript
import type { CandidateProfile, ProfileUploadResponse, UpdateProfilePayload } from '../types/profile';

const saving = ref<boolean>(false);
const saveError = ref<string | null>(null);

// Inside useProfile():
async function updateProfile(payload: UpdateProfilePayload): Promise<CandidateProfile> {
  saving.value = true;
  saveError.value = null;

  try {
    const res = await apiClient.put<CandidateProfile>('/profile', payload);
    profile.value = res;
    return res;
  } catch (e: any) {
    saveError.value = e?.message || 'Failed to update candidate profile.';
    throw e;
  } finally {
    saving.value = false;
  }
}

return {
  profile,
  loading,
  error,
  uploading,
  uploadResult,
  uploadError,
  saving,
  saveError,
  fetchProfile,
  uploadMarkdownDocument,
  updateProfile,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && bun run test src/composables/__tests__/useProfile.test.ts`
Expected: PASS (all tests pass).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/profile.ts frontend/src/composables/useProfile.ts frontend/src/composables/__tests__/useProfile.test.ts
git commit -m "feat(frontend): add updateProfile method and saving state to useProfile composable"
```

---

### Task 5: Frontend UI - `ProfileEditModal.vue` and `ProfileView.vue` Integration

**Files:**
- Create: `frontend/src/components/profile/ProfileEditModal.vue`
- Create: `frontend/src/components/profile/__tests__/ProfileEditModal.test.ts`
- Modify: `frontend/src/views/ProfileView.vue`
- Modify: `frontend/src/views/__tests__/ProfileView.test.ts`

**Interfaces:**
- Consumes: `useProfile().updateProfile`, `CandidateProfile` prop
- Produces: Visual editor modal with tabs (General, Summary, Skills, Experience & Preferences) and integrated "Edit Profile" action on `ProfileView.vue`.

- [ ] **Step 1: Write component tests for `ProfileEditModal.vue`**

Create `frontend/src/components/profile/__tests__/ProfileEditModal.test.ts`:
```typescript
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import ProfileEditModal from '../ProfileEditModal.vue';
import type { CandidateProfile } from '../../../types/profile';

const mockProfile: CandidateProfile = {
  id: 'prof-1',
  candidateId: 'cand-1',
  displayName: 'Alex Doe',
  headline: 'Full Stack Engineer',
  summary: 'Passionate developer',
  experience: 'Worked at ACME',
  careerPreferences: 'Remote only',
  skills: [
    { displayName: 'TypeScript', canonicalName: 'typescript' },
    { displayName: 'Vue.js', canonicalName: 'vue.js' },
  ],
  updatedAt: '2026-09-24T12:00:00Z',
};

describe('ProfileEditModal.vue', () => {
  it('renders initial values from profile prop', () => {
    const wrapper = mount(ProfileEditModal, {
      props: {
        profile: mockProfile,
      },
    });

    const displayNameInput = wrapper.find<HTMLInputElement>('input#displayName');
    expect(displayNameInput.element.value).toBe('Alex Doe');

    const headlineInput = wrapper.find<HTMLInputElement>('input#headline');
    expect(headlineInput.element.value).toBe('Full Stack Engineer');
  });

  it('allows adding and removing skills in the Skills tab', async () => {
    const wrapper = mount(ProfileEditModal, {
      props: {
        profile: mockProfile,
      },
    });

    // Switch to Skills tab
    const skillsTabButton = wrapper.findAll('button').find((b) => b.text().includes('Skills'));
    await skillsTabButton?.trigger('click');

    // Check existing skills count
    expect(wrapper.findAll('.skill-chip')).toHaveLength(2);

    // Add a new skill
    const newSkillInput = wrapper.find('input#newSkill');
    await newSkillInput.setValue('PostgreSQL');
    const addSkillBtn = wrapper.find('button#addSkillBtn');
    await addSkillBtn.trigger('click');

    expect(wrapper.findAll('.skill-chip')).toHaveLength(3);
    expect(wrapper.text()).toContain('PostgreSQL');

    // Remove the first skill
    const removeBtn = wrapper.findAll('.skill-chip-remove')[0];
    await removeBtn.trigger('click');

    expect(wrapper.findAll('.skill-chip')).toHaveLength(2);
  });

  it('emits close event when Cancel or close button is clicked', async () => {
    const wrapper = mount(ProfileEditModal, {
      props: {
        profile: mockProfile,
      },
    });

    const cancelBtn = wrapper.find('button#cancelBtn');
    await cancelBtn.trigger('click');
    expect(wrapper.emitted('close')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && bun run test src/components/profile/__tests__/ProfileEditModal.test.ts`
Expected: FAIL with `Cannot find module '../ProfileEditModal.vue'`.

- [ ] **Step 3: Implement `ProfileEditModal.vue`**

Create `frontend/src/components/profile/ProfileEditModal.vue`:
```vue
<script setup lang="ts">
import { ref, computed } from 'vue';
import type { CandidateProfile, UpdateProfilePayload } from '../../types/profile';
import { useProfile } from '../../composables/useProfile';
import { useSearchProfile } from '../../composables/useSearchProfile';
import {
  X,
  User,
  FileText,
  Award,
  Briefcase,
  Plus,
  Loader2,
  AlertCircle,
} from 'lucide-vue-next';

const props = defineProps<{
  profile: CandidateProfile;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'saved', updated: CandidateProfile): void;
}>();

const { updateProfile, saving, saveError } = useProfile();
const { fetchSearchProfile } = useSearchProfile();

type TabId = 'general' | 'summary' | 'skills' | 'experience';
const activeTab = ref<TabId>('general');

// Form state
const displayName = ref(props.profile.displayName);
const headline = ref(props.profile.headline ?? '');
const summary = ref(props.profile.summary ?? '');
const experience = ref(props.profile.experience ?? '');
const careerPreferences = ref(props.profile.careerPreferences ?? '');
const skills = ref<string[]>(props.profile.skills.map((s) => s.displayName));

// New skill input
const newSkillInput = ref('');
const localValidation = ref<string | null>(null);

function addSkill() {
  const trimmed = newSkillInput.value.trim();
  if (!trimmed) return;
  const canonical = trimmed.toLowerCase();
  const exists = skills.value.some((s) => s.toLowerCase() === canonical);
  if (!exists) {
    skills.value.push(trimmed);
  }
  newSkillInput.value = '';
}

function removeSkill(index: number) {
  skills.value.splice(index, 1);
}

const tabs: { id: TabId; label: string; icon: any }[] = [
  { id: 'general', label: 'General', icon: User },
  { id: 'summary', label: 'Summary', icon: FileText },
  { id: 'skills', label: 'Skills', icon: Award },
  { id: 'experience', label: 'Experience & Preferences', icon: Briefcase },
];

async function handleSave() {
  localValidation.value = null;
  const trimmedName = displayName.value.trim();
  if (!trimmedName) {
    localValidation.value = 'Display Name cannot be empty.';
    activeTab.value = 'general';
    return;
  }

  const payload: UpdateProfilePayload = {
    displayName: trimmedName,
    headline: headline.value.trim() || null,
    summary: summary.value.trim() || null,
    experience: experience.value.trim() || null,
    careerPreferences: careerPreferences.value.trim() || null,
    skills: skills.value,
  };

  try {
    const updated = await updateProfile(payload);
    await fetchSearchProfile().catch(() => undefined);
    emit('saved', updated);
    emit('close');
  } catch {
    // Handled by saveError
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
    <div
      class="bg-surface rounded-2xl border border-surface-border shadow-elevated w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-150"
    >
      <!-- Modal Header -->
      <div class="px-6 py-4 border-b border-surface-border flex items-center justify-between">
        <div>
          <h2 class="text-base font-bold text-stone-900">Edit Candidate Profile</h2>
          <p class="text-xs text-stone-500 mt-0.5">
            Fine-tune parsed details, headline, skills, and background.
          </p>
        </div>
        <button
          type="button"
          @click="emit('close')"
          class="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Navigation Tabs -->
      <div class="flex items-center gap-1 px-6 border-b border-surface-border bg-stone-50/50 overflow-x-auto">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          @click="activeTab = tab.id"
          :class="[
            'flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap',
            activeTab === tab.id
              ? 'border-emerald-700 text-emerald-900 bg-white shadow-subtle'
              : 'border-transparent text-stone-500 hover:text-stone-800',
          ]"
        >
          <component :is="tab.icon" class="w-3.5 h-3.5" />
          {{ tab.label }}
          <span
            v-if="tab.id === 'skills'"
            class="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-stone-200 text-stone-700 font-bold"
          >
            {{ skills.length }}
          </span>
        </button>
      </div>

      <!-- Body Form -->
      <div class="p-6 overflow-y-auto space-y-5 flex-1">
        <!-- Error Alerts -->
        <div
          v-if="localValidation || saveError"
          class="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2"
        >
          <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
          <span>{{ localValidation || saveError }}</span>
        </div>

        <!-- Tab 1: General -->
        <div v-show="activeTab === 'general'" class="space-y-4">
          <div>
            <label for="displayName" class="block text-xs font-bold text-stone-900 mb-1">
              Full Name <span class="text-red-500">*</span>
            </label>
            <input
              id="displayName"
              v-model="displayName"
              type="text"
              maxlength="120"
              class="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              placeholder="e.g. Ada Lovelace"
            />
          </div>

          <div>
            <label for="headline" class="block text-xs font-bold text-stone-900 mb-1">
              Professional Headline / Target Role
            </label>
            <input
              id="headline"
              v-model="headline"
              type="text"
              maxlength="255"
              class="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              placeholder="e.g. Senior Full Stack Engineer / Technical Lead"
            />
            <p class="text-[11px] text-stone-400 mt-1">
              Used to automatically derive your primary job search titles and roles.
            </p>
          </div>
        </div>

        <!-- Tab 2: Summary -->
        <div v-show="activeTab === 'summary'" class="space-y-4">
          <div>
            <label for="summary" class="block text-xs font-bold text-stone-900 mb-1">
              Professional Summary
            </label>
            <textarea
              id="summary"
              v-model="summary"
              rows="8"
              class="w-full px-3 py-2 text-xs text-stone-800 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 leading-relaxed font-sans"
              placeholder="Summarize your career highlights, strengths, and primary domain focus..."
            ></textarea>
            <p class="text-[11px] text-stone-400 mt-1">
              Feeds directly into your AI matching vector embeddings and cover letter generators.
            </p>
          </div>
        </div>

        <!-- Tab 3: Skills -->
        <div v-show="activeTab === 'skills'" class="space-y-4">
          <div>
            <label for="newSkill" class="block text-xs font-bold text-stone-900 mb-1">
              Add Verified Skills
            </label>
            <div class="flex items-center gap-2">
              <input
                id="newSkill"
                v-model="newSkillInput"
                type="text"
                @keydown.enter.prevent="addSkill"
                class="flex-1 px-3 py-2 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                placeholder="Type skill (e.g. Docker, Vue.js, Go) and press Enter"
              />
              <button
                id="addSkillBtn"
                type="button"
                @click="addSkill"
                class="px-3 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
              >
                <Plus class="w-3.5 h-3.5" />
                Add
              </button>
            </div>
          </div>

          <!-- Skills Chips Cloud -->
          <div>
            <p class="text-xs font-bold text-stone-700 mb-2">Verified Skills ({{ skills.length }})</p>
            <div class="flex items-center gap-2 flex-wrap min-h-[100px] p-3 rounded-lg border border-surface-border bg-stone-50/50">
              <span
                v-for="(skill, idx) in skills"
                :key="skill"
                class="skill-chip inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-900 border border-emerald-200 shadow-subtle"
              >
                {{ skill }}
                <button
                  type="button"
                  @click="removeSkill(idx)"
                  class="skill-chip-remove hover:text-emerald-700 focus:outline-none"
                >
                  <X class="w-3 h-3" />
                </button>
              </span>
              <span v-if="skills.length === 0" class="text-xs text-stone-400 italic">
                No skills added yet. Add at least 3-5 core technical or professional competencies.
              </span>
            </div>
          </div>
        </div>

        <!-- Tab 4: Experience & Preferences -->
        <div v-show="activeTab === 'experience'" class="space-y-4">
          <div>
            <label for="experience" class="block text-xs font-bold text-stone-900 mb-1">
              Work Experience
            </label>
            <textarea
              id="experience"
              v-model="experience"
              rows="6"
              class="w-full px-3 py-2 text-xs text-stone-800 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 leading-relaxed font-sans"
              placeholder="Detail your roles, companies, dates, and achievements..."
            ></textarea>
          </div>

          <div>
            <label for="careerPreferences" class="block text-xs font-bold text-stone-900 mb-1">
              Career Preferences
            </label>
            <textarea
              id="careerPreferences"
              v-model="careerPreferences"
              rows="4"
              class="w-full px-3 py-2 text-xs text-stone-800 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 leading-relaxed font-sans"
              placeholder="e.g. Remote work, minimum salary expectations, preferred industries..."
            ></textarea>
          </div>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="px-6 py-4 border-t border-surface-border bg-stone-50/50 flex items-center justify-end gap-3">
        <button
          id="cancelBtn"
          type="button"
          @click="emit('close')"
          :disabled="saving"
          class="px-4 py-2 text-xs font-bold text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          id="saveBtn"
          type="button"
          @click="handleSave"
          :disabled="saving"
          class="px-4 py-2 bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-subtle"
        >
          <Loader2 v-if="saving" class="w-3.5 h-3.5 animate-spin" />
          <span>{{ saving ? 'Saving Changes...' : 'Save Changes' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 4: Integrate `ProfileEditModal.vue` into `frontend/src/views/ProfileView.vue`**

In `frontend/src/views/ProfileView.vue`:
- Import `ref` and `Pencil` icon from `lucide-vue-next`.
- Import `ProfileEditModal` component.
- Add `const isEditModalOpen = ref(false)`.
- Add an "Edit Profile" button next to "Candidate Profile" title:
```vue
<div class="flex items-center justify-between">
  <div>
    <h1 class="text-2xl font-bold tracking-tight text-stone-900">Candidate Profile</h1>
    <p class="text-sm text-stone-500 mt-0.5">
      Your human-maintained career profile is the primary source of truth.
    </p>
  </div>
  <button
    v-if="profile"
    id="openEditProfileBtn"
    type="button"
    @click="isEditModalOpen = true"
    class="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-surface-border bg-surface text-stone-800 hover:bg-stone-50 text-xs font-semibold shadow-subtle transition-colors"
  >
    <Pencil class="w-3.5 h-3.5 text-stone-600" />
    Edit Profile
  </button>
</div>
```
- Render modal:
```vue
<ProfileEditModal
  v-if="isEditModalOpen && profile"
  :profile="profile"
  @close="isEditModalOpen = false"
  @saved="fetchProfile"
/>
```

- [ ] **Step 5: Run tests to verify all frontend tests pass**

Run: `cd frontend && bun run test`
Expected: PASS (all 21 test files pass, including `ProfileEditModal.test.ts` and `ProfileView.test.ts`).

- [ ] **Step 6: Run full frontend verification**

Run:
```bash
cd frontend
bun run typecheck
bun run build
```
Expected: Clean typecheck, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/profile/ProfileEditModal.vue frontend/src/components/profile/__tests__/ProfileEditModal.test.ts frontend/src/views/ProfileView.vue frontend/src/views/__tests__/ProfileView.test.ts
git commit -m "feat(frontend): implement ProfileEditModal and wire into ProfileView"
```

---

### Task 6: End-to-End Full Verification

**Files:**
- Entire repository

- [ ] **Step 1: Run complete backend test and build suite**
```bash
cd backend
bun test
bun run typecheck
bun run build
```
Expected: 0 errors, all tests pass, exit code 0.

- [ ] **Step 2: Run complete frontend test and build suite**
```bash
cd frontend
bun run test
bun run typecheck
bun run build
```
Expected: 0 errors, all tests pass, exit code 0.

- [ ] **Step 3: Confirm git status and commit plan**
```bash
git status
```

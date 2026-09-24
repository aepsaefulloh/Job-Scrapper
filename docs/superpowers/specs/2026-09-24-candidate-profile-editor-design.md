# Design Specification: Dynamic Candidate Profile Editor

**Date:** 2026-09-24  
**Status:** Approved  
**Topic:** Candidate Profile In-App Visual Editor & Cascade Sync  

---

## 1. Executive Summary

Job Scrapper establishes the candidate's career profile as the primary source of truth for all downstream workflows (job search planning, vector embeddings, rule-based matching, and application material generation). Currently, profiles are initialized or updated by uploading a raw Markdown file (`candidate.md`). 

This feature introduces an in-app visual editor (`ProfileEditModal.vue`) and updating capability (`PUT /api/profile`) on `/profile`. It empowers the candidate to review, fine-tune, add/remove skills, adjust headlines, summary, experience, and career preferences directly from the web dashboard. Changes are persisted immediately, automatically synchronizing downstream search profiles and AI profile embeddings without requiring re-uploading a Markdown file.

---

## 2. Architecture & Data Contracts

### 2.1 Backend API Specification

#### Route
```http
PUT /api/profile
```

#### Authentication & Authorization
- **Header:** `Authorization: Bearer <supabase_access_token>`
- Enforces strict candidate isolation (`candidate_id = auth.uid()`).
- Operates on the active profile record (`is_active = true`, `deleted_at IS NULL`).

#### Request Payload
```typescript
export interface UpdateProfileRequest {
  displayName: string;
  headline?: string | null;
  summary?: string | null;
  experience?: string | null;
  careerPreferences?: string | null;
  skills?: string[]; // Array of skill names (e.g. ["TypeScript", "Vue.js", "PostgreSQL"])
}
```

#### Validation Rules
1. `displayName`: Required, trimmed, minimum 1 character, maximum 120 characters. Returns `400 Bad Request` if empty.
2. `headline`: Optional string, trimmed, maximum 255 characters.
3. `summary`: Optional string, trimmed.
4. `experience`: Optional string.
5. `careerPreferences`: Optional string.
6. `skills`: Optional array of strings. Each item trimmed and deduplicated case-insensitively. Empty strings stripped. Canonical name is computed deterministically via existing helper `canonicalizeSkill()`.

#### Response Contract
- **200 OK:** Returns `CandidateProfileDetail`:
  ```typescript
  {
    id: string;
    candidateId: string;
    displayName: string;
    headline: string | null;
    summary: string | null;
    experience: string | null;
    careerPreferences: string | null;
    skills: Array<{ displayName: string; canonicalName: string }>;
    updatedAt: string;
  }
  ```
- **404 Not Found:** `{ error: { code: 'PROFILE_NOT_FOUND', message: 'Active profile was not found.' } }`
- **400 Bad Request:** `{ error: { code: 'VALIDATION_ERROR', message: string } }`

---

### 2.2 Database & Persistence Layer

#### Method on `ProfileRepository`
```typescript
updateActiveProfile(
  candidateId: string, 
  input: UpdateProfileInput
): Promise<CandidateProfileDetail>;
```

#### Persistence Operations:
1. Locate the active profile for `candidateId` (`is_active = true` and `deleted_at IS NULL`).
2. Update `profiles` table:
   - `display_name = input.displayName`
   - `headline = input.headline ?? null`
   - `summary = input.summary ?? null`
   - `experience = input.experience ?? null`
   - `career_preferences = input.careerPreferences ?? null`
   - `updated_at = NOW()`
3. Update `profile_skills` table:
   - Delete existing `profile_skills` associated with this `profile.id`.
   - Batch insert the normalized skills for `profile.id`:
     `{ profile_id, display_name, canonical_name }`
4. Return the refreshed `CandidateProfileDetail`.

---

### 2.3 Cascade Synchronization (Search Profile & AI Embeddings)

Whenever an active profile is successfully edited:
1. **Search Profile Invalidation & Re-derivation:**
   - In `candidate-search.service.ts` / `search-profile.service.ts`, call `deriveFromProfile(updatedProfile, candidateId)` and persist to `search_profiles`.
   - This ensures immediate update of derived target roles and primary/secondary skills without waiting for background cache expiry.
2. **AI Vector Embedding Recomputation:**
   - If `ProfileEmbeddingService` is available, trigger embedding generation for the updated profile text (`buildProfileEmbeddingText`), updating `profile_embeddings` with the new vector representation.

---

## 3. Frontend Specification

### 3.1 Views & Components

#### 1. `ProfileView.vue` Header Enhancement
- Next to the "Candidate Profile" title / subheader, add an **"Edit Profile"** button with a `Pencil` icon (using JobToolkit secondary/editorial button styling).
- Disabled or hidden if no active profile exists (`!profile`).
- Clicking opens `ProfileEditModal.vue`.

#### 2. `ProfileEditModal.vue` Component
A clean, editorial modal dialog with tabs/sections:
- **Tabs:**
  - `General`: Display Name (input), Headline (input). Includes a live preview of candidate avatar initial.
  - `Summary`: Professional Summary (multiline textarea with character/word guidance).
  - `Skills`: Interactive Tag Input:
    - Input box to type new skills with "Add" button and Enter/Comma keyboard trigger.
    - Badges with remove icon (`×`).
    - Clear visual counter of verified skills count.
  - `Experience & Preferences`: Two spacious textareas for Work Experience and Career Preferences.
- **Controls & States:**
  - Modal backdrop blur with ESC key and outside-click dismissal.
  - Inline validation messages (e.g., display name required).
  - "Cancel" button and "Save Changes" button (emerald theme, with loading spinner and disabled state while saving).
  - Error alert banner on mutation failure.

#### 3. Composable `useProfile.ts`
- Expose `saving = ref<boolean>(false)`.
- Implement `updateProfile(data: UpdateProfilePayload): Promise<boolean>`.
- On success:
  - Updates reactive `profile.value` directly.
  - Triggers `fetchSearchProfile()` from `useSearchProfile` so `SearchProfileCard` updates synchronously.

---

## 4. Testing Strategy

### 4.1 Backend Tests
- **Repository Unit Tests (`supabase-profile-repository.test.ts`):**
  - Verify `updateActiveProfile` updates `profiles` fields and timestamp.
  - Verify `profile_skills` are cleared and inserted with canonical names.
  - Verify error handling when active profile does not exist.
- **API Integration Tests (`profile-api.test.ts` / `app.test.ts`):**
  - `PUT /api/profile` with valid payload returns 200 and updated `CandidateProfileDetail`.
  - `PUT /api/profile` with missing `displayName` returns 400.
  - Candidate data isolation verified (`auth.uid()`).
  - Search profile sync verified.

### 4.2 Frontend Tests
- **Composable Tests (`useProfile.test.ts`):**
  - Test `updateProfile` calls `PUT /api/profile` with correct payload.
  - Test state updates (`saving`, `error`, `profile`).
- **Component Tests (`ProfileEditModal.test.ts`):**
  - Verify initial values populate inputs from current profile.
  - Verify adding and removing skill tags.
  - Verify submit button dispatches update and emits close/saved events.

# Design Specification: Scalable Job Source Selector

**Date:** 2026-09-24  
**Status:** Approved  
**Topic:** Scalable Job Source Selector & Centralized Registry  

---

## 1. Executive Summary

As Job Scrapper expands beyond Jobstreet and Loker.id, the job portal selection mechanism must gracefully scale to accommodate upcoming job providers (Dealls, Glints, Indeed, LinkedIn, KitaLulus, Kalibrr, Karir.com) without hardcoding portal lists separately across the system or cluttering the settings UI.

This feature establishes a centralized backend registry (`JOB_SOURCE_REGISTRY`), exposes available sources via `GET /api/job-sources`, and replaces the fixed checkbox layout in the Job Search Preferences modal with a searchable multi-select dropdown component (`SourceMultiSelect.vue`).

---

## 2. Architecture & Data Contracts

### 2.1 Backend Source Definition & Registry

#### Type Definition (`backend/src/search/job-source-registry.ts`)
```typescript
export interface JobSourceDefinition {
  id: string;
  name: string;
  available: boolean;
  supportsLocation?: boolean;
  supportsFreshness?: boolean;
  supportsWorkMode?: boolean;
  description?: string;
}
```

#### Centralized Registry Entries
1. `jobstreet`: `{ id: 'jobstreet', name: 'Jobstreet', available: true, supportsLocation: true, supportsFreshness: true, supportsWorkMode: true }`
2. `loker-id`: `{ id: 'loker-id', name: 'Loker.id', available: true, supportsLocation: true, supportsFreshness: true, supportsWorkMode: false }`
3. `dealls`: `{ id: 'dealls', name: 'Dealls', available: false, description: 'Tech & business jobs in SEA' }`
4. `glints`: `{ id: 'glints', name: 'Glints', available: false, description: 'Career discovery platform' }`
5. `indeed`: `{ id: 'indeed', name: 'Indeed', available: false, description: 'Global job search engine' }`
6. `linkedin`: `{ id: 'linkedin', name: 'LinkedIn', available: false, description: 'Professional networking & jobs' }`
7. `kitalulus`: `{ id: 'kitalulus', name: 'KitaLulus', available: false, description: 'Indonesian workforce portal' }`
8. `kalibrr`: `{ id: 'kalibrr', name: 'Kalibrr', available: false, description: 'Southeast Asia recruitment platform' }`
9. `karir-com`: `{ id: 'karir-com', name: 'Karir.com', available: false, description: 'Indonesian job vacancy network' }`

### 2.2 API Endpoint

#### Route
```http
GET /api/job-sources
```
- **Auth:** Open / Authenticated.
- **Response:** Array of `JobSourceDefinition` (status 200 OK).

#### Search Preferences Validation Protection
- In `SearchPreferencesService.updatePreferences(candidateId, input)`:
  - Validates that every requested source ID in `input.sources` exists in `JOB_SOURCE_REGISTRY` with `available === true`.
  - Rejects unavailable or unsupported sources with 400 Bad Request (`Unsupported job source`).
  - Never automatically selects newly added sources for existing users (user preferences remain the sole source of truth).

---

## 3. Frontend Specification

### 3.1 Composable `useJobSources.ts`
- Provides `jobSources = ref<JobSourceDefinition[]>` pre-populated with a client fallback registry.
- `fetchJobSources()`: Fetches `GET /api/job-sources` asynchronously.
- Computed helper: `availableSources = computed(() => jobSources.value.filter(s => s.available))`

### 3.2 Component `SourceMultiSelect.vue`
- **Props:**
  - `modelValue: string[]` (array of selected source IDs)
- **Emits:**
  - `update:modelValue(newSelection: string[])`
- **Collapsed State (Trigger Button):**
  - Displays selected source names (e.g. `Jobstreet, Loker.id`).
  - When more than 2 items are selected, formats compactly: `[ First, Second +N ]`.
  - Counter badge showing selected count.
  - Dropdown chevron icon.
- **Expanded State (Dropdown Menu):**
  - Search input with placeholder `"Search sources..."`. Real-time case-insensitive filtering by `name` or `id`.
  - Quick action toolbar:
    - `"Select all available"`: Adds all `available: true` source IDs.
    - `"Clear"`: Emits empty array `[]`.
    - Status counter: e.g. `2 of 2 available selected`.
  - Scrollable list of source items:
    - **Available items:** Active checkbox, bold name, `Available` badge.
    - **Unavailable items:** Disabled checkbox, dimmed text, `Coming soon` badge.
  - Closes on outside click (`click-outside`) and `Escape` key press.

### 3.3 Modal Integration (`SearchPreferencesModal.vue`)
- Replaces legacy 2-button source layout with `<SourceMultiSelect v-model="formSources" />`.
- Preserves validation: Requires at least 1 enabled source before saving.

---

## 4. Testing Strategy

### 4.1 Backend Tests
- `job-source-registry.test.ts`: Verifies source definitions, available flags, and helper functions (`getAvailableJobSourceIds`).
- `search-preferences.service.test.ts`: Verifies unavailable sources cannot be saved and existing preferences remain intact.
- `search-preferences-api.test.ts`: Verifies `GET /api/job-sources` returns the registry.

### 4.2 Frontend Tests
- `useJobSources.test.ts`: Verifies loading sources from API and fallback handling.
- `SourceMultiSelect.test.ts`:
  - Renders compact trigger with selected sources count.
  - Toggles dropdown on click.
  - Filters sources using search input.
  - Prevents selecting unavailable/disabled sources.
  - "Select all available" and "Clear" actions work properly.
- `SearchPreferencesModal.test.ts`:
  - Verifies integration with `SourceMultiSelect`.

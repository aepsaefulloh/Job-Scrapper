# Scalable Job Source Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a centralized job source registry (`JOB_SOURCE_REGISTRY`) exposed via `GET /api/job-sources` and replace the fixed checkbox layout in Job Search Preferences with a searchable multi-select dropdown component (`SourceMultiSelect.vue`) supporting quick actions, search filtering, and disabled "Coming soon" states for future providers.

**Architecture:** Backend defines `JobSourceDefinition` with `available: boolean` flags in `backend/src/search/job-source-registry.ts`. The API serves this registry via `GET /api/job-sources`. `SearchPreferencesService` validates that only available sources can be saved. Frontend consumes this via `useJobSources.ts` composable (with initial static fallback) and renders `SourceMultiSelect.vue` within `SearchPreferencesModal.vue`.

**Tech Stack:** TypeScript, Node.js, Express, Vitest, Vue 3, Vite, Tailwind CSS, Lucide icons.

## Global Constraints

- Available sources: `jobstreet`, `loker-id` (`available: true`).
- Future / unimplemented sources: `dealls`, `glints`, `indeed`, `linkedin`, `kitalulus`, `kalibrr`, `karir-com` (`available: false`, marked "Coming soon" and disabled in UI).
- Scrapers for future providers must NOT be implemented in this task.
- User preferences remain the sole source of truth; never auto-enable new sources for existing candidates.
- Search execution & scheduling continue to consume saved preferences without changes to planner semantics.
- Verification commands before completion:
  - `bun test` in `backend/`
  - `bun run typecheck` in `backend/`
  - `bun run build` in `backend/`
  - `bun run test` in `frontend/`
  - `bun run typecheck` in `frontend/`
  - `bun run build` in `frontend/`

---

### Task 1: Backend Job Source Registry & API Endpoint

**Files:**
- Create: `backend/src/search/job-source-registry.ts`
- Create: `backend/tests/unit/search/job-source-registry.test.ts`
- Create: `backend/tests/integration/api/job-sources-api.test.ts`
- Modify: `backend/src/search/search-preferences.service.ts`
- Modify: `backend/src/app.ts`

**Interfaces:**
- Produces: `JobSourceDefinition`, `JOB_SOURCE_REGISTRY`, `getAvailableJobSourceIds()`, `GET /api/job-sources`

- [ ] **Step 1: Write unit tests for `job-source-registry.ts`**

Create `backend/tests/unit/search/job-source-registry.test.ts`:
```typescript
import { describe, expect, it } from 'vitest';
import {
  JOB_SOURCE_REGISTRY,
  getAvailableJobSourceIds,
  isJobSourceAvailable,
} from '../../../src/search/job-source-registry.js';

describe('Job Source Registry', () => {
  it('contains Jobstreet and Loker.id as available sources', () => {
    const availableIds = getAvailableJobSourceIds();
    expect(availableIds).toContain('jobstreet');
    expect(availableIds).toContain('loker-id');
  });

  it('marks upcoming sources as unavailable (coming soon)', () => {
    expect(isJobSourceAvailable('dealls')).toBe(false);
    expect(isJobSourceAvailable('glints')).toBe(false);
    expect(isJobSourceAvailable('linkedin')).toBe(false);
    expect(isJobSourceAvailable('indeed')).toBe(false);
    expect(isJobSourceAvailable('kitalulus')).toBe(false);
    expect(isJobSourceAvailable('kalibrr')).toBe(false);
    expect(isJobSourceAvailable('karir-com')).toBe(false);
  });

  it('returns false for unknown source IDs', () => {
    expect(isJobSourceAvailable('unknown-portal')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && bun test tests/unit/search/job-source-registry.test.ts`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Implement `backend/src/search/job-source-registry.ts`**

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

export const JOB_SOURCE_REGISTRY: readonly JobSourceDefinition[] = [
  {
    id: 'jobstreet',
    name: 'Jobstreet',
    available: true,
    supportsLocation: true,
    supportsFreshness: true,
    supportsWorkMode: true,
    description: 'Southeast Asia jobs portal',
  },
  {
    id: 'loker-id',
    name: 'Loker.id',
    available: true,
    supportsLocation: true,
    supportsFreshness: true,
    supportsWorkMode: false,
    description: 'Indonesian job vacancy network',
  },
  {
    id: 'dealls',
    name: 'Dealls',
    available: false,
    description: 'Tech & business jobs in SEA',
  },
  {
    id: 'glints',
    name: 'Glints',
    available: false,
    description: 'Career discovery platform',
  },
  {
    id: 'indeed',
    name: 'Indeed',
    available: false,
    description: 'Global job search engine',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    available: false,
    description: 'Professional networking & jobs',
  },
  {
    id: 'kitalulus',
    name: 'KitaLulus',
    available: false,
    description: 'Indonesian workforce portal',
  },
  {
    id: 'kalibrr',
    name: 'Kalibrr',
    available: false,
    description: 'Southeast Asia recruitment platform',
  },
  {
    id: 'karir-com',
    name: 'Karir.com',
    available: false,
    description: 'Indonesian job portal',
  },
] as const;

export function getAvailableJobSourceIds(): string[] {
  return JOB_SOURCE_REGISTRY.filter((s) => s.available).map((s) => s.id);
}

export function isJobSourceAvailable(sourceId: string): boolean {
  const match = JOB_SOURCE_REGISTRY.find((s) => s.id === sourceId);
  return match?.available === true;
}
```

- [ ] **Step 4: Update `backend/src/search/search-preferences.service.ts`**

Use `getAvailableJobSourceIds()` in `search-preferences.service.ts` to ensure only available sources can be saved:
```typescript
import { getAvailableJobSourceIds } from './job-source-registry.js';

// In validate/save:
const availableSources = getAvailableJobSourceIds();
for (const s of input.sources) {
  if (!availableSources.includes(s)) {
    throw new Error(`Unsupported job source: "${s}". Supported sources: ${availableSources.join(', ')}`);
  }
}
```

- [ ] **Step 5: Write integration test and wire `GET /api/job-sources` in `backend/src/app.ts`**

Create `backend/tests/integration/api/job-sources-api.test.ts`:
```typescript
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../src/app.js';

describe('GET /api/job-sources', () => {
  it('returns list of registered job sources with availability flags', async () => {
    const app = createApp({
      authenticate: vi.fn().mockResolvedValue({ userId: 'u1', accessToken: 't1' }),
      profileDocumentMaxBytes: 1024 * 1024,
      createProfileService: vi.fn(),
    });

    const res = await request(app).get('/job-sources');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const jobstreet = res.body.find((s: any) => s.id === 'jobstreet');
    const dealls = res.body.find((s: any) => s.id === 'dealls');

    expect(jobstreet).toBeDefined();
    expect(jobstreet.available).toBe(true);
    expect(dealls).toBeDefined();
    expect(dealls.available).toBe(false);
  });
});
```

In `backend/src/app.ts`, register `GET /job-sources`:
```typescript
import { JOB_SOURCE_REGISTRY } from './search/job-source-registry.js';

// Inside createApp router:
router.get('/job-sources', (_req, res) => {
  res.json(JOB_SOURCE_REGISTRY);
});
```

- [ ] **Step 6: Run tests and commit Task 1**

```bash
cd backend
bun test
bun run typecheck
git add backend/src/search/job-source-registry.ts backend/tests/unit/search/job-source-registry.test.ts backend/tests/integration/api/job-sources-api.test.ts backend/src/search/search-preferences.service.ts backend/src/app.ts
git commit -m "feat(api): add centralized job source registry and GET /api/job-sources endpoint"
```

---

### Task 2: Frontend Types & Composable (`useJobSources.ts`)

**Files:**
- Create: `frontend/src/types/job-source.ts`
- Create: `frontend/src/composables/useJobSources.ts`
- Create: `frontend/src/composables/__tests__/useJobSources.test.ts`

**Interfaces:**
- Produces: `JobSourceDefinition`, `useJobSources(): { jobSources, availableSources, loading, fetchJobSources }`

- [ ] **Step 1: Write unit tests for `useJobSources`**

Create `frontend/src/composables/__tests__/useJobSources.test.ts`:
```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useJobSources } from '../useJobSources';
import { apiClient } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe('useJobSources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with static fallback sources containing jobstreet and loker-id', () => {
    const { jobSources, availableSources } = useJobSources();
    expect(jobSources.value.length).toBeGreaterThanOrEqual(2);
    expect(availableSources.value.map((s) => s.id)).toEqual(['jobstreet', 'loker-id']);
  });

  it('fetches remote sources and updates reactive state', async () => {
    const mockRemote = [
      { id: 'jobstreet', name: 'Jobstreet', available: true },
      { id: 'loker-id', name: 'Loker.id', available: true },
      { id: 'dealls', name: 'Dealls', available: false },
    ];
    (apiClient.get as any).mockResolvedValueOnce(mockRemote);

    const { jobSources, fetchJobSources } = useJobSources();
    await fetchJobSources();

    expect(apiClient.get).toHaveBeenCalledWith('/job-sources');
    expect(jobSources.value).toEqual(mockRemote);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && bun run test src/composables/__tests__/useJobSources.test.ts`
Expected: FAIL with missing module.

- [ ] **Step 3: Implement `frontend/src/types/job-source.ts` and `frontend/src/composables/useJobSources.ts`**

Create `frontend/src/types/job-source.ts`:
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

Create `frontend/src/composables/useJobSources.ts`:
```typescript
import { ref, computed } from 'vue';
import { apiClient } from '../lib/api';
import type { JobSourceDefinition } from '../types/job-source';

export const STATIC_FALLBACK_SOURCES: readonly JobSourceDefinition[] = [
  { id: 'jobstreet', name: 'Jobstreet', available: true, supportsLocation: true, supportsFreshness: true, supportsWorkMode: true },
  { id: 'loker-id', name: 'Loker.id', available: true, supportsLocation: true, supportsFreshness: true, supportsWorkMode: false },
  { id: 'dealls', name: 'Dealls', available: false, description: 'Tech & business jobs in SEA' },
  { id: 'glints', name: 'Glints', available: false, description: 'Career discovery platform' },
  { id: 'indeed', name: 'Indeed', available: false, description: 'Global job search engine' },
  { id: 'linkedin', name: 'LinkedIn', available: false, description: 'Professional networking & jobs' },
  { id: 'kitalulus', name: 'KitaLulus', available: false, description: 'Indonesian workforce portal' },
  { id: 'kalibrr', name: 'Kalibrr', available: false, description: 'Southeast Asia recruitment platform' },
  { id: 'karir-com', name: 'Karir.com', available: false, description: 'Indonesian job portal' },
];

const jobSources = ref<JobSourceDefinition[]>([...STATIC_FALLBACK_SOURCES]);
const loading = ref<boolean>(false);
const error = ref<string | null>(null);

export function useJobSources() {
  const availableSources = computed(() => jobSources.value.filter((s) => s.available));

  async function fetchJobSources() {
    loading.value = true;
    error.value = null;
    try {
      const res = await apiClient.get<JobSourceDefinition[]>('/job-sources');
      if (Array.isArray(res) && res.length > 0) {
        jobSources.value = res;
      }
      return res;
    } catch (e: any) {
      error.value = e?.message || 'Failed to load job sources.';
      return jobSources.value;
    } finally {
      loading.value = false;
    }
  }

  return {
    jobSources,
    availableSources,
    loading,
    error,
    fetchJobSources,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && bun run test src/composables/__tests__/useJobSources.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git add frontend/src/types/job-source.ts frontend/src/composables/useJobSources.ts frontend/src/composables/__tests__/useJobSources.test.ts
git commit -m "feat(frontend): add useJobSources composable with static fallback and remote fetching"
```

---

### Task 3: Frontend Component `SourceMultiSelect.vue`

**Files:**
- Create: `frontend/src/components/jobs/SourceMultiSelect.vue`
- Create: `frontend/src/components/jobs/__tests__/SourceMultiSelect.test.ts`

**Interfaces:**
- Consumes: `useJobSources()`
- Props: `modelValue: string[]`
- Emits: `update:modelValue(newSelection: string[])`

- [ ] **Step 1: Write component tests for `SourceMultiSelect.vue`**

Create `frontend/src/components/jobs/__tests__/SourceMultiSelect.test.ts`:
```typescript
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import SourceMultiSelect from '../SourceMultiSelect.vue';

const mockSources = [
  { id: 'jobstreet', name: 'Jobstreet', available: true },
  { id: 'loker-id', name: 'Loker.id', available: true },
  { id: 'dealls', name: 'Dealls', available: false },
  { id: 'glints', name: 'Glints', available: false },
];

vi.mock('../../../composables/useJobSources', () => ({
  useJobSources: () => ({
    jobSources: { value: mockSources },
    availableSources: { value: mockSources.filter((s) => s.available) },
    loading: { value: false },
    fetchJobSources: vi.fn(),
  }),
}));

describe('SourceMultiSelect.vue', () => {
  it('renders collapsed state with summary of selected sources', () => {
    const wrapper = mount(SourceMultiSelect, {
      props: {
        modelValue: ['jobstreet', 'loker-id'],
      },
    });

    expect(wrapper.text()).toContain('Jobstreet, Loker.id');
    expect(wrapper.text()).toContain('2');
  });

  it('filters sources when typing in search input', async () => {
    const wrapper = mount(SourceMultiSelect, {
      props: {
        modelValue: ['jobstreet'],
      },
    });

    // Open dropdown
    await wrapper.find('button.source-select-trigger').trigger('click');

    const searchInput = wrapper.find('input.source-search-input');
    await searchInput.setValue('loker');

    expect(wrapper.text()).toContain('Loker.id');
    expect(wrapper.text()).not.toContain('Dealls');
  });

  it('prevents selecting unavailable sources', async () => {
    const wrapper = mount(SourceMultiSelect, {
      props: {
        modelValue: ['jobstreet'],
      },
    });

    // Open dropdown
    await wrapper.find('button.source-select-trigger').trigger('click');

    const deallsRow = wrapper.findAll('.source-item-row').find((r) => r.text().includes('Dealls'));
    expect(deallsRow?.classes()).toContain('opacity-50');

    const deallsCheckbox = deallsRow?.find<HTMLInputElement>('input[type="checkbox"]');
    expect(deallsCheckbox?.element.disabled).toBe(true);
  });

  it('selects all available sources on "Select all available" click', async () => {
    const wrapper = mount(SourceMultiSelect, {
      props: {
        modelValue: ['jobstreet'],
      },
    });

    await wrapper.find('button.source-select-trigger').trigger('click');
    const selectAllBtn = wrapper.find('button.btn-select-all');
    await selectAllBtn.trigger('click');

    expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toEqual(['jobstreet', 'loker-id']);
  });

  it('clears selection on "Clear" click', async () => {
    const wrapper = mount(SourceMultiSelect, {
      props: {
        modelValue: ['jobstreet', 'loker-id'],
      },
    });

    await wrapper.find('button.source-select-trigger').trigger('click');
    const clearBtn = wrapper.find('button.btn-clear');
    await clearBtn.trigger('click');

    expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && bun run test src/components/jobs/__tests__/SourceMultiSelect.test.ts`
Expected: FAIL with component not found.

- [ ] **Step 3: Implement `SourceMultiSelect.vue`**

Create `frontend/src/components/jobs/SourceMultiSelect.vue`:
```vue
<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useJobSources } from '../../composables/useJobSources';
import { ChevronDown, Search, Check, X } from 'lucide-vue-next';

const props = defineProps<{
  modelValue: string[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void;
}>();

const { jobSources, availableSources, fetchJobSources } = useJobSources();

onMounted(() => {
  fetchJobSources();
  document.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
});

const isOpen = ref(false);
const searchQuery = ref('');
const containerRef = ref<HTMLElement | null>(null);

function handleClickOutside(event: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    isOpen.value = false;
  }
}

function toggleDropdown() {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    searchQuery.value = '';
  }
}

const filteredSources = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return jobSources.value;
  return jobSources.value.filter(
    (s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
  );
});

const selectedNames = computed(() => {
  const names = props.modelValue.map((id) => {
    const found = jobSources.value.find((s) => s.id === id);
    return found ? found.name : id;
  });
  return names;
});

const summaryText = computed(() => {
  if (selectedNames.value.length === 0) return 'Select job portals...';
  if (selectedNames.value.length <= 2) return selectedNames.value.join(', ');
  return `${selectedNames.value.slice(0, 2).join(', ')} +${selectedNames.value.length - 2}`;
});

function toggleSource(sourceId: string, available: boolean) {
  if (!available) return;
  const current = [...props.modelValue];
  const index = current.indexOf(sourceId);
  if (index >= 0) {
    current.splice(index, 1);
  } else {
    current.push(sourceId);
  }
  emit('update:modelValue', current);
}

function selectAllAvailable() {
  const allAvailableIds = availableSources.value.map((s) => s.id);
  emit('update:modelValue', allAvailableIds);
}

function clearAll() {
  emit('update:modelValue', []);
}
</script>

<template>
  <div ref="containerRef" class="relative w-full text-xs">
    <!-- Trigger Button -->
    <button
      type="button"
      @click="toggleDropdown"
      class="source-select-trigger w-full flex items-center justify-between px-3 py-2 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 transition-colors shadow-subtle text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
      :aria-expanded="isOpen"
    >
      <div class="flex items-center gap-2 truncate">
        <span
          :class="[
            'truncate font-medium',
            modelValue.length === 0 ? 'text-stone-400' : 'text-stone-900',
          ]"
        >
          {{ summaryText }}
        </span>
      </div>

      <div class="flex items-center gap-1.5 shrink-0 ml-2">
        <span
          v-if="modelValue.length > 0"
          class="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold"
        >
          {{ modelValue.length }}
        </span>
        <ChevronDown
          class="w-3.5 h-3.5 text-stone-500 transition-transform duration-150"
          :class="{ 'rotate-180': isOpen }"
        />
      </div>
    </button>

    <!-- Dropdown Menu -->
    <div
      v-if="isOpen"
      class="source-select-menu absolute z-50 mt-1 w-full rounded-xl border border-surface-border bg-surface shadow-elevated overflow-hidden animate-in fade-in duration-100 flex flex-col max-h-72"
    >
      <!-- Search Input -->
      <div class="p-2 border-b border-surface-border bg-stone-50/50">
        <div class="relative flex items-center">
          <Search class="w-3.5 h-3.5 text-stone-400 absolute left-2.5 pointer-events-none" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search sources..."
            class="source-search-input w-full pl-8 pr-3 py-1.5 text-xs bg-white rounded-md border border-stone-200 focus:outline-none focus:border-emerald-700"
          />
        </div>
      </div>

      <!-- Quick Action Toolbar -->
      <div
        class="px-3 py-1.5 border-b border-surface-border flex items-center justify-between text-[11px] bg-stone-50/30 text-stone-600"
      >
        <span>{{ modelValue.length }} of {{ availableSources.length }} available</span>
        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="selectAllAvailable"
            class="btn-select-all font-semibold text-emerald-700 hover:text-emerald-900"
          >
            Select all available
          </button>
          <span class="text-stone-300">|</span>
          <button
            type="button"
            @click="clearAll"
            class="btn-clear font-semibold text-stone-500 hover:text-stone-800"
          >
            Clear
          </button>
        </div>
      </div>

      <!-- Sources List -->
      <div class="overflow-y-auto p-1.5 space-y-1 flex-1">
        <div
          v-for="source in filteredSources"
          :key="source.id"
          @click="toggleSource(source.id, source.available)"
          :class="[
            'source-item-row flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors select-none',
            source.available
              ? 'cursor-pointer hover:bg-stone-100'
              : 'opacity-50 cursor-not-allowed bg-stone-50/50',
          ]"
        >
          <div class="flex items-center gap-2.5">
            <input
              type="checkbox"
              :id="`source-${source.id}`"
              :checked="modelValue.includes(source.id)"
              :disabled="!source.available"
              class="rounded border-stone-300 text-emerald-700 focus:ring-emerald-700 pointer-events-none"
            />
            <div>
              <span class="font-medium text-stone-900">{{ source.name }}</span>
              <p v-if="source.description" class="text-[10px] text-stone-400">
                {{ source.description }}
              </p>
            </div>
          </div>

          <div>
            <span
              v-if="source.available"
              class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/60"
            >
              Available
            </span>
            <span
              v-else
              class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 text-stone-500 border border-stone-200"
            >
              Coming soon
            </span>
          </div>
        </div>

        <div
          v-if="filteredSources.length === 0"
          class="p-4 text-center text-stone-400 text-xs italic"
        >
          No sources match "{{ searchQuery }}"
        </div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && bun run test src/components/jobs/__tests__/SourceMultiSelect.test.ts`
Expected: PASS (all 5 tests pass).

- [ ] **Step 5: Commit Task 3**

```bash
git add frontend/src/components/jobs/SourceMultiSelect.vue frontend/src/components/jobs/__tests__/SourceMultiSelect.test.ts
git commit -m "feat(frontend): implement SourceMultiSelect searchable multi-select component"
```

---

### Task 4: Integration in `SearchPreferencesModal.vue` & Suite Regression Verification

**Files:**
- Modify: `frontend/src/components/jobs/SearchPreferencesModal.vue`
- Modify: `frontend/src/components/jobs/__tests__/SearchPreferencesModal.test.ts`

- [ ] **Step 1: Replace hardcoded buttons with `SourceMultiSelect` in `SearchPreferencesModal.vue`**

In `SearchPreferencesModal.vue`:
```vue
<script setup>
// import SourceMultiSelect
import SourceMultiSelect from './SourceMultiSelect.vue';
</script>

<template>
  <!-- Replace grid buttons with: -->
  <div>
    <label class="block text-xs font-semibold text-stone-900 mb-1.5">
      Job Portals & Sources
    </label>
    <SourceMultiSelect v-model="formSources" />
  </div>
</template>
```

- [ ] **Step 2: Update `SearchPreferencesModal.test.ts` and verify modal tests pass**

Run: `cd frontend && bun run test src/components/jobs/__tests__/SearchPreferencesModal.test.ts`
Expected: PASS.

- [ ] **Step 3: Run complete backend and frontend verification**

Run:
```bash
cd backend
bun test
bun run typecheck
bun run build

cd ../frontend
bun run test
bun run typecheck
bun run build
```
Expected: All tests pass, 0 errors, clean builds.

- [ ] **Step 4: Commit Task 4**

```bash
git add frontend/src/components/jobs/SearchPreferencesModal.vue frontend/src/components/jobs/__tests__/SearchPreferencesModal.test.ts
git commit -m "feat(frontend): integrate SourceMultiSelect into SearchPreferencesModal"
```

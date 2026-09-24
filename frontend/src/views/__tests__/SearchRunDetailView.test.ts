import { mount } from '@vue/test-utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import SearchRunDetailView from '../SearchRunDetailView.vue';
import { ref } from 'vue';
import type { SearchExecutionRecord } from '../../types/search-execution';

const mockExecution = ref<SearchExecutionRecord | null>(null);
const mockLoading = ref(false);
const mockError = ref<string | null>(null);
const mockElapsedSeconds = ref(45);
const mockIsRunning = ref(false);
const mockStartPolling = vi.fn();
const mockStopPolling = vi.fn();
const mockFetchExecution = vi.fn();
const mockFormatDuration = (secs: number) => `${secs}s`;

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ params: { id: 'exec-123' }, path: '/search-runs/exec-123' }),
  RouterLink: {
    name: 'RouterLink',
    props: ['to'],
    template: '<a><slot /></a>',
  },
}));

vi.mock('../../composables/useAuth', () => ({
  useAuth: () => ({
    userDisplayName: { value: 'Aep' },
    user: { value: { id: 'cand-1' } },
    signOut: vi.fn(),
  }),
}));

vi.mock('../../composables/useSearchExecution', () => ({
  useSearchExecution: () => ({
    execution: mockExecution,
    loading: mockLoading,
    error: mockError,
    elapsedSeconds: mockElapsedSeconds,
    isRunning: mockIsRunning,
    startPolling: mockStartPolling,
    stopPolling: mockStopPolling,
    fetchExecution: mockFetchExecution,
    formatDuration: mockFormatDuration,
    onExecutionCompleted: vi.fn(),
    offExecutionCompleted: vi.fn(),
  }),
}));

describe('SearchRunDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoading.value = false;
    mockError.value = null;
    mockExecution.value = null;
  });

  const sampleExecution: SearchExecutionRecord = {
    id: 'exec-123',
    candidateId: 'cand-1',
    status: 'completed',
    trigger: 'manual',
    startedAt: '2026-09-24T12:00:00Z',
    finishedAt: '2026-09-24T12:00:45Z',
    preferencesSnapshot: {
      sources: ['jobstreet', 'loker-id'],
      maxPostingAgeDays: 14,
    },
    intentsSnapshot: [
      { source: 'jobstreet', keyword: 'Senior Frontend Developer', location: 'Jakarta' },
      { source: 'loker-id', keyword: 'Frontend Engineer', location: 'Jakarta' },
    ],
    stages: [
      { id: 'query_expansion', name: 'Query Expansion & Aliasing', status: 'completed' },
      { id: 'scraping', name: 'Source Scraping', status: 'completed' },
      { id: 'deduplication', name: 'Deduplication & Normalization', status: 'completed' },
      { id: 'hard_filters', name: 'Eligibility & Freshness Hard-Filters', status: 'completed' },
      { id: 'embeddings', name: 'AI Vector Embeddings', status: 'completed', isAi: true },
      { id: 'ai_evaluation', name: 'AI Compatibility Evaluation', status: 'completed', isAi: true },
    ],
    timeline: [
      { timestamp: '2026-09-24T12:00:00Z', message: 'Search execution started', type: 'info' },
      { timestamp: '2026-09-24T12:00:15Z', message: 'Scraped 15 raw jobs across sources', type: 'info' },
      { timestamp: '2026-09-24T12:00:30Z', message: 'Generating vector embeddings for new jobs', isAi: true, type: 'info' },
    ],
    summary: {
      discovered: 15,
      inserted: 8,
      updated: 2,
      duplicates: 5,
      failed: 0,
      filteredOut: 1,
      aiEvaluated: 8,
      aiFailed: 0,
    },
    sources: [
      {
        source: 'jobstreet',
        status: 'completed',
        discovered: 10,
        inserted: 6,
        duplicates: 4,
        failed: 0,
        durationMs: 25000,
      },
      {
        source: 'loker-id',
        status: 'completed',
        discovered: 5,
        inserted: 2,
        duplicates: 1,
        failed: 0,
        durationMs: 18000,
      },
    ],
    createdAt: '2026-09-24T12:00:00Z',
  };

  const mountView = () => mount(SearchRunDetailView, {
    global: {
      stubs: {
        RouterLink: {
          template: '<a><slot /></a>',
        },
      },
    },
  });

  it('starts polling with the route param ID on mount', () => {
    mountView();
    expect(mockStartPolling).toHaveBeenCalledWith('exec-123');
  });

  it('renders execution details, multi-source breakdown, and stage checklist', () => {
    mockExecution.value = sampleExecution;
    const wrapper = mountView();

    // Header info
    expect(wrapper.text()).toContain('Search Run');
    expect(wrapper.text()).toContain('Completed');
    expect(wrapper.text()).toContain('Manual');
    expect(wrapper.text()).toContain('45s');

    // Multi-source breakdown
    expect(wrapper.text()).toContain('Jobstreet');
    expect(wrapper.text()).toContain('Loker.id');

    // Summary metrics
    expect(wrapper.text()).toContain('15'); // Discovered
    expect(wrapper.text()).toContain('8'); // Inserted
    expect(wrapper.text()).toContain('5'); // Duplicates

    // Action button
    expect(wrapper.text()).toContain('Browse Discovered Jobs');
  });

  it('enforces strict AI provenance: AI badge only on genuine AI stages', () => {
    mockExecution.value = sampleExecution;
    const wrapper = mountView();

    // AI badge text
    const aiBadges = wrapper.findAll('[data-test="ai-badge"]');
    expect(aiBadges.length).toBeGreaterThan(0);

    // AI stages have the badge, deterministic stages do not
    const stagesText = wrapper.find('[data-test="stages-list"]').text();
    expect(stagesText).toContain('Query Expansion & Aliasing');
    expect(stagesText).toContain('AI Vector Embeddings');

    // Vector Embeddings and AI Compatibility stages should be marked with AI
    const stageItems = wrapper.findAll('[data-test="stage-item"]');
    expect(stageItems.length).toBe(6);

    // Query expansion stage (index 0) has NO AI badge
    expect(stageItems[0].find('[data-test="ai-badge"]').exists()).toBe(false);
    // Scraping stage (index 1) has NO AI badge
    expect(stageItems[1].find('[data-test="ai-badge"]').exists()).toBe(false);
    // Embeddings stage (index 4) HAS AI badge
    expect(stageItems[4].find('[data-test="ai-badge"]').exists()).toBe(true);
    // AI evaluation stage (index 5) HAS AI badge
    expect(stageItems[5].find('[data-test="ai-badge"]').exists()).toBe(true);
  });

  it('renders partial completion warning when status is partial', () => {
    mockExecution.value = {
      ...sampleExecution,
      status: 'partial',
      errorMessage: 'AI evaluation failed for 2 jobs due to rate limit.',
    };
    const wrapper = mountView();

    expect(wrapper.text()).toContain('Partial Completion');
    expect(wrapper.text()).toContain('AI evaluation encountered an issue');
    expect(wrapper.text()).toContain('jobs discovered during scraping remain safely saved');
  });
});

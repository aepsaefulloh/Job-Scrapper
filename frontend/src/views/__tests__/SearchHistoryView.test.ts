import { mount } from '@vue/test-utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import SearchHistoryView from '../SearchHistoryView.vue';
import { ref } from 'vue';
import type { SearchExecutionRecord, SearchExecutionFilters } from '../../types/search-execution';

const mockExecutions = ref<SearchExecutionRecord[]>([]);
const mockTotal = ref(0);
const mockLoading = ref(false);
const mockError = ref<string | null>(null);
const mockPage = ref(1);
const mockPageSize = ref(20);
const mockTotalPages = ref(1);
const mockFilters = ref<SearchExecutionFilters>({
  status: '',
  source: '',
  trigger: '',
  dateRange: 'all',
});

const mockFetchExecutions = vi.fn();
const mockSetFilter = vi.fn();
const mockSetPage = vi.fn();
const mockDeleteExecution = vi.fn().mockResolvedValue(true);
const mockClearAllExecutions = vi.fn().mockResolvedValue(true);
const mockFormatDuration = (secs: number) => `${secs}s`;

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ path: '/search-runs' }),
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

vi.mock('../../composables/useSearchExecutions', () => ({
  useSearchExecutions: () => ({
    executions: mockExecutions,
    total: mockTotal,
    loading: mockLoading,
    error: mockError,
    filters: mockFilters,
    page: mockPage,
    pageSize: mockPageSize,
    totalPages: mockTotalPages,
    fetchExecutions: mockFetchExecutions,
    setFilter: mockSetFilter,
    setPage: mockSetPage,
    formatDuration: mockFormatDuration,
    deleteExecution: mockDeleteExecution,
    clearAllExecutions: mockClearAllExecutions,
  }),
}));

describe('SearchHistoryView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoading.value = false;
    mockError.value = null;
    mockExecutions.value = [];
    mockTotal.value = 0;
    mockPage.value = 1;
    mockTotalPages.value = 1;
  });

  const sampleCompletedRun: SearchExecutionRecord = {
    id: 'exec-1',
    candidateId: 'cand-1',
    status: 'completed',
    trigger: 'manual',
    startedAt: '2026-09-24T10:00:00Z',
    finishedAt: '2026-09-24T10:01:15Z',
    preferencesSnapshot: {
      sources: ['jobstreet', 'loker-id'],
      locations: ['Jakarta', 'Bogor'],
      maxPostingAgeDays: 7,
    },
    intentsSnapshot: [
      { source: 'jobstreet', keyword: 'Frontend Developer', location: 'Jakarta' },
      { source: 'loker-id', keyword: 'Frontend Engineer', location: 'Bogor' },
    ],
    stages: [],
    timeline: [],
    summary: {
      discovered: 42,
      inserted: 25,
      updated: 0,
      duplicates: 17,
      failed: 0,
      filteredOut: 0,
      aiEvaluated: 11,
      aiFailed: 0,
    },
    sources: [
      { source: 'jobstreet', status: 'completed', discovered: 24, inserted: 15, duplicates: 9, failed: 0 },
      { source: 'loker-id', status: 'completed', discovered: 18, inserted: 10, duplicates: 8, failed: 0 },
    ],
    createdAt: '2026-09-24T10:00:00Z',
  };

  const sampleRunningRun: SearchExecutionRecord = {
    id: 'exec-2',
    candidateId: 'cand-1',
    status: 'running',
    trigger: 'scheduled',
    startedAt: '2026-09-24T11:00:00Z',
    finishedAt: null,
    preferencesSnapshot: { sources: ['jobstreet'] },
    intentsSnapshot: [],
    stages: [],
    timeline: [],
    summary: { discovered: 5, inserted: 2, updated: 0, duplicates: 3, failed: 0, filteredOut: 0, aiEvaluated: 0, aiFailed: 0 },
    sources: [{ source: 'jobstreet', status: 'running', discovered: 5, inserted: 2, duplicates: 3, failed: 0 }],
    createdAt: '2026-09-24T11:00:00Z',
  };

  const mountView = () =>
    mount(SearchHistoryView, {
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    });

  it('calls fetchExecutions on mount and renders page title', () => {
    const wrapper = mountView();
    expect(mockFetchExecutions).toHaveBeenCalled();
    expect(wrapper.text()).toContain('Search History');
  });

  it('renders execution rows with status, trigger, duration, metrics, and links', () => {
    mockExecutions.value = [sampleCompletedRun, sampleRunningRun];
    mockTotal.value = 2;

    const wrapper = mountView();

    // Check completed run
    expect(wrapper.text()).toContain('Completed');
    expect(wrapper.text()).toContain('Manual');
    expect(wrapper.text()).toContain('42 found');
    expect(wrapper.text()).toContain('+25 new');
    expect(wrapper.text()).toContain('75s'); // 1m 15s duration
    expect(wrapper.text()).toContain('View Run →');

    // Check running run
    expect(wrapper.text()).toContain('Running');
    expect(wrapper.text()).toContain('Scheduled');
    expect(wrapper.text()).toContain('View Live Progress →');

    // Multi-source display
    expect(wrapper.text()).toContain('Jobstreet + Loker.id');
  });

  it('enforces strict AI provenance: AI indicator rendered only when aiEvaluated > 0', () => {
    mockExecutions.value = [sampleCompletedRun, sampleRunningRun];
    mockTotal.value = 2;

    const wrapper = mountView();

    const aiBadges = wrapper.findAll('[data-test="ai-evaluated-badge"]');
    // Only sampleCompletedRun has aiEvaluated: 11
    expect(aiBadges.length).toBe(1);
    expect(aiBadges[0].text()).toContain('✦ AI evaluated');
  });

  it('renders empty state when no executions match', () => {
    mockExecutions.value = [];
    mockTotal.value = 0;

    const wrapper = mountView();

    expect(wrapper.text()).toContain('No search runs yet');
    expect(wrapper.text()).toContain('Run your first job search');
  });

  it('allows filtering by status and date range', async () => {
    const wrapper = mountView();

    const statusSelect = wrapper.find('[data-test="status-filter"]');
    expect(statusSelect.exists()).toBe(true);
    await statusSelect.setValue('completed');

    expect(mockSetFilter).toHaveBeenCalledWith('status', 'completed');
  });

  it('renders pagination and handles page navigation', async () => {
    mockExecutions.value = [sampleCompletedRun];
    mockTotal.value = 45;
    mockPage.value = 1;
    mockTotalPages.value = 3;

    const wrapper = mountView();

    expect(wrapper.text()).toContain('Page 1 of 3');
    const nextButton = wrapper.find('[data-test="next-page-btn"]');
    expect(nextButton.exists()).toBe(true);
    await nextButton.trigger('click');

    expect(mockSetPage).toHaveBeenCalledWith(2);
  });

  it('triggers deleteExecution when delete button is clicked', async () => {
    mockExecutions.value = [sampleCompletedRun];
    mockTotal.value = 1;

    const wrapper = mountView();

    const deleteBtn = wrapper.find('button[title="Hapus riwayat sesi ini"]');
    expect(deleteBtn.exists()).toBe(true);
    await deleteBtn.trigger('click');

    expect(mockDeleteExecution).toHaveBeenCalledWith('exec-1');
  });

  it('renders "Bersihkan Semua" button and triggers clearAllExecutions on modal confirm', async () => {
    mockExecutions.value = [sampleCompletedRun];
    mockTotal.value = 1;

    const wrapper = mountView();

    const clearAllBtn = wrapper.findAll('button').find(b => b.text().includes('Bersihkan Semua'));
    expect(clearAllBtn).toBeDefined();
    await clearAllBtn!.trigger('click');

    // Modal is now visible
    expect(wrapper.text()).toContain('Bersihkan Riwayat Scraping?');
    const modalConfirmBtn = wrapper.findAll('button').find(b => b.text().includes('Ya, Hapus Semua'));
    expect(modalConfirmBtn).toBeDefined();

    await modalConfirmBtn!.trigger('click');
    expect(mockClearAllExecutions).toHaveBeenCalled();
  });
});

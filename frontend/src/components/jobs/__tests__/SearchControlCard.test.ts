import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import SearchControlCard from '../SearchControlCard.vue';
import { useSearchProfile } from '../../../composables/useSearchProfile';
import { useScrapeRuns } from '../../../composables/useScrapeRuns';
import { useSearchPreferences } from '../../../composables/useSearchPreferences';

vi.mock('../../../composables/useSearchProfile');
vi.mock('../../../composables/useScrapeRuns');
vi.mock('../../../composables/useSearchPreferences');

const mockPush = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
  RouterLink: {
    name: 'RouterLink',
    props: ['to'],
    template: '<a><slot /></a>',
  },
}));

describe('SearchControlCard', () => {
  const mockPreferences = {
    sources: ['jobstreet', 'loker-id'],
    locations: ['Jakarta', 'Bogor'],
    workModes: ['remote'],
    employmentTypes: ['full-time'],
    maxPostingAgeDays: 7,
    unknownPostingDatePolicy: 'exclude',
  };

  const mockSearchProfile = {
    candidateId: 'cand-1',
    sourceProfileId: 'prof-1',
    sourceProfileUpdatedAt: '2026-01-01T00:00:00Z',
    targetRoles: ['Frontend Engineer'],
    roleAliases: ['Vue Developer'],
    primarySkills: ['Vue', 'TypeScript'],
    secondarySkills: [],
    industries: [],
    seniority: [],
    preferredLocations: ['Jakarta', 'Remote'],
    workModes: [],
    employmentTypes: ['full-time'],
    excludedRoles: [],
    excludedKeywords: [],
    excludedCompanies: [],
    languages: [],
    sources: ['jobstreet', 'loker-id'],
    generatedAt: '2026-01-01T00:00:00Z',
  };

  const mockLatestRun = {
    id: 'run-1',
    candidateId: 'cand-1',
    source: 'jobstreet',
    keyword: 'frontend',
    location: 'Jakarta',
    status: 'completed' as const,
    startedAt: '2026-01-01T00:00:00Z',
    finishedAt: '2026-01-01T00:01:00Z',
    discovered: 25,
    inserted: 18,
    updated: 2,
    duplicates: 5,
    failed: 0,
    safeErrorCode: null,
    safeErrorMessage: null,
    trigger: 'manual' as const,
    createdAt: '2026-01-01T00:00:00Z',
  };

  const mockLokerIdRun = {
    id: 'run-2',
    candidateId: 'cand-1',
    source: 'loker-id',
    keyword: 'frontend',
    location: 'Jakarta',
    status: 'completed' as const,
    startedAt: '2026-01-01T00:00:00Z',
    finishedAt: '2026-01-01T00:01:00Z',
    discovered: 30,
    inserted: 11,
    updated: 3,
    duplicates: 16,
    failed: 0,
    safeErrorCode: null,
    safeErrorMessage: null,
    trigger: 'manual' as const,
    createdAt: '2026-01-01T00:00:00Z',
  };

  let mockTriggerSearch: any;
  let mockFetchProfile: any;
  let mockFetchLatest: any;
  let mockFetchRecent: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockFetchProfile = vi.fn().mockResolvedValue(mockSearchProfile);
    mockFetchLatest = vi.fn().mockResolvedValue(mockLatestRun);
    mockFetchRecent = vi.fn().mockResolvedValue([mockLatestRun, mockLokerIdRun]);
    mockTriggerSearch = vi.fn().mockResolvedValue({ status: 'running', runIds: ['run-1', 'run-2'] });

    (useSearchProfile as any).mockReturnValue({
      searchProfile: ref(mockSearchProfile),
      loading: ref(false),
      error: ref(null),
      fetchSearchProfile: mockFetchProfile,
    });

    (useScrapeRuns as any).mockReturnValue({
      latestRun: ref(mockLatestRun),
      recentRuns: ref([mockLatestRun, mockLokerIdRun]),
      loading: ref(false),
      triggering: ref(false),
      isRunning: ref(false),
      error: ref(null),
      fetchLatestRun: mockFetchLatest,
      fetchRecentRuns: mockFetchRecent,
      triggerSearch: mockTriggerSearch,
      startPolling: vi.fn(),
      stopPolling: vi.fn(),
      onRunCompleted: vi.fn(),
      offRunCompleted: vi.fn(),
    });

    (useSearchPreferences as any).mockReturnValue({
      preferences: ref(mockPreferences),
      loading: ref(false),
      saving: ref(false),
      error: ref(null),
      fetchPreferences: vi.fn().mockResolvedValue(mockPreferences),
      updatePreferences: vi.fn().mockResolvedValue(mockPreferences),
    });
  });

  it('renders search preferences summary and allows opening edit preferences modal', async () => {
    const wrapper = mount(SearchControlCard);

    expect(wrapper.text()).toContain('Search Preferences');
    expect(wrapper.text()).toContain('Edit Preferences');
    expect(wrapper.text()).toContain('Last 7 days');
    expect(wrapper.text()).toContain('Bogor');

    // Click Edit Preferences
    const editBtn = wrapper.findAll('button').find((b) => b.text().includes('Edit Preferences'));
    expect(editBtn).toBeDefined();
    await editBtn!.trigger('click');

    // Modal should be visible
    expect(wrapper.text()).toContain('Job Search Preferences');
    expect(wrapper.text()).toContain('Job Portals & Sources');
  });

  it('renders search profile transparency and latest execution stats for both Jobstreet and Loker.id', () => {
    const wrapper = mount(SearchControlCard);

    expect(wrapper.text()).toContain('Job Discovery Agent');
    expect(wrapper.text()).toContain('Pilih Target & Mulai Scraping');
    expect(wrapper.text()).toContain('Frontend Engineer');
    expect(wrapper.text()).toContain('Vue Developer');
    expect(wrapper.text()).toContain('Jakarta');
    expect(wrapper.text()).toContain('Jobstreet');
    expect(wrapper.text()).toContain('Loker.id');

    // Multi-source summary cards
    expect(wrapper.text()).toContain('+18 new'); // Jobstreet new
    expect(wrapper.text()).toContain('+11 new'); // Loker.id new
  });

  it('opens confirmation modal on search button click, then triggers search upon confirmation and redirects', async () => {
    mockTriggerSearch.mockResolvedValueOnce({ id: 'exec-123', status: 'running' });
    const wrapper = mount(SearchControlCard);

    // Click the main action button
    const searchBtn = wrapper.find('button[data-test="search-jobs-btn"]');
    expect(searchBtn.exists()).toBe(true);
    await searchBtn.trigger('click');

    // Modal is now open in confirm_search mode
    expect(wrapper.text()).toContain('Konfirmasi Target & Mulai Scraping');

    // User confirms and starts scraping
    const confirmBtn = wrapper.findAll('button').find((b) => b.text().includes('Konfirmasi & Mulai Scraping'));
    expect(confirmBtn).toBeDefined();
    await confirmBtn!.trigger('click');

    expect(mockTriggerSearch).toHaveBeenCalledWith({ maxPages: 1 });
    expect(mockPush).toHaveBeenCalledWith('/search-runs/exec-123');
  });

  it('displays searching state with both active sources and disables button when isRunning is true', () => {
    (useScrapeRuns as any).mockReturnValue({
      latestRun: ref({ ...mockLatestRun, status: 'running' }),
      recentRuns: ref([mockLatestRun, mockLokerIdRun]),
      loading: ref(false),
      triggering: ref(false),
      isRunning: ref(true),
      error: ref(null),
      fetchLatestRun: mockFetchLatest,
      fetchRecentRuns: mockFetchRecent,
      triggerSearch: mockTriggerSearch,
      startPolling: vi.fn(),
      stopPolling: vi.fn(),
      onRunCompleted: vi.fn(),
      offRunCompleted: vi.fn(),
    });

    const wrapper = mount(SearchControlCard);

    expect(wrapper.text()).toContain('Searching...');
    expect(wrapper.text()).toContain('Searching Jobstreet & Loker.id...');
    const button = wrapper.find('button');
    expect(button.attributes('disabled')).toBeDefined();
  });

  it('displays partial completion status when one provider fails', () => {
    const failedLokerIdRun = {
      ...mockLokerIdRun,
      status: 'failed' as const,
      inserted: 0,
      discovered: 0,
    };

    (useScrapeRuns as any).mockReturnValue({
      latestRun: ref(mockLatestRun),
      recentRuns: ref([mockLatestRun, failedLokerIdRun]),
      loading: ref(false),
      triggering: ref(false),
      isRunning: ref(false),
      error: ref(null),
      fetchLatestRun: mockFetchLatest,
      fetchRecentRuns: mockFetchRecent,
      triggerSearch: mockTriggerSearch,
      startPolling: vi.fn(),
      stopPolling: vi.fn(),
      onRunCompleted: vi.fn(),
      offRunCompleted: vi.fn(),
    });

    const wrapper = mount(SearchControlCard);

    expect(wrapper.text()).toContain('Partial Completion');
    expect(wrapper.text()).toContain('Jobstreet');
    expect(wrapper.text()).toContain('completed');
    expect(wrapper.text()).toContain('+18 new');
    expect(wrapper.text()).toContain('Loker.id');
    expect(wrapper.text()).toContain('failed');
  });

  it('displays error banner when error is present', () => {
    (useScrapeRuns as any).mockReturnValue({
      latestRun: ref(mockLatestRun),
      recentRuns: ref([mockLatestRun]),
      loading: ref(false),
      triggering: ref(false),
      isRunning: ref(false),
      error: ref('A search is already running for this query.'),
      fetchLatestRun: mockFetchLatest,
      fetchRecentRuns: mockFetchRecent,
      triggerSearch: mockTriggerSearch,
      startPolling: vi.fn(),
      stopPolling: vi.fn(),
      onRunCompleted: vi.fn(),
      offRunCompleted: vi.fn(),
    });

    const wrapper = mount(SearchControlCard);

    expect(wrapper.text()).toContain('A search is already running for this query.');
  });

  it('displays empty state notice when candidate search profile is missing', () => {
    (useSearchProfile as any).mockReturnValue({
      searchProfile: ref(null),
      loading: ref(false),
      error: ref(null),
      fetchSearchProfile: mockFetchProfile,
    });

    const wrapper = mount(SearchControlCard);

    expect(wrapper.text()).toContain('Your job search profile is not ready yet');
    const button = wrapper.find('button');
    expect(button.attributes('disabled')).toBeDefined();
  });
});

import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import SearchControlCard from '../SearchControlCard.vue';
import { useSearchProfile } from '../../../composables/useSearchProfile';
import { useScrapeRuns } from '../../../composables/useScrapeRuns';

vi.mock('../../../composables/useSearchProfile');
vi.mock('../../../composables/useScrapeRuns');

describe('SearchControlCard', () => {
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
    sources: ['jobstreet'],
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

  let mockTriggerSearch: any;
  let mockFetchProfile: any;
  let mockFetchLatest: any;
  let mockFetchRecent: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockFetchProfile = vi.fn().mockResolvedValue(mockSearchProfile);
    mockFetchLatest = vi.fn().mockResolvedValue(mockLatestRun);
    mockFetchRecent = vi.fn().mockResolvedValue([mockLatestRun]);
    mockTriggerSearch = vi.fn().mockResolvedValue({ status: 'running', runIds: ['run-1'] });

    (useSearchProfile as any).mockReturnValue({
      searchProfile: ref(mockSearchProfile),
      loading: ref(false),
      error: ref(null),
      fetchSearchProfile: mockFetchProfile,
    });

    (useScrapeRuns as any).mockReturnValue({
      latestRun: ref(mockLatestRun),
      recentRuns: ref([mockLatestRun]),
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
  });

  it('renders search profile transparency and latest execution stats', () => {
    const wrapper = mount(SearchControlCard);

    expect(wrapper.text()).toContain('Job Discovery Agent');
    expect(wrapper.text()).toContain('Search Jobs Now');
    expect(wrapper.text()).toContain('Frontend Engineer');
    expect(wrapper.text()).toContain('Vue Developer');
    expect(wrapper.text()).toContain('Jakarta');
    expect(wrapper.text()).toContain('Jobstreet');

    // Stats
    expect(wrapper.text()).toContain('25'); // discovered
    expect(wrapper.text()).toContain('18'); // inserted
    expect(wrapper.text()).toContain('5');  // duplicates
  });

  it('triggers search when button is clicked', async () => {
    const wrapper = mount(SearchControlCard);

    const button = wrapper.find('button');
    await button.trigger('click');

    expect(mockTriggerSearch).toHaveBeenCalledWith({ maxPages: 1 });
  });

  it('displays searching state and disables button when isRunning is true', () => {
    (useScrapeRuns as any).mockReturnValue({
      latestRun: ref({ ...mockLatestRun, status: 'running' }),
      recentRuns: ref([mockLatestRun]),
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
    expect(wrapper.text()).toContain('Searching Jobstreet...');
    const button = wrapper.find('button');
    expect(button.attributes('disabled')).toBeDefined();
  });

  it('displays error banner when error is present', () => {
    (useScrapeRuns as any).mockReturnValue({
      latestRun: ref(mockLatestRun),
      recentRuns: ref([mockLatestRun]),
      loading: ref(false),
      triggering: ref(false),
      isRunning: ref(false),
      error: ref('A search is already running for this profile.'),
      fetchLatestRun: mockFetchLatest,
      fetchRecentRuns: mockFetchRecent,
      triggerSearch: mockTriggerSearch,
      startPolling: vi.fn(),
      stopPolling: vi.fn(),
      onRunCompleted: vi.fn(),
      offRunCompleted: vi.fn(),
    });

    const wrapper = mount(SearchControlCard);

    expect(wrapper.text()).toContain('A search is already running for this profile.');
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

import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import OverviewView from '../OverviewView.vue';

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ path: '/' }),
}));

vi.mock('../../composables/useAuth', () => ({
  useAuth: () => ({
    userDisplayName: { value: 'Aep' },
    user: { value: { id: 'test-user-id' } },
  }),
}));

vi.mock('../../composables/useJobs', () => ({
  useJobs: () => ({
    jobs: { value: [] },
    total: { value: 124 },
    loading: { value: false },
    fetchJobs: vi.fn(),
  }),
}));

vi.mock('../../composables/useApplications', () => ({
  useApplications: () => ({
    applications: { value: [] },
    countsByStatus: { value: { saved: 8, applied: 5, interview: 3, offer: 0, rejected: 0 } },
    savedJobIds: { value: new Set() },
    fetchApplications: vi.fn(),
    saveJob: vi.fn(),
  }),
}));

vi.mock('../../composables/useMatching', () => ({
  useMatching: () => ({
    recommendations: { value: [] },
    loading: { value: false },
    fetchRecommendations: vi.fn(),
  }),
}));

describe('OverviewView', () => {
  it('renders greeting, metrics, and right rail cards', () => {
    const wrapper = mount(OverviewView);

    expect(wrapper.text()).toContain('Good morning, Aep');
    expect(wrapper.text()).toContain('124');
    expect(wrapper.text()).toContain('New jobs this week');
    expect(wrapper.text()).toContain('Keep going');
    expect(wrapper.text()).toContain('Profile completeness');
  });
});

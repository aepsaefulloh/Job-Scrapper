import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import ApplicationRow from '../ApplicationRow.vue';

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe('ApplicationRow', () => {
  const sampleApp = {
    id: 'app-1',
    jobId: 'job-1',
    jobTitle: 'Senior Frontend Engineer',
    companyName: 'Tokopedia',
    location: 'Jakarta, Indonesia',
    status: 'applied' as const,
    notes: 'Submitted',
    appliedAt: '2026-09-23T00:00:00.000Z',
    createdAt: '2026-09-23T00:00:00.000Z',
    updatedAt: '2026-09-23T00:00:00.000Z',
  };

  it('renders application title, company, status badge, and date', () => {
    const wrapper = mount(ApplicationRow, {
      props: { application: sampleApp },
    });

    expect(wrapper.text()).toContain('Senior Frontend Engineer');
    expect(wrapper.text()).toContain('Tokopedia');
    expect(wrapper.text()).toContain('Applied');
    expect(wrapper.text()).toContain('View');
  });
});

import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import JobRow from '../JobRow.vue';
import type { JobListItem } from '../../../types/job';

const mockJob: JobListItem = {
  id: 'job-123',
  title: 'Senior Engineer',
  company: 'Tech Corp',
  source: 'jobstreet',
  location: 'Jakarta',
  publishedAt: '2026-09-23T00:00:00.000Z',
  createdAt: '2026-09-23T00:00:00.000Z',
  jobUrl: 'https://example.com/job/123',
};

describe('JobRow.vue', () => {
  it('emits delete event when trash button is clicked', async () => {
    const wrapper = mount(JobRow, {
      props: {
        job: mockJob,
      },
    });

    const deleteBtn = wrapper.find('button[title="Delete job"]');
    expect(deleteBtn.exists()).toBe(true);

    await deleteBtn.trigger('click');
    expect(wrapper.emitted('delete')).toBeTruthy();
    expect(wrapper.emitted('delete')?.[0]).toEqual([mockJob]);
  });
});

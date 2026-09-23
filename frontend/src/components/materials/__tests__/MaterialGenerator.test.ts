import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import MaterialGenerator from '../MaterialGenerator.vue';

describe('MaterialGenerator', () => {
  it('renders tone options and triggers generation', async () => {
    const wrapper = mount(MaterialGenerator, {
      props: {
        applicationId: 'app-1',
        jobTitle: 'Senior Frontend Engineer',
        companyName: 'Tokopedia',
        initialTool: 'cover_letter',
      },
    });

    expect(wrapper.text()).toContain('Create your cover letter');
    expect(wrapper.text()).toContain('Professional');
    expect(wrapper.text()).toContain('Conversational');
    expect(wrapper.text()).toContain('Enthusiastic');
    expect(wrapper.text()).toContain('Concise');
    expect(wrapper.find('button[type="submit"]').exists()).toBe(true);
  });
});

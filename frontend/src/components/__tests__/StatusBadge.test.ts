import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import StatusBadge from '../common/StatusBadge.vue';

describe('StatusBadge', () => {
  it('renders applied status with blue styling', () => {
    const wrapper = mount(StatusBadge, {
      props: { status: 'applied' },
    });
    expect(wrapper.text()).toContain('Applied');
    expect(wrapper.classes()).toContain('text-blue-700');
  });

  it('renders interview status with purple styling', () => {
    const wrapper = mount(StatusBadge, {
      props: { status: 'interview' },
    });
    expect(wrapper.text()).toContain('Interview');
    expect(wrapper.classes()).toContain('text-purple-700');
  });

  it('renders saved status with neutral styling', () => {
    const wrapper = mount(StatusBadge, {
      props: { status: 'saved' },
    });
    expect(wrapper.text()).toContain('Saved');
    expect(wrapper.classes()).toContain('text-stone-700');
  });
});

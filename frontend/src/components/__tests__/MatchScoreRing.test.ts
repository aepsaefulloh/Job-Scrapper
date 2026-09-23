import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import MatchScoreRing from '../common/MatchScoreRing.vue';

describe('MatchScoreRing', () => {
  it('renders percentage score correctly', () => {
    const wrapper = mount(MatchScoreRing, {
      props: { score: 92 },
    });
    expect(wrapper.text()).toContain('92%');
    expect(wrapper.text()).toContain('Match');
  });

  it('handles score between 0 and 1 by converting to percentage', () => {
    const wrapper = mount(MatchScoreRing, {
      props: { score: 0.88 },
    });
    expect(wrapper.text()).toContain('88%');
  });
});

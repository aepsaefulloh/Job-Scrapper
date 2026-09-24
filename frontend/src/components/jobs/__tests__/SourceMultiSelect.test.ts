import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import SourceMultiSelect from '../SourceMultiSelect.vue';

const mockSources = [
  { id: 'jobstreet', name: 'Jobstreet', available: true },
  { id: 'loker-id', name: 'Loker.id', available: true },
  { id: 'dealls', name: 'Dealls', available: false },
  { id: 'glints', name: 'Glints', available: false },
];

vi.mock('../../../composables/useJobSources', () => ({
  useJobSources: () => ({
    jobSources: ref(mockSources),
    availableSources: ref(mockSources.filter((s) => s.available)),
    loading: ref(false),
    fetchJobSources: vi.fn(),
  }),
}));

describe('SourceMultiSelect.vue', () => {
  it('renders collapsed state with summary of selected sources', () => {
    const wrapper = mount(SourceMultiSelect, {
      props: {
        modelValue: ['jobstreet', 'loker-id'],
      },
    });

    expect(wrapper.text()).toContain('Jobstreet, Loker.id');
    expect(wrapper.text()).toContain('2');
  });

  it('filters sources when typing in search input', async () => {
    const wrapper = mount(SourceMultiSelect, {
      props: {
        modelValue: ['jobstreet'],
      },
    });

    // Open dropdown
    await wrapper.find('button.source-select-trigger').trigger('click');

    const searchInput = wrapper.find('input.source-search-input');
    await searchInput.setValue('loker');

    expect(wrapper.text()).toContain('Loker.id');
    expect(wrapper.text()).not.toContain('Dealls');
  });

  it('prevents selecting unavailable sources', async () => {
    const wrapper = mount(SourceMultiSelect, {
      props: {
        modelValue: ['jobstreet'],
      },
    });

    // Open dropdown
    await wrapper.find('button.source-select-trigger').trigger('click');

    const deallsRow = wrapper.findAll('.source-item-row').find((r) => r.text().includes('Dealls'));
    expect(deallsRow?.classes()).toContain('opacity-50');

    const deallsCheckbox = deallsRow?.find<HTMLInputElement>('input[type="checkbox"]');
    expect(deallsCheckbox?.element.disabled).toBe(true);
  });

  it('selects all available sources on "Select all available" click', async () => {
    const wrapper = mount(SourceMultiSelect, {
      props: {
        modelValue: ['jobstreet'],
      },
    });

    await wrapper.find('button.source-select-trigger').trigger('click');
    const selectAllBtn = wrapper.find('button.btn-select-all');
    await selectAllBtn.trigger('click');

    expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toEqual(['jobstreet', 'loker-id']);
  });

  it('clears selection on "Clear" click', async () => {
    const wrapper = mount(SourceMultiSelect, {
      props: {
        modelValue: ['jobstreet', 'loker-id'],
      },
    });

    await wrapper.find('button.source-select-trigger').trigger('click');
    const clearBtn = wrapper.find('button.btn-clear');
    await clearBtn.trigger('click');

    expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toEqual([]);
  });
});

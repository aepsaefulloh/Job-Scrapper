import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import SearchPreferencesModal from '../SearchPreferencesModal.vue';
import type { JobSearchPreferences } from '../../../types/search-preferences';

describe('SearchPreferencesModal', () => {
  const defaultPrefs: JobSearchPreferences = {
    sources: ['jobstreet', 'loker-id'],
    locations: ['Jakarta', 'Bogor'],
    workModes: ['remote'],
    employmentTypes: ['full-time'],
    maxPostingAgeDays: 7,
    unknownPostingDatePolicy: 'exclude',
  };

  it('renders correctly with initial preferences', () => {
    const wrapper = mount(SearchPreferencesModal, {
      props: {
        modelValue: true,
        preferences: defaultPrefs,
      },
    });

    expect(wrapper.text()).toContain('Job Search Preferences');
    expect(wrapper.text()).toContain('Jobstreet, Loker.id');
    // Ensure unimplemented sources are NOT selected in summary
    expect(wrapper.text()).not.toContain('Glints');
    expect(wrapper.text()).not.toContain('LinkedIn');

    // Locations chips
    expect(wrapper.text()).toContain('Jakarta');
    expect(wrapper.text()).toContain('Bogor');

    // Freshness
    const select = wrapper.find('select');
    expect((select.element as HTMLSelectElement).value).toBe('7');
  });

  it('allows adding and removing locations', async () => {
    const wrapper = mount(SearchPreferencesModal, {
      props: {
        modelValue: true,
        preferences: defaultPrefs,
      },
    });

    // Add a new location "Bandung"
    const input = wrapper.find('input[type="text"]');
    await input.setValue('Bandung');
    const addBtn = wrapper.findAll('button').find((b) => b.text().includes('Add'));
    await addBtn!.trigger('click');

    expect(wrapper.text()).toContain('Bandung');

    // Remove "Jakarta" (first location chip)
    const removeBtns = wrapper.findAll('button[aria-label="Remove location"]');
    expect(removeBtns.length).toBe(3); // Jakarta, Bogor, Bandung
    await removeBtns[0].trigger('click');

    expect(wrapper.text()).not.toContain('Jakarta');
    expect(wrapper.text()).toContain('Bogor');
    expect(wrapper.text()).toContain('Bandung');
  });

  it('emits save with updated preferences when submitted', async () => {
    const wrapper = mount(SearchPreferencesModal, {
      props: {
        modelValue: true,
        preferences: defaultPrefs,
      },
    });

    // Change freshness to 14 days
    const select = wrapper.find('select');
    await select.setValue('14');

    // Click Save
    const saveBtn = wrapper.findAll('button').find((b) => b.text().includes('Save Preferences'));
    await saveBtn!.trigger('click');

    expect(wrapper.emitted('save')).toBeTruthy();
    const saved = wrapper.emitted('save')![0][0] as JobSearchPreferences;
    expect(saved.maxPostingAgeDays).toBe(14);
    expect(saved.sources).toEqual(['jobstreet', 'loker-id']);
  });

  it('prevents submitting when all sources are cleared', async () => {
    const wrapper = mount(SearchPreferencesModal, {
      props: {
        modelValue: true,
        preferences: defaultPrefs,
      },
    });

    // Open dropdown and click Clear
    await wrapper.find('button.source-select-trigger').trigger('click');
    await wrapper.find('button.btn-clear').trigger('click');

    // Click Save Preferences
    const saveBtn = wrapper.findAll('button').find((b) => b.text().includes('Save Preferences'));
    await saveBtn!.trigger('click');

    expect(wrapper.text()).toContain('At least one search source must be enabled.');
    expect(wrapper.emitted('save')).toBeFalsy();
  });

  it('emits update:modelValue false on cancel or close', async () => {
    const wrapper = mount(SearchPreferencesModal, {
      props: {
        modelValue: true,
        preferences: defaultPrefs,
      },
    });

    const cancelBtn = wrapper.findAll('button').find((b) => b.text().includes('Cancel'));
    await cancelBtn!.trigger('click');

    expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([false]);
  });
});

import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ProfileEditModal from '../ProfileEditModal.vue';
import type { CandidateProfile } from '../../../types/profile';

const mockProfile: CandidateProfile = {
  id: 'prof-1',
  candidateId: 'cand-1',
  displayName: 'Alex Doe',
  headline: 'Full Stack Engineer',
  summary: 'Passionate developer',
  experience: 'Worked at ACME',
  careerPreferences: 'Remote only',
  skills: [
    { displayName: 'TypeScript', canonicalName: 'typescript' },
    { displayName: 'Vue.js', canonicalName: 'vue.js' },
  ],
  updatedAt: '2026-09-24T12:00:00Z',
};

const mockUpdateProfile = vi.fn();
const mockFetchSearchProfile = vi.fn();

vi.mock('../../../composables/useProfile', () => ({
  useProfile: () => ({
    updateProfile: mockUpdateProfile,
    saving: ref(false),
    saveError: ref(null),
  }),
}));

vi.mock('../../../composables/useSearchProfile', () => ({
  useSearchProfile: () => ({
    fetchSearchProfile: mockFetchSearchProfile,
  }),
}));

describe('ProfileEditModal.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders initial values from profile prop', () => {
    const wrapper = mount(ProfileEditModal, {
      props: {
        profile: mockProfile,
      },
    });

    const displayNameInput = wrapper.find<HTMLInputElement>('input#displayName');
    expect(displayNameInput.element.value).toBe('Alex Doe');

    const headlineInput = wrapper.find<HTMLInputElement>('input#headline');
    expect(headlineInput.element.value).toBe('Full Stack Engineer');
  });

  it('allows adding and removing skills in the Skills tab', async () => {
    const wrapper = mount(ProfileEditModal, {
      props: {
        profile: mockProfile,
      },
    });

    // Switch to Skills tab
    const skillsTabButton = wrapper.findAll('button').find((b) => b.text().includes('Skills'));
    await skillsTabButton?.trigger('click');

    // Check existing skills count
    expect(wrapper.findAll('.skill-chip')).toHaveLength(2);

    // Add a new skill
    const newSkillInput = wrapper.find('input#newSkill');
    await newSkillInput.setValue('PostgreSQL');
    const addSkillBtn = wrapper.find('button#addSkillBtn');
    await addSkillBtn.trigger('click');

    expect(wrapper.findAll('.skill-chip')).toHaveLength(3);
    expect(wrapper.text()).toContain('PostgreSQL');

    // Remove the first skill
    const removeBtn = wrapper.findAll('.skill-chip-remove')[0];
    await removeBtn.trigger('click');

    expect(wrapper.findAll('.skill-chip')).toHaveLength(2);
  });

  it('emits close event when Cancel button is clicked', async () => {
    const wrapper = mount(ProfileEditModal, {
      props: {
        profile: mockProfile,
      },
    });

    const cancelBtn = wrapper.find('button#cancelBtn');
    await cancelBtn.trigger('click');
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('saves updated profile when Save Changes is clicked', async () => {
    const updatedProfile = { ...mockProfile, displayName: 'Alex Doe Updated' };
    mockUpdateProfile.mockResolvedValueOnce(updatedProfile);
    mockFetchSearchProfile.mockResolvedValueOnce({});

    const wrapper = mount(ProfileEditModal, {
      props: {
        profile: mockProfile,
      },
    });

    const displayNameInput = wrapper.find<HTMLInputElement>('input#displayName');
    await displayNameInput.setValue('Alex Doe Updated');

    const saveBtn = wrapper.find('button#saveBtn');
    await saveBtn.trigger('click');

    expect(mockUpdateProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: 'Alex Doe Updated',
      })
    );
  });
});

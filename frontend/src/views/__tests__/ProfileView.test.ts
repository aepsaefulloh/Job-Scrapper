import { ref } from 'vue';
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import ProfileView from '../ProfileView.vue';

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ path: '/profile' }),
}));

vi.mock('../../composables/useAuth', () => ({
  useAuth: () => ({
    userDisplayName: ref('Aep Saefulloh'),
    user: ref({ id: 'test-user-id' }),
  }),
}));

vi.mock('../../composables/useProfile', () => ({
  useProfile: () => ({
    profile: ref({
      id: 'p-1',
      displayName: 'Aep Saefulloh',
      headline: 'Senior Full Stack Engineer',
      summary: 'Experienced developer',
      experience: '5+ years experience building software',
      careerPreferences: 'Remote',
      skills: [{ displayName: 'Vue 3', canonicalName: 'vue3' }],
      updatedAt: '2026-09-23T00:00:00.000Z',
    }),
    loading: ref(false),
    error: ref(null),
    uploading: ref(false),
    uploadResult: ref(null),
    uploadError: ref(null),
    fetchProfile: vi.fn(),
    uploadMarkdownDocument: vi.fn(),
  }),
}));

describe('ProfileView', () => {
  it('renders candidate profile name, headline, summary, and verified skills', () => {
    const wrapper = mount(ProfileView, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    });

    expect(wrapper.text()).toContain('Aep Saefulloh');
    expect(wrapper.text()).toContain('Senior Full Stack Engineer');
    expect(wrapper.text()).toContain('Professional Summary');
    expect(wrapper.text()).toContain('Verified Skills');
    expect(wrapper.text()).toContain('Vue 3');
  });

  it('renders Edit Profile button and opens ProfileEditModal on click', async () => {
    const wrapper = mount(ProfileView, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    });

    const editBtn = wrapper.find('button#openEditProfileBtn');
    expect(editBtn.exists()).toBe(true);
    expect(editBtn.text()).toContain('Edit Profile');

    // Initially modal is not open
    expect(wrapper.findComponent({ name: 'ProfileEditModal' }).exists()).toBe(false);

    await editBtn.trigger('click');

    // Modal should now be open
    expect(wrapper.findComponent({ name: 'ProfileEditModal' }).exists()).toBe(true);
  });
});

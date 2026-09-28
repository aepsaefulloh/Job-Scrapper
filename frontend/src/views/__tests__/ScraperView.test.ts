import { ref } from 'vue';
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import ScraperView from '../ScraperView.vue';

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ path: '/scraper' }),
  RouterLink: {
    name: 'RouterLink',
    props: ['to'],
    template: '<a><slot /></a>',
  },
}));

vi.mock('../../composables/useAuth', () => ({
  useAuth: () => ({
    userDisplayName: ref('Aep'),
    user: ref({ id: 'cand-1' }),
    signOut: vi.fn(),
  }),
}));

vi.mock('../../components/jobs/SearchControlCard.vue', () => ({
  default: {
    name: 'SearchControlCard',
    template: '<div data-test="search-control-card">Search Control Card Mock</div>',
  },
}));

describe('ScraperView', () => {
  it('renders Run Scrap title, control card, and workflow steps', () => {
    const wrapper = mount(ScraperView, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    });

    expect(wrapper.text()).toContain('Run Scrap');
    expect(wrapper.find('[data-test="search-control-card"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Pilih Target & Jalankan');
    expect(wrapper.text()).toContain('Tinjau Temuan di Riwayat');
    expect(wrapper.text()).toContain('Simpan ke Katalog Jobs');
  });
});

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { router } from '../index';
import { useAuth } from '../../composables/useAuth';

vi.mock('../../composables/useAuth', () => {
  const isAuth = { value: false };
  const loading = { value: false };
  return {
    useAuth: () => ({
      isAuthenticated: isAuth,
      loading,
      initAuth: vi.fn().mockImplementation(() => {
        loading.value = false;
      }),
      setAuthenticated(val: boolean) {
        isAuth.value = val;
      },
    }),
  };
});

describe('Router navigation guard', () => {
  beforeEach(async () => {
    await router.push('/');
  });

  it('redirects unauthenticated users to /login when visiting protected route', async () => {
    const auth = useAuth() as any;
    auth.isAuthenticated.value = false;

    await router.push('/jobs');
    expect(router.currentRoute.value.name).toBe('login');
    expect(router.currentRoute.value.query.redirect).toBe('/jobs');
  });

  it('allows access to protected route when authenticated', async () => {
    const auth = useAuth() as any;
    auth.isAuthenticated.value = true;

    await router.push('/jobs');
    expect(router.currentRoute.value.name).toBe('jobs');
  });
});

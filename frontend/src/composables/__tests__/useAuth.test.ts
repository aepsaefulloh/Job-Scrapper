import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useAuth } from '../useAuth';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            access_token: 'mock-jwt-token',
            user: { id: 'test-user-id', email: 'aep@example.com' },
          },
        },
      }),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes auth state with active session', async () => {
    const auth = useAuth();
    await auth.initAuth();

    expect(auth.isAuthenticated.value).toBe(true);
    expect(auth.user.value?.id).toBe('test-user-id');
    expect(auth.userDisplayName.value).toBe('aep');
  });
});

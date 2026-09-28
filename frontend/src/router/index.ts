import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useAuth } from '../composables/useAuth';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/',
    name: 'overview',
    component: () => import('../views/OverviewView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/jobs',
    name: 'jobs',
    component: () => import('../views/JobsView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/scraper',
    name: 'scraper',
    component: () => import('../views/ScraperView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/jobs/:id',
    name: 'job-detail',
    component: () => import('../views/JobDetailView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/search-runs',
    name: 'search-history',
    component: () => import('../views/SearchHistoryView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/search-runs/:id',
    name: 'search-run-detail',
    component: () => import('../views/SearchRunDetailView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/applications',
    name: 'applications',
    component: () => import('../views/ApplicationsView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/applications/:id',
    name: 'application-detail',
    component: () => import('../views/ApplicationDetailView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('../views/ProfileView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../views/SettingsView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

router.beforeEach(async (to, _from, next) => {
  const auth = useAuth();
  if (auth.loading.value) {
    await auth.initAuth();
  }

  const requiresAuth = to.meta.requiresAuth !== false;

  if (requiresAuth && !auth.isAuthenticated.value) {
    next({ name: 'login', query: { redirect: to.fullPath } });
  } else if (to.name === 'login' && auth.isAuthenticated.value) {
    next({ name: 'overview' });
  } else {
    next();
  }
});

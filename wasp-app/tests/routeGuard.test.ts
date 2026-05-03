import {
  getAuthRedirectPath,
  isPublicRoute,
} from '../src/client/utils/routeGuard';

describe('route guard helpers', () => {
  const publicRoutes = [
    '/landing',
    '/pricing',
    '/login',
    '/signup',
    '/request-password-reset',
    '/password-reset',
    '/email-verification',
  ];
  const dashboardRoute = '/dashboard';
  const loginRoute = '/login';

  test('public routes remain accessible', () => {
    expect(isPublicRoute('/pricing', publicRoutes)).toBe(true);
    expect(isPublicRoute('/pricing/', publicRoutes)).toBe(true);
    expect(isPublicRoute('/login', publicRoutes)).toBe(true);
    expect(isPublicRoute('/password-reset/abc123', publicRoutes)).toBe(true);
    expect(isPublicRoute('/email-verification/xyz789', publicRoutes)).toBe(true);
    expect(isPublicRoute('/pricing-admin', publicRoutes)).toBe(false);
  });

  test('root redirects based on auth status', () => {
    expect(
      getAuthRedirectPath({
        pathname: '/',
        isAuthenticated: true,
        publicRoutes,
        dashboardRoute,
        loginRoute,
      }),
    ).toBe('/dashboard');

    expect(
      getAuthRedirectPath({
        pathname: '/',
        isAuthenticated: false,
        publicRoutes,
        dashboardRoute,
        loginRoute,
      }),
    ).toBe('/login');
  });

  test('protected routes redirect anonymous users', () => {
    expect(
      getAuthRedirectPath({
        pathname: '/dashboard',
        isAuthenticated: false,
        publicRoutes,
        dashboardRoute,
        loginRoute,
      }),
    ).toBe('/login');

    expect(
      getAuthRedirectPath({
        pathname: '/account',
        isAuthenticated: false,
        publicRoutes,
        dashboardRoute,
        loginRoute,
      }),
    ).toBe('/login');

    expect(
      getAuthRedirectPath({
        pathname: '/reports/scan-123',
        isAuthenticated: false,
        publicRoutes,
        dashboardRoute,
        loginRoute,
      }),
    ).toBe('/login');
  });

  test('protected routes allow authenticated users', () => {
    expect(
      getAuthRedirectPath({
        pathname: '/dashboard',
        isAuthenticated: true,
        publicRoutes,
        dashboardRoute,
        loginRoute,
      }),
    ).toBeNull();
  });

  test('public routes allow anonymous users', () => {
    expect(
      getAuthRedirectPath({
        pathname: '/signup',
        isAuthenticated: false,
        publicRoutes,
        dashboardRoute,
        loginRoute,
      }),
    ).toBeNull();
  });
});

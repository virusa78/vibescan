import { useEffect, useMemo, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { routes } from 'wasp/client/router';
import { useAuth, logout } from 'wasp/client/auth';
import { generateApiKey } from 'wasp/client/operations';
import { api } from 'wasp/client/api';
import { Toaster } from '../client/components/ui/toaster';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../client/components/ui/dialog';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { applyAppLocale, resolveAppLocale } from './i18n';
import { applyTheme, persistTheme, readThemePreference } from './theme';
import { useTokenRefresh } from './hooks/useTokenRefresh';
import { toast } from './hooks/use-toast';
import { isEditableTarget } from './utils/keyboard';
import './theme-init';
import './Main.css';
import NavBar from './components/NavBar/NavBar';
import { getAuthRedirectPath } from './utils/routeGuard';
import { appNavigationItems, marketingNavigationItems } from './components/NavBar/constants';
import CookieConsentBanner from './components/cookie-consent/Banner';
import { DocsUrl } from '../shared/common';

type PaletteScan = {
  id: string;
  inputRef: string;
  status: string;
  created_at?: string;
  createdAt?: string;
};

type PaletteCommand = {
  id: string;
  section: 'Navigate' | 'Search scans' | 'Actions' | 'Help';
  label: string;
  subtitle?: string;
  score: number;
  run: () => void | Promise<void>;
};

function getFuzzyScore(query: string, source: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;

  const text = source.toLowerCase();
  const directIndex = text.indexOf(q);
  if (directIndex >= 0) {
    return 1000 - directIndex;
  }

  let pointer = 0;
  let score = 0;
  for (const ch of q) {
    const hit = text.indexOf(ch, pointer);
    if (hit === -1) {
      return -1;
    }
    score += 10 - Math.min(hit - pointer, 9);
    pointer = hit + 1;
  }

  return score;
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: user, isLoading: isAuthLoading } = useAuth();
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [paletteScans, setPaletteScans] = useState<PaletteScan[]>([]);
  const [paletteIndex, setPaletteIndex] = useState(0);
  const locale = useMemo(() => resolveAppLocale(user?.language), [user?.language]);

  useTokenRefresh();

  const redirectPath = useMemo(() => {
    if (isAuthLoading) {
      return null;
    }

    return getAuthRedirectPath({
      pathname: location.pathname,
      isAuthenticated: Boolean(user),
      publicRoutes: [
        routes.LandingPageRoute.to,
        routes.PricingPageRoute.to,
        routes.LoginRoute.to,
        routes.SignupRoute.to,
        routes.RequestPasswordResetRoute.to,
        routes.PasswordResetRoute.to,
        routes.EmailVerificationRoute.to,
      ],
      dashboardRoute: routes.DashboardRoute.to,
      loginRoute: routes.LoginRoute.to,
    });
  }, [location.pathname, user, isAuthLoading]);

  const isMarketingPage = useMemo(() => {
    return (
      location.pathname.startsWith('/landing') ||
      location.pathname.startsWith('/pricing')
    );
  }, [location]);

  const navigationItems = isMarketingPage
    ? marketingNavigationItems
    : appNavigationItems;

  const shouldDisplayAppNavBar = useMemo(() => {
    const isAuthPage = [
      routes.LoginRoute.build(),
      routes.SignupRoute.build(),
      routes.RequestPasswordResetRoute.build(),
      routes.PasswordResetRoute.build(),
      routes.EmailVerificationRoute.build(),
    ].includes(location.pathname);

    return (
      !isAuthPage &&
      !location.pathname.startsWith('/admin')
    );
  }, [location]);

  const isAdminDashboard = useMemo(() => {
    return location.pathname.startsWith('/admin');
  }, [location]);

  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = readThemePreference(localStorage.getItem('theme'), prefersDark);
    applyTheme(theme);
  }, []);

  useEffect(() => {
    applyAppLocale(locale);
  }, [locale]);

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace('#', '');
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView();
      }
    }
  }, [location]);

  useEffect(() => {
    if (!isPaletteOpen || !user) return;

    let cancelled = false;
    void (async () => {
      try {
        const response = await api.get('/api/v1/dashboard/recent-scans', {
          params: {
            limit: 25,
            sort: 'submitted:desc',
          },
        });

        if (!cancelled) {
          const scans = Array.isArray(response.data?.scans) ? response.data.scans : [];
          setPaletteScans(scans);
        }
      } catch (error) {
        if (!cancelled) {
          setPaletteScans([]);
        }
        console.error(error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isPaletteOpen, user]);

  const toggleTheme = () => {
    const root = document.documentElement;
    const nextTheme = root.classList.contains('dark') ? 'light' : 'dark';
    persistTheme(nextTheme);
    applyTheme(nextTheme);
    toast({ title: `Theme: ${nextTheme}` });
  };

  const commands = useMemo<PaletteCommand[]>(() => {
    const query = paletteQuery.trim();
    const items: PaletteCommand[] = [];

    const add = (
      section: PaletteCommand['section'],
      label: string,
      subtitle: string,
      keywords: string,
      run: PaletteCommand['run'],
    ) => {
      const score = getFuzzyScore(query, `${label} ${subtitle} ${keywords}`);
      if (score < 0) {
        return;
      }
      items.push({ id: `${section}:${label}`, section, label, subtitle, score, run });
    };

    add('Navigate', 'Dashboard', '/dashboard', 'home metrics scans', () => navigate(routes.DashboardRoute.to));
    add('Navigate', 'New Scan', '/new-scan', 'scan submit', () => navigate(routes.NewScanRoute.to));
    add('Navigate', 'Webhooks', '/webhooks', 'events delivery', () => navigate(routes.WebhooksRoute.to));
    add('Navigate', 'API Keys', '/api-keys', 'tokens auth', () => navigate(routes.ApiKeysRoute.to));
    add('Navigate', 'Settings', '/settings', 'preferences account', () => navigate(routes.SettingsRoute.to));
    add('Navigate', 'Pricing', '/pricing', 'billing plans', () => navigate(routes.PricingPageRoute.to));

    for (const scan of paletteScans) {
      const scanLabel = scan.inputRef || scan.id;
      const scanSubtitle = `${scan.status} · ${scan.id.slice(0, 8)}`;
      const score = getFuzzyScore(query, `${scan.id} ${scan.inputRef} ${scan.status}`);
      if (score < 0) {
        continue;
      }
      items.push({
        id: `scan:${scan.id}`,
        section: 'Search scans',
        label: scanLabel,
        subtitle: scanSubtitle,
        score,
        run: () => navigate(`/scans/${scan.id}`),
      });
    }

    add('Actions', 'New scan', 'Open submission form', 'create scan', () => navigate(routes.NewScanRoute.to));
    add('Actions', 'Toggle theme', 'Light / Dark', 'theme appearance', toggleTheme);
    add('Actions', 'Log out', 'End current session', 'logout sign out', async () => logout());
    add('Actions', 'Create API key', 'Generate and copy once', 'token key', async () => {
      const keyName = `Palette key ${new Date().toISOString().slice(0, 19)}`;
      const created = await generateApiKey({ name: keyName });
      await navigator.clipboard.writeText(created.key);
      toast({ title: 'API key created and copied', description: created.name });
      navigate(routes.ApiKeysRoute.to);
    });

    add('Help', 'Keyboard shortcuts', 'Open ? overlay', 'shortcuts help', () => setIsShortcutsOpen(true));
    add('Help', 'Documentation', DocsUrl, 'docs guide', () => {
      window.open(DocsUrl, '_blank', 'noopener,noreferrer');
    });
    add('Help', 'API docs', '/docs', 'swagger openapi', () => {
      window.open('/docs', '_blank', 'noopener,noreferrer');
    });

    items.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
    return items.slice(0, 30);
  }, [navigate, paletteQuery, paletteScans]);

  useEffect(() => {
    setPaletteIndex(0);
  }, [paletteQuery, commands.length]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if ((event.metaKey || event.ctrlKey) && key === 'k') {
        event.preventDefault();
        setIsPaletteOpen((prev) => {
          const next = !prev;
          if (next) {
            setPaletteQuery('');
          }
          return next;
        });
        return;
      }

      if (event.key === 'Escape') {
        if (isPaletteOpen) {
          event.preventDefault();
          setIsPaletteOpen(false);
          return;
        }
        if (isShortcutsOpen) {
          event.preventDefault();
          setIsShortcutsOpen(false);
          return;
        }
      }

      if (isPaletteOpen) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setPaletteIndex((prev) => Math.min(prev + 1, Math.max(commands.length - 1, 0)));
          return;
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setPaletteIndex((prev) => Math.max(prev - 1, 0));
          return;
        }

        if (event.key === 'Enter') {
          event.preventDefault();
          const command = commands[paletteIndex];
          if (!command) {
            return;
          }

          void Promise.resolve(command.run())
            .catch((error) => {
              console.error(error);
              toast({ title: 'Action failed', variant: 'destructive' });
            })
            .finally(() => {
              setIsPaletteOpen(false);
            });
          return;
        }
      }

      if (event.key !== '?' && !(event.key === '/' && event.shiftKey)) {
        return;
      }

      if (isEditableTarget(event.target) || isPaletteOpen) {
        return;
      }

      event.preventDefault();
      setIsShortcutsOpen((prev) => !prev);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [commands, isPaletteOpen, isShortcutsOpen, paletteIndex]);

  if (redirectPath) {
    return <Navigate to={redirectPath} replace />;
  }

  const groupedCommands: Array<{ section: PaletteCommand['section']; items: PaletteCommand[] }> = (
    ['Navigate', 'Search scans', 'Actions', 'Help'] as const
  )
    .map((section) => ({
      section,
      items: commands.filter((command) => command.section === section),
    }))
    .filter((group) => group.items.length > 0);

  let runningIndex = -1;

  return (
    <>
      <AppErrorBoundary locale={locale}>
        <div className="bg-background text-foreground min-h-screen">
          <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.05),_transparent_42%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-15" />
          </div>
          {isAdminDashboard ? (
            <Outlet />
          ) : (
            <>
              {shouldDisplayAppNavBar && (
                <NavBar navigationItems={navigationItems} />
              )}
              <main>
                <Outlet />
              </main>
            </>
          )}
        </div>
      </AppErrorBoundary>
      <Toaster position="bottom-right" />
      <CookieConsentBanner />

      <Dialog open={isPaletteOpen} onOpenChange={setIsPaletteOpen}>
        <DialogContent className="max-w-2xl" aria-label="Command palette">
          <DialogHeader>
            <DialogTitle>Command Palette</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <input
              autoFocus
              value={paletteQuery}
              onChange={(event) => setPaletteQuery(event.target.value)}
              placeholder="Search commands and scans"
              className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
              aria-label="Command palette search"
            />
            <div className="max-h-[26rem] overflow-y-auto rounded-md border border-border/60">
              {groupedCommands.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">No matches.</p>
              ) : (
                <div className="p-2">
                  {groupedCommands.map((group) => (
                    <div key={group.section} className="mb-3 last:mb-0">
                      <p className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">{group.section}</p>
                      <div className="space-y-1" role="list">
                        {group.items.map((command) => {
                          runningIndex += 1;
                          const itemIndex = runningIndex;
                          const active = itemIndex === paletteIndex;

                          return (
                            <button
                              key={command.id}
                              type="button"
                              role="listitem"
                              className={`w-full rounded-md px-2 py-2 text-left text-sm transition ${active ? 'bg-accent' : 'hover:bg-accent/60'}`}
                              onMouseEnter={() => setPaletteIndex(itemIndex)}
                              onClick={() => {
                                void Promise.resolve(command.run())
                                  .catch((error) => {
                                    console.error(error);
                                    toast({ title: 'Action failed', variant: 'destructive' });
                                  })
                                  .finally(() => setIsPaletteOpen(false));
                              }}
                              aria-label={command.label}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium text-foreground">{command.label}</span>
                                {command.section === 'Search scans' && <span className="text-xs text-muted-foreground">Enter</span>}
                              </div>
                              {command.subtitle && (
                                <p className="text-xs text-muted-foreground mt-0.5">{command.subtitle}</p>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Cmd/Ctrl+K to open, Enter to run, Esc to close.</p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isShortcutsOpen} onOpenChange={setIsShortcutsOpen}>
        <DialogContent className="max-w-2xl" aria-label="Keyboard shortcuts">
          <DialogHeader>
            <DialogTitle>Keyboard Shortcuts</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-muted-foreground mb-2 text-xs uppercase tracking-wide">Global</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-md border p-2"><strong>Cmd/Ctrl + K</strong> Open command palette</div>
                <div className="rounded-md border p-2"><strong>?</strong> Open this overlay</div>
                <div className="rounded-md border p-2"><strong>Esc</strong> Close dialogs and overlays</div>
              </div>
            </div>
            <div>
              <p className="text-muted-foreground mb-2 text-xs uppercase tracking-wide">Dashboard</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-md border p-2"><strong>/</strong> Focus recent scans search</div>
                <div className="rounded-md border p-2"><strong>j / k</strong> Move active table row</div>
                <div className="rounded-md border p-2"><strong>Enter</strong> Open active scan</div>
                <div className="rounded-md border p-2"><strong>x / c</strong> Cancel or copy active scan id</div>
              </div>
            </div>
            <div>
              <p className="text-muted-foreground mb-2 text-xs uppercase tracking-wide">Reports</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-md border p-2"><strong>/</strong> Focus findings search</div>
                <div className="rounded-md border p-2"><strong>Esc</strong> Clear findings search</div>
                <div className="rounded-md border p-2"><strong>1..5</strong> Critical/High/Medium/Low/Info</div>
                <div className="rounded-md border p-2"><strong>f</strong> Toggle Fixable/All</div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

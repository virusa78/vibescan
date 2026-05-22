import React from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { type AppLocale } from '../i18n';

type AppErrorBoundaryProps = {
  children: React.ReactNode;
  locale: AppLocale;
};

type AppErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

const copy = {
  en: {
    title: 'Something crashed',
    description: 'The route failed to render. Reload the page or report the error so we can inspect it.',
    reload: 'Reload',
    report: 'Report to us',
    diagnostics: 'Diagnostics',
  },
  ru: {
    title: 'Что-то сломалось',
    description: 'Маршрут не смог отрисоваться. Перезагрузите страницу или отправьте ошибку на разбор.',
    reload: 'Перезагрузить',
    report: 'Сообщить нам',
    diagnostics: 'Диагностика',
  },
} as const;

export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AppErrorBoundary]', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReport = () => {
    const subject = encodeURIComponent('VibeScan route crash');
    const body = encodeURIComponent(
      [
        `Path: ${window.location.pathname}`,
        `Search: ${window.location.search}`,
        `Hash: ${window.location.hash}`,
        `Error: ${this.state.error?.message ?? 'Unknown error'}`,
      ].join('\n'),
    );

    window.location.href = `mailto:support@vibescan.local?subject=${subject}&body=${body}`;
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const localeCopy = copy[this.props.locale];

    return (
      <div className="bg-background text-foreground flex min-h-screen items-center justify-center px-6">
        <Card className="w-full max-w-2xl border-border/70 shadow-xl">
          <CardHeader className="space-y-2 border-b border-border/60">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              VibeScan
            </p>
            <CardTitle className="text-2xl">{localeCopy.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <p className="text-sm text-muted-foreground">{localeCopy.description}</p>
            <div className="rounded-lg border border-dashed border-border/70 bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {localeCopy.diagnostics}
              </p>
              <pre className="mt-2 overflow-auto text-xs text-muted-foreground">
                {this.state.error?.stack ?? this.state.error?.message ?? 'No diagnostics available.'}
              </pre>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={this.handleReload}>{localeCopy.reload}</Button>
              <Button variant="outline" onClick={this.handleReport}>
                {localeCopy.report}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}

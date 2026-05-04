import { ArrowRight, CheckCircle2, Github, Package, UploadCloud } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router';
import { completeOnboarding, getOnboardingState, useQuery } from 'wasp/client/operations';
import { routes } from 'wasp/client/router';
import { Alert, AlertDescription } from '../client/components/ui/alert';
import { Button } from '../client/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../client/components/ui/card';
import { Skeleton } from '../client/components/ui/skeleton';
import { useAsyncState } from '../client/hooks/useAsyncState';
export default function OnboardingPage() {
    const navigate = useNavigate();
    const { isLoading: isCompleting, error: completeError, run } = useAsyncState();
    const { data, isLoading, error } = useQuery(getOnboardingState);
    const onboarding = (data ?? null);
    const handleSkip = async () => {
        await run(async () => {
            await completeOnboarding({});
            navigate(routes.DashboardRoute.to);
        }, { errorMessage: 'Failed to finish onboarding.' });
    };
    if (isLoading) {
        return (<div className="py-10 lg:mt-10">
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          <div className="space-y-4">
            <Skeleton className="h-10 w-72"/>
            <Skeleton className="h-5 w-[32rem]"/>
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <Skeleton className="h-72 w-full"/>
            <Skeleton className="h-72 w-full"/>
            <Skeleton className="h-72 w-full"/>
          </div>
        </div>
      </div>);
    }
    if (error) {
        return (<div className="py-10 lg:mt-10">
        <div className="mx-auto max-w-4xl px-6 lg:px-8">
          <Alert variant="destructive">
            <AlertDescription>
              {error instanceof Error ? error.message : 'Failed to load onboarding state.'}
            </AlertDescription>
          </Alert>
        </div>
      </div>);
    }
    if (onboarding?.is_complete && !onboarding.should_show_onboarding) {
        return <Navigate to={routes.DashboardRoute.to} replace/>;
    }
    return (<div className="py-10 lg:mt-10">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-primary text-sm font-semibold tracking-[0.2em] uppercase">
            Guided Setup
          </p>
          <h1 className="text-foreground mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Get your workspace to the first useful scan
          </h1>
          <p className="text-muted-foreground mt-4 text-base sm:text-lg">
            {onboarding?.workspace_name
            ? `You are setting up ${onboarding.workspace_name}. Start with the path that gets you to results fastest.`
            : 'Start with the path that gets you to results fastest.'}
          </p>
        </div>

        {(completeError || (!onboarding?.has_workspace && onboarding)) && (<div className="mx-auto mt-6 max-w-3xl">
            <Alert variant="destructive">
              <AlertDescription>
                {completeError
                ? String(completeError)
                : 'Workspace setup is incomplete. Refresh the page and try again.'}
              </AlertDescription>
            </Alert>
          </div>)}

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <Card className="border-border/70 bg-card/90 shadow-sm">
            <CardHeader>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Github className="h-5 w-5"/>
              </div>
              <CardTitle>Scan a GitHub repository</CardTitle>
              <CardDescription>
                Best for your first real result. Paste a GitHub repo URL and queue a scan immediately.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Works now with manual GitHub repository scans.</li>
                <li>Good default path for most users.</li>
                <li>Gets you to scan details quickly.</li>
              </ul>
              <Button className="w-full" onClick={() => navigate(`${routes.NewScanRoute.to}?type=github&source=onboarding`)}>
                Start with GitHub
                <ArrowRight className="ml-2 h-4 w-4"/>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/90 shadow-sm">
            <CardHeader>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Package className="h-5 w-5"/>
              </div>
              <CardTitle>Use an SBOM</CardTitle>
              <CardDescription>
                Best when you already have a CycloneDX or similar dependency manifest ready.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Fastest path if your CI already emits SBOM files.</li>
                <li>Use a local path, upload reference, or prepared artifact.</li>
                <li>Ideal for dependency-first validation.</li>
              </ul>
              <Button variant="outline" className="w-full" onClick={() => navigate(`${routes.NewScanRoute.to}?type=sbom&source=onboarding`)}>
                Start with SBOM
                <ArrowRight className="ml-2 h-4 w-4"/>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/90 shadow-sm">
            <CardHeader>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UploadCloud className="h-5 w-5"/>
              </div>
              <CardTitle>Use a source ZIP</CardTitle>
              <CardDescription>
                Best when you want to upload a snapshot or inspect a project outside GitHub.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Useful for ad-hoc code drops.</li>
                <li>Good fallback when GitHub access is not available.</li>
                <li>Lets you validate packaged source trees.</li>
              </ul>
              <Button variant="outline" className="w-full" onClick={() => navigate(`${routes.NewScanRoute.to}?type=source_zip&source=onboarding`)}>
                Start with ZIP
                <ArrowRight className="ml-2 h-4 w-4"/>
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/70 mt-8 bg-card/90 shadow-sm">
          <CardHeader>
            <CardTitle>What happens next</CardTitle>
            <CardDescription>
              The onboarding flow is intentionally short. Your first useful result matters more than filling forms.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-border/60 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-primary"/>
                Choose input type
              </div>
              <p className="text-sm text-muted-foreground">
                Pick GitHub, SBOM, or ZIP based on what you already have available.
              </p>
            </div>
            <div className="rounded-lg border border-border/60 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-primary"/>
                Run the first scan
              </div>
              <p className="text-sm text-muted-foreground">
                You will land on scan details immediately after the scan is queued.
              </p>
            </div>
            <div className="rounded-lg border border-border/60 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-primary"/>
                Come back to the dashboard
              </div>
              <p className="text-sm text-muted-foreground">
                Once data exists, the dashboard becomes the right place to monitor trends and results.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button variant="ghost" onClick={() => navigate(routes.DashboardRoute.to)}>
            View dashboard anyway
          </Button>
          <Button variant="secondary" disabled={isCompleting} onClick={() => void handleSkip()}>
            {isCompleting ? 'Saving...' : 'Skip onboarding for now'}
          </Button>
        </div>
      </div>
    </div>);
}
//# sourceMappingURL=OnboardingPage.jsx.map
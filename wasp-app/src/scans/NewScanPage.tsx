import { FormEvent, useState } from "react";
import { submitScan, getScans, useQuery } from "wasp/client/operations";
import { Alert, AlertDescription } from "../client/components/ui/alert";
import { Button } from "../client/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../client/components/ui/card";
import { Input } from "../client/components/ui/input";
import { Label } from "../client/components/ui/label";
import { Link as WaspRouterLink, routes } from "wasp/client/router";

export default function NewScanPage() {
  const [inputRef, setInputRef] = useState("");
  const [inputType, setInputType] = useState<"github" | "sbom" | "source_zip">("github");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [createdScanId, setCreatedScanId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { refetch } = useQuery(getScans);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setCreatedScanId(null);
    setIsSubmitting(true);

    try {
      const normalized = inputRef.trim();

      const createdScan = await submitScan({
        inputRef: normalized,
        inputType,
      });

      setSuccessMessage("Scan job created.");
      setCreatedScanId(createdScan.id);
      setInputRef("");
      await refetch();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to submit scan.";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="py-10 lg:mt-10">
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-foreground mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
            New <span className="text-primary">Scan</span>
          </h2>
          <p className="text-muted-foreground mt-4">
            Submit a scan for vulnerability analysis.
          </p>
        </div>

        <Card className="from-card/95 to-card/75 border-border/70 mt-8 bg-gradient-to-b backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Scan Input</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {errorMessage && (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}
            {successMessage && (
              <Alert>
                <AlertDescription className="flex flex-wrap items-center gap-2">
                  <span>{successMessage}</span>
                  {createdScanId && (
                    <WaspRouterLink
                      to={routes.ScanDetailsRoute.to}
                      params={{ scanId: createdScanId }}
                      className="text-primary underline underline-offset-2"
                    >
                      Open details
                    </WaspRouterLink>
                  )}
                </AlertDescription>
              </Alert>
            )}
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="inputRef">Input Reference</Label>
                <Input
                  id="inputRef"
                  value={inputRef}
                  onChange={(e) => setInputRef(e.target.value)}
                  placeholder="e.g., owner/repo or path/to/sbom.json"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inputType">Input Type</Label>
                <select
                  id="inputType"
                  value={inputType}
                  onChange={(e) => setInputType(e.target.value as any)}
                  className="rounded border px-2 py-1"
                >
                  <option value="github">GitHub Repository</option>
                  <option value="sbom">SBOM File</option>
                  <option value="source_zip">Source ZIP</option>
                </select>
              </div>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Start scan"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="from-card/95 to-card/75 border-border/70 mt-8 bg-gradient-to-b backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Recent Scans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground">
              Scans will appear here once submitted.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

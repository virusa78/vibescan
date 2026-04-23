import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from 'wasp/client/auth';
import { generateApiKey, listApiKeys } from 'wasp/client/operations';
import { Alert, AlertDescription } from '../client/components/ui/alert';
import { Badge } from '../client/components/ui/badge';
import { Button } from '../client/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../client/components/ui/card';
import { Input } from '../client/components/ui/input';
import { Label } from '../client/components/ui/label';
import { Skeleton } from '../client/components/ui/skeleton';
import { useAsyncState } from '../client/hooks/useAsyncState';
import { getApiKeyDetails, type ApiKeyDetailsResponse } from './client';
import { revokeApiKey } from 'wasp/client/operations';

type ApiKeyListItem = Awaited<ReturnType<typeof listApiKeys>>[number];

function formatIsoDate(value: string | null | undefined): string {
  if (!value) return 'Never';
  return new Date(value).toLocaleDateString();
}

function formatRelative(value: string | null | undefined, emptyLabel: string): string {
  if (!value) return emptyLabel;

  const diffMs = new Date(value).getTime() - Date.now();
  const absDays = Math.abs(Math.round(diffMs / 86_400_000));

  if (absDays === 0) {
    return diffMs >= 0 ? 'Today' : 'Earlier today';
  }

  const unit = absDays === 1 ? 'day' : 'days';
  return diffMs >= 0
    ? `In ${absDays} ${unit}`
    : `${absDays} ${unit} ago`;
}

function getApiKeyStatus(item: { enabled: boolean; expiresAt?: string | Date | null }): 'active' | 'revoked' | 'expired' {
  if (!item.enabled) {
    return 'revoked';
  }

  if (item.expiresAt && new Date(item.expiresAt).getTime() < Date.now()) {
    return 'expired';
  }

  return 'active';
}

function maskApiKeyId(id: string): string {
  return `****${id.slice(-4)}`;
}

function statusBadgeVariant(status: 'active' | 'revoked' | 'expired') {
  if (status === 'expired') {
    return 'destructive' as const;
  }
  if (status === 'revoked') {
    return 'outline' as const;
  }
  return 'secondary' as const;
}

function KeySkeleton() {
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-3 w-44" />
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-5 w-52" />
        <Skeleton className="h-3 w-64" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
      <Skeleton className="h-48 rounded-lg" />
    </div>
  );
}

function UsageChart({ data }: { data: ApiKeyDetailsResponse['usage_by_day'] }) {
  const points = useMemo(() => {
    return [...data].slice(-14);
  }, [data]);

  const maxCount = Math.max(...points.map((point) => point.count), 1);

  if (points.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
        No usage recorded yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[42rem] grid-cols-14 gap-2">
        {points.map((point) => {
          const height = Math.max(8, (point.count / maxCount) * 100);
          return (
            <div key={point.date} className="flex h-48 flex-col items-center justify-end gap-2">
              <div className="text-[11px] font-medium text-foreground">{point.count}</div>
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t-md bg-primary/80 transition-all"
                  style={{ height: `${height}%` }}
                  aria-hidden="true"
                />
              </div>
              <div className="text-[10px] text-muted-foreground">{point.date.slice(5)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ApiKeysPage() {
  const { data: user } = useAuth();
  const [apiKeys, setApiKeys] = useState<ApiKeyListItem[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [selectedKeyDetails, setSelectedKeyDetails] = useState<ApiKeyDetailsResponse | null>(null);
  const [showNewKeyForm, setShowNewKeyForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<{ key: string; id: string; name: string } | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const {
    isLoading: isListLoading,
    error: listError,
    run: runList,
    setError: setListError,
  } = useAsyncState();
  const {
    isLoading: isDetailsLoading,
    error: detailsError,
    run: runDetails,
    setError: setDetailsError,
  } = useAsyncState();

  const selectedKey = useMemo(
    () => apiKeys.find((key) => key.id === selectedKeyId) ?? null,
    [apiKeys, selectedKeyId],
  );

  const loadApiKeys = useCallback(async () => {
    if (!user) return;

    await runList(
      async () => {
        const keys = await listApiKeys();
        setApiKeys(keys);
        setListError(null);
      },
      { errorMessage: 'Failed to load API keys' },
    );
  }, [runList, setListError, user]);

  const loadSelectedKeyDetails = useCallback(async (keyId: string) => {
    await runDetails(
      async () => {
        const details = await getApiKeyDetails(keyId);
        setSelectedKeyDetails(details);
        setDetailsError(null);
      },
      { errorMessage: 'Failed to load API key details' },
    );
  }, [runDetails, setDetailsError]);

  useEffect(() => {
    void loadApiKeys();
  }, [loadApiKeys]);

  useEffect(() => {
    if (apiKeys.length === 0) {
      setSelectedKeyId(null);
      setSelectedKeyDetails(null);
      return;
    }

    if (!selectedKeyId || !apiKeys.some((key) => key.id === selectedKeyId)) {
      setSelectedKeyId(apiKeys[0].id);
    }
  }, [apiKeys, selectedKeyId]);

  useEffect(() => {
    if (!selectedKeyId) {
      setSelectedKeyDetails(null);
      return;
    }

    void loadSelectedKeyDetails(selectedKeyId);
  }, [loadSelectedKeyDetails, selectedKeyId]);

  const reloadKeys = useCallback(async () => {
    await loadApiKeys();
  }, [loadApiKeys]);

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) {
      setSuccessMessage(null);
      setListError('Key name is required');
      return;
    }

    setSuccessMessage(null);
    await runList(
      async () => {
        const result = await generateApiKey({ name: newKeyName });
        setGeneratedKey(result);
        setNewKeyName('');
        setShowNewKeyForm(false);
        setSuccessMessage('API key generated. Copy it now - you will not see it again.');

        const keys = await listApiKeys();
        setApiKeys(keys);
        setSelectedKeyId(result.id);
      },
      { errorMessage: 'Failed to generate API key' },
    );
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key?')) return;

    await runList(
      async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (revokeApiKey as any)({ id: keyId });
        setSuccessMessage('API key revoked');
        const keys = await listApiKeys();
        setApiKeys(keys);
      },
      { errorMessage: 'Failed to revoke API key' },
    );
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setSuccessMessage('Copied to clipboard!');
      window.setTimeout(() => setSuccessMessage(null), 2000);
    } catch {
      setListError('Failed to copy key to clipboard');
    }
  };

  return (
    <div className="mt-10 px-6 pb-12">
      <div className="mx-auto max-w-7xl space-y-6">
        <Card className="border-border/60 shadow-lg">
          <CardHeader className="space-y-4 border-b border-border/60 pb-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  API Keys
                </p>
                <CardTitle className="text-2xl">Manage automation access tokens</CardTitle>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  Create CI keys, inspect the latest usage window, and revoke access from one place.
                </p>
              </div>
              <Button
                onClick={() => {
                  setSuccessMessage(null);
                  if (showNewKeyForm) {
                    setShowNewKeyForm(false);
                    return;
                  }
                  setGeneratedKey(null);
                  setShowNewKeyForm(true);
                }}
                disabled={isListLoading}
              >
                {showNewKeyForm ? 'Cancel' : 'Generate new key'}
              </Button>
            </div>

            {showNewKeyForm && !generatedKey && (
              <form onSubmit={handleGenerateKey} className="space-y-4 rounded-lg border border-border/60 bg-card/60 p-4">
                <div className="space-y-2">
                  <Label htmlFor="keyName">Key name</Label>
                  <Input
                    id="keyName"
                    placeholder="e.g. GitHub Actions CI"
                    value={newKeyName}
                    onChange={(event) => setNewKeyName(event.target.value)}
                    disabled={isListLoading}
                  />
                </div>
                <Button type="submit" disabled={isListLoading}>
                  {isListLoading ? 'Generating...' : 'Generate'}
                </Button>
              </form>
            )}
          </CardHeader>

          <CardContent className="space-y-6 pt-6">
            {listError && (
              <Alert variant="destructive">
                <AlertDescription>{listError}</AlertDescription>
              </Alert>
            )}
            {detailsError && (
              <Alert variant="destructive">
                <AlertDescription>{detailsError}</AlertDescription>
              </Alert>
            )}
            {successMessage && (
              <Alert>
                <AlertDescription>{successMessage}</AlertDescription>
              </Alert>
            )}

            {generatedKey && (
              <Alert className="border-green-600 bg-green-50 dark:bg-green-950">
                <AlertDescription>
                  <div className="space-y-3">
                    <p className="font-semibold">Your new API key:</p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <code className="flex-1 rounded bg-gray-800 px-3 py-2 font-mono text-sm text-gray-100">
                        {generatedKey.key}
                      </code>
                      <Button size="sm" onClick={() => void copyToClipboard(generatedKey.key)}>
                        Copy
                      </Button>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Save this key now. It is shown only once.
                    </p>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Your API keys</h3>
                    <p className="text-sm text-muted-foreground">
                      Select a key to view its expiry and recent request volume.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void reloadKeys()} disabled={isListLoading}>
                    Refresh
                  </Button>
                </div>

                {isListLoading && apiKeys.length === 0 ? (
                  <div className="space-y-3">
                    <KeySkeleton />
                    <KeySkeleton />
                    <KeySkeleton />
                  </div>
                ) : apiKeys.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/70 p-8 text-center">
                    <p className="text-lg font-medium">No API keys yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Create a production token for CI, integrations, or local automation.
                    </p>
                    <div className="mt-4">
                      <Button onClick={() => setShowNewKeyForm(true)}>Generate your first key</Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {apiKeys.map((key) => {
                      const status = getApiKeyStatus(key);
                      const isSelected = key.id === selectedKeyId;

                      return (
                        <div
                          key={key.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedKeyId(key.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setSelectedKeyId(key.id);
                            }
                          }}
                          className={`w-full rounded-xl border p-4 text-left transition ${
                            isSelected
                              ? 'border-primary bg-primary/5 shadow-sm'
                              : 'border-border/60 bg-card hover:border-primary/40 hover:bg-accent/40'
                          }`}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold">{key.name}</p>
                                <Badge variant={statusBadgeVariant(status)}>{status}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Created {formatIsoDate(key.createdAt instanceof Date ? key.createdAt.toISOString() : key.createdAt)}
                                {key.lastUsedAt && ` · Last used ${formatRelative(key.lastUsedAt instanceof Date ? key.lastUsedAt.toISOString() : key.lastUsedAt, 'never')}`}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {key.keyPrefix ? `Prefix ${key.keyPrefix}` : 'No prefix'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                {key.expiresAt ? `Expires ${formatRelative(key.expiresAt instanceof Date ? key.expiresAt.toISOString() : key.expiresAt, 'Never')}` : 'No expiry'}
                              </Badge>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleRevokeKey(key.id);
                                }}
                                disabled={isListLoading}
                              >
                                Revoke
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <aside className="space-y-4">
                <Card className="border-border/60 bg-card/80">
                  <CardHeader className="border-b border-border/60 pb-4">
                    <CardTitle className="text-lg">Key details</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Usage stats and lifecycle information for the selected key.
                    </p>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {isDetailsLoading ? (
                      <DetailSkeleton />
                    ) : detailsError ? (
                      <div className="rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
                        {detailsError}
                      </div>
                    ) : selectedKey && selectedKeyDetails ? (
                      <div className="space-y-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xl font-semibold">{selectedKey.name}</p>
                          <Badge variant={statusBadgeVariant(selectedKeyDetails.status)}>{selectedKeyDetails.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Key ID {selectedKeyDetails.id.slice(0, 8)} · Masked {maskApiKeyId(selectedKey.id)}
                        </p>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <InfoCard label="Request count" value={selectedKeyDetails.request_count.toLocaleString()} />
                          <InfoCard label="Last used" value={formatRelative(selectedKeyDetails.last_used_at, 'Never used')} />
                          <InfoCard label="Created" value={formatIsoDate(selectedKeyDetails.created_at)} />
                          <InfoCard label="Expires" value={selectedKeyDetails.expires_at ? formatRelative(selectedKeyDetails.expires_at, 'Never') : 'No expiry'} />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">Usage window</h4>
                            <span className="text-xs text-muted-foreground">
                              Last {Math.min(selectedKeyDetails.usage_by_day.length, 14)} days
                            </span>
                          </div>
                          <UsageChart data={selectedKeyDetails.usage_by_day} />
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
                        Select a key on the left to inspect expiry, last-used time, and usage counts.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </aside>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/70 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

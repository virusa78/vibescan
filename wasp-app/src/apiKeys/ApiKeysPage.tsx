import { useCallback, useEffect, useState } from 'react';
import { useAuth } from 'wasp/client/auth';
import { api } from 'wasp/client/api';
import type { ApiKey } from 'wasp/entities';
import { Alert, AlertDescription } from '../client/components/ui/alert';
import { Button } from '../client/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../client/components/ui/card';
import { Input } from '../client/components/ui/input';
import { Label } from '../client/components/ui/label';
import { useAsyncState } from '../client/hooks/useAsyncState';

type ApiKeyListItem = Omit<ApiKey, 'keyHash'>;

export default function ApiKeysPage() {
  const { data: user } = useAuth();
  const [apiKeys, setApiKeys] = useState<ApiKeyListItem[]>([]);
  const { isLoading, error, run, setError } = useAsyncState();
  const [showNewKeyForm, setShowNewKeyForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<{ key: string; id: string } | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load API keys on mount
  const loadApiKeys = useCallback(async () => {
    if (!user) return;
    await run(
      async () => {
        const res = await api.get('/api/v1/api-keys');
        setApiKeys(res.data || []);
      },
      { errorMessage: 'Failed to load API keys' },
    );
  }, [run, user]);

  useEffect(() => {
    void loadApiKeys();
  }, [loadApiKeys]);

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) {
      setSuccessMessage(null);
      setError('Key name is required');
      return;
    }

    setSuccessMessage(null);
    await run(
      async () => {
        const res = await api.post('/api/v1/api-keys', { name: newKeyName });
        const result = res.data;
        setGeneratedKey(result);
        setNewKeyName('');
        setShowNewKeyForm(false);
        setSuccessMessage('API key generated. Copy it now—you won\'t see it again!');

        // Reload keys
        const reload = await api.get('/api/v1/api-keys');
        setApiKeys(reload.data || []);
      },
      { errorMessage: 'Failed to generate API key' },
    );
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key?')) return;

    await run(
      async () => {
        await api.delete(`/api/v1/api-keys/${encodeURIComponent(keyId)}`);
        setSuccessMessage('API key revoked');
        const reload = await api.get('/api/v1/api-keys');
        setApiKeys(reload.data || []);
      },
      { errorMessage: 'Failed to revoke API key', setLoading: false },
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccessMessage('Copied to clipboard!');
    setTimeout(() => setSuccessMessage(null), 2000);
  };

  return (
    <div className="mt-10 px-6">
      <Card className="mb-4 lg:m-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>API Keys</CardTitle>
          <Button
            onClick={() => {
              setShowNewKeyForm(!showNewKeyForm);
            }}
            disabled={isLoading}
          >
            {showNewKeyForm ? 'Cancel' : 'Generate New Key'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
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
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded bg-gray-800 px-3 py-2 font-mono text-sm text-gray-100">
                      {generatedKey.key}
                    </code>
                    <Button
                      size="sm"
                      onClick={() => copyToClipboard(generatedKey.key)}
                    >
                      Copy
                    </Button>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Save this key somewhere safe. You won't be able to see it again.
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {showNewKeyForm && !generatedKey && (
            <form onSubmit={handleGenerateKey} className="space-y-4 rounded border p-4">
              <div className="space-y-2">
                <Label htmlFor="keyName">Key Name</Label>
                <Input
                  id="keyName"
                  placeholder="e.g., My CI Pipeline"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Generating...' : 'Generate'}
              </Button>
            </form>
          )}

          <div className="space-y-2">
            <h3 className="font-semibold">Your API Keys</h3>
            {isLoading && apiKeys.length === 0 ? (
              <p className="text-gray-500">Loading API keys...</p>
            ) : apiKeys.length === 0 ? (
              <p className="text-gray-500">No API keys yet. Create one to get started.</p>
            ) : (
              <div className="space-y-2">
                {apiKeys.map((key) => (
                  <div
                    key={key.id}
                    className="flex items-center justify-between rounded border p-3"
                  >
                    <div>
                      <p className="font-medium">{key.name}</p>
                      <p className="text-xs text-gray-500">
                        Created {new Date(key.createdAt).toLocaleDateString()}
                        {key.lastUsedAt && ` • Used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleRevokeKey(key.id)}
                      disabled={isLoading}
                    >
                      Revoke
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

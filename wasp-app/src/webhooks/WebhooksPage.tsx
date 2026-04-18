import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../client/components/ui/card";
import { Button } from "../client/components/ui/button";
import { Plus, Trash2, Check, X, Webhook as WebhookIcon } from "lucide-react";

interface Webhook {
  id: string;
  url: string;
  enabled: boolean;
  created_at: string;
  lastTriggeredAt?: string;
  deliverySuccessRate?: number;
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");

  const loadWebhooks = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch("/api/v1/webhooks", { credentials: "include" });
      if (!res.ok) {
        throw new Error(`Failed to load webhooks (${res.status})`);
      }
      const data = await res.json();
      setWebhooks((data.webhooks ?? []) as Webhook[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load webhooks.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWebhooks();
  }, []);

  const handleAddWebhook = async () => {
    if (!newWebhookUrl.trim()) return;

    try {
      setError(null);
      const res = await fetch("/api/v1/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          url: newWebhookUrl.trim(),
          events: ["scan_complete", "report_ready", "scan_failed"],
        }),
      });
      if (!res.ok) {
        throw new Error(`Failed to create webhook (${res.status})`);
      }

      setNewWebhookUrl("");
      setIsAddingNew(false);
      await loadWebhooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create webhook.");
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    try {
      setError(null);
      const res = await fetch(`/api/v1/webhooks/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`Failed to delete webhook (${res.status})`);
      }
      setWebhooks(webhooks.filter((w) => w.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete webhook.");
    }
  };

  const handleToggleActive = async (id: string) => {
    const current = webhooks.find((w) => w.id === id);
    if (!current) return;

    try {
      setError(null);
      const res = await fetch(`/api/v1/webhooks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ active: !current.enabled }),
      });
      if (!res.ok) {
        throw new Error(`Failed to update webhook (${res.status})`);
      }
      setWebhooks(
        webhooks.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update webhook.");
    }
  };

  return (
    <div className="p-8 lg:p-10">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-foreground text-4xl font-bold tracking-tight mb-2">
            Webhooks
          </h1>
          <p className="text-muted-foreground">
            Configure webhooks to receive real-time scan notifications
          </p>
        </div>
        <Button
          onClick={() => setIsAddingNew(!isAddingNew)}
          className="bg-primary hover:bg-primary/90"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Webhook
        </Button>
      </div>

      {error && (
        <div className="mb-6 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Add New Webhook Form */}
      {isAddingNew && (
        <Card className="mb-8 border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle>Configure New Webhook</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Webhook URL
              </label>
              <input
                type="url"
                placeholder="https://your-domain.com/webhooks/vibescan"
                value={newWebhookUrl}
                onChange={(e) => setNewWebhookUrl(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Must be a valid HTTPS URL that can receive POST requests
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleAddWebhook}
                className="bg-green-600 hover:bg-green-700"
              >
                <Check className="w-4 h-4 mr-2" />
                Create
              </Button>
              <Button
                onClick={() => {
                  setIsAddingNew(false);
                  setNewWebhookUrl("");
                }}
                className="bg-gray-600 hover:bg-gray-700"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Webhooks List */}
      {isLoading ? (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="py-8 text-sm text-muted-foreground">
            Loading webhooks...
          </CardContent>
        </Card>
      ) : webhooks.length === 0 ? (
        <Card className="border-dashed border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <WebhookIcon className="w-5 h-5 text-muted-foreground" />
              <CardTitle className="text-muted-foreground">No Webhooks Configured</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm mb-4">
              Webhooks allow you to receive real-time notifications when scans complete or vulnerabilities are found.
            </p>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>📋 <strong>Supported Events:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>Scan completed (free & enterprise)</li>
                <li>New vulnerabilities found</li>
                <li>Vulnerability severity changed</li>
                <li>Scan cancelled or failed</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {webhooks.map((webhook) => (
            <Card key={webhook.id} className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono text-foreground break-all">
                        {webhook.url}
                      </code>
                      <div className={`px-2 py-1 rounded-md text-xs font-semibold ${
                        webhook.enabled
                          ? "bg-green-500/20 text-green-600"
                          : "bg-gray-500/20 text-gray-600"
                      }`}>
                        {webhook.enabled ? "Active" : "Inactive"}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Created {new Date(webhook.created_at).toLocaleDateString()}
                      {webhook.lastTriggeredAt && ` • Last triggered ${new Date(webhook.lastTriggeredAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {webhook.deliverySuccessRate !== undefined && (
                      <div className="text-right mr-4">
                        <p className="text-sm font-semibold text-foreground">
                          {webhook.deliverySuccessRate}%
                        </p>
                        <p className="text-xs text-muted-foreground">success rate</p>
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleActive(webhook.id)}
                      className="border-border/50"
                    >
                      {webhook.enabled ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-500/30 hover:bg-red-500/10 hover:text-red-600"
                      onClick={() => handleDeleteWebhook(webhook.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Help Section */}
      <Card className="mt-8 border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-sm">Webhook Implementation Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            <p className="font-semibold text-foreground mb-1">Request Format</p>
            <code className="block bg-background/50 p-2 rounded text-xs overflow-auto">
              POST your-webhook-url
              X-VibeScan-Signature: sha256=...
            </code>
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1">Verify Signature</p>
            <p>All webhooks are signed with HMAC-SHA256 using your API key. Verify the X-VibeScan-Signature header.</p>
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1">Retries</p>
            <p>Failed deliveries are automatically retried up to 5 times with exponential backoff.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

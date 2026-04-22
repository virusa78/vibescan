import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../client/components/ui/card';
import { Button } from '../client/components/ui/button';
import { Plus, Trash2, Check, X, Webhook as WebhookIcon } from 'lucide-react';
import { useAsyncState } from '../client/hooks/useAsyncState';
import { api } from 'wasp/client/api';
import { toast } from '../client/hooks/use-toast';

type DrawerTab = 'overview' | 'deliveries' | 'payloads' | 'settings';

interface Webhook {
  id: string;
  url: string;
  enabled: boolean;
  created_at: string;
  lastTriggeredAt?: string | null;
  deliverySuccessRate?: number;
}

interface DeliveryItem {
  id: string;
  status: string;
  status_code: number | null;
  duration: number | null;
  event: string;
  attempt: number;
  timestamp: string;
  delivered_at: string | null;
  scan_id: string;
  payload: unknown;
  response: string | null;
  manual_retry_of_id: string | null;
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const { isLoading, error, run } = useAsyncState(true);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');

  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('overview');
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([]);
  const [deliveryCursor, setDeliveryCursor] = useState<string | null>(null);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string>('');

  const selectedDelivery = useMemo(
    () => deliveries.find((delivery) => delivery.id === selectedDeliveryId) ?? deliveries[0] ?? null,
    [deliveries, selectedDeliveryId],
  );

  const loadWebhooks = async () => {
    await run(
      async () => {
        const data = (await api.get('/api/v1/webhooks')).data;
        setWebhooks((data.webhooks ?? []) as Webhook[]);
      },
      { errorMessage: 'Failed to load webhooks.' },
    );
  };

  useEffect(() => {
    void loadWebhooks();
  }, []);

  const loadDeliveries = async (webhookId: string, cursor?: string) => {
    const response = await api.get(`/api/v1/webhooks/${webhookId}/deliveries`, {
      params: {
        limit: 100,
        ...(cursor ? { cursor } : {}),
      },
    });

    const data = response.data;
    const nextItems = Array.isArray(data.deliveries) ? (data.deliveries as DeliveryItem[]) : [];
    setDeliveries((previous) => (cursor ? [...previous, ...nextItems] : nextItems));
    setDeliveryCursor(data.next_cursor ?? null);
    if (!cursor) {
      setSelectedDeliveryId(nextItems[0]?.id ?? '');
    }
  };

  const openWebhookDrawer = async (webhook: Webhook) => {
    setSelectedWebhook(webhook);
    setDrawerTab('overview');
    try {
      await loadDeliveries(webhook.id);
    } catch (drawerError) {
      console.error(drawerError);
      toast({ title: 'Failed to load deliveries', variant: 'destructive' });
    }
  };

  const handleAddWebhook = async () => {
    if (!newWebhookUrl.trim()) return;

    await run(
      async () => {
        await api.post('/api/v1/webhooks', {
          url: newWebhookUrl.trim(),
          events: ['scan_complete', 'report_ready', 'scan_failed'],
        });

        setNewWebhookUrl('');
        setIsAddingNew(false);
        await loadWebhooks();
      },
      { errorMessage: 'Failed to create webhook.', setLoading: false },
    );
  };

  const handleDeleteWebhook = async (id: string) => {
    await run(
      async () => {
        await api.delete(`/api/v1/webhooks/${id}`);
        setWebhooks((previous) => previous.filter((webhook) => webhook.id !== id));
        if (selectedWebhook?.id === id) {
          setSelectedWebhook(null);
        }
      },
      { errorMessage: 'Failed to delete webhook.', setLoading: false },
    );
  };

  const handleToggleActive = async (id: string) => {
    const current = webhooks.find((webhook) => webhook.id === id);
    if (!current) return;

    await run(
      async () => {
        await api.put(`/api/v1/webhooks/${id}`, { enabled: !current.enabled });
        setWebhooks((previous) =>
          previous.map((webhook) => (webhook.id === id ? { ...webhook, enabled: !webhook.enabled } : webhook)),
        );
        if (selectedWebhook?.id === id) {
          setSelectedWebhook({ ...selectedWebhook, enabled: !selectedWebhook.enabled });
        }
      },
      { errorMessage: 'Failed to update webhook.', setLoading: false },
    );
  };

  const handleTestDelivery = async () => {
    if (!selectedWebhook) return;

    try {
      await api.post(`/api/v1/webhooks/${selectedWebhook.id}/test`);
      toast({ title: 'Test delivery queued' });
      await loadDeliveries(selectedWebhook.id);
      await loadWebhooks();
    } catch (testError) {
      console.error(testError);
      toast({ title: 'Test delivery failed', variant: 'destructive' });
    }
  };

  const handleRetryDelivery = async (deliveryId: string) => {
    if (!selectedWebhook) return;

    try {
      await api.post(`/api/v1/webhooks/${selectedWebhook.id}/deliveries/${deliveryId}/retry`);
      toast({ title: 'Retry queued' });
      await loadDeliveries(selectedWebhook.id);
    } catch (retryError) {
      console.error(retryError);
      toast({ title: 'Retry failed', variant: 'destructive' });
    }
  };

  return (
    <div className="p-8 lg:p-10">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-foreground text-4xl font-bold tracking-tight mb-2">Webhooks</h1>
          <p className="text-muted-foreground">Configure webhooks to receive real-time scan notifications</p>
        </div>
        <Button onClick={() => setIsAddingNew(!isAddingNew)} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />
          Add Webhook
        </Button>
      </div>

      {error && (
        <div className="mb-6 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600">{error}</div>
      )}

      {isAddingNew && (
        <Card className="mb-8 border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle>Configure New Webhook</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Webhook URL</label>
              <input
                type="url"
                placeholder="https://your-domain.com/webhooks/vibescan"
                value={newWebhookUrl}
                onChange={(event) => setNewWebhookUrl(event.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex gap-3">
              <Button onClick={handleAddWebhook} className="bg-green-600 hover:bg-green-700">
                <Check className="w-4 h-4 mr-2" />
                Create
              </Button>
              <Button
                onClick={() => {
                  setIsAddingNew(false);
                  setNewWebhookUrl('');
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

      {isLoading ? (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="py-8 text-sm text-muted-foreground">Loading webhooks...</CardContent>
        </Card>
      ) : webhooks.length === 0 ? (
        <Card className="border-dashed border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <WebhookIcon className="w-5 h-5 text-muted-foreground" />
              <CardTitle className="text-muted-foreground">No Webhooks Configured</CardTitle>
            </div>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-4">
          {webhooks.map((webhook) => (
            <Card
              key={webhook.id}
              className="border-border/50 bg-card/50 backdrop-blur-sm cursor-pointer"
              onClick={() => void openWebhookDrawer(webhook)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono text-foreground break-all">{webhook.url}</code>
                      <div
                        className={`px-2 py-1 rounded-md text-xs font-semibold ${
                          webhook.enabled ? 'bg-green-500/20 text-green-600' : 'bg-gray-500/20 text-gray-600'
                        }`}
                      >
                        {webhook.enabled ? 'Active' : 'Inactive'}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Created {new Date(webhook.created_at).toLocaleDateString()}
                      {webhook.lastTriggeredAt
                        ? ` • Last triggered ${new Date(webhook.lastTriggeredAt).toLocaleDateString()}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
                    <div className="text-right mr-4">
                      <p className="text-sm font-semibold text-foreground">{webhook.deliverySuccessRate ?? 0}%</p>
                      <p className="text-xs text-muted-foreground">success rate</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => void handleToggleActive(webhook.id)}>
                      {webhook.enabled ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-500/30 hover:bg-red-500/10 hover:text-red-600"
                      onClick={() => void handleDeleteWebhook(webhook.id)}
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

      {selectedWebhook && (
        <Card className="mt-8 border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm">Delivery Ops: {selectedWebhook.url}</CardTitle>
              <Button onClick={handleTestDelivery}>Test delivery</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {([
                ['overview', 'Overview'],
                ['deliveries', 'Deliveries'],
                ['payloads', 'Payloads'],
                ['settings', 'Settings'],
              ] as Array<[DrawerTab, string]>).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs ${
                    drawerTab === tab
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border/60 text-muted-foreground'
                  }`}
                  onClick={() => setDrawerTab(tab)}
                >
                  {label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {drawerTab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="rounded border border-border/50 p-3">Total deliveries: {deliveries.length}</div>
                <div className="rounded border border-border/50 p-3">
                  Success: {deliveries.filter((delivery) => delivery.status === 'delivered').length}
                </div>
                <div className="rounded border border-border/50 p-3">
                  Failed/exhausted: {deliveries.filter((delivery) => delivery.status !== 'delivered').length}
                </div>
              </div>
            )}

            {drawerTab === 'deliveries' && (
              <div className="space-y-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/30">
                        <th className="py-2 px-2 text-left">Event</th>
                        <th className="py-2 px-2 text-left">Status</th>
                        <th className="py-2 px-2 text-left">Status code</th>
                        <th className="py-2 px-2 text-left">Duration</th>
                        <th className="py-2 px-2 text-left">Attempt</th>
                        <th className="py-2 px-2 text-left">Timestamp</th>
                        <th className="py-2 px-2 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deliveries.map((delivery) => {
                        const canRetry = delivery.status === 'failed' || delivery.status === 'exhausted';
                        return (
                          <tr
                            key={delivery.id}
                            className={`border-b border-border/20 cursor-pointer ${
                              selectedDelivery?.id === delivery.id ? 'bg-accent/20' : ''
                            }`}
                            onClick={() => setSelectedDeliveryId(delivery.id)}
                          >
                            <td className="py-2 px-2">{delivery.event}</td>
                            <td className="py-2 px-2">{delivery.status}</td>
                            <td className="py-2 px-2">{delivery.status_code ?? '-'}</td>
                            <td className="py-2 px-2">{delivery.duration ?? '-'} ms</td>
                            <td className="py-2 px-2">{delivery.attempt}</td>
                            <td className="py-2 px-2">{new Date(delivery.timestamp).toLocaleString()}</td>
                            <td className="py-2 px-2">
                              <Button
                                disabled={!canRetry}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (!canRetry) return;
                                  void handleRetryDelivery(delivery.id);
                                }}
                              >
                                Retry now
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {deliveryCursor && (
                  <Button onClick={() => void loadDeliveries(selectedWebhook.id, deliveryCursor)}>Load more</Button>
                )}
              </div>
            )}

            {drawerTab === 'payloads' && (
              <div className="space-y-3">
                {!selectedDelivery ? (
                  <p className="text-sm text-muted-foreground">Select a delivery from the Deliveries tab.</p>
                ) : (
                  <>
                    <div className="rounded border border-border/50 p-3">
                      <p className="text-xs text-muted-foreground mb-2">Payload</p>
                      <pre className="overflow-auto text-xs">{JSON.stringify(selectedDelivery.payload ?? {}, null, 2)}</pre>
                    </div>
                    <div className="rounded border border-border/50 p-3">
                      <p className="text-xs text-muted-foreground mb-2">Response</p>
                      <pre className="overflow-auto text-xs">{selectedDelivery.response ?? '-'}</pre>
                    </div>
                  </>
                )}
              </div>
            )}

            {drawerTab === 'settings' && (
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => void handleToggleActive(selectedWebhook.id)}>
                  {selectedWebhook.enabled ? 'Disable webhook' : 'Enable webhook'}
                </Button>
                <Button
                  variant="outline"
                  className="border-red-500/30 hover:bg-red-500/10 hover:text-red-600"
                  onClick={() => void handleDeleteWebhook(selectedWebhook.id)}
                >
                  Delete webhook
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

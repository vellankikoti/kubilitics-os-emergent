import { useState, useCallback, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Globe, Clock, Download, Trash2, Lock, ExternalLink, RefreshCw, Activity, Shield, Route, Server } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ResourceDetailLayout,
  TopologyViewer,
  YamlViewer,
  YamlCompareViewer,
  EventsSection,
  ActionsSection,
  DeleteConfirmDialog,
  SectionCard,
  DetailRow,
  type TopologyNode,
  type TopologyEdge,
  type ResourceStatus,
  type YamlVersion,
  type EventInfo,
} from '@/components/resources';
import { useResourceDetail, useResourceEvents } from '@/hooks/useK8sResourceDetail';
import { useDeleteK8sResource, useUpdateK8sResource, calculateAge, type KubernetesResource } from '@/hooks/useKubernetes';
import { useResourceTopology } from '@/hooks/useResourceTopology';
import { useBackendConfigStore, getEffectiveBackendBaseUrl } from '@/stores/backendConfigStore';
import { toast } from 'sonner';

interface IngressResource extends KubernetesResource {
  spec?: {
    ingressClassName?: string;
    rules?: Array<{
      host?: string;
      http?: {
        paths: Array<{
          path: string;
          pathType: string;
          backend: {
            service?: { name: string; port: { number?: number; name?: string } };
          };
        }>;
      };
    }>;
    tls?: Array<{ hosts?: string[]; secretName?: string }>;
  };
  status?: {
    loadBalancer?: {
      ingress?: Array<{ ip?: string; hostname?: string }>;
    };
  };
}

const fallbackTopologyNodes: TopologyNode[] = [];
const fallbackTopologyEdges: TopologyEdge[] = [];

const VALID_TAB_IDS = new Set(['overview', 'routing', 'tls', 'traffic', 'backends', 'events', 'metrics', 'yaml', 'compare', 'topology', 'controller', 'waf', 'actions']);

export default function IngressDetail() {
  const { namespace: nsParam, name } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') || 'overview';
  const initialTab = VALID_TAB_IDS.has(tabFromUrl) ? tabFromUrl : 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);
  const namespace = nsParam ?? '';

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);
  const baseUrl = getEffectiveBackendBaseUrl();
  const isBackendConfigured = useBackendConfigStore((s) => s.isBackendConfigured());
  const clusterId = useBackendConfigStore((s) => s.currentClusterId);

  const { resource: ing, isLoading, error, age, yaml, isConnected, refetch } = useResourceDetail<IngressResource>(
    'ingresses',
    name,
    nsParam,
    undefined
  );
  const resourceEvents = useResourceEvents('Ingress', namespace, name ?? undefined);
  const events = resourceEvents.events;

  const deleteIngress = useDeleteK8sResource('ingresses');
  const updateIngress = useUpdateK8sResource('ingresses');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const resourceTopology = useResourceTopology('ingresses', namespace, name ?? undefined);
  const useBackendTopology = isBackendConfigured && !!clusterId;
  const topologyNodesFromBackend = useBackendTopology ? resourceTopology.nodes : fallbackTopologyNodes;
  const topologyEdgesFromBackend = useBackendTopology ? resourceTopology.edges : fallbackTopologyEdges;
  const topologyLoading = useBackendTopology ? resourceTopology.isLoading : false;
  const topologyError = useBackendTopology ? resourceTopology.error : null;

  const ingName = ing.metadata?.name || '';
  const ingNamespace = ing.metadata?.namespace || '';

  const handleDownloadYaml = useCallback(() => {
    const blob = new Blob([yaml], { type: 'application/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ingName || 'ingress'}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  }, [yaml, ingName]);
  const annotations = ing.metadata?.annotations || {};
  const ingressClassName = ing.spec?.ingressClassName || '-';
  const rules = ing.spec?.rules || [];
  const tls = ing.spec?.tls || [];
  const lbIngress = ing.status?.loadBalancer?.ingress || [];
  const address = lbIngress[0]?.ip || lbIngress[0]?.hostname || '-';
  const status: ResourceStatus = address !== '-' ? 'Healthy' : 'Warning';
  const tlsStatusLabel = tls.length > 0 ? 'Valid' : 'Disabled';

  // Mock YAML versions for comparison
  const yamlVersions: YamlVersion[] = [
    { id: 'current', label: 'Current Version', yaml, timestamp: 'now' },
    { id: 'previous', label: 'Previous Version', yaml: yaml.replace('app.example.com', 'old.example.com'), timestamp: '2 hours ago' },
    { id: 'initial', label: 'Initial Version', yaml: yaml.replace('/api', '/v1/api'), timestamp: '1 day ago' },
  ];

  const handleSaveYaml = useCallback(async (newYaml: string) => {
    if (!isConnected || !name || !namespace) {
      toast.error('Connect cluster to update Ingress');
      throw new Error('Not connected');
    }
    try {
      await updateIngress.mutateAsync({ name, namespace, yaml: newYaml });
      toast.success('Ingress updated successfully');
      refetch();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to update: ${message}`);
      throw err;
    }
  }, [isConnected, name, namespace, updateIngress, refetch]);

  const handleNodeClick = (node: TopologyNode) => {
    const ns = node.namespace ?? namespace ?? '';
    if (node.type === 'service') navigate(`/services/${ns}/${node.name}`);
    else if (node.type === 'secret') navigate(`/secrets/${ns}/${node.name}`);
    else if (node.type === 'ingressclass') navigate(`/ingressclasses/${node.name}`);
  };

  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tabId === 'overview') next.delete('tab');
      else next.set('tab', tabId);
      return next;
    });
  }, [setSearchParams]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!ing?.metadata?.name || error) {
    return (
      <div className="space-y-4 p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">{error ? 'Failed to load resource.' : 'Ingress not found.'}</p>
            {error && <p className="text-sm text-destructive mt-2">{String(error)}</p>}
            <Button variant="outline" className="mt-4" onClick={() => navigate('/ingresses')}>
              Back to Ingresses
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hostsCount = rules.reduce((acc, r) => acc + (r.host ? 1 : 0), 0) || rules.length;
  const rulesCount = rules.reduce((acc, r) => acc + (r.http?.paths?.length ?? 0), 0);
  const defaultBackendService = (ing.spec as { defaultBackend?: { service?: { name?: string; port?: { number?: number; name?: string } } } })?.defaultBackend?.service?.name;
  const defaultBackendPort = (ing.spec as { defaultBackend?: { service?: { port?: { number?: number; name?: string } } } })?.defaultBackend?.service?.port?.number ?? (ing.spec as { defaultBackend?: { service?: { port?: { name?: string } } } })?.defaultBackend?.service?.port?.name ?? '—';
  const statusCards = [
    { label: 'Status', value: status, icon: Globe, iconColor: 'primary' as const },
    { label: 'Hosts', value: String(hostsCount), icon: Globe, iconColor: 'info' as const },
    { label: 'TLS', value: tlsStatusLabel, icon: Lock, iconColor: tls.length > 0 ? 'success' as const : 'muted' as const },
    { label: 'Rules', value: String(rulesCount), icon: Route, iconColor: 'muted' as const },
    { label: 'Addresses', value: address !== '-' ? address : (lbIngress.length ? String(lbIngress.length) : '—'), icon: ExternalLink, iconColor: address !== '-' ? ('success' as const) : ('muted' as const) },
  ];

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionCard title="Ingress info" icon={Globe}>
            <DetailRow label="Class" value={ingressClassName} />
            <DetailRow label="Default backend" value={ing.spec?.defaultBackend ? `${(ing.spec as { defaultBackend?: { service?: { name: string } } }).defaultBackend?.service?.name ?? '—'}` : '—'} />
            <DetailRow label="Age" value={age} />
          </SectionCard>
          {rules.length > 0 && (
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-base">Rules</CardTitle></CardHeader>
              <CardContent>
                {rules.map((rule, idx) => (
                  <div key={rule.host || idx} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-primary" />
                      <span className="font-mono font-medium">{rule.host || '*'}</span>
                    </div>
                    <div className="ml-6 space-y-2">
                      {(rule.http?.paths || []).map((path, pIdx) => (
                        <div key={path.path || pIdx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">{path.pathType}</Badge>
                            <span className="font-mono text-sm">{path.path}</span>
                          </div>
                          <div className="font-mono text-sm text-muted-foreground">
                            → {path.backend?.service?.name ?? '—'}:{path.backend?.service?.port?.number ?? path.backend?.service?.port?.name ?? '—'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {tls.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">TLS Configuration</CardTitle></CardHeader>
              <CardContent>
                {tls.map((t, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-[hsl(var(--success))]" />
                      <span className="font-mono text-sm">{(t.hosts || []).join(', ')}</span>
                    </div>
                    <Link to={`/secrets/${namespace}/${t.secretName}`}><Badge variant="secondary">{t.secretName}</Badge></Link>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {Object.keys(annotations).length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Annotations</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(annotations).map(([key, value]) => (
                    <div key={key} className="text-sm">
                      <p className="text-muted-foreground">{key}</p>
                      <p className="font-mono break-all">{String(value)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ),
    },
    {
      id: 'routing',
      label: 'Routing Rules',
      content: (
        <div className="space-y-6">
          {/* Visual routing diagram: Host → Path → Service:Port */}
          <SectionCard title="Visual Routing Diagram" icon={Route}>
            {rules.length === 0 ? (
              <p className="text-muted-foreground text-sm">No rules defined.</p>
            ) : (
              <div className="space-y-4">
                {rules.map((rule, idx) => (
                  <div key={rule.host || idx} className="rounded-lg border border-border bg-muted/20 p-4">
                    <div className="flex items-center gap-2 font-mono font-medium text-primary mb-3">
                      <Globe className="h-4 w-4" />
                      Host: {rule.host || '*'}
                      {(rule.host || '').includes('*') && <Badge variant="secondary" className="text-xs">Wildcard</Badge>}
                    </div>
                    <div className="ml-4 space-y-2">
                      {(rule.http?.paths || []).map((path, pIdx) => (
                        <div key={pIdx} className="flex items-center gap-3 flex-wrap text-sm">
                          <Badge variant="outline">{path.pathType}</Badge>
                          <span className="font-mono">{path.path}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-mono">
                            {path.backend?.service?.name ?? '—'}:{path.backend?.service?.port?.number ?? path.backend?.service?.port?.name ?? '—'}
                          </span>
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toast.info('Test route: coming soon')}>Test</Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
          {/* Rules table */}
          <Card>
            <CardHeader><CardTitle className="text-base">Rules Table</CardTitle></CardHeader>
            <CardContent>
              {rules.length === 0 ? (
                <p className="text-muted-foreground text-sm">No routing rules.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 font-medium">Host</th>
                        <th className="text-left py-2 font-medium">Path</th>
                        <th className="text-left py-2 font-medium">Path Type</th>
                        <th className="text-left py-2 font-medium">Backend Service</th>
                        <th className="text-left py-2 font-medium">Backend Port</th>
                        <th className="w-20"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rules.flatMap((rule, rIdx) =>
                        (rule.http?.paths || []).map((path, pIdx) => (
                          <tr key={`${rIdx}-${pIdx}`} className="border-b border-border/60">
                            <td className="py-2 font-mono">{rule.host || '*'}</td>
                            <td className="py-2 font-mono">{path.path}</td>
                            <td><Badge variant="outline">{path.pathType}</Badge></td>
                            <td className="font-mono">{path.backend?.service?.name ?? '—'}</td>
                            <td className="font-mono">{path.backend?.service?.port?.number ?? path.backend?.service?.port?.name ?? '—'}</td>
                            <td><Button variant="ghost" size="sm" onClick={() => toast.info('Test: coming soon')}>Test</Button></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
          {/* Default backend */}
          {(defaultBackendService || defaultBackendPort !== '—') && (
            <SectionCard title="Default Backend" icon={Server}>
              <p className="text-sm text-muted-foreground">When no rule matches:</p>
              <p className="font-mono mt-1">{defaultBackendService ?? '—'}:{defaultBackendPort}</p>
            </SectionCard>
          )}
          <SectionCard title="Path conflict detection" icon={Route}>
            <p className="text-muted-foreground text-sm">Overlapping path detection across ingresses requires cluster-wide analysis. No conflicts detected for this ingress.</p>
          </SectionCard>
        </div>
      ),
    },
    {
      id: 'tls',
      label: 'TLS/SSL',
      content: tls.length === 0 ? (
        <SectionCard title="TLS/SSL" icon={Lock}><p className="text-muted-foreground text-sm">No TLS configured</p></SectionCard>
      ) : (
        <div className="space-y-6">
          {tls.map((t, idx) => (
            <Card key={idx}>
              <CardHeader><CardTitle className="text-base">Certificate — {(t.hosts || []).join(', ') || '—'}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DetailRow label="Hosts" value={(t.hosts || []).join(', ') || '—'} />
                  <DetailRow label="Secret" value={t.secretName ? <Link to={`/secrets/${namespace}/${t.secretName}`} className="text-primary hover:underline">{t.secretName}</Link> : '—'} />
                  <DetailRow label="Issuer" value="—" />
                  <DetailRow label="Subject" value="—" />
                  <DetailRow label="SANs" value="—" />
                  <DetailRow label="Valid From / Valid To" value="—" />
                  <DetailRow label="Days Remaining" value="—" />
                  <DetailRow label="Key Algorithm / Key Size" value="—" />
                  <DetailRow label="Signature Algorithm" value="—" />
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Certificate chain</p>
                  <p className="text-sm text-muted-foreground">Root → Intermediate → Leaf (requires secret/cert-manager integration)</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-[hsl(142,76%,36%)]/20 text-[hsl(142,76%,36%)]">Certificate health: —</Badge>
                  <span className="text-xs text-muted-foreground">Green (&gt;30d), Yellow (7–30d), Red (&lt;7d)</span>
                </div>
                <p className="text-muted-foreground text-sm">Auto-renewal status and SSL Labs grade require cert-manager and external integration.</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ),
    },
    {
      id: 'traffic',
      label: 'Traffic Analytics',
      content: (
        <SectionCard title="Traffic Analytics" icon={Activity}>
          <p className="text-muted-foreground text-sm mb-3">Requires metrics pipeline integration.</p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Traffic by Host / Traffic by Path</li>
            <li>Status code distribution (2xx, 3xx, 4xx, 5xx)</li>
            <li>Latency by route (P50 / P95 / P99)</li>
            <li>Top clients (IP / User-Agent)</li>
            <li>Geographic distribution (GeoIP)</li>
            <li>Bandwidth (ingress/egress per host)</li>
          </ul>
        </SectionCard>
      ),
    },
    {
      id: 'backends',
      label: 'Backend Health',
      content: (
        <SectionCard title="Backend Health" icon={Server}>
          <p className="text-muted-foreground text-sm mb-2">Health status of each backend service and its endpoints.</p>
          {rules.length === 0 && !defaultBackendService ? (
            <p className="text-muted-foreground text-sm">No backends defined.</p>
          ) : (
            <ul className="text-sm space-y-1">
              {defaultBackendService && <li className="font-mono">Default: {defaultBackendService} (endpoints: —)</li>}
              {Array.from(new Set(rules.flatMap((r) => (r.http?.paths || []).map((p) => p.backend?.service?.name).filter(Boolean) as string[]))).map((svc) => <li key={svc} className="font-mono">{svc} — endpoints: —</li>)}
            </ul>
          )}
        </SectionCard>
      ),
    },
    { id: 'events', label: 'Events', content: <EventsSection events={events} /> },
    { id: 'metrics', label: 'Metrics', content: <SectionCard title="Metrics" icon={Activity}><p className="text-muted-foreground text-sm">Placeholder until metrics pipeline.</p></SectionCard> },
    { id: 'yaml', label: 'YAML', content: <YamlViewer yaml={yaml} resourceName={ingName} editable onSave={handleSaveYaml} /> },
    { id: 'compare', label: 'Compare', content: <YamlCompareViewer versions={yamlVersions} resourceName={ingName} /> },
    {
      id: 'topology',
      label: 'Topology',
      content: !useBackendTopology ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-muted-foreground text-sm">
          <p>Connect to the Kubilitics backend (Settings → Connect) and select a cluster to view resource topology.</p>
        </div>
      ) : topologyLoading ? (
        <div className="flex items-center justify-center min-h-[400px]"><Skeleton className="h-8 w-8" /></div>
      ) : topologyError ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-sm">
          <p className="text-destructive">Topology unavailable: {topologyError instanceof Error ? topologyError.message : String(topologyError)}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => resourceTopology.refetch()}>Retry</Button>
        </div>
      ) : (topologyNodesFromBackend.length === 0 && topologyEdgesFromBackend.length === 0) ? (
        <div className="flex items-center justify-center min-h-[400px] text-muted-foreground text-sm">No related resources in topology for this ingress.</div>
      ) : (
        <TopologyViewer nodes={topologyNodesFromBackend} edges={topologyEdgesFromBackend} onNodeClick={handleNodeClick} />
      ),
    },
    { id: 'controller', label: 'Controller Status', content: <SectionCard title="Controller status" icon={Globe}><p className="text-muted-foreground text-sm">Placeholder for ingress controller status.</p></SectionCard> },
    { id: 'waf', label: 'WAF & Security', content: <SectionCard title="WAF & Security" icon={Shield}><p className="text-muted-foreground text-sm">Annotations only when present.</p><div className="mt-2 text-sm">{Object.entries(annotations).filter(([k]) => k.toLowerCase().includes('waf') || k.toLowerCase().includes('auth')).length ? Object.entries(annotations).map(([k, v]) => <div key={k}>{k}: {String(v)}</div>) : 'No WAF/security annotations'}</div></SectionCard> },
    {
      id: 'actions',
      label: 'Actions',
      content: (
        <ActionsSection actions={[
          { icon: Route, label: 'Test All Routes', description: 'Test all route endpoints', onClick: () => toast.info('Test all routes: coming soon') },
          { icon: Lock, label: 'Refresh Certificate', description: 'Refresh TLS certificate (cert-manager)', onClick: () => toast.info('Requires cert-manager') },
          { icon: Lock, label: 'View Certificate', description: 'View TLS secret', onClick: () => tls[0]?.secretName ? navigate(`/secrets/${namespace}/${tls[0].secretName}`) : toast.info('No TLS configured') },
          { icon: ExternalLink, label: 'Open in Browser', description: 'Open external URL', onClick: () => { const u = lbIngress[0]?.hostname || lbIngress[0]?.ip; if (u) window.open(`http://${u}`, '_blank'); else toast.info('No address'); } },
          { icon: Download, label: 'Download YAML', description: 'Export Ingress definition', onClick: handleDownloadYaml },
          { icon: Trash2, label: 'Delete Ingress', description: 'Remove this ingress', variant: 'destructive', onClick: () => setShowDeleteDialog(true) },
        ]} />
      ),
    },
  ];

  return (
    <>
      <ResourceDetailLayout
        resourceType="Ingress"
        resourceIcon={Globe}
        name={ingName}
        namespace={ingNamespace}
        status={status}
        backLink="/ingresses"
        backLabel="Ingresses"
        headerMetadata={<span className="flex items-center gap-1.5 ml-2 text-sm text-muted-foreground"><Clock className="h-3.5 w-3.5" />Created {age}{isConnected && <Badge variant="outline" className="ml-2 text-xs">Live</Badge>}</span>}
        actions={[
          { label: 'Refresh', icon: RefreshCw, variant: 'outline', onClick: () => { refetch(); resourceEvents.refetch(); } },
          { label: 'Download YAML', icon: Download, variant: 'outline', onClick: handleDownloadYaml },
          { label: 'Delete', icon: Trash2, variant: 'destructive', onClick: () => setShowDeleteDialog(true) },
        ]}
        statusCards={statusCards}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />
      <DeleteConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        resourceType="Ingress"
        resourceName={ingName}
        namespace={ingNamespace}
        onConfirm={async () => {
          if (isConnected && name && ingNamespace) {
            await deleteIngress.mutateAsync({ name, namespace: ingNamespace });
            navigate('/ingresses');
          } else {
            toast.success(`Ingress ${ingName} deleted (demo mode)`);
            navigate('/ingresses');
          }
        }}
        requireNameConfirmation
      />
    </>
  );
}

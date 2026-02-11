import { useState, useCallback, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Globe, Clock, Server, Download, Trash2, ExternalLink, Network, Loader2, RefreshCw, Copy, Activity, Shield, Layers } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ResourceDetailLayout,
  TopologyViewer,
  NodeDetailPopup,
  YamlViewer,
  YamlCompareViewer,
  EventsSection,
  ActionsSection,
  DeleteConfirmDialog,
  SectionCard,
  DetailRow,
  type TopologyNode,
  type TopologyEdge,
  type ResourceDetail,
  type ResourceStatus,
  type YamlVersion,
  type EventInfo,
} from '@/components/resources';
import { useResourceDetail, useResourceEvents, resourceToYaml } from '@/hooks/useK8sResourceDetail';
import { useDeleteK8sResource, useUpdateK8sResource, useK8sResource, useK8sResourceList, calculateAge, type KubernetesResource } from '@/hooks/useKubernetes';
import { useResourceTopology } from '@/hooks/useResourceTopology';
import { useBackendConfigStore, getEffectiveBackendBaseUrl } from '@/stores/backendConfigStore';
import { useActiveClusterId } from '@/hooks/useActiveClusterId';
import { useQuery } from '@tanstack/react-query';
import { getServiceEndpoints, getResource } from '@/services/backendApiClient';
import { Breadcrumbs, useDetailBreadcrumbs } from '@/components/layout/Breadcrumbs';
import { useClusterStore } from '@/stores/clusterStore';
import { toast } from 'sonner';

interface ServiceResource extends KubernetesResource {
  spec?: {
    type?: string;
    clusterIP?: string;
    externalIPs?: string[];
    externalName?: string;
    ports?: Array<{ name?: string; port: number; targetPort?: number | string; protocol?: string; nodePort?: number }>;
    selector?: Record<string, string>;
    sessionAffinity?: string;
    externalTrafficPolicy?: string;
    internalTrafficPolicy?: string;
    ipFamilies?: string[];
    ipFamilyPolicy?: string;
    loadBalancerIP?: string;
    loadBalancerSourceRanges?: string[];
    allocateLoadBalancerNodePorts?: boolean;
    publishNotReadyAddresses?: boolean;
  };
  status?: {
    loadBalancer?: { ingress?: Array<{ ip?: string; hostname?: string }> };
  };
}

const fallbackTopologyNodes: TopologyNode[] = [];
const fallbackTopologyEdges: TopologyEdge[] = [];

interface EndpointsResource extends KubernetesResource {
  subsets?: Array<{
    addresses?: Array<{ ip: string; hostname?: string; nodeName?: string; targetRef?: { kind: string; namespace: string; name: string } }>;
    notReadyAddresses?: Array<{ ip: string; hostname?: string; nodeName?: string; targetRef?: { kind: string; namespace: string; name: string } }>;
    ports?: Array<{ name?: string; port: number; protocol?: string }>;
  }>;
}

export default function ServiceDetail() {
  const { namespace: nsParam, name } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [topologySelectedNode, setTopologySelectedNode] = useState<ResourceDetail | null>(null);

  const namespace = nsParam ?? '';
  const baseUrl = getEffectiveBackendBaseUrl();
  const isBackendConfigured = useBackendConfigStore((s) => s.isBackendConfigured());
  const clusterId = useActiveClusterId();
  const activeCluster = useClusterStore((s) => s.activeCluster);
  const breadcrumbSegments = useDetailBreadcrumbs('Service', name ?? undefined, nsParam ?? undefined, activeCluster?.name);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const { resource: svc, isLoading, error, age, yaml, isConnected, refetch } = useResourceDetail<ServiceResource>(
    'services',
    name,
    nsParam,
    undefined
  );
  const resourceEvents = useResourceEvents('Service', namespace, name ?? undefined);
  const events = resourceEvents.events;
  const eventsLoading = resourceEvents.isLoading;
  const useBackendEndpoints = !!(isBackendConfigured && clusterId && baseUrl && namespace && name);
  const endpointsQuery = useQuery({
    queryKey: ['service-endpoints', clusterId, namespace, name],
    queryFn: () => getServiceEndpoints(baseUrl!, clusterId!, namespace, name!),
    enabled: useBackendEndpoints,
  });
  const endpointsFromK8s = useK8sResource<EndpointsResource>(
    'endpoints',
    name ?? '',
    namespace,
    { enabled: !!(name && namespace && !useBackendEndpoints) }
  );
  const endpointsResource = useBackendEndpoints ? endpointsQuery.data : endpointsFromK8s.data;
  const endpointsLoading = useBackendEndpoints ? endpointsQuery.isLoading : endpointsFromK8s.isLoading;
  const endpointsError = useBackendEndpoints ? endpointsQuery.error : endpointsFromK8s.error;

  const deleteService = useDeleteK8sResource('services');
  const updateService = useUpdateK8sResource('services');
  const resourceTopology = useResourceTopology('services', namespace, name ?? undefined);
  const useBackendTopology = isBackendConfigured && !!clusterId;
  const topologyNodesFromBackend = useBackendTopology ? resourceTopology.nodes : fallbackTopologyNodes;
  const topologyEdgesFromBackend = useBackendTopology ? resourceTopology.edges : fallbackTopologyEdges;
  const topologyLoading = useBackendTopology ? resourceTopology.isLoading : false;
  const topologyError = useBackendTopology ? resourceTopology.error : null;

  const servicesInNs = useK8sResourceList<KubernetesResource>('services', namespace, { limit: 100, enabled: !!namespace });
  const networkPoliciesInNs = useK8sResourceList<KubernetesResource & { spec?: { podSelector?: { matchLabels?: Record<string, string> }; policyTypes?: string[] } }>(
    'networkpolicies',
    namespace,
    { enabled: !!namespace }
  );
  const networkPoliciesList = networkPoliciesInNs.data?.items ?? [];
  const otherServiceNames = useMemo(
    () =>
      (servicesInNs.data?.items ?? [])
        .filter((s) => s.metadata?.name !== name)
        .slice(0, 3)
        .map((s) => s.metadata!.name!),
    [servicesInNs.data?.items, name]
  );
  const compareServicesQuery = useQuery({
    queryKey: ['service-compare-yamls', clusterId, namespace, otherServiceNames],
    queryFn: async () => {
      const results = await Promise.all(
        otherServiceNames.map((n) => getResource(baseUrl!, clusterId!, 'services', namespace, n))
      );
      return results.map((r, i) => ({ name: otherServiceNames[i], yaml: resourceToYaml(r as KubernetesResource) }));
    },
    enabled: !!(isBackendConfigured && clusterId && baseUrl && namespace && otherServiceNames.length > 0),
    staleTime: 30_000,
  });
  const yamlVersionsForCompare: YamlVersion[] = useMemo(() => {
    const currentName = svc.metadata?.name ?? 'Current';
    const versions: YamlVersion[] = [{ id: 'current', label: currentName, yaml, timestamp: 'Current' }];
    if (compareServicesQuery.data) {
      compareServicesQuery.data.forEach((d, i) => versions.push({ id: `other-${i}`, label: d.name, yaml: d.yaml, timestamp: '' }));
    }
    return versions;
  }, [svc.metadata?.name, yaml, compareServicesQuery.data]);

  const podsInNs = useK8sResourceList<KubernetesResource & { spec?: { containers?: { name: string }[] }; metadata?: { name: string } }>(
    'pods',
    namespace,
    { enabled: !!namespace && !!svc.spec?.selector && Object.keys(svc.spec.selector).length > 0 }
  );
  const selectorPods = useMemo(() => {
    const sel = svc.spec?.selector;
    const items = podsInNs.data?.items ?? [];
    if (!sel || !items.length) return [];
    return items.filter((p: KubernetesResource) => {
      const labels = p.metadata?.labels ?? {};
      return Object.entries(sel).every(([k, v]) => labels[k] === v);
    });
  }, [podsInNs.data?.items, svc.spec?.selector]);

  const backingDeployment = useMemo(() => {
    const ref = selectorPods.find((p: KubernetesResource & { metadata?: { ownerReferences?: Array<{ kind: string; name: string }> } }) =>
      p.metadata?.ownerReferences?.some((r) => r.kind === 'Deployment')
    )?.metadata?.ownerReferences?.find((r) => r.kind === 'Deployment');
    return ref ? { name: ref.name, namespace } : null;
  }, [selectorPods, namespace]);

  const { endpointsReady, endpointsTotal, endpointRows } = useMemo(() => {
    const ep = endpointsResource as EndpointsResource | undefined;
    if (!ep?.subsets?.length) return { endpointsReady: 0, endpointsTotal: 0, endpointRows: [] as { address: string; port: string; protocol: string; ready: boolean; hostname?: string; nodeName?: string; podRef?: { ns: string; name: string } }[] };
    let ready = 0;
    const rows: { address: string; port: string; protocol: string; ready: boolean; hostname?: string; nodeName?: string; podRef?: { ns: string; name: string } }[] = [];
    for (const sub of ep.subsets) {
      const ports = sub.ports ?? [];
      const portStr = ports.map((p) => `${p.port}/${p.protocol || 'TCP'}`).join(', ') || '—';
      for (const addr of sub.addresses ?? []) {
        ready++;
        rows.push({
          address: addr.ip,
          port: portStr,
          protocol: ports[0]?.protocol ?? 'TCP',
          ready: true,
          hostname: addr.hostname,
          nodeName: addr.nodeName,
          podRef: addr.targetRef?.kind === 'Pod' ? { ns: addr.targetRef.namespace, name: addr.targetRef.name } : undefined,
        });
      }
      for (const addr of sub.notReadyAddresses ?? []) {
        rows.push({
          address: addr.ip,
          port: portStr,
          protocol: ports[0]?.protocol ?? 'TCP',
          ready: false,
          hostname: addr.hostname,
          nodeName: addr.nodeName,
          podRef: addr.targetRef?.kind === 'Pod' ? { ns: addr.targetRef.namespace, name: addr.targetRef.name } : undefined,
        });
      }
    }
    return { endpointsReady: ready, endpointsTotal: rows.length, endpointRows: rows };
  }, [endpointsResource]);

  const status: ResourceStatus = endpointsTotal > 0 && endpointsReady === 0 ? 'Degraded' : 'Healthy';
  const serviceType = svc.spec?.type || 'ClusterIP';
  const clusterIP = svc.spec?.clusterIP ?? (serviceType === 'ExternalName' ? '-' : 'None');
  const externalIP = useMemo(() => {
    if (svc.spec?.externalIPs?.length) return svc.spec.externalIPs.join(', ');
    if (serviceType === 'LoadBalancer' && svc.status?.loadBalancer?.ingress?.length)
      return svc.status.loadBalancer.ingress.map((i) => i.hostname || i.ip).filter(Boolean).join(', ');
    return null;
  }, [svc.spec?.externalIPs, serviceType, svc.status?.loadBalancer]);
  const ports = svc.spec?.ports || [];
  const selector = svc.spec?.selector || {};
  const sessionAffinity = svc.spec?.sessionAffinity || 'None';
  const svcName = svc.metadata?.name || '';
  const svcNamespace = svc.metadata?.namespace || '';
  const dnsName = namespace && svcName ? `${svcName}.${namespace}.svc.cluster.local` : '';

  const handleDownloadYaml = useCallback(() => {
    const blob = new Blob([yaml], { type: 'application/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${svcName || 'service'}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  }, [yaml, svcName]);

  // Compare tab: current + up to 3 other services from same namespace (real backend data)
  const yamlVersions = yamlVersionsForCompare;

  const handleSaveYaml = useCallback(async (newYaml: string) => {
    if (!isConnected || !name || !namespace) {
      toast.error('Connect cluster to update Service');
      throw new Error('Not connected');
    }
    try {
      await updateService.mutateAsync({ name, namespace, yaml: newYaml });
      toast.success('Service updated successfully');
      refetch();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to update: ${message}`);
      throw err;
    }
  }, [isConnected, name, namespace, updateService, refetch]);

  const handleNodeClick = useCallback((node: TopologyNode) => {
    const resourceDetail: ResourceDetail = {
      id: node.id,
      type: node.type as ResourceDetail['type'],
      name: node.name,
      namespace: node.namespace,
      status: node.status,
    };
    setTopologySelectedNode(resourceDetail);
  }, []);

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

  if (!svc?.metadata?.name || error) {
    return (
      <div className="space-y-4 p-6">
        <Breadcrumbs segments={breadcrumbSegments} className="mb-2" />
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">{error ? 'Failed to load resource.' : 'Service not found.'}</p>
            {error && <p className="text-sm text-destructive mt-2">{String(error)}</p>}
            <Button variant="outline" className="mt-4" onClick={() => navigate('/services')}>
              Back to Services
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusCards = [
    { label: 'Type', value: serviceType, icon: Globe, iconColor: 'primary' as const },
    { label: 'Cluster IP', value: clusterIP, icon: Network, iconColor: 'info' as const },
    { label: 'External IP', value: externalIP ?? '—', icon: Globe, iconColor: 'muted' as const },
    { label: 'Endpoints', value: endpointsTotal > 0 ? `${endpointsReady}/${endpointsTotal}` : '—', icon: Server, iconColor: 'success' as const },
    { label: 'Ports', value: String(ports.length), icon: Layers, iconColor: 'muted' as const },
    { label: 'Session Affinity', value: sessionAffinity, icon: Clock, iconColor: 'muted' as const },
  ];

  const copyDns = () => {
    if (dnsName) {
      navigator.clipboard.writeText(dnsName);
      toast.success('DNS name copied');
    }
  };

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionCard title="Service info" icon={Globe}>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <DetailRow label="Type" value={<Badge variant="secondary">{serviceType}</Badge>} />
              <DetailRow label="Cluster IP" value={<span className="font-mono">{clusterIP}</span>} />
              {svc.spec?.externalName != null && <DetailRow label="External Name" value={svc.spec.externalName} />}
              <DetailRow label="Session Affinity" value={sessionAffinity} />
              <DetailRow label="External Traffic Policy" value={svc.spec?.externalTrafficPolicy ?? '—'} />
              <DetailRow label="Internal Traffic Policy" value={svc.spec?.internalTrafficPolicy ?? '—'} />
              <DetailRow label="IP Families" value={svc.spec?.ipFamilies?.join(', ') ?? '—'} />
              <DetailRow label="IP Family Policy" value={svc.spec?.ipFamilyPolicy ?? '—'} />
              <DetailRow label="Publish Not Ready Addresses" value={svc.spec?.publishNotReadyAddresses ? 'true' : 'false'} />
              <DetailRow label="Age" value={age} />
            </div>
          </SectionCard>
          <SectionCard title="Ports" icon={Layers}>
            <div className="space-y-3">
              {ports.length === 0 ? <p className="text-muted-foreground text-sm">No ports</p> : ports.map((port, idx) => (
                <div key={port.name || idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium">{port.name || `port-${idx}`}</p>
                    <p className="text-sm text-muted-foreground">{port.protocol || 'TCP'}</p>
                  </div>
                  <div className="text-right font-mono text-sm">
                    <p>{port.port} → {port.targetPort ?? '—'}{port.nodePort != null ? ` (nodePort: ${port.nodePort})` : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
          <SectionCard title="Selector" icon={Server}>
            {Object.keys(selector).length === 0 ? <p className="text-muted-foreground text-sm">No selector</p> : (
              <div className="flex flex-wrap gap-2">
                {Object.entries(selector).map(([key, value]) => (
                  <Badge key={key} variant="outline" className="font-mono text-xs">{key}={value}</Badge>
                ))}
              </div>
            )}
          </SectionCard>
          <SectionCard title="Metadata" icon={Clock}>
            <div className="space-y-2 text-sm">
              {svc.metadata?.labels && Object.keys(svc.metadata.labels).length > 0 && (
                <DetailRow label="Labels" value={<div className="flex flex-wrap gap-1">{Object.entries(svc.metadata.labels).map(([k, v]) => <Badge key={k} variant="outline" className="text-xs">{k}={v}</Badge>)}</div>} />
              )}
              {svc.metadata?.annotations && Object.keys(svc.metadata.annotations).length > 0 && (
                <DetailRow label="Annotations" value={<div className="flex flex-wrap gap-1">{Object.entries(svc.metadata.annotations).map(([k, v]) => <Badge key={k} variant="outline" className="text-xs">{k}={String(v).slice(0, 20)}</Badge>)}</div>} />
              )}
            </div>
          </SectionCard>
        </div>
      ),
    },
    {
      id: 'endpoints',
      label: 'Endpoints & Health',
      content: (
        <div className="space-y-6">
          <SectionCard title="Endpoints" icon={Server}>
            {!useBackendEndpoints && !isConnected ? (
              <p className="text-muted-foreground text-sm">Connect to a cluster (or the Kubilitics backend) to view endpoint details for this service.</p>
            ) : endpointsLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : endpointsError ? (
              <p className="text-destructive text-sm">Failed to load endpoints: {endpointsError instanceof Error ? endpointsError.message : String(endpointsError)}</p>
            ) : endpointRows.length === 0 ? (
              <p className="text-muted-foreground text-sm">No endpoints. Ensure pods match the service selector.</p>
            ) : (
              <>
                <div className="mb-4 flex items-center gap-2">
                  <Link to={`/endpoints/${namespace}/${svcName}`} className="text-primary text-sm hover:underline">View Endpoints resource</Link>
                </div>
                <div className="rounded-md border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b bg-muted/40"><th className="text-left p-2">Address</th><th className="text-left p-2">Port</th><th className="text-left p-2">Protocol</th><th className="text-left p-2">Ready</th><th className="text-left p-2">Hostname</th><th className="text-left p-2">Node</th><th className="text-left p-2">Pod</th></tr></thead>
                    <tbody>
                      {endpointRows.map((row, i) => (
                        <tr key={i} className="border-b">
                          <td className="p-2 font-mono">{row.address}</td>
                          <td className="p-2">{row.port}</td>
                          <td className="p-2">{row.protocol}</td>
                          <td className="p-2">{row.ready ? <Badge variant="default" className="bg-green-600">Ready</Badge> : <Badge variant="secondary">Not Ready</Badge>}</td>
                          <td className="p-2">{row.hostname ?? '—'}</td>
                          <td className="p-2">{row.nodeName ?? '—'}</td>
                          <td className="p-2">{row.podRef ? <Link to={`/pods/${row.podRef.ns}/${row.podRef.name}`} className="text-primary hover:underline">{row.podRef.name}</Link> : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </SectionCard>
        </div>
      ),
    },
    {
      id: 'traffic',
      label: 'Traffic Flow',
      content: (
        <SectionCard title="Traffic flow" icon={Activity}>
          <p className="text-muted-foreground text-sm mb-4">External → Load Balancer → Service → Endpoints → Pods. Metrics (request rate, latency, error rate) require a metrics pipeline.</p>
          <div className="grid grid-cols-3 gap-4">
            <Card><CardContent className="pt-4"><p className="text-sm font-medium">Request rate</p><p className="text-muted-foreground text-xs">—</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-sm font-medium">Latency</p><p className="text-muted-foreground text-xs">—</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-sm font-medium">Error rate</p><p className="text-muted-foreground text-xs">—</p></CardContent></Card>
          </div>
        </SectionCard>
      ),
    },
    {
      id: 'dns',
      label: 'DNS',
      content: (
        <SectionCard title="DNS" icon={Globe}>
          <DetailRow label="DNS name" value={<span className="font-mono">{dnsName || '—'}</span>} />
          <div className="mt-2 flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={copyDns} disabled={!dnsName}>
              <Copy className="h-3.5 w-3.5 mr-1" /> Copy
            </Button>
          </div>
          <p className="text-muted-foreground text-sm mt-4">A/AAAA and SRV records are created automatically for this service in the cluster DNS.</p>
        </SectionCard>
      ),
    },
    {
      id: 'portforward',
      label: 'Port Forward',
      content: (
        <SectionCard title="Port forward" icon={ExternalLink}>
          <p className="text-muted-foreground text-sm mb-4">Forward a local port to this service (e.g. <code className="text-xs bg-muted px-1 rounded">kubectl port-forward svc/{svcName} 8080:80</code>). For pod-level port forward, use the Pod detail page.</p>
          <Button onClick={() => toast.info(`Use: kubectl port-forward svc/${svcName} -n ${namespace} <localPort>:<servicePort>`)}>Create port forward</Button>
        </SectionCard>
      ),
    },
    {
      id: 'pods',
      label: 'Pods',
      content: (
        <SectionCard title="Pods (selector match)" icon={Server}>
          {selectorPods.length === 0 ? <p className="text-muted-foreground text-sm">No pods match the service selector.</p> : (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/40"><th className="text-left p-2">Name</th><th className="text-left p-2">Actions</th></tr></thead>
                <tbody>
                  {selectorPods.map((p) => (
                    <tr key={p.metadata?.name} className="border-b">
                      <td className="p-2 font-mono">{p.metadata?.name}</td>
                      <td className="p-2"><Link to={`/pods/${namespace}/${p.metadata?.name}`} className="text-primary text-sm hover:underline">View</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      ),
    },
    { id: 'events', label: 'Events', content: <EventsSection events={events} isLoading={eventsLoading} /> },
    {
      id: 'metrics',
      label: 'Metrics',
      content: (
        <SectionCard title="Metrics" icon={Activity}>
          <p className="text-muted-foreground text-sm mb-4">Traffic, latency, and error rate for services require a metrics pipeline (e.g. Prometheus). Placeholder until integration.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <Card><CardContent className="pt-4"><p className="text-sm font-medium">Request rate</p><p className="text-muted-foreground text-xs">—</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-sm font-medium">Latency</p><p className="text-muted-foreground text-xs">—</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-sm font-medium">Error rate</p><p className="text-muted-foreground text-xs">—</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-sm font-medium">Connections</p><p className="text-muted-foreground text-xs">—</p></CardContent></Card>
          </div>
        </SectionCard>
      ),
    },
    { id: 'yaml', label: 'YAML', content: <YamlViewer yaml={yaml} resourceName={svcName} editable onSave={handleSaveYaml} /> },
    {
      id: 'compare',
      label: 'Compare',
      content: !isBackendConfigured || !clusterId ? (
        <SectionCard title="Compare" icon={Layers}>
          <p className="text-muted-foreground text-sm">Connect to the Kubilitics backend and select a cluster to compare this service with others in the namespace.</p>
        </SectionCard>
      ) : (
        <YamlCompareViewer versions={yamlVersions} resourceName={svcName} />
      ),
    },
    {
      id: 'topology',
      label: 'Topology',
      content: !isBackendConfigured || !clusterId ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6">
          <Network className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Connect to the Kubilitics backend (Settings → Connect) and select a cluster to view resource topology.</p>
        </div>
      ) : topologyLoading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : topologyError ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6">
          <p className="text-destructive text-sm">Topology unavailable: {topologyError instanceof Error ? topologyError.message : String(topologyError)}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => resourceTopology.refetch()}>Retry</Button>
        </div>
      ) : (topologyNodesFromBackend.length === 0 && topologyEdgesFromBackend.length === 0) ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6">
          <Network className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No related resources in topology for this service.</p>
        </div>
      ) : (
        <>
          <TopologyViewer nodes={topologyNodesFromBackend} edges={topologyEdgesFromBackend} onNodeClick={handleNodeClick} />
          <NodeDetailPopup
            resource={topologySelectedNode}
            onClose={() => setTopologySelectedNode(null)}
            sourceResourceType="Service"
            sourceResourceName={svc?.metadata?.name ?? name ?? ''}
          />
        </>
      ),
    },
    {
      id: 'networkpolicies',
      label: 'Network Policies',
      content: (
        <SectionCard title="Network policies in this namespace" icon={Shield}>
          {networkPoliciesInNs.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : networkPoliciesList.length === 0 ? (
            <p className="text-muted-foreground text-sm">No NetworkPolicies in this namespace.</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/40"><th className="text-left p-2">Name</th><th className="text-left p-2">Policy Types</th><th className="text-left p-2">Pod Selector</th><th className="text-left p-2">Actions</th></tr></thead>
                <tbody>
                  {networkPoliciesList.map((np) => (
                    <tr key={np.metadata?.name} className="border-b">
                      <td className="p-2 font-mono">{np.metadata?.name}</td>
                      <td className="p-2">{(np.spec?.policyTypes ?? []).join(', ') || '—'}</td>
                      <td className="p-2 font-mono text-xs">{np.spec?.podSelector?.matchLabels ? Object.entries(np.spec.podSelector.matchLabels).map(([k, v]) => `${k}=${v}`).join(', ') : 'All pods'}</td>
                      <td className="p-2"><Link to={`/networkpolicies/${namespace}/${np.metadata?.name}`} className="text-primary text-sm hover:underline">View</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-muted-foreground text-xs mt-3">Pods backing this service may be affected by these policies depending on selector overlap.</p>
        </SectionCard>
      ),
    },
    ...(serviceType === 'LoadBalancer' ? [{
      id: 'loadbalancer',
      label: 'Load Balancer',
      content: (
        <SectionCard title="Load balancer status" icon={Globe}>
          <DetailRow label="Ingress" value={svc.status?.loadBalancer?.ingress?.map((i) => i.ip || i.hostname).join(', ') ?? '—'} />
          <p className="text-muted-foreground text-sm mt-2">Annotations and provisioning events depend on the cloud provider.</p>
        </SectionCard>
      ),
    }] : []),
    {
      id: 'actions',
      label: 'Actions',
      content: (
        <ActionsSection actions={[
          { icon: ExternalLink, label: 'Port Forward', description: 'Forward local port to this service', onClick: () => toast.info(`kubectl port-forward svc/${svcName} -n ${namespace} <localPort>:<servicePort>`) },
          { icon: Globe, label: 'Test Connectivity', description: 'Simple connectivity check', onClick: () => toast.info('Test connectivity: requires backend support (design 3.1)') },
          ...(backingDeployment ? [{ icon: Server, label: 'Scale Backing Deployment', description: `Open Deployment ${backingDeployment.name} to scale`, onClick: () => navigate(`/deployments/${backingDeployment.namespace}/${backingDeployment.name}`) }] : []),
          { icon: Download, label: 'Download YAML', description: 'Export Service definition', onClick: handleDownloadYaml },
          { icon: Trash2, label: 'Delete Service', description: 'Remove this service', variant: 'destructive', onClick: () => setShowDeleteDialog(true) },
        ]} />
      ),
    },
  ];

  return (
    <>
      <ResourceDetailLayout
        resourceType="Service"
        resourceIcon={Globe}
        name={svcName}
        namespace={svcNamespace}
        status={status}
        backLink="/services"
        backLabel="Services"
        headerMetadata={<span className="flex items-center gap-1.5 ml-2 text-sm text-muted-foreground"><Clock className="h-3.5 w-3.5" />Created {age}{isConnected && <Badge variant="outline" className="ml-2 text-xs">Live</Badge>}</span>}
        actions={[
          { label: 'Refresh', icon: RefreshCw, variant: 'outline', onClick: () => { refetch(); resourceEvents.refetch(); } },
          { label: 'Download YAML', icon: Download, variant: 'outline', onClick: handleDownloadYaml },
          { label: 'Port Forward', icon: ExternalLink, variant: 'outline', onClick: () => toast.info(`kubectl port-forward svc/${svcName} -n ${namespace} <localPort>:<servicePort>`) },
          { label: 'Delete', icon: Trash2, variant: 'destructive', onClick: () => setShowDeleteDialog(true) },
        ]}
        statusCards={statusCards}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tabId) => {
          setActiveTab(tabId);
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            if (tabId === 'overview') next.delete('tab');
            else next.set('tab', tabId);
            return next;
          });
        }}
      />
      <DeleteConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        resourceType="Service"
        resourceName={svcName}
        namespace={svcNamespace}
        onConfirm={async () => {
          if (isConnected && name && svcNamespace) {
            await deleteService.mutateAsync({ name: name!, namespace: svcNamespace });
            navigate('/services');
          } else {
            toast.success(`Service ${svcName} deleted (demo mode)`);
            navigate('/services');
          }
        }}
        requireNameConfirmation
      />
    </>
  );
}

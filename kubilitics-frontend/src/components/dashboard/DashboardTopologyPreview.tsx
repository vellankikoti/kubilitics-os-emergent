/**
 * System Map Preview — compact topology for dashboard. View full map → /topology.
 */
import { useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Map, Loader2 } from 'lucide-react';
import { useClusterStore } from '@/stores/clusterStore';
import { useBackendConfigStore } from '@/stores/backendConfigStore';
import { useTopologyFromBackend } from '@/hooks/useTopologyFromBackend';
import { TopologyCanvas } from '@/features/topology';
import { filterTopologyForPreview, DASHBOARD_TOPOLOGY_KINDS } from './topologyPreviewUtils';
import type { TopologyGraph, KubernetesKind, HealthStatus, RelationshipType } from '@/types/topology';
import { cn } from '@/lib/utils';

const PREVIEW_RELATIONSHIPS: RelationshipType[] = [
  'owns',
  'selects',
  'schedules',
  'routes',
  'configures',
  'mounts',
  'stores',
  'contains',
];
const PREVIEW_HEALTH: (HealthStatus | 'pending')[] = ['healthy', 'warning', 'critical', 'unknown'];

const emptyGraph: TopologyGraph = {
  schemaVersion: '1.0',
  nodes: [],
  edges: [],
  metadata: {
    clusterId: '',
    generatedAt: '',
    layoutSeed: '',
    isComplete: true,
    warnings: [],
  },
};

export function DashboardTopologyPreview() {
  const { activeCluster } = useClusterStore();
  const isBackendConfigured = useBackendConfigStore((s) => s.isBackendConfigured());
  const currentClusterId = useBackendConfigStore((s) => s.currentClusterId);
  const clusterId = activeCluster?.id ?? currentClusterId;
  const topologyQuery = useTopologyFromBackend(
    isBackendConfigured && clusterId ? clusterId : null
  );
  const canvasRef = useRef<React.ComponentRef<typeof TopologyCanvas>>(null);

  const graph = useMemo(() => {
    const raw = topologyQuery.data;
    if (!raw || !raw.nodes?.length) return emptyGraph;
    return filterTopologyForPreview(raw);
  }, [topologyQuery.data]);

  const selectedResources = useMemo(
    () => new Set<KubernetesKind>(DASHBOARD_TOPOLOGY_KINDS),
    []
  );
  const selectedRelationships = useMemo(
    () => new Set<RelationshipType>(PREVIEW_RELATIONSHIPS),
    []
  );
  const selectedHealth = useMemo(
    () => new Set<HealthStatus | 'pending'>(PREVIEW_HEALTH),
    []
  );

  const isEmpty = !graph.nodes.length;

  return (
    <section
      className={cn(
        'rounded-xl border border-border/50 bg-card/30 overflow-hidden',
        'flex flex-col min-h-[320px]'
      )}
      aria-label="System map preview"
    >
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
        <h2 className="text-sm font-medium text-foreground">System map</h2>
        <Link
          to="/topology"
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          <Map className="h-3.5 w-3.5" />
          View full map
        </Link>
      </div>
      <div className="flex-1 min-h-[280px] relative">
        {topologyQuery.isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : isEmpty ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            No topology data. Connect backend and ensure cluster has resources.
          </div>
        ) : (
          <TopologyCanvas
            ref={canvasRef}
            graph={graph}
            selectedResources={selectedResources}
            selectedRelationships={selectedRelationships}
            selectedHealth={selectedHealth}
            searchQuery=""
            layoutDirection="TB"
            className="h-full w-full min-h-[280px]"
          />
        )}
      </div>
    </section>
  );
}

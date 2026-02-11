import { useMemo, useState, useEffect, useRef } from 'react';
import { useK8sResourceList } from './useKubernetes';
import { useClusterStore } from '@/stores/clusterStore';
import type { TopologyNode, TopologyEdge } from '@/types/topology';

export function useClusterTopology() {
    const { activeCluster } = useClusterStore();
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const hasAutoExpanded = useRef(false);

    // Fetch Nodes
    const { data: nodesList, isLoading: nodesLoading } = useK8sResourceList(
        'nodes',
        undefined,
        { enabled: !!activeCluster }
    );

    // Fetch Pods (Cluster-wide) - Optimization: Only fetch if a node is expanded? 
    // For now, let's fetch all pods but maybe limit? Or fetch per node?
    // Fetching all pods might be heavy for large clusters. 
    // But for the visualization we likely need them. 
    // Let's rely on standard list for now, maybe we can filter by fieldSelector if API supports it later.
    const { data: podsList, isLoading: podsLoading } = useK8sResourceList(
        'pods',
        undefined,
        { enabled: !!activeCluster }
    );

    const toggleNodeExpansion = (nodeId: string) => {
        setExpandedNodes(prev => {
            const next = new Set(prev);
            if (next.has(nodeId)) next.delete(nodeId);
            else next.add(nodeId);
            return next;
        });
    };

    // Auto-expand first node once so pods are visible immediately (nested topology is obvious)
    useEffect(() => {
        if (!nodesList?.items?.length || hasAutoExpanded.current) return;
        hasAutoExpanded.current = true;
        const firstName = (nodesList.items[0] as any).metadata?.name;
        if (firstName) setExpandedNodes(new Set([`node-${firstName}`]));
    }, [nodesList?.items]);

    const { nodes, edges } = useMemo(() => {
        if (!activeCluster) return { nodes: [], edges: [] };

        const graphNodes: TopologyNode[] = [];
        const graphEdges: TopologyEdge[] = [];
        const nodeItems = Array.isArray(nodesList?.items) ? nodesList.items : [];
        const podItems = Array.isArray(podsList?.items) ? podsList.items : [];

        // 1. Cluster Node (Center)
        const clusterNodeId = `cluster-${activeCluster.id}`;
        const defaultMetadata = { labels: {}, annotations: {}, createdAt: '', uid: '' };
        graphNodes.push({
            id: clusterNodeId,
            kind: 'Cluster',
            name: activeCluster.name,
            namespace: '',
            apiVersion: 'v1',
            status: 'Ready',
            metadata: defaultMetadata,
            computed: { health: 'healthy' },
        });

        // 2. Worker Nodes (defensive: skip entries without metadata.name)
        nodeItems.forEach((node: any) => {
            const nodeName = node?.metadata?.name;
            if (!nodeName) return;
            const nodeId = `node-${nodeName}`;
            const isReady =
                node?.status?.conditions?.find((c: any) => c?.type === 'Ready')?.status === 'True';

            graphNodes.push({
                id: nodeId,
                kind: 'Node',
                name: nodeName,
                namespace: '',
                apiVersion: 'v1',
                status: isReady ? 'Ready' : 'NotReady',
                metadata: defaultMetadata,
                computed: { health: isReady ? 'healthy' : 'critical' },
            });

            graphEdges.push({
                id: `edge-${clusterNodeId}-${nodeId}`,
                source: clusterNodeId,
                target: nodeId,
                relationshipType: 'owns',
                label: 'Manages',
                metadata: { derivation: 'ownerReference', confidence: 1, sourceField: 'cluster' },
            });

            // 3. Pods (if node is expanded): safe filter by spec.nodeName and metadata
            if (expandedNodes.has(nodeId)) {
                podItems.forEach((pod: any) => {
                    if (pod?.spec?.nodeName !== nodeName) return;
                    const podName = pod?.metadata?.name;
                    const podNamespace = pod?.metadata?.namespace ?? '';
                    if (!podName) return;
                    const podId = `pod-${podNamespace}-${podName}`;
                    const phase = pod?.status?.phase ?? 'Unknown';
                    const isRunning = phase === 'Running';

                    graphNodes.push({
                        id: podId,
                        kind: 'Pod',
                        name: podName,
                        namespace: podNamespace,
                        apiVersion: 'v1',
                        status: phase,
                        metadata: defaultMetadata,
                        computed: {
                            health: isRunning
                                ? 'healthy'
                                : phase === 'Pending'
                                  ? 'warning'
                                  : 'critical',
                        },
                    });

                    graphEdges.push({
                        id: `edge-${nodeId}-${podId}`,
                        source: nodeId,
                        target: podId,
                        relationshipType: 'schedules',
                        label: 'Runs',
                        metadata: { derivation: 'fieldReference', confidence: 1, sourceField: 'spec.nodeName' },
                    });
                });
            }
        });

        return { nodes: graphNodes, edges: graphEdges };
    }, [activeCluster, nodesList, podsList, expandedNodes]);

    return {
        nodes,
        edges,
        isLoading: nodesLoading || podsLoading,
        expandedNodes,
        toggleNodeExpansion
    };
}

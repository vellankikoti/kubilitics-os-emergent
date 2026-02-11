/**
 * Node Topology Hook
 * Builds topology for a specific node: Node + Pods on that node + their owners, ConfigMaps, Secrets, PVCs, PVs.
 * Same logic as NodeDetail topology tab.
 */
import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useK8sResourceList } from './useKubernetes';
import { useBackendConfigStore, getEffectiveBackendBaseUrl } from '@/stores/backendConfigStore';
import { useActiveClusterId } from './useActiveClusterId';
import { getResource } from '@/services/backendApiClient';
import type { TopologyNode, TopologyEdge } from '@/components/resources/D3ForceTopology';
import type { KubernetesResource } from './useKubernetes';

export function useNodeTopology(nodeName: string | undefined) {
  const clusterId = useActiveClusterId();
  const storedUrl = useBackendConfigStore((s) => s.backendBaseUrl);
  const isBackendConfigured = useBackendConfigStore((s) => s.isBackendConfigured);
  const backendBaseUrl = getEffectiveBackendBaseUrl(storedUrl);

  const podsOnNodeQuery = useK8sResourceList<KubernetesResource>('pods', undefined, {
    fieldSelector: nodeName ? `spec.nodeName=${nodeName}` : '',
    enabled: !!nodeName && !!clusterId,
    limit: 500,
  });

  const runningPodsRaw = (podsOnNodeQuery.data?.items ?? []) as KubernetesResource[];

  const pvcKeys = useMemo(() => {
    const set = new Set<string>();
    (runningPodsRaw as Array<{ metadata?: { namespace?: string }; spec?: { volumes?: Array<{ persistentVolumeClaim?: { claimName?: string } }> } }>).forEach((pod) => {
      const podNs = pod.metadata?.namespace ?? 'default';
      pod.spec?.volumes?.forEach((vol) => {
        if (vol.persistentVolumeClaim?.claimName) set.add(`${podNs}/${vol.persistentVolumeClaim.claimName}`);
      });
    });
    return Array.from(set).map((key) => {
      const [ns, n] = key.split('/');
      return { ns, name: n };
    });
  }, [runningPodsRaw]);

  const pvcQueries = useQueries({
    queries: pvcKeys.map(({ ns, name }) => ({
      queryKey: ['pvc-detail', clusterId, ns, name],
      queryFn: () => getResource(backendBaseUrl, clusterId!, 'persistentvolumeclaims', ns, name) as Promise<{ spec?: { volumeName?: string } }>,
      enabled: !!(isBackendConfigured() && clusterId && name),
      staleTime: 60_000,
    })),
  });

  const pvcVolumeNames = useMemo(() => {
    const m: Record<string, string> = {};
    pvcQueries.forEach((q, i) => {
      if (q.data?.spec?.volumeName && pvcKeys[i]) m[`${pvcKeys[i].ns}/${pvcKeys[i].name}`] = q.data.spec.volumeName;
    });
    return m;
  }, [pvcQueries, pvcKeys]);

  const replicasetKeys = useMemo(() => {
    const set = new Set<string>();
    (runningPodsRaw as Array<{
      metadata?: { namespace?: string; ownerReferences?: Array<{ kind?: string; name?: string }> };
    }>).forEach((pod) => {
      const podNs = pod.metadata?.namespace ?? 'default';
      pod.metadata?.ownerReferences?.forEach((ref) => {
        if ((ref.kind ?? '').toLowerCase() === 'replicaset' && ref.name) {
          set.add(`${podNs}/${ref.name}`);
        }
      });
    });
    return Array.from(set).map((key) => {
      const [ns, n] = key.split('/');
      return { ns, name: n };
    });
  }, [runningPodsRaw]);

  const replicasetQueries = useQueries({
    queries: replicasetKeys.map(({ ns, name }) => ({
      queryKey: ['replicaset-owner', clusterId, ns, name],
      queryFn: () => getResource(backendBaseUrl, clusterId!, 'replicasets', ns, name) as Promise<{
        metadata?: { ownerReferences?: Array<{ kind?: string; name?: string }> };
      }>,
      enabled: !!(isBackendConfigured() && clusterId && name),
      staleTime: 60_000,
    })),
  });

  const replicasetToDeployment = useMemo(() => {
    const m = new Map<string, { ns: string; name: string }>();
    replicasetQueries.forEach((q, i) => {
      const rs = q.data;
      const key = replicasetKeys[i];
      if (!key || !rs?.metadata?.ownerReferences) return;
      const depRef = rs.metadata.ownerReferences.find((r) => (r.kind ?? '').toLowerCase() === 'deployment');
      if (depRef?.name) {
        m.set(`${key.ns}/${key.name}`, { ns: key.ns, name: depRef.name });
      }
    });
    return m;
  }, [replicasetQueries, replicasetKeys]);

  const { nodes, edges } = useMemo(() => {
    if (!nodeName) return { nodes: [], edges: [] };

    const nodeId = 'node';
    const graphNodes: TopologyNode[] = [{ id: nodeId, type: 'node', name: nodeName, status: 'healthy', isCurrent: true }];
    const graphEdges: TopologyEdge[] = [];
    const seenNodeIds = new Set<string>([nodeId]);

    const kindToType = (k: string): TopologyNode['type'] => {
      const kind = (k || '').toLowerCase();
      if (kind === 'deployment') return 'deployment';
      if (kind === 'replicaset') return 'replicaset';
      if (kind === 'statefulset') return 'statefulset';
      if (kind === 'daemonset') return 'daemonset';
      if (kind === 'job') return 'job';
      if (kind === 'cronjob') return 'cronjob';
      return 'pod';
    };

    const addNode = (id: string, type: TopologyNode['type'], resourceName: string, ns?: string) => {
      if (seenNodeIds.has(id)) return;
      seenNodeIds.add(id);
      graphNodes.push({ id, type, name: resourceName, namespace: ns, status: 'healthy' });
    };

    type PodRaw = {
      metadata?: { name?: string; namespace?: string; ownerReferences?: Array<{ kind?: string; name?: string }> };
      spec?: {
        serviceAccountName?: string;
        volumes?: Array<{ configMap?: { name?: string }; secret?: { secretName?: string }; persistentVolumeClaim?: { claimName?: string } }>;
        containers?: Array<{
          envFrom?: Array<{ configMapRef?: { name?: string }; secretRef?: { name?: string } }>;
          env?: Array<{ valueFrom?: { configMapKeyRef?: { name?: string }; secretKeyRef?: { name?: string } } }>;
        }>;
      };
    };

    (runningPodsRaw as PodRaw[]).forEach((pod) => {
      const podName = pod.metadata?.name ?? '';
      const podNs = pod.metadata?.namespace ?? 'default';
      const podId = `pod:${podNs}/${podName}`;
      addNode(podId, 'pod', podName, podNs);
      graphEdges.push({ from: podId, to: nodeId, label: 'Runs On' });

      const nsId = `namespace:${podNs}`;
      addNode(nsId, 'namespace', podNs, podNs);
      graphEdges.push({ from: podId, to: nsId, label: 'In Namespace' });

      const saName = pod.spec?.serviceAccountName ?? 'default';
      const saId = `serviceaccount:${podNs}/${saName}`;
      addNode(saId, 'serviceaccount', saName, podNs);
      graphEdges.push({ from: podId, to: saId, label: 'Uses' });

      pod.metadata?.ownerReferences?.forEach((ref) => {
        const ownerKind = ref.kind ?? '';
        const ownerName = ref.name ?? '';
        if (!ownerName) return;
        const ownerType = kindToType(ownerKind);
        const ownerId = `owner:${ownerType}:${podNs}/${ownerName}`;
        addNode(ownerId, ownerType, ownerName, podNs);
        graphEdges.push({ from: podId, to: ownerId, label: 'Managed By' });
      });

      const refsFromVolumes = (vol: { configMap?: { name?: string }; secret?: { secretName?: string }; persistentVolumeClaim?: { claimName?: string } }) => {
        if (vol.configMap?.name) {
          const id = `configmap:${podNs}/${vol.configMap.name}`;
          addNode(id, 'configmap', vol.configMap.name, podNs);
          graphEdges.push({ from: podId, to: id, label: 'Uses' });
        }
        if (vol.secret?.secretName) {
          const id = `secret:${podNs}/${vol.secret.secretName}`;
          addNode(id, 'secret', vol.secret.secretName, podNs);
          graphEdges.push({ from: podId, to: id, label: 'Uses' });
        }
        if (vol.persistentVolumeClaim?.claimName) {
          const id = `pvc:${podNs}/${vol.persistentVolumeClaim.claimName}`;
          addNode(id, 'pvc', vol.persistentVolumeClaim.claimName, podNs);
          graphEdges.push({ from: podId, to: id, label: 'Uses' });
          const pvName = pvcVolumeNames[`${podNs}/${vol.persistentVolumeClaim.claimName}`];
          if (pvName) {
            const pvId = `pv:${pvName}`;
            addNode(pvId, 'pv', pvName, undefined);
            graphEdges.push({ from: id, to: pvId, label: 'Bound To' });
          }
        }
      };

      pod.spec?.volumes?.forEach(refsFromVolumes);

      pod.spec?.containers?.forEach((container) => {
        container.envFrom?.forEach((e) => {
          if (e.configMapRef?.name) {
            const id = `configmap:${podNs}/${e.configMapRef.name}`;
            addNode(id, 'configmap', e.configMapRef.name, podNs);
            graphEdges.push({ from: podId, to: id, label: 'Uses' });
          }
          if (e.secretRef?.name) {
            const id = `secret:${podNs}/${e.secretRef.name}`;
            addNode(id, 'secret', e.secretRef.name, podNs);
            graphEdges.push({ from: podId, to: id, label: 'Uses' });
          }
        });
        container.env?.forEach((e) => {
          const cmName = e.valueFrom?.configMapKeyRef?.name;
          const secretName = e.valueFrom?.secretKeyRef?.name;
          if (cmName) {
            const id = `configmap:${podNs}/${cmName}`;
            addNode(id, 'configmap', cmName, podNs);
            graphEdges.push({ from: podId, to: id, label: 'Uses' });
          }
          if (secretName) {
            const id = `secret:${podNs}/${secretName}`;
            addNode(id, 'secret', secretName, podNs);
            graphEdges.push({ from: podId, to: id, label: 'Uses' });
          }
        });
      });
    });

    replicasetToDeployment.forEach((dep, rsKey) => {
      const depId = `deployment:${dep.ns}/${dep.name}`;
      if (seenNodeIds.has(depId)) return;
      seenNodeIds.add(depId);
      graphNodes.push({ id: depId, type: 'deployment', name: dep.name, namespace: dep.ns, status: 'healthy' });
      const rsId = `owner:replicaset:${rsKey}`;
      if (seenNodeIds.has(rsId)) {
        graphEdges.push({ from: rsId, to: depId, label: 'Managed By' });
      }
    });

    return { nodes: graphNodes, edges: graphEdges };
  }, [nodeName, runningPodsRaw, pvcVolumeNames, replicasetToDeployment]);

  const isLoading = podsOnNodeQuery.isLoading;

  return { nodes, edges, isLoading };
}

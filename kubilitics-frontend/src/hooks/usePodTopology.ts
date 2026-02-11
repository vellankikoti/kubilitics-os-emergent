/**
 * Builds a pod-scoped topology graph: pod, owner (e.g. ReplicaSet), Deployment (from RS),
 * node, services, endpoints, endpointslice, ingress, configmaps, secrets, PVCs, PVs,
 * StorageClass, ServiceAccount, HPA, PDB, NetworkPolicy. Uses existing list/get APIs (backend when configured).
 */
import { useMemo } from 'react';
import { useK8sResource, useK8sResourceList, type KubernetesResource } from './useKubernetes';
import type { TopologyNode, TopologyEdge } from '@/components/resources/D3ForceTopology';

type ResourceType = import('@/components/resources/D3ForceTopology').ResourceType;

const KIND_TO_API_TYPE: Record<string, 'replicasets' | 'deployments' | 'daemonsets' | 'statefulsets' | 'jobs' | 'cronjobs'> = {
  replicaset: 'replicasets',
  deployment: 'deployments',
  daemonset: 'daemonsets',
  statefulset: 'statefulsets',
  job: 'jobs',
  cronjob: 'cronjobs',
  replicationcontroller: 'replicasets',
};

function matchLabels(selector: Record<string, string> | undefined, labels: Record<string, string> | undefined): boolean {
  if (!selector || !labels) return false;
  return Object.entries(selector).every(([k, v]) => labels[k] === v);
}

function kindToType(kind: string): ResourceType {
  const k = kind.toLowerCase();
  if (k === 'replicaset') return 'replicaset';
  if (k === 'deployment') return 'deployment';
  if (k === 'daemonset') return 'daemonset';
  if (k === 'statefulset') return 'statefulset';
  if (k === 'job') return 'job';
  if (k === 'cronjob') return 'cronjob';
  if (k === 'replicationcontroller') return 'replicaset';
  return 'pod';
}

function nodeId(type: ResourceType, namespace: string | undefined, name: string): string {
  if (type === 'node') return name;
  return namespace ? `${type}/${namespace}/${name}` : `${type}/${name}`;
}

function selectorMatchesLabels(selector: Record<string, string> | undefined, labels: Record<string, string> | undefined): boolean {
  if (!selector || !labels) return false;
  return Object.entries(selector).every(([k, v]) => labels[k] === v);
}

type PodVolume = { configMap?: { name: string }; secret?: { secretName: string }; persistentVolumeClaim?: { claimName: string } };
type PodSpecWithVolumes = { spec?: { volumes?: PodVolume[] } };

export function usePodTopology(podName: string | undefined, namespace: string | undefined) {
  const { data: pod, isLoading: podLoading } = useK8sResource<KubernetesResource>(
    'pods',
    podName || '',
    namespace,
    { enabled: !!podName && !!namespace }
  );

  const ownerRef = pod?.metadata?.ownerReferences?.[0];
  const ownerKind = ownerRef?.kind;
  const ownerName = ownerRef?.name;
  const nodeName = (pod as { spec?: { nodeName?: string } })?.spec?.nodeName;
  const podLabels = pod?.metadata?.labels ?? {};
  const volumes: PodVolume[] = (pod as PodSpecWithVolumes)?.spec?.volumes ?? [];

  const configMapNames = useMemo(() => volumes.filter((v) => v.configMap?.name).map((v) => v.configMap!.name), [volumes]);
  const secretNames = useMemo(() => volumes.filter((v) => v.secret?.secretName).map((v) => v.secret!.secretName), [volumes]);
  const pvcNames = useMemo(() => volumes.filter((v) => v.persistentVolumeClaim?.claimName).map((v) => v.persistentVolumeClaim!.claimName), [volumes]);

  const ownerApiType = ownerKind ? (KIND_TO_API_TYPE[ownerKind.toLowerCase()] ?? 'replicasets') : 'replicasets';
  const { data: ownerResource } = useK8sResource<KubernetesResource>(
    ownerApiType,
    ownerName || '',
    namespace,
    { enabled: !!ownerName && !!namespace && !!pod }
  );

  const { data: node } = useK8sResource<KubernetesResource>(
    'nodes',
    nodeName || '',
    undefined,
    { enabled: !!nodeName && !!pod }
  );

  const { data: servicesData } = useK8sResourceList<KubernetesResource & { spec?: { selector?: Record<string, string> } }>(
    'services',
    namespace,
    { enabled: !!namespace && !!pod }
  );

  const { data: configmapsData } = useK8sResourceList<KubernetesResource>(
    'configmaps',
    namespace,
    { enabled: !!namespace && !!pod && configMapNames.length > 0 }
  );

  const { data: secretsData } = useK8sResourceList<KubernetesResource>(
    'secrets',
    namespace,
    { enabled: !!namespace && !!pod && secretNames.length > 0 }
  );

  const { data: pvcsData } = useK8sResourceList<KubernetesResource>(
    'persistentvolumeclaims',
    namespace,
    { enabled: !!namespace && !!pod && pvcNames.length > 0 }
  );

  const deploymentOwnerRef = useMemo(() => {
    if (ownerKind?.toLowerCase() !== 'replicaset' || !ownerResource?.metadata?.ownerReferences?.length) return null;
    const ref = ownerResource.metadata!.ownerReferences!.find((r: { kind?: string }) => r.kind?.toLowerCase() === 'deployment');
    return ref as { name: string } | undefined;
  }, [ownerKind, ownerResource?.metadata?.ownerReferences]);
  const deploymentName = deploymentOwnerRef?.name;

  const { data: deploymentResource } = useK8sResource<KubernetesResource>(
    'deployments',
    deploymentName || '',
    namespace,
    { enabled: !!deploymentName && !!namespace && !!pod }
  );

  const serviceAccountName = (pod as { spec?: { serviceAccountName?: string } })?.spec?.serviceAccountName || 'default';
  const { data: serviceAccountResource } = useK8sResource<KubernetesResource>(
    'serviceaccounts',
    serviceAccountName,
    namespace,
    { enabled: !!namespace && !!pod }
  );

  const { data: endpointsData } = useK8sResourceList<KubernetesResource>(
    'endpoints',
    namespace,
    { enabled: !!namespace && !!pod }
  );

  const { data: endpointSlicesData } = useK8sResourceList<KubernetesResource & { metadata?: { labels?: Record<string, string> } }>(
    'endpointslices',
    namespace,
    { enabled: !!namespace && !!pod }
  );

  const { data: ingressesData } = useK8sResourceList<KubernetesResource & { spec?: { rules?: Array<{ http?: { paths?: Array<{ backend?: { service?: { name?: string } } }> } }> } }>(
    'ingresses',
    namespace,
    { enabled: !!namespace && !!pod }
  );

  const { data: hpasData } = useK8sResourceList<KubernetesResource & { spec?: { scaleTargetRef?: { kind?: string; name?: string } } }>(
    'horizontalpodautoscalers',
    namespace,
    { enabled: !!namespace && !!pod }
  );

  const { data: pdbsData } = useK8sResourceList<KubernetesResource & { spec?: { selector?: { matchLabels?: Record<string, string> } } }>(
    'poddisruptionbudgets',
    namespace,
    { enabled: !!namespace && !!pod }
  );

  const { data: networkPoliciesData } = useK8sResourceList<KubernetesResource & { spec?: { podSelector?: { matchLabels?: Record<string, string> } } }>(
    'networkpolicies',
    namespace,
    { enabled: !!namespace && !!pod }
  );

  const { data: pvsData } = useK8sResourceList<KubernetesResource>(
    'persistentvolumes',
    undefined,
    { enabled: !!pod && (pvcsData?.items?.length ?? 0) > 0 }
  );

  const { data: storageClassesData } = useK8sResourceList<KubernetesResource>(
    'storageclasses',
    undefined,
    { enabled: !!pod && (pvcsData?.items?.length ?? 0) > 0 }
  );

  const { nodes, edges } = useMemo(() => {
    const ns = namespace ?? (pod?.metadata?.namespace as string) ?? '';
    const nodesList: TopologyNode[] = [];
    const edgesList: TopologyEdge[] = [];
    const ownerType = kindToType(ownerKind || 'ReplicaSet');

    if (!pod?.metadata?.name) return { nodes: nodesList, edges: edgesList };

    const podId = nodeId('pod', ns, pod.metadata.name);
    nodesList.push({
      id: podId,
      type: 'pod',
      name: pod.metadata.name,
      namespace: ns,
      status: (pod as { status?: { phase?: string } })?.status?.phase === 'Running' ? 'healthy' : 'pending',
      isCurrent: true,
    });

    if (ownerResource?.metadata?.name) {
      const ownerId = nodeId(ownerType, ns, ownerResource.metadata.name);
      nodesList.push({
        id: ownerId,
        type: ownerType,
        name: ownerResource.metadata.name,
        namespace: ns,
        status: 'healthy',
      });
      edgesList.push({ from: ownerId, to: podId, label: 'Manages' });

      if (deploymentResource?.metadata?.name && ownerType === 'replicaset') {
        const depId = nodeId('deployment', ns, deploymentResource.metadata.name);
        if (!nodesList.some((n) => n.id === depId)) {
          nodesList.push({
            id: depId,
            type: 'deployment',
            name: deploymentResource.metadata.name,
            namespace: ns,
            status: 'healthy',
          });
          edgesList.push({ from: depId, to: ownerId, label: 'Manages' });
        }
      }
    }

    if (serviceAccountResource?.metadata?.name) {
      const saId = nodeId('serviceaccount', ns, serviceAccountResource.metadata.name);
      if (!nodesList.some((n) => n.id === saId)) {
        nodesList.push({
          id: saId,
          type: 'serviceaccount',
          name: serviceAccountResource.metadata.name,
          namespace: ns,
          status: 'healthy',
        });
        edgesList.push({ from: podId, to: saId, label: 'Uses' });
      }
    }

    if (node?.metadata?.name) {
      const nodeIdStr = nodeId('node', undefined, node.metadata.name);
      nodesList.push({
        id: nodeIdStr,
        type: 'node',
        name: node.metadata.name,
        status: 'healthy',
      });
      edgesList.push({ from: podId, to: nodeIdStr, label: 'Runs on' });
    }

    const nsId = nodeId('namespace', ns, ns);
    if (!nodesList.some((n) => n.id === nsId)) {
      nodesList.push({
        id: nsId,
        type: 'namespace',
        name: ns,
        namespace: ns,
        status: 'healthy',
      });
      edgesList.push({ from: podId, to: nsId, label: 'In Namespace' });
    }

    const services = servicesData?.items ?? [];
    const matchingServices = services.filter(
      (s) => s.spec?.selector && selectorMatchesLabels(s.spec.selector, podLabels)
    );
    for (const svc of matchingServices) {
      const name = svc.metadata?.name;
      if (!name) continue;
      const svcId = nodeId('service', ns, name);
      nodesList.push({
        id: svcId,
        type: 'service',
        name,
        namespace: ns,
        status: 'healthy',
      });
      edgesList.push({ from: svcId, to: podId, label: 'Selects' });
    }

    const configmaps = configmapsData?.items ?? [];
    const matchingConfigMaps = configmaps.filter((c) => c.metadata?.name && configMapNames.includes(c.metadata.name));
    for (const cm of matchingConfigMaps) {
      const name = cm.metadata?.name;
      if (!name) continue;
      const cmId = nodeId('configmap', ns, name);
      nodesList.push({
        id: cmId,
        type: 'configmap',
        name,
        namespace: ns,
        status: 'healthy',
      });
      edgesList.push({ from: podId, to: cmId, label: 'Mounts' });
    }

    const secrets = secretsData?.items ?? [];
    const matchingSecrets = secrets.filter((s) => s.metadata?.name && secretNames.includes(s.metadata.name));
    for (const sec of matchingSecrets) {
      const name = sec.metadata?.name;
      if (!name) continue;
      const secId = nodeId('secret', ns, name);
      nodesList.push({
        id: secId,
        type: 'secret',
        name,
        namespace: ns,
        status: 'healthy',
      });
      edgesList.push({ from: podId, to: secId, label: 'Mounts' });
    }

    const pvcs = pvcsData?.items ?? [];
    const matchingPvcs = pvcs.filter((p) => p.metadata?.name && pvcNames.includes(p.metadata.name));
    const pvsItems = pvsData?.items ?? [];
    const storageClassesItems = storageClassesData?.items ?? [];
    for (const pvc of matchingPvcs) {
      const name = pvc.metadata?.name;
      if (!name) continue;
      const pvcId = nodeId('pvc', ns, name);
      nodesList.push({
        id: pvcId,
        type: 'pvc',
        name,
        namespace: ns,
        status: 'healthy',
      });
      edgesList.push({ from: podId, to: pvcId, label: 'Mounts' });
      const pvcSpec = (pvc as { spec?: { volumeName?: string; storageClassName?: string } }).spec;
      const volumeName = pvcSpec?.volumeName;
      if (volumeName && pvsItems.length > 0) {
        const pv = (pvsItems as K8sResource[]).find((p) => p.metadata?.name === volumeName);
        if (pv?.metadata?.name) {
          const pvId = nodeId('pv', '', pv.metadata.name);
          if (!nodesList.some((n) => n.id === pvId)) {
            nodesList.push({
              id: pvId,
              type: 'pv',
              name: pv.metadata.name,
              namespace: '',
              status: 'healthy',
            });
            edgesList.push({ from: pvcId, to: pvId, label: 'Bound to' });
          }
          const pvStorageClass = (pv as { spec?: { storageClassName?: string } }).spec?.storageClassName;
          if (pvStorageClass && storageClassesItems.length > 0) {
            const sc = (storageClassesItems as K8sResource[]).find((s) => s.metadata?.name === pvStorageClass);
            if (sc?.metadata?.name) {
              const scId = nodeId('storageclass', '', sc.metadata.name);
              if (!nodesList.some((n) => n.id === scId)) {
                nodesList.push({
                  id: scId,
                  type: 'storageclass',
                  name: sc.metadata.name,
                  namespace: '',
                  status: 'healthy',
                });
                edgesList.push({ from: pvId, to: scId, label: 'Uses' });
              }
            }
          }
        }
      }
      const storageClassName = pvcSpec?.storageClassName;
      if (storageClassName && storageClassesItems.length > 0) {
        const sc = (storageClassesItems as K8sResource[]).find((s) => s.metadata?.name === storageClassName);
        if (sc?.metadata?.name) {
          const scId = nodeId('storageclass', '', sc.metadata.name);
          if (!nodesList.some((n) => n.id === scId)) {
            nodesList.push({
              id: scId,
              type: 'storageclass',
              name: sc.metadata.name,
              namespace: '',
              status: 'healthy',
            });
            edgesList.push({ from: pvcId, to: scId, label: 'Uses' });
          }
        }
      }
    }

    const matchingServiceNames = new Set(matchingServices.map((s) => s.metadata?.name).filter(Boolean) as string[]);
    const endpointsItems = endpointsData?.items ?? [];
    for (const ep of endpointsItems as K8sResource[]) {
      const name = ep.metadata?.name;
      if (!name || !matchingServiceNames.has(name)) continue;
      const epId = nodeId('endpoint', ns, name);
      if (nodesList.some((n) => n.id === epId)) continue;
      nodesList.push({
        id: epId,
        type: 'endpoint',
        name,
        namespace: ns,
        status: 'healthy',
      });
      const svcId = nodeId('service', ns, name);
      edgesList.push({ from: svcId, to: epId, label: 'Creates' });
    }
    const endpointSlicesItems = endpointSlicesData?.items ?? [];
    for (const slice of endpointSlicesItems as Array<K8sResource & { metadata?: { labels?: Record<string, string> } }>) {
      const svcName = slice.metadata?.labels?.['kubernetes.io/service-name'];
      if (!svcName || !matchingServiceNames.has(svcName)) continue;
      const name = slice.metadata?.name;
      if (!name) continue;
      const sliceId = nodeId('endpointslice', ns, name);
      if (nodesList.some((n) => n.id === sliceId)) continue;
      nodesList.push({
        id: sliceId,
        type: 'endpointslice',
        name,
        namespace: ns,
        status: 'healthy',
      });
      const svcId = nodeId('service', ns, svcName);
      edgesList.push({ from: svcId, to: sliceId, label: 'Backed by' });
    }
    const ingressesItems = ingressesData?.items ?? [];
    for (const ing of ingressesItems as Array<K8sResource & { spec?: { rules?: Array<{ http?: { paths?: Array<{ backend?: { service?: { name?: string } } }> } }> } }>) {
      const rules = ing.spec?.rules ?? [];
      let linked = false;
      for (const rule of rules) {
        const paths = rule.http?.paths ?? [];
        for (const p of paths) {
          const svcName = p.backend?.service?.name;
          if (svcName && matchingServiceNames.has(svcName)) {
            linked = true;
            break;
          }
        }
        if (linked) break;
      }
      if (!linked) continue;
      const name = ing.metadata?.name;
      if (!name) continue;
      const ingId = nodeId('ingress', ns, name);
      if (nodesList.some((n) => n.id === ingId)) continue;
      nodesList.push({
        id: ingId,
        type: 'ingress',
        name,
        namespace: ns,
        status: 'healthy',
      });
      for (const rule of rules) {
        const paths = rule.http?.paths ?? [];
        for (const p of paths) {
          const svcName = p.backend?.service?.name;
          if (svcName && matchingServiceNames.has(svcName)) {
            const svcId = nodeId('service', ns, svcName);
            edgesList.push({ from: ingId, to: svcId, label: 'Exposes' });
            break;
          }
        }
      }
    }

    const hpasItems = hpasData?.items ?? [];
    for (const hpa of hpasItems as Array<K8sResource & { spec?: { scaleTargetRef?: { kind?: string; name?: string } } }>) {
      const ref = hpa.spec?.scaleTargetRef;
      if (!ref?.name) continue;
      const refKind = (ref.kind ?? '').toLowerCase();
      const targetsDeployment = refKind === 'deployment' && deploymentResource?.metadata?.name === ref.name;
      const targetsReplicaSet = refKind === 'replicaset' && ownerResource?.metadata?.name === ref.name;
      if (!targetsDeployment && !targetsReplicaSet) continue;
      const name = hpa.metadata?.name;
      if (!name) continue;
      const hpaId = nodeId('hpa', ns, name);
      if (nodesList.some((n) => n.id === hpaId)) continue;
      nodesList.push({
        id: hpaId,
        type: 'hpa',
        name,
        namespace: ns,
        status: 'healthy',
      });
      if (targetsDeployment) {
        const depId = nodeId('deployment', ns, deploymentResource!.metadata!.name);
        edgesList.push({ from: hpaId, to: depId, label: 'Scales' });
      } else {
        const ownerId = nodeId(ownerType, ns, ownerResource!.metadata!.name);
        edgesList.push({ from: hpaId, to: ownerId, label: 'Scales' });
      }
    }

    const pdbsItems = pdbsData?.items ?? [];
    for (const pdb of pdbsItems as Array<K8sResource & { spec?: { selector?: { matchLabels?: Record<string, string> } } }>) {
      if (!selectorMatchesLabels(pdb.spec?.selector?.matchLabels, podLabels)) continue;
      const name = pdb.metadata?.name;
      if (!name) continue;
      const pdbId = nodeId('pdb', ns, name);
      if (nodesList.some((n) => n.id === pdbId)) continue;
      nodesList.push({
        id: pdbId,
        type: 'pdb',
        name,
        namespace: ns,
        status: 'healthy',
      });
      edgesList.push({ from: pdbId, to: podId, label: 'Protects' });
    }

    const networkPoliciesItems = networkPoliciesData?.items ?? [];
    for (const np of networkPoliciesItems as Array<K8sResource & { spec?: { podSelector?: { matchLabels?: Record<string, string> } } }>) {
      const selector = np.spec?.podSelector?.matchLabels;
      const matches = !selector || Object.keys(selector).length === 0 || selectorMatchesLabels(selector, podLabels);
      if (!matches) continue;
      const name = np.metadata?.name;
      if (!name) continue;
      const npId = nodeId('networkpolicy', ns, name);
      if (nodesList.some((n) => n.id === npId)) continue;
      nodesList.push({
        id: npId,
        type: 'networkpolicy',
        name,
        namespace: ns,
        status: 'healthy',
      });
      edgesList.push({ from: npId, to: podId, label: 'Restricts' });
    }

    const podStatus = pod as { status?: { podIPs?: Array<{ ip?: string }> } };
    const podIP = podStatus.status?.podIPs?.[0]?.ip;
    if (podIP) {
      const podNode = nodesList.find((n) => n.id === podId);
      if (podNode) podNode.name = `${pod.metadata!.name} (${podIP})`;
    }
    const nodeAddresses = node as { status?: { addresses?: Array<{ type?: string; address?: string }> } };
    const internalIP = nodeAddresses?.status?.addresses?.find((a) => a.type === 'InternalIP')?.address;
    if (internalIP && node?.metadata?.name) {
      const nodeIdStr = nodeId('node', undefined, node.metadata.name);
      const nodeNode = nodesList.find((n) => n.id === nodeIdStr);
      if (nodeNode) nodeNode.name = `${node.metadata.name} (${internalIP})`;
    }

    return { nodes: nodesList, edges: edgesList };
  }, [
    pod,
    namespace,
    ownerResource,
    ownerKind,
    node,
    deploymentResource,
    serviceAccountResource,
    servicesData?.items,
    configmapsData?.items,
    secretsData?.items,
    pvcsData?.items,
    pvsData?.items,
    storageClassesData?.items,
    endpointsData?.items,
    endpointSlicesData?.items,
    ingressesData?.items,
    hpasData?.items,
    pdbsData?.items,
    networkPoliciesData?.items,
    configMapNames,
    secretNames,
    pvcNames,
    podLabels,
  ]);

  const isLoading = podLoading;
  return { nodes, edges, isLoading };
}

/**
 * Cluster Topology Graph Builder
 * Constructs comprehensive topology graph from Kubernetes resources
 * Similar to NodeDetail topology but for entire cluster
 */
import { useMemo } from 'react';
import { useK8sResourceList } from './useKubernetes';
import { useClusterStore } from '@/stores/clusterStore';
import type { TopologyNode, TopologyEdge } from '@/types/topology';

interface TopologyGraphResult {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Builds cluster topology graph from Kubernetes resources
 * @param namespace Optional namespace filter (undefined = all namespaces)
 */
export function useClusterTopologyGraph(namespace?: string): TopologyGraphResult {
  const { activeCluster } = useClusterStore();

  // Fetch all resource types
  const { data: nodesList, isLoading: nodesLoading } = useK8sResourceList('nodes', undefined, { enabled: !!activeCluster });
  const { data: namespacesList, isLoading: namespacesLoading } = useK8sResourceList('namespaces', undefined, { enabled: !!activeCluster });
  const { data: podsList, isLoading: podsLoading } = useK8sResourceList('pods', namespace, { enabled: !!activeCluster });
  const { data: deploymentsList, isLoading: deploymentsLoading } = useK8sResourceList('deployments', namespace, { enabled: !!activeCluster });
  const { data: replicasetsList, isLoading: replicasetsLoading } = useK8sResourceList('replicasets', namespace, { enabled: !!activeCluster });
  const { data: statefulsetsList, isLoading: statefulsetsLoading } = useK8sResourceList('statefulsets', namespace, { enabled: !!activeCluster });
  const { data: daemonsetsList, isLoading: daemonsetsLoading } = useK8sResourceList('daemonsets', namespace, { enabled: !!activeCluster });
  const { data: jobsList, isLoading: jobsLoading } = useK8sResourceList('jobs', namespace, { enabled: !!activeCluster });
  const { data: cronjobsList, isLoading: cronjobsLoading } = useK8sResourceList('cronjobs', namespace, { enabled: !!activeCluster });
  const { data: servicesList, isLoading: servicesLoading } = useK8sResourceList('services', namespace, { enabled: !!activeCluster });
  const { data: ingressesList, isLoading: ingressesLoading } = useK8sResourceList('ingresses', namespace, { enabled: !!activeCluster });
  const { data: configmapsList, isLoading: configmapsLoading } = useK8sResourceList('configmaps', namespace, { enabled: !!activeCluster });
  const { data: secretsList, isLoading: secretsLoading } = useK8sResourceList('secrets', namespace, { enabled: !!activeCluster });
  const { data: pvcsList, isLoading: pvcsLoading } = useK8sResourceList('persistentvolumeclaims', namespace, { enabled: !!activeCluster });
  const { data: pvsList, isLoading: pvsLoading } = useK8sResourceList('persistentvolumes', undefined, { enabled: !!activeCluster });
  const { data: storageclassesList, isLoading: storageclassesLoading } = useK8sResourceList('storageclasses', undefined, { enabled: !!activeCluster });
  const { data: ingressclassesList, isLoading: ingressclassesLoading } = useK8sResourceList('ingressclasses', undefined, { enabled: !!activeCluster });
  const { data: serviceaccountsList, isLoading: serviceaccountsLoading } = useK8sResourceList('serviceaccounts', namespace, { enabled: !!activeCluster });

  const isLoading = nodesLoading || namespacesLoading || podsLoading || deploymentsLoading || 
    replicasetsLoading || statefulsetsLoading || daemonsetsLoading || jobsLoading || 
    cronjobsLoading || servicesLoading || ingressesLoading || configmapsLoading || 
    secretsLoading || pvcsLoading || pvsLoading || storageclassesLoading || ingressclassesLoading || serviceaccountsLoading;

  const { nodes, edges } = useMemo(() => {
    if (!activeCluster) return { nodes: [], edges: [] };

    const graphNodes: TopologyNode[] = [];
    const graphEdges: TopologyEdge[] = [];
    const seenNodeIds = new Set<string>();

    const defaultMetadata = { labels: {}, annotations: {}, createdAt: '', uid: '' };

    // Helper to add node if not seen
    const addNode = (
      id: string,
      kind: TopologyNode['kind'],
      name: string,
      namespace: string = '',
      status: TopologyNode['status'] = 'Running',
      health: TopologyNode['computed']['health'] = 'healthy',
      metadata: TopologyNode['metadata'] = defaultMetadata,
      computed?: Partial<TopologyNode['computed']>
    ) => {
      if (seenNodeIds.has(id)) return id;
      seenNodeIds.add(id);
      graphNodes.push({
        id,
        kind,
        name,
        namespace,
        apiVersion: 'v1',
        status,
        metadata,
        computed: { health, ...computed },
      });
      return id;
    };

    // Helper to add edge
    const addEdge = (source: string, target: string, relationshipType: TopologyEdge['relationshipType'], label: string) => {
      if (!seenNodeIds.has(source) || !seenNodeIds.has(target)) return;
      graphEdges.push({
        id: `edge-${source}-${target}-${relationshipType}`,
        source,
        target,
        relationshipType,
        label,
        metadata: { derivation: 'fieldReference', confidence: 1, sourceField: '' },
      });
    };

    // 1. Cluster Node (center) - mark as current/center node
    const clusterNodeId = `Cluster/${activeCluster.id}`;
    addNode(clusterNodeId, 'Cluster', activeCluster.name, '', 'Ready', 'healthy');
    // Mark cluster node with special metadata for layout detection
    const clusterNode = graphNodes.find(n => n.id === clusterNodeId);
    if (clusterNode) {
      (clusterNode as any)._isClusterCenter = true;
    }

    // 2. Cluster-scoped resources (Level 1: Direct children of cluster)
    // These include: Nodes, StorageClasses, PVs, IngressClasses
    
    // 2a. Nodes (Cluster-scoped) - connect directly to cluster
    const nodeIds = new Map<string, string>();
    const nodeToNamespaces = new Map<string, Set<string>>(); // Track which namespaces have pods on each node
    (nodesList?.items || []).forEach((node: any) => {
      const nodeName = node.metadata?.name;
      if (!nodeName) return;
      const nodeId = `Node/${nodeName}`;
      nodeIds.set(nodeName, nodeId);
      const isReady = node.status?.conditions?.find((c: any) => c?.type === 'Ready')?.status === 'True';
      addNode(nodeId, 'Node', nodeName, '', isReady ? 'Ready' : 'NotReady', isReady ? 'healthy' : 'critical', {
        labels: node.metadata?.labels || {},
        annotations: node.metadata?.annotations || {},
        createdAt: node.metadata?.creationTimestamp || '',
        uid: node.metadata?.uid || '',
      });
      // Connect node to cluster (cluster-scoped resource)
      addEdge(clusterNodeId, nodeId, 'owns', 'manages');
      nodeToNamespaces.set(nodeId, new Set());
    });

    // 2b. StorageClasses (Cluster-scoped) - connect directly to cluster
    const storageClassIds = new Map<string, string>();
    (storageclassesList?.items || []).forEach((sc: any) => {
      const scName = sc.metadata?.name;
      if (!scName) return;
      const scId = `StorageClass/${scName}`;
      storageClassIds.set(scName, scId);
      addNode(scId, 'StorageClass', scName, '', 'Running', 'healthy', {
        labels: sc.metadata?.labels || {},
        annotations: sc.metadata?.annotations || {},
        createdAt: sc.metadata?.creationTimestamp || '',
        uid: sc.metadata?.uid || '',
      });
      // Connect StorageClass to cluster (cluster-scoped resource)
      addEdge(clusterNodeId, scId, 'owns', 'contains');
    });

    // 2c. PersistentVolumes (Cluster-scoped) - connect to cluster and StorageClass
    const pvIds = new Map<string, string>();
    (pvsList?.items || []).forEach((pv: any) => {
      const pvName = pv.metadata?.name;
      if (!pvName) return;
      const pvId = `PersistentVolume/${pvName}`;
      pvIds.set(pvName, pvId);
      const phase = pv.status?.phase || 'Available';
      const health = phase === 'Bound' ? 'healthy' : phase === 'Available' ? 'warning' : 'critical';
      addNode(pvId, 'PersistentVolume', pvName, '', phase as TopologyNode['status'], health, {
        labels: pv.metadata?.labels || {},
        annotations: pv.metadata?.annotations || {},
        createdAt: pv.metadata?.creationTimestamp || '',
        uid: pv.metadata?.uid || '',
      });
      // Connect PV to cluster (cluster-scoped resource)
      addEdge(clusterNodeId, pvId, 'owns', 'contains');
      // Also connect PV to StorageClass if applicable
      const scName = pv.spec?.storageClassName;
      if (scName && storageClassIds.has(scName)) {
        addEdge(storageClassIds.get(scName)!, pvId, 'owns', 'provisions');
      }
    });

    // 2d. IngressClasses (Cluster-scoped) - connect directly to cluster
    const ingressClassIds = new Map<string, string>();
    (ingressclassesList?.items || []).forEach((ic: any) => {
      const icName = ic.metadata?.name;
      if (!icName) return;
      const icId = `IngressClass/${icName}`;
      ingressClassIds.set(icName, icId);
      addNode(icId, 'IngressClass', icName, '', 'Running', 'healthy', {
        labels: ic.metadata?.labels || {},
        annotations: ic.metadata?.annotations || {},
        createdAt: ic.metadata?.creationTimestamp || '',
        uid: ic.metadata?.uid || '',
      });
      // Connect IngressClass to cluster (cluster-scoped resource)
      addEdge(clusterNodeId, icId, 'owns', 'contains');
    });

    // 3. Namespaces (Level 2: Under cluster-scoped resources)
    const namespaceIds = new Map<string, string>();
    (namespacesList?.items || []).forEach((ns: any) => {
      const nsName = ns.metadata?.name;
      if (!nsName) return;
      const nsId = `Namespace/${nsName}`;
      namespaceIds.set(nsName, nsId);
      addNode(nsId, 'Namespace', nsName, '', 'Running', 'healthy', {
        labels: ns.metadata?.labels || {},
        annotations: ns.metadata?.annotations || {},
        createdAt: ns.metadata?.creationTimestamp || '',
        uid: ns.metadata?.uid || '',
      });
      // Connect namespace to cluster (it's under cluster-scoped level)
      addEdge(clusterNodeId, nsId, 'owns', 'contains');
    });

    // 6. PersistentVolumeClaims
    const pvcIds = new Map<string, string>();
    (pvcsList?.items || []).forEach((pvc: any) => {
      const pvcName = pvc.metadata?.name;
      const pvcNs = pvc.metadata?.namespace || '';
      if (!pvcName) return;
      const pvcId = `PersistentVolumeClaim/${pvcNs}/${pvcName}`;
      pvcIds.set(`${pvcNs}/${pvcName}`, pvcId);
      const phase = pvc.status?.phase || 'Pending';
      const health = phase === 'Bound' ? 'healthy' : 'warning';
      addNode(pvcId, 'PersistentVolumeClaim', pvcName, pvcNs, phase as TopologyNode['status'], health, {
        labels: pvc.metadata?.labels || {},
        annotations: pvc.metadata?.annotations || {},
        createdAt: pvc.metadata?.creationTimestamp || '',
        uid: pvc.metadata?.uid || '',
      });
      const nsId = namespaceIds.get(pvcNs);
      if (nsId) addEdge(nsId, pvcId, 'contains', 'contains');
      const volumeName = pvc.spec?.volumeName;
      if (volumeName && pvIds.has(volumeName)) {
        addEdge(pvcId, pvIds.get(volumeName)!, 'stores', 'binds');
      }
    });

    // 7. ConfigMaps
    const configMapIds = new Map<string, string>();
    (configmapsList?.items || []).forEach((cm: any) => {
      const cmName = cm.metadata?.name;
      const cmNs = cm.metadata?.namespace || '';
      if (!cmName) return;
      const cmId = `ConfigMap/${cmNs}/${cmName}`;
      configMapIds.set(`${cmNs}/${cmName}`, cmId);
      addNode(cmId, 'ConfigMap', cmName, cmNs, 'Running', 'healthy', {
        labels: cm.metadata?.labels || {},
        annotations: cm.metadata?.annotations || {},
        createdAt: cm.metadata?.creationTimestamp || '',
        uid: cm.metadata?.uid || '',
      });
      const nsId = namespaceIds.get(cmNs);
      if (nsId) addEdge(nsId, cmId, 'contains', 'contains');
    });

    // 8. Secrets
    const secretIds = new Map<string, string>();
    (secretsList?.items || []).forEach((secret: any) => {
      const secretName = secret.metadata?.name;
      const secretNs = secret.metadata?.namespace || '';
      if (!secretName) return;
      const secretId = `Secret/${secretNs}/${secretName}`;
      secretIds.set(`${secretNs}/${secretName}`, secretId);
      addNode(secretId, 'Secret', secretName, secretNs, 'Running', 'healthy', {
        labels: secret.metadata?.labels || {},
        annotations: secret.metadata?.annotations || {},
        createdAt: secret.metadata?.creationTimestamp || '',
        uid: secret.metadata?.uid || '',
      });
      const nsId = namespaceIds.get(secretNs);
      if (nsId) addEdge(nsId, secretId, 'contains', 'contains');
    });

    // 9. ServiceAccounts
    const serviceAccountIds = new Map<string, string>();
    (serviceaccountsList?.items || []).forEach((sa: any) => {
      const saName = sa.metadata?.name;
      const saNs = sa.metadata?.namespace || '';
      if (!saName) return;
      const saId = `ServiceAccount/${saNs}/${saName}`;
      serviceAccountIds.set(`${saNs}/${saName}`, saId);
      addNode(saId, 'ServiceAccount', saName, saNs, 'Running', 'healthy', {
        labels: sa.metadata?.labels || {},
        annotations: sa.metadata?.annotations || {},
        createdAt: sa.metadata?.creationTimestamp || '',
        uid: sa.metadata?.uid || '',
      });
      const nsId = namespaceIds.get(saNs);
      if (nsId) addEdge(nsId, saId, 'contains', 'contains');
    });

    // 10. Deployments
    const deploymentIds = new Map<string, string>();
    (deploymentsList?.items || []).forEach((dep: any) => {
      const depName = dep.metadata?.name;
      const depNs = dep.metadata?.namespace || '';
      if (!depName) return;
      const depId = `Deployment/${depNs}/${depName}`;
      deploymentIds.set(`${depNs}/${depName}`, depId);
      const replicas = dep.spec?.replicas || 0;
      const readyReplicas = dep.status?.readyReplicas || 0;
      const health = readyReplicas === replicas ? 'healthy' : readyReplicas > 0 ? 'warning' : 'critical';
      addNode(depId, 'Deployment', depName, depNs, 'Running', health, {
        labels: dep.metadata?.labels || {},
        annotations: dep.metadata?.annotations || {},
        createdAt: dep.metadata?.creationTimestamp || '',
        uid: dep.metadata?.uid || '',
      }, { replicas: { desired: replicas, ready: readyReplicas, available: readyReplicas } });
      const nsId = namespaceIds.get(depNs);
      if (nsId) addEdge(nsId, depId, 'contains', 'contains');
    });

    // 11. ReplicaSets
    const replicasetIds = new Map<string, string>();
    (replicasetsList?.items || []).forEach((rs: any) => {
      const rsName = rs.metadata?.name;
      const rsNs = rs.metadata?.namespace || '';
      if (!rsName) return;
      const rsId = `ReplicaSet/${rsNs}/${rsName}`;
      replicasetIds.set(`${rsNs}/${rsName}`, rsId);
      const replicas = rs.spec?.replicas || 0;
      const readyReplicas = rs.status?.readyReplicas || 0;
      const health = readyReplicas === replicas ? 'healthy' : readyReplicas > 0 ? 'warning' : 'critical';
      addNode(rsId, 'ReplicaSet', rsName, rsNs, 'Running', health, {
        labels: rs.metadata?.labels || {},
        annotations: rs.metadata?.annotations || {},
        createdAt: rs.metadata?.creationTimestamp || '',
        uid: rs.metadata?.uid || '',
      }, { replicas: { desired: replicas, ready: readyReplicas, available: readyReplicas } });
      const nsId = namespaceIds.get(rsNs);
      if (nsId) addEdge(nsId, rsId, 'contains', 'contains');
      // Link to Deployment if owner reference exists
      rs.metadata?.ownerReferences?.forEach((ref: any) => {
        if (ref.kind === 'Deployment' && ref.name) {
          const depId = `Deployment/${rsNs}/${ref.name}`;
          if (deploymentIds.has(`${rsNs}/${ref.name}`)) {
            addEdge(depId, rsId, 'owns', 'manages');
          }
        }
      });
    });

    // 12. StatefulSets
    const statefulsetIds = new Map<string, string>();
    (statefulsetsList?.items || []).forEach((sts: any) => {
      const stsName = sts.metadata?.name;
      const stsNs = sts.metadata?.namespace || '';
      if (!stsName) return;
      const stsId = `StatefulSet/${stsNs}/${stsName}`;
      statefulsetIds.set(`${stsNs}/${stsName}`, stsId);
      const replicas = sts.spec?.replicas || 0;
      const readyReplicas = sts.status?.readyReplicas || 0;
      const health = readyReplicas === replicas ? 'healthy' : readyReplicas > 0 ? 'warning' : 'critical';
      addNode(stsId, 'StatefulSet', stsName, stsNs, 'Running', health, {
        labels: sts.metadata?.labels || {},
        annotations: sts.metadata?.annotations || {},
        createdAt: sts.metadata?.creationTimestamp || '',
        uid: sts.metadata?.uid || '',
      }, { health, replicas: { desired: replicas, ready: readyReplicas, available: readyReplicas } });
      const nsId = namespaceIds.get(stsNs);
      if (nsId) addEdge(nsId, stsId, 'contains', 'contains');
    });

    // 13. DaemonSets
    const daemonsetIds = new Map<string, string>();
    (daemonsetsList?.items || []).forEach((ds: any) => {
      const dsName = ds.metadata?.name;
      const dsNs = ds.metadata?.namespace || '';
      if (!dsName) return;
      const dsId = `DaemonSet/${dsNs}/${dsName}`;
      daemonsetIds.set(`${dsNs}/${dsName}`, dsId);
      const desiredNumberScheduled = ds.status?.desiredNumberScheduled || 0;
      const numberReady = ds.status?.numberReady || 0;
      const health = numberReady === desiredNumberScheduled ? 'healthy' : numberReady > 0 ? 'warning' : 'critical';
      addNode(dsId, 'DaemonSet', dsName, dsNs, 'Running', health, {
        labels: ds.metadata?.labels || {},
        annotations: ds.metadata?.annotations || {},
        createdAt: ds.metadata?.creationTimestamp || '',
        uid: ds.metadata?.uid || '',
      });
      const nsId = namespaceIds.get(dsNs);
      if (nsId) addEdge(nsId, dsId, 'contains', 'contains');
    });

    // 14. Jobs
    const jobIds = new Map<string, string>();
    (jobsList?.items || []).forEach((job: any) => {
      const jobName = job.metadata?.name;
      const jobNs = job.metadata?.namespace || '';
      if (!jobName) return;
      const jobId = `Job/${jobNs}/${jobName}`;
      jobIds.set(`${jobNs}/${jobName}`, jobId);
      const succeeded = job.status?.succeeded || 0;
      const failed = job.status?.failed || 0;
      const active = job.status?.active || 0;
      const health = succeeded > 0 ? 'healthy' : failed > 0 ? 'critical' : active > 0 ? 'warning' : 'unknown';
      addNode(jobId, 'Job', jobName, jobNs, active > 0 ? 'Running' : succeeded > 0 ? 'Succeeded' : 'Failed', health, {
        labels: job.metadata?.labels || {},
        annotations: job.metadata?.annotations || {},
        createdAt: job.metadata?.creationTimestamp || '',
        uid: job.metadata?.uid || '',
      });
      const nsId = namespaceIds.get(jobNs);
      if (nsId) addEdge(nsId, jobId, 'contains', 'contains');
      // Link to CronJob if owner reference exists
      job.metadata?.ownerReferences?.forEach((ref: any) => {
        if (ref.kind === 'CronJob' && ref.name) {
          const cjId = `CronJob/${jobNs}/${ref.name}`;
          if (seenNodeIds.has(cjId)) {
            addEdge(cjId, jobId, 'owns', 'creates');
          }
        }
      });
    });

    // 15. CronJobs
    (cronjobsList?.items || []).forEach((cj: any) => {
      const cjName = cj.metadata?.name;
      const cjNs = cj.metadata?.namespace || '';
      if (!cjName) return;
      const cjId = `CronJob/${cjNs}/${cjName}`;
      const active = cj.status?.active?.length || 0;
      const lastScheduleTime = cj.status?.lastScheduleTime;
      const health = lastScheduleTime ? 'healthy' : 'warning';
      addNode(cjId, 'CronJob', cjName, cjNs, 'Running', health, {
        labels: cj.metadata?.labels || {},
        annotations: cj.metadata?.annotations || {},
        createdAt: cj.metadata?.creationTimestamp || '',
        uid: cj.metadata?.uid || '',
      });
      const nsId = namespaceIds.get(cjNs);
      if (nsId) addEdge(nsId, cjId, 'contains', 'contains');
    });

    // 16. Services
    const serviceIds = new Map<string, string>();
    (servicesList?.items || []).forEach((svc: any) => {
      const svcName = svc.metadata?.name;
      const svcNs = svc.metadata?.namespace || '';
      if (!svcName) return;
      const svcId = `Service/${svcNs}/${svcName}`;
      serviceIds.set(`${svcNs}/${svcName}`, svcId);
      addNode(svcId, 'Service', svcName, svcNs, 'Running', 'healthy', {
        labels: svc.metadata?.labels || {},
        annotations: svc.metadata?.annotations || {},
        createdAt: svc.metadata?.creationTimestamp || '',
        uid: svc.metadata?.uid || '',
      });
      const nsId = namespaceIds.get(svcNs);
      if (nsId) addEdge(nsId, svcId, 'contains', 'contains');
    });

    // 17. Ingresses
    (ingressesList?.items || []).forEach((ing: any) => {
      const ingName = ing.metadata?.name;
      const ingNs = ing.metadata?.namespace || '';
      if (!ingName) return;
      const ingId = `Ingress/${ingNs}/${ingName}`;
      addNode(ingId, 'Ingress', ingName, ingNs, 'Running', 'healthy', {
        labels: ing.metadata?.labels || {},
        annotations: ing.metadata?.annotations || {},
        createdAt: ing.metadata?.creationTimestamp || '',
        uid: ing.metadata?.uid || '',
      });
      const nsId = namespaceIds.get(ingNs);
      if (nsId) addEdge(nsId, ingId, 'contains', 'contains');
      // Link to Services
      const rules = ing.spec?.rules || [];
      rules.forEach((rule: any) => {
        const paths = rule.http?.paths || [];
        paths.forEach((path: any) => {
          const svcName = path.backend?.service?.name;
          if (svcName) {
            const svcId = `Service/${ingNs}/${svcName}`;
            if (serviceIds.has(`${ingNs}/${svcName}`)) {
              addEdge(ingId, svcId, 'routes', 'routes');
            }
          }
        });
      });
      
      // Link Ingress to IngressClass
      const ingressClassName = ing.spec?.ingressClassName;
      if (ingressClassName && ingressClassIds.has(ingressClassName)) {
        addEdge(ingId, ingressClassIds.get(ingressClassName)!, 'uses', 'uses');
      }
    });

    // 18. Pods (most complex - relationships to everything)
    const podIds = new Map<string, string>();
    (podsList?.items || []).forEach((pod: any) => {
      const podName = pod.metadata?.name;
      const podNs = pod.metadata?.namespace || '';
      if (!podName) return;
      const podId = `Pod/${podNs}/${podName}`;
      podIds.set(`${podNs}/${podName}`, podId);
      const phase = pod.status?.phase || 'Pending';
      const restartCount = pod.status?.containerStatuses?.[0]?.restartCount || 0;
      const health = phase === 'Running' ? 'healthy' : phase === 'Pending' ? 'warning' : 'critical';
      addNode(podId, 'Pod', podName, podNs, phase as TopologyNode['status'], health, {
        labels: pod.metadata?.labels || {},
        annotations: pod.metadata?.annotations || {},
        createdAt: pod.metadata?.creationTimestamp || '',
        uid: pod.metadata?.uid || '',
      }, { restartCount });
      
      // Pod → Namespace
      const nsId = namespaceIds.get(podNs);
      if (nsId) {
        addEdge(nsId, podId, 'contains', 'contains');
      }
      
      // Pod → Node (for node-scoped view when node is expanded)
      const nodeName = pod.spec?.nodeName;
      if (nodeName && nodeIds.has(nodeName)) {
        const nodeId = nodeIds.get(nodeName)!;
        // Track which namespaces have pods on this node (for node-scoped view)
        const namespacesOnNode = nodeToNamespaces.get(nodeId);
        if (namespacesOnNode) {
          namespacesOnNode.add(podNs);
        }
        // Connect pod to node (for node-scoped topology)
        addEdge(nodeId, podId, 'hosts', 'runs pod');
      }

      // Pod → ServiceAccount
      const saName = pod.spec?.serviceAccountName || 'default';
      const saId = `ServiceAccount/${podNs}/${saName}`;
      if (serviceAccountIds.has(`${podNs}/${saName}`)) {
        addEdge(podId, saId, 'references', 'uses');
      }

      // Pod → Owners (Deployment, ReplicaSet, StatefulSet, DaemonSet, Job)
      pod.metadata?.ownerReferences?.forEach((ref: any) => {
        const ownerKind = ref.kind;
        const ownerName = ref.name;
        if (!ownerName) return;
        let ownerId: string | undefined;
        if (ownerKind === 'ReplicaSet') {
          ownerId = `ReplicaSet/${podNs}/${ownerName}`;
          if (replicasetIds.has(`${podNs}/${ownerName}`)) {
            addEdge(ownerId, podId, 'owns', 'manages');
          }
        } else if (ownerKind === 'StatefulSet') {
          ownerId = `StatefulSet/${podNs}/${ownerName}`;
          if (statefulsetIds.has(`${podNs}/${ownerName}`)) {
            addEdge(ownerId, podId, 'owns', 'manages');
          }
        } else if (ownerKind === 'DaemonSet') {
          ownerId = `DaemonSet/${podNs}/${ownerName}`;
          if (daemonsetIds.has(`${podNs}/${ownerName}`)) {
            addEdge(ownerId, podId, 'owns', 'manages');
          }
        } else if (ownerKind === 'Job') {
          ownerId = `Job/${podNs}/${ownerName}`;
          if (jobIds.has(`${podNs}/${ownerName}`)) {
            addEdge(ownerId, podId, 'owns', 'manages');
          }
        }
      });

      // Pod → ConfigMaps/Secrets/PVCs (from volumes)
      pod.spec?.volumes?.forEach((vol: any) => {
        if (vol.configMap?.name) {
          const cmId = `ConfigMap/${podNs}/${vol.configMap.name}`;
          if (configMapIds.has(`${podNs}/${vol.configMap.name}`)) {
            addEdge(podId, cmId, 'mounts', 'mounts');
          }
        }
        if (vol.secret?.secretName) {
          const secretId = `Secret/${podNs}/${vol.secret.secretName}`;
          if (secretIds.has(`${podNs}/${vol.secret.secretName}`)) {
            addEdge(podId, secretId, 'mounts', 'mounts');
          }
        }
        if (vol.persistentVolumeClaim?.claimName) {
          const pvcId = `PersistentVolumeClaim/${podNs}/${vol.persistentVolumeClaim.claimName}`;
          if (pvcIds.has(`${podNs}/${vol.persistentVolumeClaim.claimName}`)) {
            addEdge(podId, pvcId, 'mounts', 'mounts');
          }
        }
      });

      // Pod → ConfigMaps/Secrets (from envFrom)
      pod.spec?.containers?.forEach((container: any) => {
        container.envFrom?.forEach((env: any) => {
          if (env.configMapRef?.name) {
            const cmId = `ConfigMap/${podNs}/${env.configMapRef.name}`;
            if (configMapIds.has(`${podNs}/${env.configMapRef.name}`)) {
              addEdge(podId, cmId, 'configures', 'configures');
            }
          }
          if (env.secretRef?.name) {
            const secretId = `Secret/${podNs}/${env.secretRef.name}`;
            if (secretIds.has(`${podNs}/${env.secretRef.name}`)) {
              addEdge(podId, secretId, 'configures', 'configures');
            }
          }
        });
      });

      // Pod → Services (via label selectors) - will be connected after all pods are processed
    });

    // 19. Connect Services to Pods via label selectors
    (servicesList?.items || []).forEach((svc: any) => {
      const svcName = svc.metadata?.name;
      const svcNs = svc.metadata?.namespace || '';
      if (!svcName) return;
      const svcId = `Service/${svcNs}/${svcName}`;
      const selector = svc.spec?.selector;
      if (!selector || Object.keys(selector).length === 0) return;

      // Find matching pods
      (podsList?.items || []).forEach((pod: any) => {
        const podName = pod.metadata?.name;
        const podNs = pod.metadata?.namespace || '';
        if (podNs !== svcNs) return; // Services only select pods in same namespace
        
        const podLabels = pod.metadata?.labels || {};
        const matches = Object.entries(selector).every(([key, value]) => podLabels[key] === value);
        
        if (matches) {
          const podId = `Pod/${podNs}/${podName}`;
          if (podIds.has(`${podNs}/${podName}`)) {
            addEdge(svcId, podId, 'selects', 'selects');
          }
        }
      });
    });

    return { nodes: graphNodes, edges: graphEdges };
  }, [
    activeCluster,
    namespace,
    nodesList,
    namespacesList,
    podsList,
    deploymentsList,
    replicasetsList,
    statefulsetsList,
    daemonsetsList,
    jobsList,
    cronjobsList,
    servicesList,
    ingressesList,
    configmapsList,
    secretsList,
    pvcsList,
    pvsList,
    storageclassesList,
    ingressclassesList,
    serviceaccountsList,
  ]);

  return {
    nodes,
    edges,
    isLoading,
    error: null,
  };
}

import { useK8sResource, useK8sResourceList, calculateAge, type KubernetesResource, type ResourceType } from './useKubernetes';
import { useKubernetesConfigStore } from '@/stores/kubernetesConfigStore';

export interface EventInfo {
  type: 'Normal' | 'Warning';
  reason: string;
  message: string;
  time: string;
}

// Convert a K8s resource object to YAML string
export function resourceToYaml(resource: KubernetesResource): string {
  const formatValue = (value: any, indent: number = 0): string => {
    const spaces = '  '.repeat(indent);
    
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') {
      if (value.includes('\n')) {
        const lines = value.split('\n').map(line => `${spaces}  ${line}`).join('\n');
        return `|\n${lines}`;
      }
      if (value.includes(':') || value.includes('#') || value.includes('"') || value.includes("'")) {
        return `"${value.replace(/"/g, '\\"')}"`;
      }
      return value;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return '[]';
      return value.map(item => {
        if (typeof item === 'object' && item !== null) {
          const objLines = Object.entries(item)
            .map(([k, v], idx) => {
              const prefix = idx === 0 ? '- ' : '  ';
              return `${spaces}${prefix}${k}: ${formatValue(v, indent + 1)}`;
            })
            .join('\n');
          return objLines;
        }
        return `${spaces}- ${formatValue(item, indent + 1)}`;
      }).join('\n');
    }
    if (typeof value === 'object') {
      const entries = Object.entries(value).filter(([_, v]) => v !== undefined);
      if (entries.length === 0) return '{}';
      return '\n' + entries
        .map(([k, v]) => `${spaces}  ${k}: ${formatValue(v, indent + 1)}`)
        .join('\n');
    }
    return String(value);
  };

  const lines: string[] = [];
  
  if (resource.apiVersion) lines.push(`apiVersion: ${resource.apiVersion}`);
  if (resource.kind) lines.push(`kind: ${resource.kind}`);
  
  if (resource.metadata) {
    lines.push('metadata:');
    const { name, namespace, labels, annotations, creationTimestamp, uid } = resource.metadata;
    if (name) lines.push(`  name: ${name}`);
    if (namespace) lines.push(`  namespace: ${namespace}`);
    if (uid) lines.push(`  uid: ${uid}`);
    if (creationTimestamp) lines.push(`  creationTimestamp: ${creationTimestamp}`);
    if (labels && Object.keys(labels).length > 0) {
      lines.push('  labels:');
      Object.entries(labels).forEach(([k, v]) => lines.push(`    ${k}: ${v}`));
    }
    if (annotations && Object.keys(annotations).length > 0) {
      lines.push('  annotations:');
      Object.entries(annotations).forEach(([k, v]) => lines.push(`    ${k}: "${v}"`));
    }
  }
  
  if (resource.spec) {
    lines.push(`spec:${formatValue(resource.spec, 0)}`);
  }
  
  if (resource.status) {
    lines.push(`status:${formatValue(resource.status, 0)}`);
  }
  
  return lines.join('\n');
}

// Hook to fetch events for a resource
export function useK8sEvents(namespace?: string, fieldSelector?: string) {
  const { data, isLoading, error } = useK8sResourceList<KubernetesResource>(
    'events',
    namespace,
    { enabled: !!namespace || !!fieldSelector }
  );

  const events: EventInfo[] = (data?.items || []).map((event: any) => ({
    type: event.type || 'Normal',
    reason: event.reason || '',
    message: event.message || '',
    time: event.lastTimestamp ? calculateAge(event.lastTimestamp) : 
          event.eventTime ? calculateAge(event.eventTime) : 'unknown',
  }));

  return { events, isLoading, error };
}

// Generic hook for resource detail with fallback
export function useResourceDetail<T extends KubernetesResource>(
  resourceType: ResourceType,
  name: string | undefined,
  namespace: string | undefined,
  mockData: T
) {
  const { config } = useKubernetesConfigStore();
  const isConnected = config.isConnected;
  
  const { data, isLoading, error, refetch } = useK8sResource<T>(
    resourceType,
    name || '',
    namespace,
    { enabled: !!name }
  );

  const resource = isConnected && data ? data : mockData;
  const age = resource?.metadata?.creationTimestamp 
    ? calculateAge(resource.metadata.creationTimestamp) 
    : mockData.metadata?.creationTimestamp 
      ? calculateAge(mockData.metadata.creationTimestamp) 
      : 'unknown';

  return {
    resource,
    isLoading: isConnected ? isLoading : false,
    error,
    isConnected,
    age,
    refetch,
    yaml: resourceToYaml(resource),
  };
}

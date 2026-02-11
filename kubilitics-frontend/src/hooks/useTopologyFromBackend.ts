/**
 * Fetches topology graph from Kubilitics backend (GET /api/v1/clusters/{clusterId}/topology).
 * Enabled when backend is configured and clusterId is set. Per TASKS A3.4.
 */
import { useQuery } from '@tanstack/react-query';
import { useBackendConfigStore, getEffectiveBackendBaseUrl } from '@/stores/backendConfigStore';
import { getTopology } from '@/services/backendApiClient';

export function useTopologyFromBackend(clusterId: string | null, options?: { namespace?: string }) {
  const stored = useBackendConfigStore((s) => s.backendBaseUrl);
  const backendBaseUrl = getEffectiveBackendBaseUrl(stored);
  const isConfigured = useBackendConfigStore((s) => s.isBackendConfigured());

  return useQuery({
    queryKey: ['backend', 'topology', backendBaseUrl, clusterId, options?.namespace],
    queryFn: () => getTopology(backendBaseUrl, clusterId!, { namespace: options?.namespace }),
    enabled: isConfigured && !!clusterId,
    staleTime: 60_000,
    refetchInterval: false,
  });
}

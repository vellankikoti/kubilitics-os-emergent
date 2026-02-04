import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Command, Box, Server, Layers, Globe, Container, Key, FileCode, Database, Clock, Network, Shield, ArrowRight, Loader2 } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SearchResult {
  id: string;
  name: string;
  namespace?: string;
  type: string;
  path: string;
  status?: 'healthy' | 'warning' | 'error' | 'pending';
}

const resourceIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  pod: Box,
  deployment: Container,
  service: Globe,
  node: Server,
  configmap: FileCode,
  secret: Key,
  namespace: Network,
  replicaset: Layers,
  statefulset: Database,
  daemonset: Server,
  job: Clock,
  cronjob: Clock,
  ingress: Globe,
  pvc: Database,
  pv: Database,
  serviceaccount: Shield,
  role: Shield,
  clusterrole: Shield,
};

const statusColors = {
  healthy: 'bg-success text-success-foreground',
  warning: 'bg-warning text-warning-foreground',
  error: 'bg-error text-error-foreground',
  pending: 'bg-muted text-muted-foreground',
};

// Mock resources for search (in real app, this would come from API)
const mockResources: SearchResult[] = [
  // Pods
  { id: 'pod-1', name: 'nginx-deployment-7fb96c846b-abc12', namespace: 'production', type: 'pod', path: '/pods/production/nginx-deployment-7fb96c846b-abc12', status: 'healthy' },
  { id: 'pod-2', name: 'api-gateway-5f8f9c7d6-jkl78', namespace: 'production', type: 'pod', path: '/pods/production/api-gateway-5f8f9c7d6-jkl78', status: 'healthy' },
  { id: 'pod-3', name: 'redis-master-0', namespace: 'production', type: 'pod', path: '/pods/production/redis-master-0', status: 'healthy' },
  { id: 'pod-4', name: 'postgres-0', namespace: 'staging', type: 'pod', path: '/pods/staging/postgres-0', status: 'warning' },
  { id: 'pod-5', name: 'worker-queue-abc123', namespace: 'default', type: 'pod', path: '/pods/default/worker-queue-abc123', status: 'error' },
  // Deployments
  { id: 'dep-1', name: 'nginx-deployment', namespace: 'production', type: 'deployment', path: '/deployments/production/nginx-deployment', status: 'healthy' },
  { id: 'dep-2', name: 'api-gateway', namespace: 'production', type: 'deployment', path: '/deployments/production/api-gateway', status: 'healthy' },
  { id: 'dep-3', name: 'frontend-app', namespace: 'staging', type: 'deployment', path: '/deployments/staging/frontend-app', status: 'healthy' },
  // Services
  { id: 'svc-1', name: 'nginx-service', namespace: 'production', type: 'service', path: '/services/production/nginx-service', status: 'healthy' },
  { id: 'svc-2', name: 'api-gateway-svc', namespace: 'production', type: 'service', path: '/services/production/api-gateway-svc', status: 'healthy' },
  { id: 'svc-3', name: 'kubernetes', namespace: 'default', type: 'service', path: '/services/default/kubernetes', status: 'healthy' },
  // Nodes
  { id: 'node-1', name: 'worker-node-1', type: 'node', path: '/nodes/worker-node-1', status: 'healthy' },
  { id: 'node-2', name: 'worker-node-2', type: 'node', path: '/nodes/worker-node-2', status: 'healthy' },
  { id: 'node-3', name: 'control-plane-1', type: 'node', path: '/nodes/control-plane-1', status: 'healthy' },
  // ConfigMaps
  { id: 'cm-1', name: 'app-config', namespace: 'production', type: 'configmap', path: '/configmaps/production/app-config' },
  { id: 'cm-2', name: 'nginx-conf', namespace: 'production', type: 'configmap', path: '/configmaps/production/nginx-conf' },
  // Secrets
  { id: 'sec-1', name: 'db-credentials', namespace: 'production', type: 'secret', path: '/secrets/production/db-credentials' },
  { id: 'sec-2', name: 'api-keys', namespace: 'production', type: 'secret', path: '/secrets/production/api-keys' },
  // Namespaces
  { id: 'ns-1', name: 'production', type: 'namespace', path: '/namespaces/production', status: 'healthy' },
  { id: 'ns-2', name: 'staging', type: 'namespace', path: '/namespaces/staging', status: 'healthy' },
  { id: 'ns-3', name: 'default', type: 'namespace', path: '/namespaces/default', status: 'healthy' },
  // Ingresses
  { id: 'ing-1', name: 'main-ingress', namespace: 'production', type: 'ingress', path: '/ingresses/production/main-ingress', status: 'healthy' },
  // StatefulSets
  { id: 'sts-1', name: 'postgres', namespace: 'staging', type: 'statefulset', path: '/statefulsets/staging/postgres', status: 'healthy' },
  { id: 'sts-2', name: 'redis', namespace: 'production', type: 'statefulset', path: '/statefulsets/production/redis', status: 'healthy' },
];

// Quick actions
const quickActions = [
  { id: 'nav-dashboard', name: 'Go to Dashboard', icon: Server, path: '/dashboard' },
  { id: 'nav-pods', name: 'View All Pods', icon: Box, path: '/pods' },
  { id: 'nav-deployments', name: 'View All Deployments', icon: Container, path: '/deployments' },
  { id: 'nav-services', name: 'View All Services', icon: Globe, path: '/services' },
  { id: 'nav-topology', name: 'Open Topology View', icon: Network, path: '/topology' },
  { id: 'nav-settings', name: 'Settings', icon: Shield, path: '/settings' },
];

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);

  // Filter resources based on search
  const filteredResources = useMemo(() => {
    if (!search.trim()) return [];
    
    const query = search.toLowerCase();
    return mockResources.filter(resource => {
      const matchesSearch = 
        resource.name.toLowerCase().includes(query) ||
        (resource.namespace?.toLowerCase().includes(query)) ||
        resource.type.toLowerCase().includes(query);
      
      const matchesFilter = !selectedFilter || resource.type === selectedFilter;
      
      return matchesSearch && matchesFilter;
    }).slice(0, 15);
  }, [search, selectedFilter]);

  // Group resources by type
  const groupedResources = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {};
    filteredResources.forEach(resource => {
      if (!groups[resource.type]) {
        groups[resource.type] = [];
      }
      groups[resource.type].push(resource);
    });
    return groups;
  }, [filteredResources]);

  const handleSelect = useCallback((path: string) => {
    navigate(path);
    onOpenChange(false);
    setSearch('');
    setSelectedFilter(null);
  }, [navigate, onOpenChange]);

  // Simulate loading when search changes
  useEffect(() => {
    if (search) {
      setIsLoading(true);
      const timeout = setTimeout(() => setIsLoading(false), 200);
      return () => clearTimeout(timeout);
    }
    setIsLoading(false);
  }, [search]);

  const resourceTypes = ['pod', 'deployment', 'service', 'node', 'configmap', 'secret', 'namespace', 'ingress'];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <div className="flex items-center border-b border-border px-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search pods, deployments, services, nodes..."
          className="flex h-12 w-full bg-transparent py-3 px-2 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
        />
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      
      {/* Filter chips */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border overflow-x-auto">
        <span className="text-xs text-muted-foreground shrink-0">Filter:</span>
        <Badge
          variant={selectedFilter === null ? 'default' : 'outline'}
          className="cursor-pointer text-xs"
          onClick={() => setSelectedFilter(null)}
        >
          All
        </Badge>
        {resourceTypes.map(type => {
          const Icon = resourceIcons[type] || Box;
          return (
            <Badge
              key={type}
              variant={selectedFilter === type ? 'default' : 'outline'}
              className="cursor-pointer text-xs gap-1 capitalize"
              onClick={() => setSelectedFilter(selectedFilter === type ? null : type)}
            >
              <Icon className="h-3 w-3" />
              {type}s
            </Badge>
          );
        })}
      </div>

      <CommandList className="max-h-[400px]">
        {!search && (
          <CommandGroup heading="Quick Actions">
            {quickActions.map((action) => (
              <CommandItem
                key={action.id}
                onSelect={() => handleSelect(action.path)}
                className="flex items-center gap-3 py-2.5"
              >
                <div className="p-1.5 rounded-md bg-primary/10">
                  <action.icon className="h-4 w-4 text-primary" />
                </div>
                <span className="flex-1">{action.name}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {search && filteredResources.length === 0 && (
          <CommandEmpty className="py-12 text-center">
            <div className="flex flex-col items-center gap-2">
              <Search className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No resources found for "{search}"</p>
              <p className="text-xs text-muted-foreground">Try searching by name, namespace, or type</p>
            </div>
          </CommandEmpty>
        )}

        {Object.entries(groupedResources).map(([type, resources]) => {
          const Icon = resourceIcons[type] || Box;
          return (
            <CommandGroup key={type} heading={
              <div className="flex items-center gap-2 capitalize">
                <Icon className="h-4 w-4" />
                {type}s
                <Badge variant="secondary" className="text-[10px] ml-1">{resources.length}</Badge>
              </div>
            }>
              {resources.map((resource) => (
                <CommandItem
                  key={resource.id}
                  onSelect={() => handleSelect(resource.path)}
                  className="flex items-center gap-3 py-2.5"
                >
                  <div className={cn(
                    'p-1.5 rounded-md',
                    resource.status === 'healthy' ? 'bg-success/10' :
                    resource.status === 'warning' ? 'bg-warning/10' :
                    resource.status === 'error' ? 'bg-error/10' : 'bg-muted'
                  )}>
                    <Icon className={cn(
                      'h-4 w-4',
                      resource.status === 'healthy' ? 'text-success' :
                      resource.status === 'warning' ? 'text-warning' :
                      resource.status === 'error' ? 'text-error' : 'text-muted-foreground'
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{resource.name}</p>
                    {resource.namespace && (
                      <p className="text-xs text-muted-foreground">
                        Namespace: {resource.namespace}
                      </p>
                    )}
                  </div>
                  {resource.status && (
                    <Badge 
                      variant="secondary" 
                      className={cn(
                        'text-[10px] capitalize',
                        resource.status === 'healthy' && 'bg-success/10 text-success',
                        resource.status === 'warning' && 'bg-warning/10 text-warning',
                        resource.status === 'error' && 'bg-error/10 text-error'
                      )}
                    >
                      {resource.status}
                    </Badge>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
      </CommandList>
      
      {/* Footer with keyboard hints */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-border text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded">↵</kbd>
            Select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded">↑</kbd>
            <kbd className="px-1.5 py-0.5 bg-muted rounded">↓</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded">Esc</kbd>
            Close
          </span>
        </div>
        <span className="flex items-center gap-1">
          <Command className="h-3 w-3" />K to open search
        </span>
      </div>
    </CommandDialog>
  );
}

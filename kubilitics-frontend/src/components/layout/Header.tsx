import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, User, ChevronDown, Command, Plus, Upload } from 'lucide-react';
import { KubernetesLogo } from '../icons/KubernetesIcons';
import { useClusterStore } from '@/stores/clusterStore';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { GlobalSearch } from './GlobalSearch';
import { K8sConnectionDialog } from './K8sConnectionDialog';
import { DeploymentWizard, ServiceWizard, ConfigMapWizard, SecretWizard } from '@/components/wizards';
import { toast } from 'sonner';

const statusColors = {
  healthy: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
};

export function Header() {
  const navigate = useNavigate();
  const { activeCluster, clusters, setActiveCluster, activeNamespace, setActiveNamespace, namespaces } = useClusterStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState<'deployment' | 'service' | 'configmap' | 'secret' | null>(null);

  const handleWizardSubmit = (yaml: string) => {
    console.log('Created resource:', yaml);
    toast.success('Resource YAML generated successfully!');
    setWizardOpen(null);
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return (
    <>
      <header className="h-14 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="flex items-center justify-between h-full px-4">
          {/* Left: Logo + Cluster Selector */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <KubernetesLogo size={28} className="text-primary" />
              <span className="font-semibold text-lg tracking-tight">Kubilitics</span>
            </div>

            {activeCluster && (
              <div className="flex items-center gap-2 ml-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 gap-2 px-3 text-sm font-medium">
                      <span className={`w-2 h-2 rounded-full ${statusColors[activeCluster.status]}`} />
                      {activeCluster.name}
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    {clusters.map((cluster) => (
                      <DropdownMenuItem
                        key={cluster.id}
                        onClick={() => setActiveCluster(cluster)}
                        className="flex items-center gap-2"
                      >
                        <span className={`w-2 h-2 rounded-full ${statusColors[cluster.status]}`} />
                        <div className="flex-1">
                          <div className="font-medium">{cluster.name}</div>
                          <div className="text-xs text-muted-foreground">{cluster.region} · {cluster.version}</div>
                        </div>
                        {cluster.id === activeCluster.id && (
                          <span className="text-xs text-primary">Active</span>
                        )}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/setup/kubeconfig')}>
                      <Upload className="h-4 w-4 mr-2" />
                      Add Cluster
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <span className="text-muted-foreground">/</span>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 gap-2 px-3 text-sm font-medium">
                      {activeNamespace === 'all' ? 'All Namespaces' : activeNamespace}
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuItem onClick={() => setActiveNamespace('all')}>
                      All Namespaces
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {namespaces.map((ns) => (
                      <DropdownMenuItem
                        key={ns.name}
                        onClick={() => setActiveNamespace(ns.name)}
                        className="flex items-center justify-between"
                      >
                        <span>{ns.name}</span>
                        <span className="text-xs text-muted-foreground">{ns.pods} pods</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          {/* Center: Search */}
          <div className="flex-1 max-w-xl mx-8">
            <button
              onClick={() => setSearchOpen(true)}
              className="w-full h-9 px-4 flex items-center gap-3 rounded-lg border border-border bg-muted/50 text-muted-foreground text-sm hover:bg-muted transition-colors"
            >
              <Search className="h-4 w-4" />
              <span className="flex-1 text-left">Search resources...</span>
              <kbd className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-background rounded border">
                <Command className="h-3 w-3" />K
              </kbd>
            </button>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <K8sConnectionDialog />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Create</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setWizardOpen('deployment')}>Deployment</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setWizardOpen('service')}>Service</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setWizardOpen('configmap')}>ConfigMap</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setWizardOpen('secret')}>Secret</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" size="icon" className="h-9 w-9 relative">
              <Bell className="h-4.5 w-4.5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <User className="h-4.5 w-4.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem>Settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/setup/kubeconfig')}>
                  <Upload className="h-4 w-4 mr-2" />
                  Add Cluster
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={() => navigate('/')}>
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      
      {wizardOpen === 'deployment' && <DeploymentWizard onClose={() => setWizardOpen(null)} onSubmit={handleWizardSubmit} />}
      {wizardOpen === 'service' && <ServiceWizard onClose={() => setWizardOpen(null)} onSubmit={handleWizardSubmit} />}
      {wizardOpen === 'configmap' && <ConfigMapWizard onClose={() => setWizardOpen(null)} onSubmit={handleWizardSubmit} />}
      {wizardOpen === 'secret' && <SecretWizard onClose={() => setWizardOpen(null)} onSubmit={handleWizardSubmit} />}
    </>
  );
}

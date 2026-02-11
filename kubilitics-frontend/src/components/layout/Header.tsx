/**
 * Kubilitics Header — Clean, balanced navigation bar.
 *
 * Layout: Logo zone (sidebar column) | Search | Cluster · Shell · Kubeconfig · Connect | Notifications | Profile
 * - Logo zone: w-72, sidebar-style background, fills header height
 * - Search resources: always-visible trigger in header (core feature)
 * - All controls sized for clarity; labels visible; Notifications and Profile are real controls
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Bell,
  ChevronDown,
  Command,
  Terminal,
  FileDown,
  Settings,
  LogOut,
  Plus,
} from 'lucide-react';
import { KubernetesLogo } from '../icons/KubernetesIcons';
import { useClusterStore } from '@/stores/clusterStore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { GlobalSearch } from './GlobalSearch';
import { K8sConnectionDialog } from './K8sConnectionDialog';
import { ClusterShellPanel } from '@/components/shell';
import { DeploymentWizard, ServiceWizard, ConfigMapWizard, SecretWizard } from '@/components/wizards';
import { getClusterKubeconfig } from '@/services/backendApiClient';
import { getEffectiveBackendBaseUrl } from '@/stores/backendConfigStore';
import { useBackendConfigStore } from '@/stores/backendConfigStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
  healthy: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
};

/** Header height — keep in sync with Sidebar's calc(100vh - 5rem) */
export const HEADER_HEIGHT_CLASS = 'h-20';

/* ─── Design tokens: balanced, readable controls ─── */

/** Secondary action — Cluster (same treatment) */
const BTN = cn(
  'h-11 px-5 rounded-lg',
  'inline-flex items-center justify-center gap-2.5',
  'text-base font-medium leading-none',
  'border border-border/80 bg-background text-foreground',
  'hover:bg-accent hover:border-border',
  'transition-colors duration-150',
  'active:scale-[0.97]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
  'disabled:opacity-50 disabled:pointer-events-none'
);

/** Feature actions — Shell, Kubeconfig: clear button treatment and value proposition */
const FEATURE_BTN = cn(
  'h-11 px-5 rounded-lg',
  'inline-flex items-center justify-center gap-2.5',
  'text-base font-semibold leading-none',
  'border-2 border-border bg-muted/60 text-foreground',
  'hover:bg-muted hover:border-primary/30 hover:shadow-md',
  'transition-all duration-150',
  'active:scale-[0.97]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
  'disabled:opacity-50 disabled:pointer-events-none'
);

/** Primary CTA — Connect */
const PRIMARY_BTN = cn(
  'h-11 px-5 rounded-lg',
  'inline-flex items-center justify-center gap-2.5',
  'text-base font-semibold leading-none',
  'border shadow-sm',
  'transition-colors duration-150',
  'active:scale-[0.97]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1'
);

/** Icon or labelled button (Notifications, etc.) */
const ICON_BTN = cn(
  'h-11 min-w-[2.75rem] rounded-lg',
  'inline-flex items-center justify-center gap-2',
  'text-muted-foreground',
  'hover:bg-accent hover:text-foreground',
  'transition-colors duration-150',
  'active:scale-[0.97]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1'
);

export function Header() {
  const navigate = useNavigate();
  const { activeCluster, clusters, setActiveCluster, isDemo } = useClusterStore();
  const setCurrentClusterId = useBackendConfigStore((s) => s.setCurrentClusterId);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shellOpen, setShellOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState<'deployment' | 'service' | 'configmap' | 'secret' | null>(null);

  const handleWizardSubmit = (yaml: string) => {
    console.log('Created resource:', yaml);
    toast.success('Resource YAML generated successfully!');
    setWizardOpen(null);
  };

  const storedBackendUrl = useBackendConfigStore((s) => s.backendBaseUrl);
  const backendBaseUrl = getEffectiveBackendBaseUrl(storedBackendUrl);

  const handleDownloadKubeconfig = async (clusterId: string, clusterName: string) => {
    try {
      const { blob, filename } = await getClusterKubeconfig(backendBaseUrl, clusterId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${filename}`);
    } catch (error) {
      toast.error('Failed to download kubeconfig');
      console.error(error);
    }
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

  useEffect(() => {
    const onOpenSearch = () => setSearchOpen(true);
    window.addEventListener('openGlobalSearch', onOpenSearch);
    return () => window.removeEventListener('openGlobalSearch', onOpenSearch);
  }, []);

  return (
    <>
      <header className={cn(HEADER_HEIGHT_CLASS, 'border-b border-border/40 bg-background/95 backdrop-blur-xl sticky top-0 z-50')}>
        <div className="flex items-center h-full w-full">

          {/* ──── Logo zone: prominent Kubilitics branding — fills sidebar column, dominates visually ──── */}
          <div className="w-72 shrink-0 flex items-center justify-center h-full bg-sidebar/95 border-r border-border/60 px-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/25">
                <KubernetesLogo size={38} className="text-primary-foreground" />
              </div>
              <span className="text-2xl font-extrabold tracking-tight text-foreground select-none">
                Kubilitics
              </span>
            </div>
          </div>

          {/* ──── Main bar: Search (stretches) | Cluster · Shell · Kubeconfig · Connect · Notifications · Profile (right) ──── */}
          <div className="flex-1 min-w-0 flex items-center gap-4 pl-6 pr-6">
            {/* Search resources — global search: high visibility so users find it immediately */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className={cn(
                'flex-1 min-w-[200px] h-12 px-5 flex items-center gap-3 rounded-xl',
                'border-2 border-primary/25 bg-primary/5 text-foreground',
                'hover:border-primary/40 hover:bg-primary/10',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                'transition-colors duration-150 group shadow-sm'
              )}
            >
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 group-hover:bg-primary/20">
                <Search className="h-5 w-5 shrink-0 text-primary" />
              </div>
              <span className="flex-1 text-left text-base font-semibold text-foreground">Search all resources...</span>
              <kbd className="hidden sm:inline-flex h-7 items-center gap-1 rounded-md border-2 border-border bg-muted/80 px-2.5 font-mono text-xs font-semibold text-foreground shrink-0">
                <Command className="h-3.5 w-3.5" />K
              </kbd>
            </button>

            {/* Right group: pushed to the edge with even spacing between items */}
            <div className="flex items-center gap-4 shrink-0 ml-auto">
            <TooltipProvider delayDuration={300}>

              {/* Cluster selector */}
              {activeCluster && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className={cn(BTN, 'shrink-0 max-w-[240px]')}>
                      <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', statusColors[activeCluster.status])} />
                      <span className="truncate text-base">{activeCluster.name}</span>
                      <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72">
                    <div className="px-3 py-2 border-b border-border/50">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Switch cluster</p>
                    </div>
                    {clusters.map((cluster) => (
                      <DropdownMenuItem
                        key={cluster.id}
                        onClick={() => {
                          setActiveCluster(cluster);
                          if (!isDemo) setCurrentClusterId(cluster.id);
                        }}
                        className="flex items-center gap-3 py-2.5 cursor-pointer"
                      >
                        <span className={cn('w-2 h-2 rounded-full shrink-0', statusColors[cluster.status])} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{cluster.name}</div>
                          <div className="text-xs text-muted-foreground">{cluster.region} · {cluster.version}</div>
                        </div>
                        {cluster.id === activeCluster.id && (
                          <span className="text-[11px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">Active</span>
                        )}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/setup/kubeconfig')} className="gap-2 cursor-pointer py-2.5">
                      <Plus className="h-4 w-4" />
                      <span className="text-sm">Add Cluster</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Shell — clear feature button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setShellOpen(true)}
                    disabled={!activeCluster}
                    className={FEATURE_BTN}
                  >
                    <Terminal className="h-5 w-5 shrink-0" />
                    <span>Shell</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8}>Open cluster terminal</TooltipContent>
              </Tooltip>

              {/* Kubeconfig — clear feature button */}
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <button className={FEATURE_BTN}>
                        <FileDown className="h-5 w-5 shrink-0" />
                        <span>Kubeconfig</span>
                      </button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={8}>Download kubeconfig</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" className="w-64">
                  <div className="px-3 py-2 border-b border-border/50">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Download kubeconfig</p>
                  </div>
                  {clusters.map((cluster) => (
                    <DropdownMenuItem
                      key={cluster.id}
                      onClick={() => handleDownloadKubeconfig(cluster.id, cluster.name)}
                      className="flex items-center gap-3 py-2.5 cursor-pointer"
                    >
                      <span className={cn('w-2 h-2 rounded-full shrink-0', statusColors[cluster.status])} />
                      <span className="flex-1 text-sm truncate">{cluster.name}</span>
                      <FileDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Connect — primary CTA */}
              <K8sConnectionDialog triggerClassName={PRIMARY_BTN} />

              {/* Notifications — labelled, same height as other actions */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className={cn(ICON_BTN, 'px-3')} aria-label="Notifications">
                    <span className="relative shrink-0">
                      <Bell className="h-5 w-5" />
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-background" />
                    </span>
                    <span className="hidden md:inline text-base font-medium">Notifications</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8}>Notifications</TooltipContent>
              </Tooltip>

              {/* Profile — avatar + label + chevron, real account control */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      'h-11 pl-2 pr-3 rounded-lg',
                      'inline-flex items-center gap-2.5',
                      'hover:bg-accent',
                      'transition-colors duration-150',
                      'active:scale-[0.97]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1'
                    )}
                    aria-label="User menu"
                  >
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarImage src="" />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-sm font-bold text-primary-foreground">
                        AD
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-foreground hidden sm:inline">Admin User</span>
                    <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-3 py-2.5 border-b border-border/50">
                    <p className="text-sm font-medium text-foreground">Admin User</p>
                    <p className="text-xs text-muted-foreground mt-0.5">admin@kubilitics.com</p>
                  </div>
                  <DropdownMenuItem onClick={() => navigate('/settings')} className="gap-2 py-2.5 cursor-pointer">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/setup/kubeconfig')} className="gap-2 py-2.5 cursor-pointer">
                    <Plus className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Add Cluster</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="gap-2 py-2.5 cursor-pointer text-destructive focus:text-destructive"
                    onClick={() => navigate('/')}
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="text-sm">Sign Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

            </TooltipProvider>
            </div>
          </div>
        </div>
      </header>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

      {activeCluster && (
        <ClusterShellPanel
          open={shellOpen}
          onOpenChange={setShellOpen}
          clusterId={activeCluster.id}
          clusterName={activeCluster.name}
          backendBaseUrl={backendBaseUrl}
        />
      )}

      {wizardOpen === 'deployment' && <DeploymentWizard onClose={() => setWizardOpen(null)} onSubmit={handleWizardSubmit} />}
      {wizardOpen === 'service' && <ServiceWizard onClose={() => setWizardOpen(null)} onSubmit={handleWizardSubmit} />}
      {wizardOpen === 'configmap' && <ConfigMapWizard onClose={() => setWizardOpen(null)} onSubmit={handleWizardSubmit} />}
      {wizardOpen === 'secret' && <SecretWizard onClose={() => setWizardOpen(null)} onSubmit={handleWizardSubmit} />}
    </>
  );
}

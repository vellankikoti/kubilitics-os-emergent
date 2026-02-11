import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Box,
  Layers,
  Server,
  Globe,
  Database,
  Settings,
  Shield,
  Activity,
  Network,
  FileText,
  ChevronRight,
  ChevronLeft,
  Key,
  Scale,
  Route,
  HardDrive,
  Users,
  Gauge,
  FileCode,
  Webhook,
  AlertTriangle,
  Container,
  Clock,
  Loader2,
  Cpu,
  Lock,
  Zap,
  HardDrive as StorageIcon
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useResourceCounts } from '@/hooks/useResourceCounts';

const SIDEBAR_COLLAPSED_KEY = 'kubilitics-sidebar-collapsed';

function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    } catch {
      /* ignore */
    }
  }, [collapsed]);
  return [collapsed, setCollapsed] as const;
}

interface NavItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
  count?: number;
}

function NavItem({ to, icon: Icon, label, count }: NavItemProps) {
  const location = useLocation();
  const isActive = location.pathname === to || location.pathname.startsWith(`${to}/`);

  return (
    <NavLink
      to={to}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative overflow-hidden',
        isActive
          ? 'text-primary bg-primary/5'
          : 'text-foreground hover:bg-muted/50'
      )}
    >
      {/* Active Indicator Line */}
      {isActive && (
        <motion.div
          layoutId="activeNavLine"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 rounded-r-full bg-primary"
        />
      )}

      <Icon className={cn("h-5 w-5 transition-colors relative z-10", isActive ? "text-primary fill-primary/10" : "text-foreground/80 group-hover:text-foreground")} />
      <span className={cn("flex-1 truncate relative z-10", isActive && "font-semibold")}>{label}</span>
      {count !== undefined && (
        <span
          className={cn(
            'text-xs font-bold px-2 py-0.5 rounded-full min-w-[1.5rem] text-center shadow-sm leading-none transition-colors relative z-10',
            isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground/90 group-hover:bg-muted-foreground/20'
          )}
        >
          {count}
        </span>
      )}
    </NavLink>
  );
}

interface NavGroupProps {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon: React.ElementType;
  /** When true, show the same blue gradient highlight as Dashboard/Topology/Settings */
  isSectionActive?: boolean;
}

function NavGroup({ label, children, defaultOpen = true, icon: Icon, isSectionActive = false }: NavGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="space-y-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all duration-300 group shadow-sm border",
          isSectionActive
            ? "bg-gradient-to-r from-primary to-blue-600 text-primary-foreground shadow-lg shadow-blue-500/20 border-transparent"
            : isOpen
              ? "bg-muted/50 text-foreground border-border/50"
              : "bg-card hover:bg-muted/50 text-foreground border-transparent hover:border-border/50"
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-1.5 rounded-lg transition-colors",
            isSectionActive ? "bg-primary-foreground/20 text-primary-foreground" : isOpen ? "bg-muted text-foreground" : "bg-muted text-foreground/90 group-hover:bg-background group-hover:text-foreground"
          )}>
            <Icon className="h-5 w-5" />
          </div>
        <span className={cn(
          "text-base font-normal tracking-wide uppercase",
          isSectionActive ? "text-primary-foreground" : "text-foreground"
        )}>
          {label}
        </span>
        </div>
        <ChevronRight
          className={cn('h-5 w-5 transition-transform duration-300', isSectionActive ? 'text-primary-foreground' : 'text-foreground/80 group-hover:text-foreground', isOpen && 'rotate-90')}
        />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <div className="relative pl-4 ml-4 border-l-2 border-primary/20 my-2 space-y-1">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItemIconOnly({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }) {
  const location = useLocation();
  const isActive = location.pathname === to || location.pathname.startsWith(`${to}/`);
  return (
    <NavLink
      to={to}
      className={cn(
        'flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:scale-105 active:scale-95 group relative border',
        isActive
          ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30 border-transparent'
          : 'text-foreground hover:bg-muted border-transparent hover:border-border/50'
      )}
      title={label}
      aria-label={label}
    >
      <Icon className={cn("h-6 w-6", isActive && "fill-primary-foreground/20")} aria-hidden />

      {/* Tooltip-like label on hover for icon-only mode */}
      <span className="absolute left-full ml-3 px-3 py-1.5 bg-popover text-popover-foreground text-sm font-medium rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-border">
        {label}
      </span>
    </NavLink>
  );
}

function isPathIn(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

const WORKLOAD_PATHS = ['/pods', '/deployments', '/replicasets', '/statefulsets', '/daemonsets', '/jobs', '/cronjobs'];
const NETWORKING_PATHS = ['/services', '/ingresses', '/ingressclasses', '/endpoints', '/endpointslices', '/networkpolicies'];
const STORAGE_PATHS = ['/configmaps', '/secrets', '/persistentvolumes', '/persistentvolumeclaims', '/storageclasses', '/volumeattachments'];
const CLUSTER_PATHS = ['/nodes', '/namespaces', '/events', '/apiservices', '/leases'];
const SECURITY_PATHS = ['/serviceaccounts', '/roles', '/clusterroles', '/rolebindings', '/clusterrolebindings', '/priorityclasses'];
const RESOURCES_PATHS = ['/resourcequotas', '/limitranges'];
const SCALING_PATHS = ['/horizontalpodautoscalers', '/verticalpodautoscalers', '/poddisruptionbudgets'];
const CRD_PATHS = ['/customresourcedefinitions', '/customresources'];
const ADMISSION_PATHS = ['/mutatingwebhooks', '/validatingwebhooks'];

function SidebarContent({
  counts,
  isLoading,
}: {
  counts: ReturnType<typeof useResourceCounts>['counts'];
  isLoading: boolean;
}) {
  const location = useLocation();
  const pathname = location.pathname;
  const isDashboardActive = pathname === '/dashboard';
  const isTopologyActive = pathname.startsWith('/topology');
  const isSettingsActive = pathname.startsWith('/settings');

  return (
    <div className="flex flex-col gap-6 pb-6 w-full">
      <div className="space-y-1.5">
        <NavLink
          to="/dashboard"
          className={cn(
            "flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 group border shadow-sm",
            isDashboardActive
              ? "bg-gradient-to-r from-primary to-blue-600 text-primary-foreground shadow-lg shadow-blue-500/20 border-transparent"
              : "bg-card text-foreground hover:bg-muted/50 border-transparent hover:border-border/50"
          )}
        >
          <LayoutDashboard className="h-6 w-6" />
          <span className="font-normal text-base">Dashboard</span>
        </NavLink>

        <NavLink
          to="/topology"
          className={cn(
            "flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 group border shadow-sm",
            isTopologyActive
              ? "bg-gradient-to-r from-primary to-blue-600 text-primary-foreground shadow-lg shadow-blue-500/20 border-transparent"
              : "bg-card text-foreground hover:bg-muted/50 border-transparent hover:border-border/50"
          )}
        >
          <Network className="h-6 w-6" />
          <span className="font-normal text-base">Topology</span>
        </NavLink>
      </div>

      {/* Connection indicator */}
      {isLoading && (
        <div className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-blue-600 bg-blue-50/50 rounded-lg animate-pulse border border-blue-100">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Syncing resources...</span>
        </div>
      )}

      <div className="space-y-5">
        {/* Workloads */}
        <NavGroup label="Workloads" icon={Cpu} defaultOpen={true} isSectionActive={isPathIn(pathname, WORKLOAD_PATHS)}>
          <NavItem to="/pods" icon={Box} label="Pods" count={counts.pods} />
          <NavItem to="/deployments" icon={Container} label="Deployments" count={counts.deployments} />
          <NavItem to="/replicasets" icon={Layers} label="ReplicaSets" count={counts.replicasets} />
          <NavItem to="/statefulsets" icon={Layers} label="StatefulSets" count={counts.statefulsets} />
          <NavItem to="/daemonsets" icon={Layers} label="DaemonSets" count={counts.daemonsets} />
          <NavItem to="/jobs" icon={Activity} label="Jobs" count={counts.jobs} />
          <NavItem to="/cronjobs" icon={Clock} label="CronJobs" count={counts.cronjobs} />
        </NavGroup>

        {/* Networking */}
        <NavGroup label="Networking" icon={Globe} defaultOpen={false} isSectionActive={isPathIn(pathname, NETWORKING_PATHS)}>
          <NavItem to="/services" icon={Globe} label="Services" count={counts.services} />
          <NavItem to="/ingresses" icon={Globe} label="Ingresses" count={counts.ingresses} />
          <NavItem to="/ingressclasses" icon={Route} label="Ingress Classes" count={counts.ingressclasses} />
          <NavItem to="/endpoints" icon={Globe} label="Endpoints" count={counts.endpoints} />
          <NavItem to="/endpointslices" icon={Network} label="Endpoint Slices" count={counts.endpointslices} />
          <NavItem to="/networkpolicies" icon={Shield} label="Network Policies" count={counts.networkpolicies} />
        </NavGroup>

        {/* Storage */}
        <NavGroup label="Storage" icon={StorageIcon} defaultOpen={false} isSectionActive={isPathIn(pathname, STORAGE_PATHS)}>
          <NavItem to="/configmaps" icon={Settings} label="ConfigMaps" count={counts.configmaps} />
          <NavItem to="/secrets" icon={Key} label="Secrets" count={counts.secrets} />
          <NavItem to="/persistentvolumes" icon={HardDrive} label="Persistent Volumes" count={counts.persistentvolumes} />
          <NavItem to="/persistentvolumeclaims" icon={Database} label="PVCs" count={counts.persistentvolumeclaims} />
          <NavItem to="/storageclasses" icon={Database} label="Storage Classes" count={counts.storageclasses} />
          <NavItem to="/volumeattachments" icon={HardDrive} label="Volume Attachments" count={counts.volumeattachments} />
        </NavGroup>

        {/* Cluster */}
        <NavGroup label="Cluster" icon={Server} defaultOpen={false} isSectionActive={isPathIn(pathname, CLUSTER_PATHS)}>
          <NavItem to="/nodes" icon={Server} label="Nodes" count={counts.nodes} />
          <NavItem to="/namespaces" icon={FileText} label="Namespaces" count={counts.namespaces} />
          <NavItem to="/events" icon={Activity} label="Events" />
          <NavItem to="/apiservices" icon={FileCode} label="API Services" count={counts.apiservices} />
          <NavItem to="/leases" icon={Activity} label="Leases" count={counts.leases} />
        </NavGroup>

        {/* Security & Access */}
        <NavGroup label="Security" icon={Lock} defaultOpen={false} isSectionActive={isPathIn(pathname, SECURITY_PATHS)}>
          <NavItem to="/serviceaccounts" icon={Users} label="Service Accounts" count={counts.serviceaccounts} />
          <NavItem to="/roles" icon={Shield} label="Roles" count={counts.roles} />
          <NavItem to="/clusterroles" icon={Shield} label="Cluster Roles" count={counts.clusterroles} />
          <NavItem to="/rolebindings" icon={Shield} label="Role Bindings" count={counts.rolebindings} />
          <NavItem to="/clusterrolebindings" icon={Shield} label="Cluster Role Bindings" count={counts.clusterrolebindings} />
          <NavItem to="/priorityclasses" icon={AlertTriangle} label="Priority Classes" count={counts.priorityclasses} />
        </NavGroup>

        {/* Resource Management */}
        <NavGroup label="Resources" icon={Gauge} defaultOpen={false} isSectionActive={isPathIn(pathname, RESOURCES_PATHS)}>
          <NavItem to="/resourcequotas" icon={Gauge} label="Resource Quotas" count={counts.resourcequotas} />
          <NavItem to="/limitranges" icon={Scale} label="Limit Ranges" count={counts.limitranges} />
        </NavGroup>

        {/* Scaling & Policies */}
        <NavGroup label="Scaling" icon={Zap} defaultOpen={false} isSectionActive={isPathIn(pathname, SCALING_PATHS)}>
          <NavItem to="/horizontalpodautoscalers" icon={Scale} label="HPAs" count={counts.horizontalpodautoscalers} />
          <NavItem to="/verticalpodautoscalers" icon={Scale} label="VPAs" count={counts.verticalpodautoscalers} />
          <NavItem to="/poddisruptionbudgets" icon={Shield} label="PDBs" count={counts.poddisruptionbudgets} />
        </NavGroup>

        {/* Custom Resources */}
        <NavGroup label="CRDs" icon={FileCode} defaultOpen={false} isSectionActive={isPathIn(pathname, CRD_PATHS)}>
          <NavItem to="/customresourcedefinitions" icon={FileCode} label="Definitions" count={counts.customresourcedefinitions} />
          <NavItem to="/customresources" icon={FileCode} label="Instances" />
        </NavGroup>

        {/* Admission Control */}
        <NavGroup label="Admission" icon={Webhook} defaultOpen={false} isSectionActive={isPathIn(pathname, ADMISSION_PATHS)}>
          <NavItem to="/mutatingwebhooks" icon={Webhook} label="Mutating Webhooks" count={counts.mutatingwebhookconfigurations} />
          <NavItem to="/validatingwebhooks" icon={Webhook} label="Validating Webhooks" count={counts.validatingwebhookconfigurations} />
        </NavGroup>
      </div>

      <div className="pt-4 mt-auto border-t border-border space-y-1.5">
        <NavLink
          to="/settings"
          className={cn(
            "flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 group border shadow-sm",
            isSettingsActive
              ? "bg-gradient-to-r from-primary to-blue-600 text-primary-foreground shadow-lg shadow-blue-500/20 border-transparent"
              : "bg-card text-foreground hover:bg-muted/50 border-transparent hover:border-border/50"
          )}
        >
          <Settings className={cn("h-6 w-6 transition-colors shrink-0", isSettingsActive ? "text-primary-foreground" : "text-foreground/80 group-hover:text-foreground")} />
          <span className="font-normal text-base">Settings</span>
        </NavLink>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { counts, isLoading } = useResourceCounts();
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const [flyoutOpen, setFlyoutOpen] = useState(false);

  const fullContent = (
    <div className="flex flex-col h-full bg-sidebar/30">
      <div className="flex-1 overflow-y-auto px-5 py-6 scrollbar-thin scrollbar-thumb-border/40 hover:scrollbar-thumb-border/80">
        <SidebarContent counts={counts} isLoading={isLoading} />
      </div>
    </div>
  );

  if (collapsed) {
    return (
      <>
        <aside
          className="w-[5.5rem] h-[calc(100vh-5rem)] border-r border-border/60 bg-sidebar/95 backdrop-blur supports-[backdrop-filter]:bg-sidebar/60 flex flex-col items-center py-6 gap-4 shrink-0 z-30"
          onMouseEnter={() => setFlyoutOpen(true)}
          onMouseLeave={() => setFlyoutOpen(false)}
          aria-label="Navigation rail"
        >
          <NavItemIconOnly to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavItemIconOnly to="/topology" icon={Network} label="Topology" />
          <div className="w-12 h-px bg-border/50 my-2" />
          <NavItemIconOnly to="/pods" icon={Box} label="Pods" />
          <NavItemIconOnly to="/nodes" icon={Server} label="Nodes" />
          <NavItemIconOnly to="/services" icon={Globe} label="Services" />
          <NavItemIconOnly to="/events" icon={Activity} label="Events" />

          <div className="flex-1" />

          <NavItemIconOnly to="/settings" icon={Settings} label="Settings" />
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="flex items-center justify-center w-11 h-11 rounded-xl text-foreground/90 hover:text-foreground hover:bg-muted transition-colors mb-2"
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </aside>
        <AnimatePresence>
          {flyoutOpen && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="fixed left-[5.5rem] top-20 bottom-0 z-40 w-72 border-r border-border bg-sidebar/95 backdrop-blur shadow-2xl"
              onMouseEnter={() => setFlyoutOpen(true)}
              onMouseLeave={() => setFlyoutOpen(false)}
              style={{ height: 'calc(100vh - 5rem)' }}
            >
              {fullContent}
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <aside className="w-72 h-[calc(100vh-5rem)] flex flex-col border-r border-border/60 bg-sidebar/95 backdrop-blur supports-[backdrop-filter]:bg-sidebar/60 shrink-0 transition-all duration-300">
      {fullContent}

      {/* Collapse Footer — same visual weight as Dashboard/Topology/Settings */}
      <div className="p-4 border-t border-border/60 bg-sidebar/50">
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="flex items-center justify-center gap-3 w-full px-4 py-3.5 rounded-xl border shadow-sm bg-card text-foreground hover:bg-muted/50 border-transparent hover:border-border/50 transition-all duration-200 group"
          aria-label="Collapse sidebar"
        >
          <ChevronLeft className="h-6 w-6 transition-transform group-hover:-translate-x-0.5 shrink-0" aria-hidden />
          <span className="font-normal text-base">Collapse Sidebar</span>
        </button>
      </div>
    </aside>
  );
}
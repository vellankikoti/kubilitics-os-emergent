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
} from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useResourceCounts } from '@/hooks/useResourceCounts';

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
        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="flex-1">{label}</span>
      {count !== undefined && (
        <span
          className={cn(
            'text-xs px-1.5 py-0.5 rounded-md min-w-[1.5rem] text-center',
            isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
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
}

function NavGroup({ label, children, defaultOpen = true }: NavGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="space-y-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronRight
          className={cn('h-3 w-3 transition-transform', isOpen && 'rotate-90')}
        />
        {label}
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-0.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Sidebar() {
  const { counts, isLoading, isConnected } = useResourceCounts();
  
  return (
    <aside className="w-60 h-[calc(100vh-3.5rem)] overflow-y-auto border-r border-border bg-sidebar p-3 space-y-6">
      {/* Overview */}
      <div className="space-y-0.5">
        <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
        <NavItem to="/topology" icon={Network} label="Topology" />
        <NavItem to="/settings" icon={Settings} label="Settings" />
      </div>

      {/* Connection indicator */}
      {isLoading && (
        <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Syncing...</span>
        </div>
      )}

      {/* Workloads */}
      <NavGroup label="Workloads" defaultOpen={false}>
        <NavItem to="/pods" icon={Box} label="Pods" count={counts.pods} />
        <NavItem to="/deployments" icon={Container} label="Deployments" count={counts.deployments} />
        <NavItem to="/replicasets" icon={Layers} label="ReplicaSets" count={counts.replicasets} />
        <NavItem to="/statefulsets" icon={Layers} label="StatefulSets" count={counts.statefulsets} />
        <NavItem to="/daemonsets" icon={Layers} label="DaemonSets" count={counts.daemonsets} />
        <NavItem to="/jobs" icon={Activity} label="Jobs" count={counts.jobs} />
        <NavItem to="/cronjobs" icon={Clock} label="CronJobs" count={counts.cronjobs} />
      </NavGroup>

      {/* Networking */}
      <NavGroup label="Networking" defaultOpen={false}>
        <NavItem to="/services" icon={Globe} label="Services" count={counts.services} />
        <NavItem to="/ingresses" icon={Globe} label="Ingresses" count={counts.ingresses} />
        <NavItem to="/ingressclasses" icon={Route} label="Ingress Classes" count={counts.ingressclasses} />
        <NavItem to="/endpoints" icon={Globe} label="Endpoints" count={counts.endpoints} />
        <NavItem to="/endpointslices" icon={Network} label="Endpoint Slices" count={counts.endpointslices} />
        <NavItem to="/networkpolicies" icon={Shield} label="Network Policies" count={counts.networkpolicies} />
      </NavGroup>

      {/* Storage */}
      <NavGroup label="Storage" defaultOpen={false}>
        <NavItem to="/configmaps" icon={Settings} label="ConfigMaps" count={counts.configmaps} />
        <NavItem to="/secrets" icon={Key} label="Secrets" count={counts.secrets} />
        <NavItem to="/persistentvolumes" icon={HardDrive} label="Persistent Volumes" count={counts.persistentvolumes} />
        <NavItem to="/persistentvolumeclaims" icon={Database} label="PVCs" count={counts.persistentvolumeclaims} />
        <NavItem to="/storageclasses" icon={Database} label="Storage Classes" count={counts.storageclasses} />
        <NavItem to="/volumeattachments" icon={HardDrive} label="Volume Attachments" count={counts.volumeattachments} />
      </NavGroup>

      {/* Cluster */}
      <NavGroup label="Cluster" defaultOpen={false}>
        <NavItem to="/nodes" icon={Server} label="Nodes" count={counts.nodes} />
        <NavItem to="/namespaces" icon={FileText} label="Namespaces" count={counts.namespaces} />
        <NavItem to="/events" icon={Activity} label="Events" />
        <NavItem to="/apiservices" icon={FileCode} label="API Services" count={counts.apiservices} />
        <NavItem to="/leases" icon={Activity} label="Leases" count={counts.leases} />
      </NavGroup>

      {/* Security & Access */}
      <NavGroup label="Security & Access" defaultOpen={false}>
        <NavItem to="/serviceaccounts" icon={Users} label="Service Accounts" count={counts.serviceaccounts} />
        <NavItem to="/roles" icon={Shield} label="Roles" count={counts.roles} />
        <NavItem to="/clusterroles" icon={Shield} label="Cluster Roles" count={counts.clusterroles} />
        <NavItem to="/rolebindings" icon={Shield} label="Role Bindings" count={counts.rolebindings} />
        <NavItem to="/clusterrolebindings" icon={Shield} label="Cluster Role Bindings" count={counts.clusterrolebindings} />
        <NavItem to="/priorityclasses" icon={AlertTriangle} label="Priority Classes" count={counts.priorityclasses} />
      </NavGroup>

      {/* Resource Management */}
      <NavGroup label="Resource Management" defaultOpen={false}>
        <NavItem to="/resourcequotas" icon={Gauge} label="Resource Quotas" count={counts.resourcequotas} />
        <NavItem to="/limitranges" icon={Scale} label="Limit Ranges" count={counts.limitranges} />
      </NavGroup>

      {/* Scaling & Policies */}
      <NavGroup label="Scaling & Policies" defaultOpen={false}>
        <NavItem to="/horizontalpodautoscalers" icon={Scale} label="HPAs" count={counts.horizontalpodautoscalers} />
        <NavItem to="/verticalpodautoscalers" icon={Scale} label="VPAs" count={counts.verticalpodautoscalers} />
        <NavItem to="/poddisruptionbudgets" icon={Shield} label="PDBs" count={counts.poddisruptionbudgets} />
      </NavGroup>

      {/* Custom Resources */}
      <NavGroup label="Custom Resources" defaultOpen={false}>
        <NavItem to="/customresourcedefinitions" icon={FileCode} label="CRDs" count={counts.customresourcedefinitions} />
        <NavItem to="/customresources" icon={FileCode} label="Custom Resources" />
      </NavGroup>

      {/* Admission Control */}
      <NavGroup label="Admission Control" defaultOpen={false}>
        <NavItem to="/mutatingwebhooks" icon={Webhook} label="Mutating Webhooks" count={counts.mutatingwebhookconfigurations} />
        <NavItem to="/validatingwebhooks" icon={Webhook} label="Validating Webhooks" count={counts.validatingwebhookconfigurations} />
      </NavGroup>
    </aside>
  );
}
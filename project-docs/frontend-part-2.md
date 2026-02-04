# Kubilitics Frontend Engineering Blueprint — Part 2

## Screens, Interactions & Navigation

**Document Version:** 1.0
**Last Updated:** February 2026
**Status:** AUTHORITATIVE — Single Source of Truth

---

## Table of Contents

1. [Application Shell & Navigation](#1-application-shell--navigation)
2. [Dashboard Screen](#2-dashboard-screen)
3. [Pod List Screen](#3-pod-list-screen)
4. [Pod Detail Screen](#4-pod-detail-screen)
5. [Universal Search Modal](#5-universal-search-modal)
6. [Cluster Selector](#6-cluster-selector)
7. [Settings Screen](#7-settings-screen)
8. [User Interaction Specification](#8-user-interaction-specification)
9. [Mobile Adaptations](#9-mobile-adaptations)

---

## 1. Application Shell & Navigation

### 1.1 Screen Identity

| Attribute | Value |
|-----------|-------|
| **Screen Name** | AppShell |
| **Entry Points** | Application launch |
| **Platforms** | Desktop, Mobile, Web |
| **Persistent** | Yes (always visible) |

### 1.2 Layout Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ HEADER (64px height)                                                        │
│ ┌──────────┬──────────────────────────────────────────┬──────────────────┐ │
│ │  Logo    │  Cluster Selector  │  Search (Cmd+K)     │  User / Settings │ │
│ └──────────┴──────────────────────────────────────────┴──────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│ BODY                                                                        │
│ ┌────────────────┬──────────────────────────────────────────────────────┐  │
│ │                │                                                       │  │
│ │  SIDEBAR       │                    MAIN CONTENT                       │  │
│ │  (256px)       │                                                       │  │
│ │                │                                                       │  │
│ │  - Dashboard   │                                                       │  │
│ │  - Topology    │                                                       │  │
│ │  - Workloads   │                                                       │  │
│ │  - Networking  │                                                       │  │
│ │  - Storage     │                                                       │  │
│ │  - Config      │                                                       │  │
│ │  - Security    │                                                       │  │
│ │  - Cluster     │                                                       │  │
│ │                │                                                       │  │
│ │  [Collapse]    │                                                       │  │
│ │                │                                                       │  │
│ └────────────────┴──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 AppShell Component Specification

```typescript
// src/components/layout/AppShell/AppShell.tsx
import { type FC, type ReactNode, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { DetailPanel } from './DetailPanel';
import { useUIStore } from '@/stores/uiStore';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/utils/cn';

interface AppShellProps {
  children?: ReactNode;
}

export const AppShell: FC<AppShellProps> = ({ children }) => {
  const { sidebarCollapsed, detailPanelOpen, detailPanelContent } = useUIStore();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(max-width: 1024px)');

  return (
    <div className="flex h-screen flex-col bg-background-primary overflow-hidden">
      {/* Header - Fixed */}
      <Header className="h-16 flex-shrink-0 border-b border-neutral-200 dark:border-neutral-800" />

      {/* Body - Flexible */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Collapsible */}
        {!isMobile && (
          <Sidebar
            collapsed={sidebarCollapsed}
            className={cn(
              'flex-shrink-0 border-r border-neutral-200 dark:border-neutral-800',
              'transition-[width] duration-200 ease-out',
              sidebarCollapsed ? 'w-16' : 'w-64'
            )}
          />
        )}

        {/* Main Content */}
        <main
          className={cn(
            'flex-1 overflow-auto',
            'transition-[margin] duration-200 ease-out'
          )}
        >
          {children ?? <Outlet />}
        </main>

        {/* Detail Panel - Slide-in */}
        {detailPanelOpen && !isMobile && (
          <DetailPanel
            content={detailPanelContent}
            className={cn(
              'w-[400px] flex-shrink-0 border-l border-neutral-200 dark:border-neutral-800',
              'animate-slideInRight'
            )}
          />
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      {isMobile && <MobileBottomNav />}

      {/* Mobile Detail Sheet */}
      {isMobile && detailPanelOpen && (
        <MobileDetailSheet content={detailPanelContent} />
      )}
    </div>
  );
};
```

### 1.4 Header Component

```typescript
// src/components/layout/Header/Header.tsx
import { type FC } from 'react';
import { Logo } from './Logo';
import { ClusterSelector } from '@/features/cluster/ClusterSelector';
import { SearchTrigger } from '@/features/search/SearchTrigger';
import { UserMenu } from './UserMenu';
import { ThemeToggle } from './ThemeToggle';
import { cn } from '@/utils/cn';

interface HeaderProps {
  className?: string;
}

export const Header: FC<HeaderProps> = ({ className }) => {
  return (
    <header
      className={cn(
        'flex items-center justify-between px-4',
        'bg-background-elevated',
        className
      )}
      role="banner"
    >
      {/* Left Section */}
      <div className="flex items-center gap-4">
        <Logo />
        <ClusterSelector />
      </div>

      {/* Center Section - Search */}
      <div className="flex-1 max-w-xl mx-4">
        <SearchTrigger />
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
};
```

### 1.5 Sidebar Component

```typescript
// src/components/layout/Sidebar/Sidebar.tsx
import { type FC } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Network,
  Box,
  Globe,
  HardDrive,
  FileText,
  Shield,
  Server,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip';

interface SidebarProps {
  collapsed: boolean;
  className?: string;
}

interface NavItem {
  id: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
  path: string;
  badge?: number;
}

const navigationItems: NavItem[] = [
  { id: 'dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard, path: '/' },
  { id: 'topology', labelKey: 'nav.topology', icon: Network, path: '/topology' },
  { id: 'workloads', labelKey: 'nav.workloads', icon: Box, path: '/workloads' },
  { id: 'networking', labelKey: 'nav.networking', icon: Globe, path: '/networking' },
  { id: 'storage', labelKey: 'nav.storage', icon: HardDrive, path: '/storage' },
  { id: 'configuration', labelKey: 'nav.configuration', icon: FileText, path: '/configuration' },
  { id: 'security', labelKey: 'nav.security', icon: Shield, path: '/security' },
  { id: 'cluster', labelKey: 'nav.cluster', icon: Server, path: '/cluster' },
];

export const Sidebar: FC<SidebarProps> = ({ collapsed, className }) => {
  const { t } = useTranslation();
  const { toggleSidebar } = useUIStore();
  const location = useLocation();

  return (
    <nav
      className={cn('flex flex-col bg-background-secondary', className)}
      role="navigation"
      aria-label={t('nav.mainNavigation')}
    >
      {/* Navigation Items */}
      <ul className="flex-1 py-2 space-y-1 px-2">
        {navigationItems.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path));

          const linkContent = (
            <NavLink
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md',
                'transition-colors duration-150',
                'hover:bg-neutral-100 dark:hover:bg-neutral-800',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500',
                isActive && 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-400',
                collapsed && 'justify-center'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <item.icon
                size={20}
                className={cn(
                  'flex-shrink-0',
                  isActive ? 'text-cyan-600 dark:text-cyan-400' : 'text-neutral-500'
                )}
                aria-hidden="true"
              />
              {!collapsed && (
                <span className="text-sm font-medium truncate">
                  {t(item.labelKey)}
                </span>
              )}
              {!collapsed && item.badge !== undefined && item.badge > 0 && (
                <span className="ml-auto bg-rose-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );

          return (
            <li key={item.id}>
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right">
                    {t(item.labelKey)}
                  </TooltipContent>
                </Tooltip>
              ) : (
                linkContent
              )}
            </li>
          );
        })}
      </ul>

      {/* Collapse Toggle */}
      <div className="p-2 border-t border-neutral-200 dark:border-neutral-800">
        <button
          onClick={toggleSidebar}
          className={cn(
            'flex items-center justify-center w-full py-2 rounded-md',
            'hover:bg-neutral-100 dark:hover:bg-neutral-800',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500',
            'transition-colors duration-150'
          )}
          aria-label={collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
        >
          {collapsed ? (
            <ChevronRight size={20} className="text-neutral-500" />
          ) : (
            <>
              <ChevronLeft size={20} className="text-neutral-500" />
              <span className="ml-2 text-sm text-neutral-500">{t('nav.collapse')}</span>
            </>
          )}
        </button>
      </div>
    </nav>
  );
};
```

### 1.6 Routing Configuration

```typescript
// src/routes/index.tsx
import { createBrowserRouter, RouteObject } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';

// Lazy-loaded pages
import { lazy, Suspense } from 'react';
import { PageLoader } from '@/components/feedback/Loading';

const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Topology = lazy(() => import('@/pages/Topology'));
const Workloads = lazy(() => import('@/pages/Workloads'));
const Networking = lazy(() => import('@/pages/Networking'));
const Storage = lazy(() => import('@/pages/Storage'));
const Configuration = lazy(() => import('@/pages/Configuration'));
const Security = lazy(() => import('@/pages/Security'));
const Cluster = lazy(() => import('@/pages/Cluster'));
const Settings = lazy(() => import('@/pages/Settings'));
const NotFound = lazy(() => import('@/pages/NotFound'));

// Resource detail pages
const PodList = lazy(() => import('@/features/resources/pods/PodList'));
const PodDetail = lazy(() => import('@/features/resources/pods/PodDetail'));
const DeploymentList = lazy(() => import('@/features/resources/deployments/DeploymentList'));
const DeploymentDetail = lazy(() => import('@/features/resources/deployments/DeploymentDetail'));
// ... (50+ resource types)

const withSuspense = (Component: React.LazyExoticComponent<React.FC>) => (
  <Suspense fallback={<PageLoader />}>
    <Component />
  </Suspense>
);

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      // Dashboard
      { index: true, element: withSuspense(Dashboard) },

      // Full Topology View
      { path: 'topology', element: withSuspense(Topology) },

      // Workloads
      {
        path: 'workloads',
        children: [
          { index: true, element: withSuspense(Workloads) },
          { path: 'pods', element: withSuspense(PodList) },
          { path: 'pods/:namespace/:name', element: withSuspense(PodDetail) },
          { path: 'deployments', element: withSuspense(DeploymentList) },
          { path: 'deployments/:namespace/:name', element: withSuspense(DeploymentDetail) },
          { path: 'statefulsets', element: withSuspense(StatefulSetList) },
          { path: 'statefulsets/:namespace/:name', element: withSuspense(StatefulSetDetail) },
          { path: 'daemonsets', element: withSuspense(DaemonSetList) },
          { path: 'daemonsets/:namespace/:name', element: withSuspense(DaemonSetDetail) },
          { path: 'replicasets', element: withSuspense(ReplicaSetList) },
          { path: 'replicasets/:namespace/:name', element: withSuspense(ReplicaSetDetail) },
          { path: 'jobs', element: withSuspense(JobList) },
          { path: 'jobs/:namespace/:name', element: withSuspense(JobDetail) },
          { path: 'cronjobs', element: withSuspense(CronJobList) },
          { path: 'cronjobs/:namespace/:name', element: withSuspense(CronJobDetail) },
        ],
      },

      // Networking
      {
        path: 'networking',
        children: [
          { index: true, element: withSuspense(Networking) },
          { path: 'services', element: withSuspense(ServiceList) },
          { path: 'services/:namespace/:name', element: withSuspense(ServiceDetail) },
          { path: 'ingresses', element: withSuspense(IngressList) },
          { path: 'ingresses/:namespace/:name', element: withSuspense(IngressDetail) },
          { path: 'networkpolicies', element: withSuspense(NetworkPolicyList) },
          { path: 'networkpolicies/:namespace/:name', element: withSuspense(NetworkPolicyDetail) },
          { path: 'endpoints', element: withSuspense(EndpointsList) },
          { path: 'endpointslices', element: withSuspense(EndpointSliceList) },
        ],
      },

      // Storage
      {
        path: 'storage',
        children: [
          { index: true, element: withSuspense(Storage) },
          { path: 'persistentvolumes', element: withSuspense(PVList) },
          { path: 'persistentvolumes/:name', element: withSuspense(PVDetail) },
          { path: 'persistentvolumeclaims', element: withSuspense(PVCList) },
          { path: 'persistentvolumeclaims/:namespace/:name', element: withSuspense(PVCDetail) },
          { path: 'storageclasses', element: withSuspense(StorageClassList) },
          { path: 'storageclasses/:name', element: withSuspense(StorageClassDetail) },
        ],
      },

      // Configuration
      {
        path: 'configuration',
        children: [
          { index: true, element: withSuspense(Configuration) },
          { path: 'configmaps', element: withSuspense(ConfigMapList) },
          { path: 'configmaps/:namespace/:name', element: withSuspense(ConfigMapDetail) },
          { path: 'secrets', element: withSuspense(SecretList) },
          { path: 'secrets/:namespace/:name', element: withSuspense(SecretDetail) },
          { path: 'resourcequotas', element: withSuspense(ResourceQuotaList) },
          { path: 'limitranges', element: withSuspense(LimitRangeList) },
        ],
      },

      // Security / RBAC
      {
        path: 'security',
        children: [
          { index: true, element: withSuspense(Security) },
          { path: 'serviceaccounts', element: withSuspense(ServiceAccountList) },
          { path: 'serviceaccounts/:namespace/:name', element: withSuspense(ServiceAccountDetail) },
          { path: 'roles', element: withSuspense(RoleList) },
          { path: 'roles/:namespace/:name', element: withSuspense(RoleDetail) },
          { path: 'rolebindings', element: withSuspense(RoleBindingList) },
          { path: 'clusterroles', element: withSuspense(ClusterRoleList) },
          { path: 'clusterroles/:name', element: withSuspense(ClusterRoleDetail) },
          { path: 'clusterrolebindings', element: withSuspense(ClusterRoleBindingList) },
        ],
      },

      // Cluster
      {
        path: 'cluster',
        children: [
          { index: true, element: withSuspense(Cluster) },
          { path: 'nodes', element: withSuspense(NodeList) },
          { path: 'nodes/:name', element: withSuspense(NodeDetail) },
          { path: 'namespaces', element: withSuspense(NamespaceList) },
          { path: 'namespaces/:name', element: withSuspense(NamespaceDetail) },
          { path: 'events', element: withSuspense(EventList) },
          { path: 'crds', element: withSuspense(CRDList) },
          { path: 'crds/:name', element: withSuspense(CRDDetail) },
        ],
      },

      // Settings
      { path: 'settings', element: withSuspense(Settings) },
      { path: 'settings/:section', element: withSuspense(Settings) },

      // Catch-all
      { path: '*', element: withSuspense(NotFound) },
    ],
  },
];

export const router = createBrowserRouter(routes);
```

---

## 2. Dashboard Screen

### 2.1 Screen Identity

| Attribute | Value |
|-----------|-------|
| **Screen Name** | Dashboard |
| **Route** | `/` |
| **Entry Points** | App launch, Sidebar click, Cmd+1 |
| **Platforms** | Desktop, Mobile, Web |

### 2.2 Layout Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ DASHBOARD                                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ CLUSTER PULSE (Summary Bar)                                          │   │
│  │ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                     │   │
│  │ │Workloads│ │ Network │ │ Storage │ │Security │                     │   │
│  │ │ 42/50   │ │  100%   │ │   80%   │ │12 warns │                     │   │
│  │ └─────────┘ └─────────┘ └─────────┘ └─────────┘                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌───────────────────────────────┐ ┌───────────────────────────────────┐   │
│  │ TOPOLOGY PREVIEW              │ │ RECENT EVENTS                     │   │
│  │                               │ │                                   │   │
│  │    [Mini topology graph]      │ │ ⚠️ payment-db CPU (2m)            │   │
│  │                               │ │ ✅ nginx scaled (5m)              │   │
│  │                               │ │ ❌ backup-job failed (12m)        │   │
│  │                               │ │                                   │   │
│  │   [View Full Topology →]      │ │ [View All Events →]               │   │
│  └───────────────────────────────┘ └───────────────────────────────────┘   │
│                                                                             │
│  ┌───────────────────────────────┐ ┌───────────────────────────────────┐   │
│  │ RESOURCE OVERVIEW             │ │ AI INSIGHTS (Premium)             │   │
│  │                               │ │                                   │   │
│  │ Pods:       156 running       │ │ "Consider increasing payment-db   │   │
│  │ Deployments: 23 healthy       │ │  CPU limit to prevent latency"    │   │
│  │ Services:    45 active        │ │                                   │   │
│  │ Nodes:        5 ready         │ │ [Apply Fix] [Dismiss]             │   │
│  │                               │ │                                   │   │
│  └───────────────────────────────┘ └───────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Dashboard Component

```typescript
// src/pages/Dashboard.tsx
import { type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { ClusterPulse } from '@/features/cluster/ClusterPulse';
import { TopologyPreview } from '@/features/topology/components/TopologyPreview';
import { RecentEvents } from '@/features/resources/events/RecentEvents';
import { ResourceOverview } from '@/features/resources/_shared/ResourceOverview';
import { AIInsights } from '@/features/ai/AIInsights';
import { useClusterStore } from '@/stores/clusterStore';
import { useClusterPulse } from '@/hooks/useClusterPulse';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const Dashboard: FC = () => {
  const { t } = useTranslation();
  const { currentCluster } = useClusterStore();
  const { data: pulse, isLoading, error } = useClusterPulse(currentCluster?.id);

  if (!currentCluster) {
    return <NoClusterSelected />;
  }

  if (error) {
    return <DashboardError error={error} />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          {t('dashboard.title')}
        </h1>
        <span className="text-sm text-neutral-500">
          {t('dashboard.cluster')}: {currentCluster.name}
        </span>
      </div>

      {/* Cluster Pulse */}
      <ClusterPulse data={pulse} isLoading={isLoading} />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Topology Preview */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('dashboard.topologyPreview')}</CardTitle>
            <Link
              to="/topology"
              className="flex items-center gap-1 text-sm text-cyan-600 hover:text-cyan-700"
            >
              {t('dashboard.viewFullTopology')}
              <ArrowRight size={16} />
            </Link>
          </CardHeader>
          <CardContent className="h-[300px]">
            <TopologyPreview clusterId={currentCluster.id} />
          </CardContent>
        </Card>

        {/* Recent Events */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('dashboard.recentEvents')}</CardTitle>
            <Link
              to="/cluster/events"
              className="flex items-center gap-1 text-sm text-cyan-600 hover:text-cyan-700"
            >
              {t('dashboard.viewAllEvents')}
              <ArrowRight size={16} />
            </Link>
          </CardHeader>
          <CardContent>
            <RecentEvents limit={5} />
          </CardContent>
        </Card>

        {/* Resource Overview */}
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.resourceOverview')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResourceOverview />
          </CardContent>
        </Card>

        {/* AI Insights (Premium) */}
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.aiInsights')}</CardTitle>
          </CardHeader>
          <CardContent>
            <AIInsights />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
```

---

## 3. Pod List Screen

### 3.1 Screen Identity

| Attribute | Value |
|-----------|-------|
| **Screen Name** | PodList |
| **Route** | `/workloads/pods` |
| **Entry Points** | Sidebar > Workloads > Pods, Search, Deep link |
| **Platforms** | Desktop, Mobile, Web |

### 3.2 Layout Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PODS                                                     [Toggle: List/Topo]│
├─────────────────────────────────────────────────────────────────────────────┤
│ FILTERS                                                                     │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ │
│ │ Namespace ▼│ │  Status   ▼│ │   Node    ▼│ │  Labels   ▼│ │🔍 Search   │ │
│ └────────────┘ └────────────┘ └────────────┘ └────────────┘ └────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│ TABLE                                                                       │
│ ┌───┬────────────────────┬───────────┬─────────┬──────────┬─────┬────────┐ │
│ │ □ │ Name               │ Namespace │ Status  │ Restarts │ Age │ Node   │ │
│ ├───┼────────────────────┼───────────┼─────────┼──────────┼─────┼────────┤ │
│ │ □ │ nginx-7c4b8-x2m4k  │ default   │●Running │    0     │ 2d  │ node-1 │ │
│ │ □ │ nginx-7c4b8-k8p2n  │ default   │●Running │    0     │ 2d  │ node-2 │ │
│ │ □ │ payment-5f6d-8j3k  │ payment   │◐Warning │    5     │ 1h  │ node-1 │ │
│ │ □ │ redis-master-0     │ cache     │●Running │    0     │ 5d  │ node-3 │ │
│ └───┴────────────────────┴───────────┴─────────┴──────────┴─────┴────────┘ │
│                                                                             │
│ PAGINATION                                                                  │
│ Showing 1-50 of 156    [< Prev] [1] [2] [3] [4] [Next >]    [50 per page ▼]│
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Pod List Component

```typescript
// src/features/resources/pods/PodList.tsx
import { type FC, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/Table';
import { Checkbox } from '@/components/ui/Checkbox';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/common/StatusBadge';
import { RelativeTime } from '@/components/common/RelativeTime';
import { NamespaceFilter } from '@/components/filters/NamespaceFilter';
import { StatusFilter } from '@/components/filters/StatusFilter';
import { NodeFilter } from '@/components/filters/NodeFilter';
import { LabelFilter } from '@/components/filters/LabelFilter';
import { SearchInput } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { ViewToggle } from '@/components/common/ViewToggle';
import { PodContextMenu } from './PodContextMenu';
import { BulkActions } from '@/components/common/BulkActions';
import { useClusterStore } from '@/stores/clusterStore';
import { useUIStore } from '@/stores/uiStore';
import { podService } from '@/services/api/resources';
import { mapPodStatus } from '@/utils/kubernetes';
import type { Pod, PodListFilters } from '@/types/kubernetes';

interface PodListState {
  filters: PodListFilters;
  sort: {
    column: keyof Pod['metadata'] | keyof Pod['status'] | 'restarts' | 'age';
    direction: 'asc' | 'desc';
  };
  pagination: {
    page: number;
    pageSize: number;
  };
  selectedIds: Set<string>;
}

const PodList: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentCluster } = useClusterStore();
  const { setDetailPanel } = useUIStore();

  const [state, setState] = useState<PodListState>({
    filters: {
      namespace: '',
      status: '',
      node: '',
      labels: {},
      search: '',
    },
    sort: {
      column: 'name',
      direction: 'asc',
    },
    pagination: {
      page: 1,
      pageSize: 50,
    },
    selectedIds: new Set(),
  });

  // Fetch pods with filters
  const {
    data: podsResponse,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['pods', currentCluster?.id, state.filters, state.pagination],
    queryFn: () =>
      podService.list({
        clusterId: currentCluster!.id,
        ...state.filters,
        page: state.pagination.page,
        pageSize: state.pagination.pageSize,
      }),
    enabled: !!currentCluster,
    refetchInterval: 5000, // Real-time updates
  });

  const pods = podsResponse?.items ?? [];
  const totalCount = podsResponse?.metadata?.totalCount ?? 0;

  // Sort pods client-side
  const sortedPods = useMemo(() => {
    return [...pods].sort((a, b) => {
      const { column, direction } = state.sort;
      let aVal: string | number;
      let bVal: string | number;

      switch (column) {
        case 'name':
          aVal = a.metadata.name;
          bVal = b.metadata.name;
          break;
        case 'namespace':
          aVal = a.metadata.namespace;
          bVal = b.metadata.namespace;
          break;
        case 'restarts':
          aVal = a.status.containerStatuses?.reduce((sum, c) => sum + c.restartCount, 0) ?? 0;
          bVal = b.status.containerStatuses?.reduce((sum, c) => sum + c.restartCount, 0) ?? 0;
          break;
        case 'age':
          aVal = new Date(a.metadata.creationTimestamp).getTime();
          bVal = new Date(b.metadata.creationTimestamp).getTime();
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [pods, state.sort]);

  // Handlers
  const handleSort = useCallback((column: typeof state.sort.column) => {
    setState((prev) => ({
      ...prev,
      sort: {
        column,
        direction:
          prev.sort.column === column && prev.sort.direction === 'asc' ? 'desc' : 'asc',
      },
    }));
  }, []);

  const handleRowClick = useCallback(
    (pod: Pod) => {
      navigate(`/workloads/pods/${pod.metadata.namespace}/${pod.metadata.name}`);
    },
    [navigate]
  );

  const handleRowHover = useCallback(
    (pod: Pod | null) => {
      if (pod) {
        setDetailPanel({
          type: 'pod-preview',
          data: pod,
        });
      }
    },
    [setDetailPanel]
  );

  const handleSelectAll = useCallback(() => {
    setState((prev) => {
      const allIds = sortedPods.map((p) => `${p.metadata.namespace}/${p.metadata.name}`);
      const allSelected = allIds.every((id) => prev.selectedIds.has(id));

      return {
        ...prev,
        selectedIds: allSelected ? new Set() : new Set(allIds),
      };
    });
  }, [sortedPods]);

  const handleSelectRow = useCallback((pod: Pod) => {
    const id = `${pod.metadata.namespace}/${pod.metadata.name}`;
    setState((prev) => {
      const newSelected = new Set(prev.selectedIds);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      return { ...prev, selectedIds: newSelected };
    });
  }, []);

  // Loading state
  if (isLoading && pods.length === 0) {
    return <PodListSkeleton />;
  }

  // Error state
  if (error) {
    return <PodListError error={error} onRetry={refetch} />;
  }

  // Empty state
  if (pods.length === 0 && !isLoading) {
    return <PodListEmpty filters={state.filters} />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800">
        <h1 className="text-xl font-semibold">{t('pods.title')}</h1>
        <ViewToggle
          view="list"
          onViewChange={(view) => {
            if (view === 'topology') {
              navigate('/topology?filter=pods');
            }
          }}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 p-4 border-b border-neutral-200 dark:border-neutral-800">
        <NamespaceFilter
          value={state.filters.namespace}
          onChange={(namespace) =>
            setState((prev) => ({ ...prev, filters: { ...prev.filters, namespace } }))
          }
        />
        <StatusFilter
          value={state.filters.status}
          onChange={(status) =>
            setState((prev) => ({ ...prev, filters: { ...prev.filters, status } }))
          }
          options={['Running', 'Pending', 'Failed', 'Succeeded', 'Unknown']}
        />
        <NodeFilter
          value={state.filters.node}
          onChange={(node) =>
            setState((prev) => ({ ...prev, filters: { ...prev.filters, node } }))
          }
        />
        <LabelFilter
          value={state.filters.labels}
          onChange={(labels) =>
            setState((prev) => ({ ...prev, filters: { ...prev.filters, labels } }))
          }
        />
        <SearchInput
          placeholder={t('pods.searchPlaceholder')}
          value={state.filters.search}
          onChange={(e) =>
            setState((prev) => ({
              ...prev,
              filters: { ...prev.filters, search: e.target.value },
            }))
          }
          className="w-64"
        />
      </div>

      {/* Bulk Actions */}
      {state.selectedIds.size > 0 && (
        <BulkActions
          selectedCount={state.selectedIds.size}
          onDelete={() => handleBulkDelete(Array.from(state.selectedIds))}
          onRestart={() => handleBulkRestart(Array.from(state.selectedIds))}
          onClearSelection={() =>
            setState((prev) => ({ ...prev, selectedIds: new Set() }))
          }
        />
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={
                    sortedPods.length > 0 &&
                    sortedPods.every((p) =>
                      state.selectedIds.has(`${p.metadata.namespace}/${p.metadata.name}`)
                    )
                  }
                  onCheckedChange={handleSelectAll}
                  aria-label={t('pods.selectAll')}
                />
              </TableHead>
              <TableHead
                sortable
                sortDirection={state.sort.column === 'name' ? state.sort.direction : null}
                onSort={() => handleSort('name')}
              >
                {t('pods.columns.name')}
              </TableHead>
              <TableHead
                sortable
                sortDirection={state.sort.column === 'namespace' ? state.sort.direction : null}
                onSort={() => handleSort('namespace')}
              >
                {t('pods.columns.namespace')}
              </TableHead>
              <TableHead>{t('pods.columns.status')}</TableHead>
              <TableHead
                sortable
                sortDirection={state.sort.column === 'restarts' ? state.sort.direction : null}
                onSort={() => handleSort('restarts')}
              >
                {t('pods.columns.restarts')}
              </TableHead>
              <TableHead
                sortable
                sortDirection={state.sort.column === 'age' ? state.sort.direction : null}
                onSort={() => handleSort('age')}
              >
                {t('pods.columns.age')}
              </TableHead>
              <TableHead>{t('pods.columns.node')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPods.map((pod) => {
              const id = `${pod.metadata.namespace}/${pod.metadata.name}`;
              const isSelected = state.selectedIds.has(id);
              const status = mapPodStatus(pod);
              const restartCount =
                pod.status.containerStatuses?.reduce((sum, c) => sum + c.restartCount, 0) ?? 0;

              return (
                <PodContextMenu key={id} pod={pod}>
                  <TableRow
                    isSelected={isSelected}
                    onClick={() => handleRowClick(pod)}
                    onMouseEnter={() => handleRowHover(pod)}
                    onMouseLeave={() => handleRowHover(null)}
                    className="cursor-pointer"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRowClick(pod);
                      if (e.key === ' ') {
                        e.preventDefault();
                        handleSelectRow(pod);
                      }
                    }}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleSelectRow(pod)}
                        aria-label={t('pods.selectPod', { name: pod.metadata.name })}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{pod.metadata.name}</TableCell>
                    <TableCell>{pod.metadata.namespace}</TableCell>
                    <TableCell>
                      <StatusBadge status={status} />
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          restartCount > 5 ? 'text-amber-600 font-medium' : undefined
                        }
                      >
                        {restartCount}
                      </span>
                    </TableCell>
                    <TableCell>
                      <RelativeTime date={pod.metadata.creationTimestamp} />
                    </TableCell>
                    <TableCell>{pod.spec.nodeName ?? '-'}</TableCell>
                  </TableRow>
                </PodContextMenu>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between p-4 border-t border-neutral-200 dark:border-neutral-800">
        <span className="text-sm text-neutral-500">
          {t('pods.showing', {
            start: (state.pagination.page - 1) * state.pagination.pageSize + 1,
            end: Math.min(state.pagination.page * state.pagination.pageSize, totalCount),
            total: totalCount,
          })}
        </span>
        <Pagination
          currentPage={state.pagination.page}
          totalPages={Math.ceil(totalCount / state.pagination.pageSize)}
          onPageChange={(page) =>
            setState((prev) => ({ ...prev, pagination: { ...prev.pagination, page } }))
          }
        />
        <select
          value={state.pagination.pageSize}
          onChange={(e) =>
            setState((prev) => ({
              ...prev,
              pagination: { pageSize: Number(e.target.value), page: 1 },
            }))
          }
          className="border rounded px-2 py-1 text-sm"
          aria-label={t('pods.pageSize')}
        >
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>
    </div>
  );
};

export default PodList;
```

### 3.4 Pod Context Menu

```typescript
// src/features/resources/pods/PodContextMenu.tsx
import { type FC, type ReactNode } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuShortcut,
} from '@/components/ui/ContextMenu';
import {
  Eye,
  FileText,
  Terminal,
  RefreshCw,
  Trash2,
  Copy,
  Network,
  Bug,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { usePodActions } from './hooks/usePodActions';
import type { Pod } from '@/types/kubernetes';

interface PodContextMenuProps {
  pod: Pod;
  children: ReactNode;
}

export const PodContextMenu: FC<PodContextMenuProps> = ({ pod, children }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    viewLogs,
    execIntoContainer,
    restartPod,
    deletePod,
    copyPodName,
    copyPodYaml,
    showInTopology,
  } = usePodActions();

  const containers = pod.spec.containers;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {/* View Details */}
        <ContextMenuItem
          onClick={() =>
            navigate(`/workloads/pods/${pod.metadata.namespace}/${pod.metadata.name}`)
          }
        >
          <Eye className="mr-2 h-4 w-4" />
          {t('pods.actions.viewDetails')}
          <ContextMenuShortcut>Enter</ContextMenuShortcut>
        </ContextMenuItem>

        {/* View Logs - with container submenu if multiple */}
        {containers.length === 1 ? (
          <ContextMenuItem onClick={() => viewLogs(pod, containers[0].name)}>
            <FileText className="mr-2 h-4 w-4" />
            {t('pods.actions.viewLogs')}
            <ContextMenuShortcut>L</ContextMenuShortcut>
          </ContextMenuItem>
        ) : (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <FileText className="mr-2 h-4 w-4" />
              {t('pods.actions.viewLogs')}
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {containers.map((container) => (
                <ContextMenuItem
                  key={container.name}
                  onClick={() => viewLogs(pod, container.name)}
                >
                  {container.name}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}

        {/* Exec - with container submenu if multiple */}
        {containers.length === 1 ? (
          <ContextMenuItem onClick={() => execIntoContainer(pod, containers[0].name)}>
            <Terminal className="mr-2 h-4 w-4" />
            {t('pods.actions.exec')}
            <ContextMenuShortcut>E</ContextMenuShortcut>
          </ContextMenuItem>
        ) : (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Terminal className="mr-2 h-4 w-4" />
              {t('pods.actions.exec')}
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {containers.map((container) => (
                <ContextMenuItem
                  key={container.name}
                  onClick={() => execIntoContainer(pod, container.name)}
                >
                  {container.name}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}

        <ContextMenuSeparator />

        {/* Show in Topology */}
        <ContextMenuItem onClick={() => showInTopology(pod)}>
          <Network className="mr-2 h-4 w-4" />
          {t('pods.actions.showInTopology')}
          <ContextMenuShortcut>T</ContextMenuShortcut>
        </ContextMenuItem>

        {/* Debug (Port Forward) */}
        <ContextMenuItem onClick={() => debugPod(pod)}>
          <Bug className="mr-2 h-4 w-4" />
          {t('pods.actions.debug')}
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Copy */}
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Copy className="mr-2 h-4 w-4" />
            {t('pods.actions.copy')}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem onClick={() => copyPodName(pod)}>
              {t('pods.actions.copyName')}
            </ContextMenuItem>
            <ContextMenuItem onClick={() => copyPodYaml(pod)}>
              {t('pods.actions.copyYaml')}
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />

        {/* Restart */}
        <ContextMenuItem onClick={() => restartPod(pod)}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {t('pods.actions.restart')}
          <ContextMenuShortcut>R</ContextMenuShortcut>
        </ContextMenuItem>

        {/* Delete - Danger Zone */}
        <ContextMenuItem
          onClick={() => deletePod(pod)}
          className="text-rose-600 focus:text-rose-600"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {t('pods.actions.delete')}
          <ContextMenuShortcut>⌫</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
```

---

## 4. Pod Detail Screen

### 4.1 Screen Identity

| Attribute | Value |
|-----------|-------|
| **Screen Name** | PodDetail |
| **Route** | `/workloads/pods/:namespace/:name` |
| **Entry Points** | Pod list click, Search, Topology click, Deep link, Event click, AI recommendation |
| **Platforms** | Desktop, Mobile, Web |

### 4.2 Layout Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ POD DETAIL                                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ HEADER                                                                      │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ← Back   nginx-7c4b8b7f9-x2m4k            ●Running   Restarts: 0       │ │
│ │          Namespace: default               Owner: deployment/nginx       │ │
│ │                                                                         │ │
│ │ [View Logs] [Exec] [Restart] [⋮ More]                                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│ TABS (Fixed Order - CANNOT BE REORDERED)                                    │
│ ┌────────┬────────────┬────────┬──────┬──────────┬──────┬──────────┬─────┐ │
│ │Overview│ Containers │ Events │ Logs │ Topology │ YAML │ Security │Perf │ │
│ └────────┴────────────┴────────┴──────┴──────────┴──────┴──────────┴─────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│ TAB CONTENT (Scrollable)                                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │                                                                         │ │
│ │  [Content varies by selected tab - see sections below]                  │ │
│ │                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Tab Order (FIXED - NON-NEGOTIABLE)

```typescript
// src/features/resources/pods/PodDetail.tsx
export const POD_TABS = [
  { id: 'overview', labelKey: 'pods.tabs.overview', component: PodOverview },
  { id: 'containers', labelKey: 'pods.tabs.containers', component: PodContainers },
  { id: 'events', labelKey: 'pods.tabs.events', component: PodEvents },
  { id: 'logs', labelKey: 'pods.tabs.logs', component: PodLogs },
  { id: 'topology', labelKey: 'pods.tabs.topology', component: PodTopology },
  { id: 'yaml', labelKey: 'pods.tabs.yaml', component: PodYaml },
  { id: 'security', labelKey: 'pods.tabs.security', component: PodSecurity },
  { id: 'performance', labelKey: 'pods.tabs.performance', component: PodPerformance },
] as const;

// Tab order is IMMUTABLE per PRD requirement
```

### 4.4 Pod Detail Component

```typescript
// src/features/resources/pods/PodDetail.tsx
import { type FC, useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileText, Terminal, RefreshCw, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { StatusBadge } from '@/components/common/StatusBadge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu';
import { PodOverview } from './PodOverview';
import { PodContainers } from './PodContainers';
import { PodEvents } from './PodEvents';
import { PodLogs } from './PodLogs';
import { PodTopology } from './PodTopology';
import { PodYaml } from './PodYaml';
import { PodSecurity } from './PodSecurity';
import { PodPerformance } from './PodPerformance';
import { PodDetailSkeleton } from './PodDetailSkeleton';
import { PodDetailError } from './PodDetailError';
import { usePodActions } from './hooks/usePodActions';
import { useClusterStore } from '@/stores/clusterStore';
import { podService } from '@/services/api/resources';
import { mapPodStatus } from '@/utils/kubernetes';

const PodDetail: FC = () => {
  const { namespace, name } = useParams<{ namespace: string; name: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') ?? 'overview';
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentCluster } = useClusterStore();
  const { viewLogs, execIntoContainer, restartPod, deletePod } = usePodActions();

  // Fetch pod data
  const {
    data: pod,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['pod', currentCluster?.id, namespace, name],
    queryFn: () =>
      podService.get({
        clusterId: currentCluster!.id,
        namespace: namespace!,
        name: name!,
      }),
    enabled: !!currentCluster && !!namespace && !!name,
    refetchInterval: 5000,
  });

  // Update URL when tab changes
  const handleTabChange = (tabId: string) => {
    setSearchParams({ tab: tabId });
  };

  if (isLoading) {
    return <PodDetailSkeleton />;
  }

  if (error || !pod) {
    return <PodDetailError error={error} onRetry={refetch} />;
  }

  const status = mapPodStatus(pod);
  const restartCount =
    pod.status.containerStatuses?.reduce((sum, c) => sum + c.restartCount, 0) ?? 0;
  const ownerRef = pod.metadata.ownerReferences?.[0];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex-shrink-0 p-4 border-b border-neutral-200 dark:border-neutral-800">
        {/* Navigation */}
        <div className="flex items-center gap-2 mb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            aria-label={t('common.back')}
          >
            <ArrowLeft size={16} />
          </Button>
          <span className="text-sm text-neutral-500">
            {t('pods.backToList')}
          </span>
        </div>

        {/* Pod Info */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold">{pod.metadata.name}</h1>
              <StatusBadge status={status} />
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-neutral-500">
              <span>
                {t('pods.namespace')}: {pod.metadata.namespace}
              </span>
              {ownerRef && (
                <span>
                  {t('pods.owner')}: {ownerRef.kind}/{ownerRef.name}
                </span>
              )}
              <span>
                {t('pods.restarts')}: {restartCount}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => viewLogs(pod, pod.spec.containers[0].name)}
              leftIcon={<FileText size={16} />}
            >
              {t('pods.actions.viewLogs')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => execIntoContainer(pod, pod.spec.containers[0].name)}
              leftIcon={<Terminal size={16} />}
            >
              {t('pods.actions.exec')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => restartPod(pod)}
              leftIcon={<RefreshCw size={16} />}
            >
              {t('pods.actions.restart')}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreVertical size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => copyPodYaml(pod)}>
                  {t('pods.actions.copyYaml')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => showInTopology(pod)}>
                  {t('pods.actions.showInTopology')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => deletePod(pod)}
                  className="text-rose-600"
                >
                  {t('pods.actions.delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <TabsList className="flex-shrink-0 px-4 border-b border-neutral-200 dark:border-neutral-800">
          {POD_TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {t(tab.labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="flex-1 overflow-auto">
          <TabsContent value="overview" className="p-4">
            <PodOverview pod={pod} />
          </TabsContent>
          <TabsContent value="containers" className="p-4">
            <PodContainers pod={pod} />
          </TabsContent>
          <TabsContent value="events" className="p-4">
            <PodEvents pod={pod} />
          </TabsContent>
          <TabsContent value="logs" className="p-4 h-full">
            <PodLogs pod={pod} />
          </TabsContent>
          <TabsContent value="topology" className="h-full">
            <PodTopology pod={pod} />
          </TabsContent>
          <TabsContent value="yaml" className="p-4">
            <PodYaml pod={pod} />
          </TabsContent>
          <TabsContent value="security" className="p-4">
            <PodSecurity pod={pod} />
          </TabsContent>
          <TabsContent value="performance" className="p-4">
            <PodPerformance pod={pod} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default PodDetail;
```

### 4.5 Pod Overview Tab

```typescript
// src/features/resources/pods/PodOverview.tsx
import { type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { RelativeTime } from '@/components/common/RelativeTime';
import { InfoRow } from '@/components/common/InfoRow';
import type { Pod } from '@/types/kubernetes';

interface PodOverviewProps {
  pod: Pod;
}

export const PodOverview: FC<PodOverviewProps> = ({ pod }) => {
  const { t } = useTranslation();

  const qosClass = pod.status.qosClass ?? 'Unknown';
  const containerCount = pod.spec.containers.length;
  const initContainerCount = pod.spec.initContainers?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>{t('pods.overview.basicInfo')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <InfoRow label={t('pods.overview.name')} value={pod.metadata.name} />
          <InfoRow label={t('pods.overview.namespace')} value={pod.metadata.namespace} />
          <InfoRow label={t('pods.overview.uid')} value={pod.metadata.uid} mono />
          <InfoRow
            label={t('pods.overview.created')}
            value={<RelativeTime date={pod.metadata.creationTimestamp} showAbsolute />}
          />
          <InfoRow label={t('pods.overview.phase')} value={<StatusBadge status={pod.status.phase.toLowerCase()} />} />
          <InfoRow label={t('pods.overview.qosClass')} value={qosClass} />
        </CardContent>
      </Card>

      {/* Pod Status */}
      <Card>
        <CardHeader>
          <CardTitle>{t('pods.overview.status')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <InfoRow label={t('pods.overview.podIP')} value={pod.status.podIP ?? '-'} mono />
          <InfoRow label={t('pods.overview.hostIP')} value={pod.status.hostIP ?? '-'} mono />
          <InfoRow label={t('pods.overview.nodeName')} value={pod.spec.nodeName ?? '-'} />
          <InfoRow
            label={t('pods.overview.containers')}
            value={`${containerCount} container${containerCount !== 1 ? 's' : ''}`}
          />
          {initContainerCount > 0 && (
            <InfoRow
              label={t('pods.overview.initContainers')}
              value={`${initContainerCount} init container${initContainerCount !== 1 ? 's' : ''}`}
            />
          )}
        </CardContent>
      </Card>

      {/* Conditions */}
      <Card>
        <CardHeader>
          <CardTitle>{t('pods.overview.conditions')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {pod.status.conditions?.map((condition) => (
              <div
                key={condition.type}
                className="flex items-center justify-between py-2 border-b last:border-0"
              >
                <span className="font-medium">{condition.type}</span>
                <StatusBadge
                  status={condition.status === 'True' ? 'healthy' : 'warning'}
                  label={condition.status}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Labels & Annotations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('pods.overview.labels')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {Object.entries(pod.metadata.labels ?? {}).map(([key, value]) => (
                <div key={key} className="flex items-start gap-2 text-sm">
                  <span className="font-mono text-neutral-500">{key}:</span>
                  <span className="font-mono">{value}</span>
                </div>
              ))}
              {Object.keys(pod.metadata.labels ?? {}).length === 0 && (
                <span className="text-neutral-500">{t('common.none')}</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('pods.overview.annotations')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-48 overflow-auto">
              {Object.entries(pod.metadata.annotations ?? {}).map(([key, value]) => (
                <div key={key} className="flex flex-col gap-1 text-sm py-1 border-b last:border-0">
                  <span className="font-mono text-neutral-500 text-xs">{key}</span>
                  <span className="font-mono text-xs break-all">{value}</span>
                </div>
              ))}
              {Object.keys(pod.metadata.annotations ?? {}).length === 0 && (
                <span className="text-neutral-500">{t('common.none')}</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
```

### 4.6 Pod Topology Tab (MANDATORY - CORE VALUE)

```typescript
// src/features/resources/pods/PodTopology.tsx
import { type FC, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TopologyCanvas } from '@/features/topology/components/TopologyCanvas';
import { TopologyControls } from '@/features/topology/components/TopologyControls';
import { TopologyLegend } from '@/features/topology/components/TopologyLegend';
import { TopologyLoading } from '@/features/topology/components/TopologyLoading';
import { TopologyError } from '@/features/topology/components/TopologyError';
import { useClusterStore } from '@/stores/clusterStore';
import { topologyService } from '@/services/api/topology';
import type { Pod } from '@/types/kubernetes';

interface PodTopologyProps {
  pod: Pod;
}

/**
 * Pod Topology Tab - MANDATORY per PRD
 *
 * Must show graph closure including:
 * - Compute: Pod, ReplicaSet, Deployment, Node
 * - Networking: Services, EndpointSlices, NetworkPolicies, Ingress
 * - Storage: PVCs, PVs, StorageClass, CSI
 * - Configuration: ConfigMaps, Secrets
 * - Security: ServiceAccount, Role/ClusterRole, RoleBinding/ClusterRoleBinding
 * - System: Namespace, ResourceQuota, LimitRange, Webhooks, Helm, GitOps
 *
 * If ANY connected resource exists and is not visible, the topology is INVALID.
 */
export const PodTopology: FC<PodTopologyProps> = ({ pod }) => {
  const { currentCluster } = useClusterStore();

  // Fetch full topology graph centered on this pod
  const {
    data: graph,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      'topology',
      'pod',
      currentCluster?.id,
      pod.metadata.namespace,
      pod.metadata.name,
    ],
    queryFn: () =>
      topologyService.getPodTopology({
        clusterId: currentCluster!.id,
        namespace: pod.metadata.namespace,
        podName: pod.metadata.name,
        depth: -1, // Full graph closure - NO DEPTH LIMIT per PRD
      }),
    enabled: !!currentCluster,
    refetchInterval: 10000,
  });

  // Validate graph completeness (per PRD requirement)
  const graphValidation = useMemo(() => {
    if (!graph) return null;
    return topologyService.validateGraph(graph);
  }, [graph]);

  if (isLoading) {
    return <TopologyLoading />;
  }

  if (error) {
    return <TopologyError error={error} onRetry={refetch} />;
  }

  // Graph validation failure - show explicit error per PRD
  if (graphValidation && !graphValidation.isValid) {
    return (
      <TopologyError
        error={{
          message: 'Topology graph validation failed',
          details: graphValidation.missingRelationships,
        }}
        onRetry={refetch}
      />
    );
  }

  return (
    <div className="relative h-full">
      {/* Topology Canvas */}
      <TopologyCanvas
        graph={graph!}
        centeredNodeId={`pod/${pod.metadata.namespace}/${pod.metadata.name}`}
        className="h-full"
      />

      {/* Controls (Zoom, Fit, Export) */}
      <TopologyControls className="absolute top-4 right-4" />

      {/* Legend */}
      <TopologyLegend className="absolute bottom-4 left-4" />
    </div>
  );
};
```

---

## 5. Universal Search Modal

### 5.1 Screen Identity

| Attribute | Value |
|-----------|-------|
| **Screen Name** | SearchModal |
| **Trigger** | Cmd+K (Mac), Ctrl+K (Windows/Linux), Click search bar |
| **Platforms** | Desktop, Mobile, Web |

### 5.2 Search Modal Component

```typescript
// src/features/search/components/SearchModal.tsx
import { type FC, useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { SearchResults } from './SearchResults';
import { SearchHints } from './SearchHints';
import { useSearchStore } from '@/stores/searchStore';
import { useClusterStore } from '@/stores/clusterStore';
import { searchService } from '@/services/api/search';
import { Search, Loader2 } from 'lucide-react';

export const SearchModal: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isOpen, close, recentSearches, addRecentSearch } = useSearchStore();
  const { currentCluster } = useClusterStore();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounce(query, 200);

  // Search query
  const {
    data: results,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ['search', currentCluster?.id, debouncedQuery],
    queryFn: () =>
      searchService.search({
        clusterId: currentCluster!.id,
        query: debouncedQuery,
        limit: 20,
      }),
    enabled: !!currentCluster && debouncedQuery.length >= 2,
  });

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const totalResults = results?.items?.length ?? 0;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, totalResults - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (results?.items?.[selectedIndex]) {
            handleSelectResult(results.items[selectedIndex]);
          }
          break;
        case 'Escape':
          close();
          break;
      }
    },
    [results, selectedIndex, close]
  );

  const handleSelectResult = useCallback(
    (result: SearchResult) => {
      addRecentSearch(query);
      close();

      // Navigate based on result type
      const path = buildResourcePath(result.kind, result.namespace, result.name);
      navigate(path);
    },
    [query, addRecentSearch, close, navigate]
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0">
        {/* Search Input */}
        <DialogHeader className="p-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
              size={20}
            />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('search.placeholder')}
              className="pl-10 pr-10"
              aria-label={t('search.ariaLabel')}
            />
            {isFetching && (
              <Loader2
                className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-neutral-500"
                size={20}
              />
            )}
          </div>
        </DialogHeader>

        {/* Results */}
        <div className="max-h-[60vh] overflow-auto">
          {query.length < 2 ? (
            <SearchHints recentSearches={recentSearches} />
          ) : isLoading ? (
            <SearchResultsSkeleton />
          ) : results?.items?.length === 0 ? (
            <SearchNoResults query={query} />
          ) : (
            <SearchResults
              results={results!.items}
              selectedIndex={selectedIndex}
              onSelect={handleSelectResult}
              onHover={setSelectedIndex}
            />
          )}
        </div>

        {/* Footer with shortcuts */}
        <div className="flex items-center justify-between p-3 border-t border-neutral-200 dark:border-neutral-800 text-xs text-neutral-500">
          <div className="flex items-center gap-4">
            <span>
              <kbd className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded">↵</kbd>
              {' '}{t('search.toSelect')}
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded">↑↓</kbd>
              {' '}{t('search.toNavigate')}
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded">esc</kbd>
              {' '}{t('search.toClose')}
            </span>
          </div>
          <span>{t('search.searchTip')}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
};
```

---

## 6. Cluster Selector

### 6.1 Component Specification

```typescript
// src/features/cluster/ClusterSelector.tsx
import { type FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/Popover';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useClusterStore } from '@/stores/clusterStore';
import { ChevronDown, Plus, RefreshCw, Settings, Check } from 'lucide-react';

export const ClusterSelector: FC = () => {
  const { t } = useTranslation();
  const {
    clusters,
    currentCluster,
    setCurrentCluster,
    refreshClusters,
    isRefreshing,
  } = useClusterStore();

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredClusters = clusters.filter((cluster) =>
    cluster.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectCluster = (clusterId: string) => {
    setCurrentCluster(clusterId);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          aria-label={t('cluster.selectCluster')}
          className="w-[250px] justify-between"
        >
          {currentCluster ? (
            <div className="flex items-center gap-2 truncate">
              <StatusBadge
                status={currentCluster.status === 'connected' ? 'healthy' : 'warning'}
                size="sm"
                showDot
                label=""
              />
              <span className="truncate">{currentCluster.name}</span>
            </div>
          ) : (
            <span className="text-neutral-500">{t('cluster.selectCluster')}</span>
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        {/* Search */}
        <div className="p-2 border-b border-neutral-200 dark:border-neutral-800">
          <Input
            placeholder={t('cluster.searchClusters')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8"
          />
        </div>

        {/* Cluster List */}
        <div className="max-h-[300px] overflow-auto p-1">
          {filteredClusters.length === 0 ? (
            <div className="py-6 text-center text-sm text-neutral-500">
              {t('cluster.noClustersFound')}
            </div>
          ) : (
            filteredClusters.map((cluster) => (
              <button
                key={cluster.id}
                onClick={() => handleSelectCluster(cluster.id)}
                className={`
                  w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm
                  hover:bg-neutral-100 dark:hover:bg-neutral-800
                  ${currentCluster?.id === cluster.id ? 'bg-cyan-50 dark:bg-cyan-950/30' : ''}
                `}
              >
                <StatusBadge
                  status={cluster.status === 'connected' ? 'healthy' : 'warning'}
                  size="sm"
                  showDot
                  label=""
                />
                <div className="flex-1 text-left">
                  <div className="font-medium">{cluster.name}</div>
                  <div className="text-xs text-neutral-500">{cluster.context}</div>
                </div>
                {currentCluster?.id === cluster.id && (
                  <Check className="h-4 w-4 text-cyan-600" />
                )}
              </button>
            ))
          )}
        </div>

        {/* Actions */}
        <div className="border-t border-neutral-200 dark:border-neutral-800 p-1">
          <button
            onClick={refreshClusters}
            disabled={isRefreshing}
            className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {t('cluster.refresh')}
          </button>
          <button
            onClick={() => navigate('/settings/clusters')}
            className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <Settings className="h-4 w-4" />
            {t('cluster.manage')}
          </button>
          <button
            onClick={() => openAddClusterModal()}
            className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <Plus className="h-4 w-4" />
            {t('cluster.addNew')}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
```

---

## 7. Settings Screen

### 7.1 Settings Component

```typescript
// src/pages/Settings.tsx
import { type FC } from 'react';
import { useParams, NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Palette,
  Globe,
  Keyboard,
  Bell,
  Shield,
  Server,
  Puzzle,
  Info,
} from 'lucide-react';

const settingsSections = [
  { id: 'appearance', labelKey: 'settings.appearance', icon: Palette },
  { id: 'language', labelKey: 'settings.language', icon: Globe },
  { id: 'shortcuts', labelKey: 'settings.shortcuts', icon: Keyboard },
  { id: 'notifications', labelKey: 'settings.notifications', icon: Bell },
  { id: 'security', labelKey: 'settings.security', icon: Shield },
  { id: 'clusters', labelKey: 'settings.clusters', icon: Server },
  { id: 'plugins', labelKey: 'settings.plugins', icon: Puzzle },
  { id: 'about', labelKey: 'settings.about', icon: Info },
];

const Settings: FC = () => {
  const { t } = useTranslation();
  const { section = 'appearance' } = useParams();

  return (
    <div className="flex h-full">
      {/* Settings Navigation */}
      <nav className="w-64 border-r border-neutral-200 dark:border-neutral-800 p-4">
        <h1 className="text-lg font-semibold mb-4">{t('settings.title')}</h1>
        <ul className="space-y-1">
          {settingsSections.map((s) => (
            <li key={s.id}>
              <NavLink
                to={`/settings/${s.id}`}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                    isActive
                      ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-400'
                      : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`
                }
              >
                <s.icon size={18} />
                {t(s.labelKey)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Settings Content */}
      <div className="flex-1 p-6 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
};

export default Settings;
```

---

## 8. User Interaction Specification

### 8.1 Complete Interaction Matrix

| Interaction | Trigger | UI Feedback | Backend Call | Topology Impact | Failure Handling |
|-------------|---------|-------------|--------------|-----------------|------------------|
| **Click Node** | Left-click on topology node | Node scales 1.02, selection ring appears, detail panel slides in | GET /api/v1/resources/:kind/:namespace/:name | None | Toast error, node stays selected |
| **Hover Node** | Mouse enter topology node | Node glow effect, connected nodes highlight, unrelated fade to 30% | None (client-side) | Blast radius visualization | N/A |
| **Double-click Node** | Double-click topology node | Group expands/collapses with animation | None (client-side) | Layout recalculates | N/A |
| **Right-click Node** | Right-click / Ctrl+click | Context menu appears at cursor | None | None | N/A |
| **Drag Canvas** | Left-click + drag on empty space | Canvas pans smoothly | None | None | N/A |
| **Scroll/Pinch** | Mouse wheel / trackpad pinch | Zoom 10%-500% with smooth easing | None | None | Clamp at limits |
| **Shift+Drag** | Shift + left-drag | Selection box appears | None | Multiple selection | N/A |
| **Space** | Spacebar on topology | Pause/resume indicator, updates freeze | WebSocket pause | Layout frozen | N/A |
| **Cmd+K** | Cmd+K / Ctrl+K | Search modal opens | None initially | None | N/A |
| **Search Query** | Type in search modal | Results update with 200ms debounce | GET /api/v1/search?q=... | None | Show "no results" |
| **Enter Search** | Enter on selected result | Modal closes, navigates to resource | None | None | Toast error |
| **Delete Pod** | Delete action (context menu / button) | Confirmation modal with impact preview | DELETE /api/v1/pods/:ns/:name | Node fades out after deletion | Toast error, rollback UI |
| **Restart Pod** | Restart action | Loading state, then success toast | POST /api/v1/pods/:ns/:name/restart | Node flashes, status updates | Toast error |
| **Scale Deployment** | Scale action | Replica slider, preview | PATCH /api/v1/deployments/:ns/:name | New pod nodes appear | Toast error, rollback |
| **View Logs** | Logs action | Log panel opens, live stream starts | WebSocket /api/v1/logs/:ns/:name/:container | None | Reconnect with backoff |
| **Exec Shell** | Exec action | Terminal panel opens, session starts | WebSocket /api/v1/exec/:ns/:name/:container | None | Reconnect with backoff |

### 8.2 Keyboard Shortcut Complete List

```typescript
// src/config/keyboardShortcuts.ts
export const KEYBOARD_SHORTCUTS = {
  // Global
  'cmd+k': { action: 'openSearch', description: 'Open universal search' },
  'cmd+,': { action: 'openSettings', description: 'Open settings' },
  'cmd+1': { action: 'goToDashboard', description: 'Go to dashboard' },
  'cmd+2': { action: 'goToTopology', description: 'Go to topology' },
  'cmd+3': { action: 'goToWorkloads', description: 'Go to workloads' },
  'cmd+w': { action: 'closeCurrentTab', description: 'Close current tab' },
  'cmd+shift+p': { action: 'openCommandPalette', description: 'Open command palette' },
  'escape': { action: 'closeModal', description: 'Close modal / deselect' },
  '?': { action: 'showShortcuts', description: 'Show keyboard shortcuts' },
  'r': { action: 'refresh', description: 'Refresh current view' },
  't': { action: 'toggleView', description: 'Toggle topology/list view' },

  // Topology
  '+': { action: 'zoomIn', scope: 'topology', description: 'Zoom in' },
  '-': { action: 'zoomOut', scope: 'topology', description: 'Zoom out' },
  '0': { action: 'resetZoom', scope: 'topology', description: 'Reset zoom' },
  'f': { action: 'fitToScreen', scope: 'topology', description: 'Fit to screen' },
  ' ': { action: 'togglePause', scope: 'topology', description: 'Pause/resume updates' },
  'ArrowUp': { action: 'selectPrevious', scope: 'topology', description: 'Select previous node' },
  'ArrowDown': { action: 'selectNext', scope: 'topology', description: 'Select next node' },
  'ArrowLeft': { action: 'selectParent', scope: 'topology', description: 'Select parent node' },
  'ArrowRight': { action: 'selectChild', scope: 'topology', description: 'Select first child' },
  'Enter': { action: 'openDetail', scope: 'topology', description: 'Open node detail' },
  'e': { action: 'exportTopology', scope: 'topology', description: 'Export topology' },

  // List
  'j': { action: 'moveDown', scope: 'list', description: 'Move down' },
  'k': { action: 'moveUp', scope: 'list', description: 'Move up' },
  'x': { action: 'toggleSelect', scope: 'list', description: 'Toggle selection' },
  'cmd+a': { action: 'selectAll', scope: 'list', description: 'Select all' },
  'Delete': { action: 'deleteSelected', scope: 'list', description: 'Delete selected' },
  'l': { action: 'viewLogs', scope: 'list', description: 'View logs' },
  'Enter': { action: 'openDetail', scope: 'list', description: 'Open detail' },

  // Detail
  '1': { action: 'tab1', scope: 'detail', description: 'Go to Overview tab' },
  '2': { action: 'tab2', scope: 'detail', description: 'Go to Containers tab' },
  '3': { action: 'tab3', scope: 'detail', description: 'Go to Events tab' },
  '4': { action: 'tab4', scope: 'detail', description: 'Go to Logs tab' },
  '5': { action: 'tab5', scope: 'detail', description: 'Go to Topology tab' },
  '6': { action: 'tab6', scope: 'detail', description: 'Go to YAML tab' },
  '7': { action: 'tab7', scope: 'detail', description: 'Go to Security tab' },
  '8': { action: 'tab8', scope: 'detail', description: 'Go to Performance tab' },
} as const;
```

### 8.3 Gesture Specification (Mobile)

| Gesture | Context | Action |
|---------|---------|--------|
| **Tap** | Node | Select node, show bottom sheet |
| **Long press** | Node | Open context menu |
| **Pinch** | Canvas | Zoom in/out |
| **Two-finger drag** | Canvas | Pan |
| **Swipe left** | List row | Show quick actions |
| **Swipe right** | List row | Select row |
| **Pull down** | List | Refresh |
| **Swipe down** | Bottom sheet | Close |

---

## 9. Mobile Adaptations

### 9.1 Responsive Breakpoints

```typescript
// src/styles/breakpoints.ts
export const breakpoints = {
  sm: '640px',   // Mobile landscape
  md: '768px',   // Tablet portrait
  lg: '1024px',  // Tablet landscape / small desktop
  xl: '1280px',  // Desktop
  '2xl': '1536px', // Large desktop
} as const;

// Media query hooks
export const mediaQueries = {
  isMobile: '(max-width: 767px)',
  isTablet: '(min-width: 768px) and (max-width: 1023px)',
  isDesktop: '(min-width: 1024px)',
  prefersReducedMotion: '(prefers-reduced-motion: reduce)',
  prefersDarkMode: '(prefers-color-scheme: dark)',
} as const;
```

### 9.2 Mobile Layout Adaptations

```typescript
// Mobile-specific components and behavior

// 1. Bottom Navigation (replaces sidebar)
const MobileBottomNav: FC = () => (
  <nav className="fixed bottom-0 left-0 right-0 h-16 bg-background-elevated border-t safe-area-inset-bottom">
    <div className="flex items-center justify-around h-full">
      {mobileNavItems.map((item) => (
        <NavLink key={item.id} to={item.path}>
          <item.icon size={24} />
          <span className="text-xs">{item.label}</span>
        </NavLink>
      ))}
    </div>
  </nav>
);

// 2. Bottom Sheet (replaces detail panel)
const MobileDetailSheet: FC<{ content: DetailContent }> = ({ content }) => (
  <Sheet open={!!content}>
    <SheetContent side="bottom" className="h-[60vh]">
      <SheetHandle /> {/* Drag indicator */}
      <DetailContent content={content} />
    </SheetContent>
  </Sheet>
);

// 3. Full-screen Topology (no sidebars)
const MobileTopology: FC = () => (
  <div className="fixed inset-0 z-50">
    <TopologyCanvas fullscreen />
    <MobileTopologyControls />
    <MobileTopologyLegend />
    <MobileTopologyBottomBar />
  </div>
);
```

---

## Next: Part 3 — Topology Rendering & State Management

Continue to `frontend-part-3.md` for:
- Cytoscape.js integration
- Graph rendering engine
- Deterministic layout algorithm
- State management patterns
- Real-time updates
- Export system

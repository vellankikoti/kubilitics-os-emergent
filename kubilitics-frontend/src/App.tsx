import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useClusterStore } from "@/stores/clusterStore";
import { AIAssistant } from "@/components/AIAssistant";

// Pages - Entry & Setup
import ModeSelection from "./pages/ModeSelection";
import ClusterConnect from "./pages/ClusterConnect";
import ConnectedRedirect from "./pages/ConnectedRedirect";
import KubeConfigSetup from "./pages/KubeConfigSetup";
import ClusterSelection from "./pages/ClusterSelection";
import DashboardPage from "./pages/DashboardPage";
import HomePage from "./pages/HomePage";
import ProjectDetailPage from "./pages/ProjectDetailPage";

// Workloads
import Pods from "./pages/Pods";
import PodDetail from "./pages/PodDetail";
import NotFound from "./pages/NotFound";
import Deployments from "./pages/Deployments";
import DeploymentDetail from "./pages/DeploymentDetail";
import ReplicaSets from "./pages/ReplicaSets";
import ReplicaSetDetail from "./pages/ReplicaSetDetail";
import StatefulSets from "./pages/StatefulSets";
import StatefulSetDetail from "./pages/StatefulSetDetail";
import DaemonSets from "./pages/DaemonSets";
import DaemonSetDetail from "./pages/DaemonSetDetail";
import Jobs from "./pages/Jobs";
import JobDetail from "./pages/JobDetail";
import CronJobs from "./pages/CronJobs";
import CronJobDetail from "./pages/CronJobDetail";
import ReplicationControllers from "./pages/ReplicationControllers";
import ReplicationControllerDetail from "./pages/ReplicationControllerDetail";
import PodTemplates from "./pages/PodTemplates";
import PodTemplateDetail from "./pages/PodTemplateDetail";
import ControllerRevisions from "./pages/ControllerRevisions";
import ControllerRevisionDetail from "./pages/ControllerRevisionDetail";
import ResourceSlices from "./pages/ResourceSlices";
import ResourceSliceDetail from "./pages/ResourceSliceDetail";
import DeviceClasses from "./pages/DeviceClasses";
import DeviceClassDetail from "./pages/DeviceClassDetail";
import IPAddressPools from "./pages/IPAddressPools";
import IPAddressPoolDetail from "./pages/IPAddressPoolDetail";
import BGPPeers from "./pages/BGPPeers";
import BGPPeerDetail from "./pages/BGPPeerDetail";
import WorkloadsOverview from "./pages/WorkloadsOverview";

// Networking
import Services from "./pages/Services";
import ServiceDetail from "./pages/ServiceDetail";
import Endpoints from "./pages/Endpoints";
import EndpointDetail from "./pages/EndpointDetail";
import EndpointSlices from "./pages/EndpointSlices";
import EndpointSliceDetail from "./pages/EndpointSliceDetail";
import Ingresses from "./pages/Ingresses";
import IngressDetail from "./pages/IngressDetail";
import IngressClasses from "./pages/IngressClasses";
import IngressClassDetail from "./pages/IngressClassDetail";
import NetworkPolicies from "./pages/NetworkPolicies";
import NetworkPolicyDetail from "./pages/NetworkPolicyDetail";

// Storage & Config
import ConfigMaps from "./pages/ConfigMaps";
import ConfigMapDetail from "./pages/ConfigMapDetail";
import Secrets from "./pages/Secrets";
import SecretDetail from "./pages/SecretDetail";
import PersistentVolumes from "./pages/PersistentVolumes";
import PersistentVolumeDetail from "./pages/PersistentVolumeDetail";
import PersistentVolumeClaims from "./pages/PersistentVolumeClaims";
import PersistentVolumeClaimDetail from "./pages/PersistentVolumeClaimDetail";
import StorageClasses from "./pages/StorageClasses";
import StorageClassDetail from "./pages/StorageClassDetail";
import VolumeAttachments from "./pages/VolumeAttachments";
import VolumeAttachmentDetail from "./pages/VolumeAttachmentDetail";
import VolumeSnapshots from "./pages/VolumeSnapshots";
import VolumeSnapshotDetail from "./pages/VolumeSnapshotDetail";
import VolumeSnapshotClasses from "./pages/VolumeSnapshotClasses";
import VolumeSnapshotClassDetail from "./pages/VolumeSnapshotClassDetail";
import VolumeSnapshotContents from "./pages/VolumeSnapshotContents";
import VolumeSnapshotContentDetail from "./pages/VolumeSnapshotContentDetail";

// Cluster
import Nodes from "./pages/Nodes";
import NodeDetail from "./pages/NodeDetail";
import Namespaces from "./pages/Namespaces";
import NamespaceDetail from "./pages/NamespaceDetail";
import Events from "./pages/Events";
import EventDetail from "./pages/EventDetail";
import ComponentStatuses from "./pages/ComponentStatuses";
import ComponentStatusDetail from "./pages/ComponentStatusDetail";
import APIServices from "./pages/APIServices";
import APIServiceDetail from "./pages/APIServiceDetail";
import Leases from "./pages/Leases";
import LeaseDetail from "./pages/LeaseDetail";
import RuntimeClasses from "./pages/RuntimeClasses";
import RuntimeClassDetail from "./pages/RuntimeClassDetail";

// RBAC
import ServiceAccounts from "./pages/ServiceAccounts";
import ServiceAccountDetail from "./pages/ServiceAccountDetail";
import Roles from "./pages/Roles";
import RoleDetail from "./pages/RoleDetail";
import RoleBindings from "./pages/RoleBindings";
import RoleBindingDetail from "./pages/RoleBindingDetail";
import ClusterRoles from "./pages/ClusterRoles";
import ClusterRoleDetail from "./pages/ClusterRoleDetail";
import ClusterRoleBindings from "./pages/ClusterRoleBindings";
import ClusterRoleBindingDetail from "./pages/ClusterRoleBindingDetail";
import PodSecurityPolicies from "./pages/PodSecurityPolicies";
import PodSecurityPolicyDetail from "./pages/PodSecurityPolicyDetail";

// Autoscaling & Resource Management
import HorizontalPodAutoscalers from "./pages/HorizontalPodAutoscalers";
import HorizontalPodAutoscalerDetail from "./pages/HorizontalPodAutoscalerDetail";
import VerticalPodAutoscalers from "./pages/VerticalPodAutoscalers";
import VerticalPodAutoscalerDetail from "./pages/VerticalPodAutoscalerDetail";
import PodDisruptionBudgets from "./pages/PodDisruptionBudgets";
import PodDisruptionBudgetDetail from "./pages/PodDisruptionBudgetDetail";
import ResourceQuotas from "./pages/ResourceQuotas";
import ResourceQuotaDetail from "./pages/ResourceQuotaDetail";
import LimitRanges from "./pages/LimitRanges";
import LimitRangeDetail from "./pages/LimitRangeDetail";
import PriorityClasses from "./pages/PriorityClasses";
import PriorityClassDetail from "./pages/PriorityClassDetail";

// Custom Resources & Admission Control
import CustomResourceDefinitions from "./pages/CustomResourceDefinitions";
import CustomResourceDefinitionDetail from "./pages/CustomResourceDefinitionDetail";
import CustomResources from "./pages/CustomResources";
import MutatingWebhooks from "./pages/MutatingWebhooks";
import MutatingWebhookDetail from "./pages/MutatingWebhookDetail";
import ValidatingWebhooks from "./pages/ValidatingWebhooks";
import ValidatingWebhookDetail from "./pages/ValidatingWebhookDetail";
import Settings from "./pages/Settings";
import Topology from "./pages/Topology";

// Layout
import { AppLayout } from "./components/layout/AppLayout";

// Analytics Dashboards
import { AnalyticsOverview } from "./pages/AnalyticsOverview";
import { SecurityDashboard } from "./pages/SecurityDashboard";
import { MLAnalyticsDashboard } from "./pages/MLAnalyticsDashboard";
import { CostDashboard } from "./pages/CostDashboard";

const queryClient = new QueryClient();

// Protected route wrapper - requires active cluster connection.
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { activeCluster } = useClusterStore();
  if (!activeCluster) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Initial navigation logic: Mode Selection -> Connection -> Dashboard
function ModeSelectionEntryPoint() {
  const { appMode, activeCluster } = useClusterStore();

  // If already connected, go to home (the primary hub)
  if (activeCluster) return <Navigate to="/home" replace />;

  // If mode selected but not connected, go to connect page
  if (appMode) return <Navigate to="/connect" replace />;

  // Default: Choose mode
  return <ModeSelection />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AIAssistant />
        <Routes>
          {/* Entry Point - Mode Selection or Cluster Connection */}
          <Route path="/" element={<ModeSelectionEntryPoint />} />
          <Route path="/mode-selection" element={<ModeSelection />} />
          <Route path="/connect" element={<ClusterConnect />} />

          {/* Apply cluster from Connect and redirect to dashboard (avoids ProtectedRoute timing) */}
          <Route path="/connected" element={<ConnectedRedirect />} />

          {/* Setup Flow - Kubeconfig & Cluster Selection */}
          <Route path="/setup/kubeconfig" element={<KubeConfigSetup />} />
          <Route path="/setup/clusters" element={<ClusterSelection />} />

          {/* Protected App Routes - Require Cluster Connection */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/home" element={<HomePage />} />
            <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/settings" element={<Settings />} />

            {/* Analytics Dashboards */}
            <Route path="/analytics" element={<AnalyticsOverview />} />
            <Route path="/security" element={<SecurityDashboard />} />
            <Route path="/ml-analytics" element={<MLAnalyticsDashboard />} />
            <Route path="/cost" element={<CostDashboard />} />

            {/* Cluster Topology */}
            <Route path="/topology" element={<Topology />} />

            {/* Workloads */}
            <Route path="/workloads" element={<WorkloadsOverview />} />
            <Route path="/pods" element={<Pods />} />
            <Route path="/pods/:namespace/:name" element={<PodDetail />} />
            <Route path="/deployments" element={<Deployments />} />
            <Route path="/deployments/:namespace/:name" element={<DeploymentDetail />} />
            <Route path="/replicasets" element={<ReplicaSets />} />
            <Route path="/replicasets/:namespace/:name" element={<ReplicaSetDetail />} />
            <Route path="/statefulsets" element={<StatefulSets />} />
            <Route path="/statefulsets/:namespace/:name" element={<StatefulSetDetail />} />
            <Route path="/daemonsets" element={<DaemonSets />} />
            <Route path="/daemonsets/:namespace/:name" element={<DaemonSetDetail />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/:namespace/:name" element={<JobDetail />} />
            <Route path="/cronjobs" element={<CronJobs />} />
            <Route path="/cronjobs/:namespace/:name" element={<CronJobDetail />} />
            <Route path="/replicationcontrollers" element={<ReplicationControllers />} />
            <Route path="/replicationcontrollers/:namespace/:name" element={<ReplicationControllerDetail />} />
            <Route path="/replication-controllers/:namespace/:name" element={<ReplicationControllerDetail />} />
            <Route path="/podtemplates" element={<PodTemplates />} />
            <Route path="/podtemplates/:namespace/:name" element={<PodTemplateDetail />} />
            <Route path="/controllerrevisions" element={<ControllerRevisions />} />
            <Route path="/controllerrevisions/:namespace/:name" element={<ControllerRevisionDetail />} />
            <Route path="/resourceslices" element={<ResourceSlices />} />
            <Route path="/resourceslices/:name" element={<ResourceSliceDetail />} />
            <Route path="/deviceclasses" element={<DeviceClasses />} />
            <Route path="/deviceclasses/:name" element={<DeviceClassDetail />} />
            <Route path="/device-classes" element={<DeviceClasses />} />
            <Route path="/device-classes/:name" element={<DeviceClassDetail />} />
            <Route path="/ipaddresspools" element={<IPAddressPools />} />
            <Route path="/ipaddresspools/:namespace/:name" element={<IPAddressPoolDetail />} />
            <Route path="/bgppeers" element={<BGPPeers />} />
            <Route path="/bgppeers/:namespace/:name" element={<BGPPeerDetail />} />

            {/* Networking */}
            <Route path="/services" element={<Services />} />
            <Route path="/services/:namespace/:name" element={<ServiceDetail />} />
            <Route path="/endpoints" element={<Endpoints />} />
            <Route path="/endpoints/:namespace/:name" element={<EndpointDetail />} />
            <Route path="/endpointslices" element={<EndpointSlices />} />
            <Route path="/endpointslices/:namespace/:name" element={<EndpointSliceDetail />} />
            <Route path="/ingresses" element={<Ingresses />} />
            <Route path="/ingresses/:namespace/:name" element={<IngressDetail />} />
            <Route path="/ingressclasses" element={<IngressClasses />} />
            <Route path="/ingressclasses/:name" element={<IngressClassDetail />} />
            <Route path="/networkpolicies" element={<NetworkPolicies />} />
            <Route path="/networkpolicies/:namespace/:name" element={<NetworkPolicyDetail />} />

            {/* Storage & Config */}
            <Route path="/configmaps" element={<ConfigMaps />} />
            <Route path="/configmaps/:namespace/:name" element={<ConfigMapDetail />} />
            <Route path="/secrets" element={<Secrets />} />
            <Route path="/secrets/:namespace/:name" element={<SecretDetail />} />
            <Route path="/persistentvolumes" element={<PersistentVolumes />} />
            <Route path="/persistentvolumes/:name" element={<PersistentVolumeDetail />} />
            <Route path="/persistentvolumeclaims" element={<PersistentVolumeClaims />} />
            <Route path="/persistentvolumeclaims/:namespace/:name" element={<PersistentVolumeClaimDetail />} />
            <Route path="/storageclasses" element={<StorageClasses />} />
            <Route path="/storageclasses/:name" element={<StorageClassDetail />} />
            <Route path="/volumeattachments" element={<VolumeAttachments />} />
            <Route path="/volumeattachments/:name" element={<VolumeAttachmentDetail />} />
            <Route path="/volumesnapshots" element={<VolumeSnapshots />} />
            <Route path="/volumesnapshots/:namespace/:name" element={<VolumeSnapshotDetail />} />
            <Route path="/volume-snapshots" element={<VolumeSnapshots />} />
            <Route path="/volume-snapshots/:namespace/:name" element={<VolumeSnapshotDetail />} />
            <Route path="/volumesnapshotclasses" element={<VolumeSnapshotClasses />} />
            <Route path="/volumesnapshotclasses/:name" element={<VolumeSnapshotClassDetail />} />
            <Route path="/volume-snapshot-classes" element={<VolumeSnapshotClasses />} />
            <Route path="/volume-snapshot-classes/:name" element={<VolumeSnapshotClassDetail />} />
            <Route path="/volumesnapshotcontents" element={<VolumeSnapshotContents />} />
            <Route path="/volumesnapshotcontents/:name" element={<VolumeSnapshotContentDetail />} />
            <Route path="/volume-snapshot-contents" element={<VolumeSnapshotContents />} />
            <Route path="/volume-snapshot-contents/:name" element={<VolumeSnapshotContentDetail />} />

            {/* Cluster */}
            <Route path="/nodes" element={<Nodes />} />
            <Route path="/nodes/:name" element={<NodeDetail />} />
            <Route path="/namespaces" element={<Namespaces />} />
            <Route path="/namespaces/:name" element={<NamespaceDetail />} />
            <Route path="/events" element={<Events />} />
            <Route path="/events/:namespace/:name" element={<EventDetail />} />
            <Route path="/componentstatuses" element={<ComponentStatuses />} />
            <Route path="/componentstatuses/:name" element={<ComponentStatusDetail />} />
            <Route path="/component-statuses/:name" element={<ComponentStatusDetail />} />
            <Route path="/apiservices" element={<APIServices />} />
            <Route path="/apiservices/:name" element={<APIServiceDetail />} />
            <Route path="/leases" element={<Leases />} />
            <Route path="/leases/:namespace/:name" element={<LeaseDetail />} />
            <Route path="/runtimeclasses" element={<RuntimeClasses />} />
            <Route path="/runtimeclasses/:name" element={<RuntimeClassDetail />} />
            <Route path="/runtime-classes/:name" element={<RuntimeClassDetail />} />

            {/* RBAC */}
            <Route path="/serviceaccounts" element={<ServiceAccounts />} />
            <Route path="/serviceaccounts/:namespace/:name" element={<ServiceAccountDetail />} />
            <Route path="/roles" element={<Roles />} />
            <Route path="/roles/:namespace/:name" element={<RoleDetail />} />
            <Route path="/rolebindings" element={<RoleBindings />} />
            <Route path="/rolebindings/:namespace/:name" element={<RoleBindingDetail />} />
            <Route path="/clusterroles" element={<ClusterRoles />} />
            <Route path="/clusterroles/:name" element={<ClusterRoleDetail />} />
            <Route path="/clusterrolebindings" element={<ClusterRoleBindings />} />
            <Route path="/clusterrolebindings/:name" element={<ClusterRoleBindingDetail />} />
            <Route path="/podsecuritypolicies" element={<PodSecurityPolicies />} />
            <Route path="/podsecuritypolicies/:name" element={<PodSecurityPolicyDetail />} />
            <Route path="/pod-security-policies/:name" element={<PodSecurityPolicyDetail />} />

            {/* Autoscaling & Resource Management */}
            <Route path="/horizontalpodautoscalers" element={<HorizontalPodAutoscalers />} />
            <Route path="/horizontalpodautoscalers/:namespace/:name" element={<HorizontalPodAutoscalerDetail />} />
            <Route path="/verticalpodautoscalers" element={<VerticalPodAutoscalers />} />
            <Route path="/verticalpodautoscalers/:namespace/:name" element={<VerticalPodAutoscalerDetail />} />
            <Route path="/poddisruptionbudgets" element={<PodDisruptionBudgets />} />
            <Route path="/poddisruptionbudgets/:namespace/:name" element={<PodDisruptionBudgetDetail />} />
            <Route path="/resourcequotas" element={<ResourceQuotas />} />
            <Route path="/resourcequotas/:namespace/:name" element={<ResourceQuotaDetail />} />
            <Route path="/limitranges" element={<LimitRanges />} />
            <Route path="/limitranges/:namespace/:name" element={<LimitRangeDetail />} />
            <Route path="/priorityclasses" element={<PriorityClasses />} />
            <Route path="/priorityclasses/:name" element={<PriorityClassDetail />} />

            {/* Custom Resources & Admission Control */}
            <Route path="/customresourcedefinitions" element={<CustomResourceDefinitions />} />
            <Route path="/customresourcedefinitions/:name" element={<CustomResourceDefinitionDetail />} />
            <Route path="/custom-resource-definitions/:name" element={<CustomResourceDefinitionDetail />} />
            <Route path="/customresources" element={<CustomResources />} />
            <Route path="/mutatingwebhooks" element={<MutatingWebhooks />} />
            <Route path="/mutatingwebhooks/:name" element={<MutatingWebhookDetail />} />
            <Route path="/validatingwebhooks" element={<ValidatingWebhooks />} />
            <Route path="/validatingwebhooks/:name" element={<ValidatingWebhookDetail />} />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

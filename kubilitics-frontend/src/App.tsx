import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useClusterStore } from "@/stores/clusterStore";

// Pages - Entry & Setup
import ClusterConnect from "./pages/ClusterConnect";
import KubeConfigSetup from "./pages/KubeConfigSetup";
import ClusterSelection from "./pages/ClusterSelection";
import Dashboard from "./pages/Dashboard";
import Pods from "./pages/Pods";
import PodDetail from "./pages/PodDetail";
import Topology from "./pages/Topology";
import NotFound from "./pages/NotFound";

// Workloads
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

// Cluster
import Nodes from "./pages/Nodes";
import NodeDetail from "./pages/NodeDetail";
import Namespaces from "./pages/Namespaces";
import NamespaceDetail from "./pages/NamespaceDetail";
import Events from "./pages/Events";
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

// Layout
import { AppLayout } from "./components/layout/AppLayout";

const queryClient = new QueryClient();

// Protected route wrapper - requires active cluster connection
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { activeCluster } = useClusterStore();
  
  if (!activeCluster) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Entry Point - Cluster Connection (replaces SaaS auth flows) */}
          <Route path="/" element={<ClusterConnect />} />
          
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
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/topology" element={<Topology />} />
            <Route path="/settings" element={<Settings />} />
            
            {/* Workloads */}
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
            
            {/* Cluster */}
            <Route path="/nodes" element={<Nodes />} />
            <Route path="/nodes/:name" element={<NodeDetail />} />
            <Route path="/namespaces" element={<Namespaces />} />
            <Route path="/namespaces/:name" element={<NamespaceDetail />} />
            <Route path="/events" element={<Events />} />
            <Route path="/componentstatuses" element={<ComponentStatuses />} />
            <Route path="/componentstatuses/:name" element={<ComponentStatusDetail />} />
            <Route path="/apiservices" element={<APIServices />} />
            <Route path="/apiservices/:name" element={<APIServiceDetail />} />
            <Route path="/leases" element={<Leases />} />
            <Route path="/leases/:namespace/:name" element={<LeaseDetail />} />
            <Route path="/runtimeclasses" element={<RuntimeClasses />} />
            <Route path="/runtimeclasses/:name" element={<RuntimeClassDetail />} />
            
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
            <Route path="/customresources" element={<CustomResources />} />
            <Route path="/mutatingwebhooks" element={<MutatingWebhooks />} />
            <Route path="/mutatingwebhooks/:name" element={<MutatingWebhookDetail />} />
            <Route path="/validatingwebhooks" element={<ValidatingWebhooks />} />
            <Route path="/validatingwebhooks/:name" element={<ValidatingWebhookDetail />} />
          </Route>
          
          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

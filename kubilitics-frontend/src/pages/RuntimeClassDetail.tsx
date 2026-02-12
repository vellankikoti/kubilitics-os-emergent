import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { normalizeKindForTopology } from '@/utils/resourceKindMapper';
import { FolderCog, Clock, Cpu, Download, Trash2, Settings, Package, Box, RefreshCw, Network } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  ResourceDetailLayout,
  
  YamlViewer,
  YamlCompareViewer,
  EventsSection,
  ActionsSection,
  DeleteConfirmDialog,
  ResourceTopologyView,
  
  
  type ResourceStatus,
  type EventInfo,
  type YamlVersion,
} from '@/components/resources';

const mockRuntimeClass = {
  name: 'gvisor',
  status: 'Active' as ResourceStatus,
  handler: 'runsc',
  age: '180d',
  overhead: {
    podFixed: { cpu: '100m', memory: '50Mi' },
  },
  scheduling: {
    nodeSelector: { 'runtime': 'gvisor' },
    tolerations: [{ key: 'runtime', operator: 'Equal', value: 'gvisor', effect: 'NoSchedule' }],
  },
};

// Mock pods using this runtime class
const mockPodsUsingRuntime = [
  { name: 'sandbox-pod-1', namespace: 'security' },
  { name: 'sandbox-pod-2', namespace: 'security' },
  { name: 'isolated-worker', namespace: 'production' },
];

const mockEvents: EventInfo[] = [];

export default function RuntimeClassDetail() {
  const { name } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const rc = mockRuntimeClass;

  const handleDownloadYaml = useCallback(() => {
    const blob = new Blob(['apiVersion: node.k8s.io/v1\nkind: RuntimeClass\n...'], { type: 'application/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${rc.name || 'runtimeclass'}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  }, [rc.name]);

  const yaml = 'apiVersion: node.k8s.io/v1\nkind: RuntimeClass\n...';
  const yamlVersions: YamlVersion[] = yaml ? [{ id: 'current', label: 'Current Version', yaml, timestamp: 'now' }] : [];

  const statusCards = [
    { label: 'Handler', value: rc.handler, icon: Cpu, iconColor: 'primary' as const },
    { label: 'CPU Overhead', value: rc.overhead?.podFixed?.cpu || '-', icon: Settings, iconColor: 'info' as const },
    { label: 'Memory Overhead', value: rc.overhead?.podFixed?.memory || '-', icon: FolderCog, iconColor: 'warning' as const },
    { label: 'Age', value: rc.age, icon: Clock, iconColor: 'muted' as const },
  ];

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Runtime Info</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">Handler</p>
                  <Badge variant="default" className="font-mono">{rc.handler}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Age</p>
                  <p>{rc.age}</p>
                </div>
              </div>
              <div className="pt-2">
                <p className="text-sm text-muted-foreground">
                  The handler specifies the underlying runtime configuration. <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">{rc.handler}</code> is 
                  a user-space kernel that provides strong isolation for container workloads.
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Overhead</CardTitle>
              <CardDescription>Additional resources consumed by the runtime</CardDescription>
            </CardHeader>
            <CardContent>
              {rc.overhead?.podFixed ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground mb-1">CPU</p>
                    <p className="font-mono text-lg font-medium">{rc.overhead.podFixed.cpu}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground mb-1">Memory</p>
                    <p className="font-mono text-lg font-medium">{rc.overhead.podFixed.memory}</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No overhead defined</p>
              )}
            </CardContent>
          </Card>
          {rc.scheduling && (
            <>
              <Card>
                <CardHeader><CardTitle className="text-base">Node Selector</CardTitle></CardHeader>
                <CardContent>
                  {Object.keys(rc.scheduling.nodeSelector || {}).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(rc.scheduling.nodeSelector || {}).map(([key, value]) => (
                        <Badge key={key} variant="outline" className="font-mono text-xs">{key}={value}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No node selector defined</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Tolerations</CardTitle></CardHeader>
                <CardContent>
                  {rc.scheduling.tolerations && rc.scheduling.tolerations.length > 0 ? (
                    <div className="space-y-2">
                      {rc.scheduling.tolerations.map((tol, idx) => (
                        <div key={idx} className="p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="font-mono text-xs">{tol.key}</Badge>
                            <span className="text-muted-foreground">{tol.operator}</span>
                            <Badge variant="secondary" className="font-mono text-xs">{tol.value}</Badge>
                            <Badge variant="destructive" className="text-xs">{tol.effect}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No tolerations defined</p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                Pods Using This RuntimeClass
              </CardTitle>
              <CardDescription>{mockPodsUsingRuntime.length} pods are using this runtime class</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {mockPodsUsingRuntime.map((pod) => (
                  <div 
                    key={pod.name}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                    onClick={() => navigate(`/pods/${pod.namespace}/${pod.name}`)}
                  >
                    <div className="flex items-center gap-3">
                      <Box className="h-4 w-4 text-primary" />
                      <span className="font-medium">{pod.name}</span>
                    </div>
                    <Badge variant="outline">{pod.namespace}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },
    { id: 'events', label: 'Events', content: <EventsSection events={mockEvents} /> },
    { id: 'yaml', label: 'YAML', content: <YamlViewer yaml={yaml} resourceName={rc.name} editable onSave={handleSaveYaml} /> },
    { id: 'compare', label: 'Compare', content: <YamlCompareViewer versions={yamlVersions} resourceName={rc.name} /> },
    {
      id: 'topology',
      label: 'Topology',
      icon: Network,
      content: (
        <ResourceTopologyView
          kind={normalizeKindForTopology('RuntimeClass')}
          namespace={''}
          name={name ?? ''}
          sourceResourceType="RuntimeClass"
          sourceResourceName={rc?.name ?? name ?? ''}
        />
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      content: (
        <ActionsSection actions={[
          { icon: Download, label: 'Download YAML', description: 'Export RuntimeClass definition', onClick: handleDownloadYaml },
          { icon: Trash2, label: 'Delete RuntimeClass', description: 'Remove this runtime class', variant: 'destructive', onClick: () => setShowDeleteDialog(true) },
        ]} />
      ),
    },
  ];

  return (
    <>
      <ResourceDetailLayout
        resourceType="RuntimeClass"
        resourceIcon={FolderCog}
        name={rc.name}
        status="Healthy"
        backLink="/runtimeclasses"
        backLabel="Runtime Classes"
        headerMetadata={<span className="flex items-center gap-1.5 ml-2 text-sm text-muted-foreground"><Clock className="h-3.5 w-3.5" />Created {rc.age}</span>}
        actions={[
          { label: 'Refresh', icon: RefreshCw, variant: 'outline', onClick: () => {} },
          { label: 'Download YAML', icon: Download, variant: 'outline', onClick: handleDownloadYaml },
          { label: 'Delete', icon: Trash2, variant: 'destructive', onClick: () => setShowDeleteDialog(true) },
        ]}
        statusCards={statusCards}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <DeleteConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        resourceType="RuntimeClass"
        resourceName={rc.name}
        onConfirm={() => {
          toast.success(`RuntimeClass ${rc.name} deleted (demo mode)`);
          navigate('/runtimeclasses');
        }}
        requireNameConfirmation
      />
    </>
  );
}

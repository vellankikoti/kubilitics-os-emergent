import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileCode, Clock, Server, Download, Trash2, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ResourceHeader, ResourceStatusCards, ResourceTabs,
  YamlViewer, EventsSection, ActionsSection,
  type ResourceStatus, type EventInfo,
} from '@/components/resources';

const mockAPIService = {
  name: 'v1.apps',
  status: 'Available' as ResourceStatus,
  service: 'Local',
  group: 'apps',
  version: 'v1',
  insecureSkipTLSVerify: false,
  groupPriorityMinimum: 17800,
  versionPriority: 15,
  age: '180d',
  conditions: [
    { type: 'Available', status: 'True', reason: 'Local', message: 'Local APIServices are always available' },
  ],
};

const mockEvents: EventInfo[] = [];

const yaml = `apiVersion: apiregistration.k8s.io/v1
kind: APIService
metadata:
  name: v1.apps
spec:
  group: apps
  version: v1
  groupPriorityMinimum: 17800
  versionPriority: 15
status:
  conditions:
  - type: Available
    status: "True"
    reason: Local
    message: Local APIServices are always available`;

export default function APIServiceDetail() {
  const { name } = useParams();
  const [activeTab, setActiveTab] = useState('overview');
  const api = mockAPIService;

  const statusCards = [
    { label: 'Status', value: api.status, icon: CheckCircle, iconColor: 'success' as const },
    { label: 'Service', value: api.service, icon: Server, iconColor: 'info' as const },
    { label: 'Group', value: api.group || 'core', icon: FileCode, iconColor: 'primary' as const },
    { label: 'Age', value: api.age, icon: Clock, iconColor: 'muted' as const },
  ];

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">API Service Info</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-muted-foreground mb-1">Group</p><p className="font-mono">{api.group || 'core'}</p></div>
                <div><p className="text-muted-foreground mb-1">Version</p><Badge variant="secondary">{api.version}</Badge></div>
                <div><p className="text-muted-foreground mb-1">Service</p><p>{api.service}</p></div>
                <div><p className="text-muted-foreground mb-1">Status</p><Badge variant="default">{api.status}</Badge></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Priority Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-muted-foreground mb-1">Group Priority Minimum</p><p className="font-mono">{api.groupPriorityMinimum}</p></div>
                <div><p className="text-muted-foreground mb-1">Version Priority</p><p className="font-mono">{api.versionPriority}</p></div>
              </div>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Conditions</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {api.conditions.map((condition) => (
                  <div key={condition.type} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Badge variant={condition.status === 'True' ? 'default' : 'secondary'}>{condition.type}</Badge>
                      <span className="text-sm text-muted-foreground">{condition.reason}</span>
                    </div>
                    <p className="text-sm">{condition.message}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },
    { id: 'events', label: 'Events', content: <EventsSection events={mockEvents} /> },
    { id: 'yaml', label: 'YAML', content: <YamlViewer yaml={yaml} resourceName={api.name} /> },
    {
      id: 'actions',
      label: 'Actions',
      content: (
        <ActionsSection actions={[
          { icon: Download, label: 'Download YAML', description: 'Export API Service definition' },
          { icon: Trash2, label: 'Delete API Service', description: 'Remove this API service', variant: 'destructive' },
        ]} />
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <ResourceHeader
        resourceType="APIService"
        resourceIcon={FileCode}
        name={api.name}
        status={api.status}
        backLink="/apiservices"
        backLabel="API Services"
        metadata={<span className="flex items-center gap-1.5 ml-2"><Clock className="h-3.5 w-3.5" />Created {api.age}</span>}
        actions={[
          { label: 'Delete', icon: Trash2, variant: 'destructive' },
        ]}
      />
      <ResourceStatusCards cards={statusCards} />
      <ResourceTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
    </motion.div>
  );
}

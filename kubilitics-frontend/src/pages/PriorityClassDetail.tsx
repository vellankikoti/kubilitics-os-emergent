import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, Clock, ArrowUpDown, Download, Trash2, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ResourceHeader, ResourceStatusCards, ResourceTabs,
  YamlViewer, EventsSection, ActionsSection,
  type ResourceStatus, type EventInfo,
} from '@/components/resources';

const mockPriorityClass = {
  name: 'system-cluster-critical',
  status: 'Active' as ResourceStatus,
  value: 2000000000,
  globalDefault: false,
  preemptionPolicy: 'PreemptLowerPriority',
  description: 'Used for system critical pods that must not be moved from their current node.',
  age: '180d',
};

const mockEvents: EventInfo[] = [];

const yaml = `apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: system-cluster-critical
value: 2000000000
globalDefault: false
preemptionPolicy: PreemptLowerPriority
description: "Used for system critical pods that must not be moved from their current node."`;

export default function PriorityClassDetail() {
  const { name } = useParams();
  const [activeTab, setActiveTab] = useState('overview');
  const pc = mockPriorityClass;

  const statusCards = [
    { label: 'Value', value: pc.value.toLocaleString(), icon: ArrowUpDown, iconColor: 'primary' as const },
    { label: 'Global Default', value: pc.globalDefault ? 'Yes' : 'No', icon: Shield, iconColor: 'info' as const },
    { label: 'Preemption', value: 'Enabled', icon: AlertTriangle, iconColor: 'warning' as const },
    { label: 'Age', value: pc.age, icon: Clock, iconColor: 'muted' as const },
  ];

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Priority Class Info</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">Priority Value</p>
                  <p className="font-mono text-lg font-bold text-primary">{pc.value.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Global Default</p>
                  <Badge variant={pc.globalDefault ? 'default' : 'secondary'}>
                    {pc.globalDefault ? 'Yes' : 'No'}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Preemption Policy</p>
                  <Badge variant="outline">{pc.preemptionPolicy}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Age</p>
                  <p>{pc.age}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Description</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{pc.description}</p>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Priority Scale</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"
                    style={{ width: `${Math.min((pc.value / 2000001000) * 100, 100)}%` }}
                  />
                </div>
                <Badge variant="default">{pc.value.toLocaleString()}</Badge>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>0 (Lowest)</span>
                <span>2,000,001,000 (Highest)</span>
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },
    { id: 'events', label: 'Events', content: <EventsSection events={mockEvents} /> },
    { id: 'yaml', label: 'YAML', content: <YamlViewer yaml={yaml} resourceName={pc.name} /> },
    {
      id: 'actions',
      label: 'Actions',
      content: (
        <ActionsSection actions={[
          { icon: Download, label: 'Download YAML', description: 'Export PriorityClass definition' },
          { icon: Trash2, label: 'Delete PriorityClass', description: 'Remove this priority class', variant: 'destructive' },
        ]} />
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <ResourceHeader
        resourceType="PriorityClass"
        resourceIcon={AlertTriangle}
        name={pc.name}
        status={pc.status}
        backLink="/priorityclasses"
        backLabel="Priority Classes"
        metadata={<span className="flex items-center gap-1.5 ml-2"><Clock className="h-3.5 w-3.5" />Created {pc.age}</span>}
        actions={[
          { label: 'Delete', icon: Trash2, variant: 'destructive' },
        ]}
      />
      <ResourceStatusCards cards={statusCards} />
      <ResourceTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
    </motion.div>
  );
}

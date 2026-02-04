import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Activity, Clock, CheckCircle, AlertTriangle, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ResourceHeader, ResourceStatusCards, ResourceTabs,
  YamlViewer, EventsSection,
  type ResourceStatus, type EventInfo,
} from '@/components/resources';

const mockComponentStatus = {
  name: 'etcd-0',
  status: 'Healthy' as ResourceStatus,
  age: '180d',
  conditions: [
    { type: 'Healthy', status: 'True', message: '{"health":"true","reason":""}', error: '' },
  ],
};

const mockEvents: EventInfo[] = [];

const yaml = `apiVersion: v1
kind: ComponentStatus
metadata:
  name: etcd-0
conditions:
- type: Healthy
  status: "True"
  message: '{"health":"true","reason":""}'`;

export default function ComponentStatusDetail() {
  const { name } = useParams();
  const [activeTab, setActiveTab] = useState('overview');
  const cs = mockComponentStatus;

  const isHealthy = cs.conditions.some(c => c.type === 'Healthy' && c.status === 'True');

  const statusCards = [
    { label: 'Status', value: isHealthy ? 'Healthy' : 'Unhealthy', icon: isHealthy ? CheckCircle : AlertTriangle, iconColor: isHealthy ? 'success' as const : 'error' as const },
    { label: 'Conditions', value: cs.conditions.length, icon: Activity, iconColor: 'info' as const },
    { label: 'Age', value: cs.age, icon: Clock, iconColor: 'muted' as const },
  ];

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="grid grid-cols-1 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Component Info</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-full ${isHealthy ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                  {isHealthy ? (
                    <CheckCircle className="h-8 w-8 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-8 w-8 text-red-500" />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{cs.name}</h3>
                  <p className="text-muted-foreground">
                    {isHealthy ? 'Component is healthy and responding normally' : 'Component is experiencing issues'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Conditions</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {cs.conditions.map((condition, idx) => (
                  <div key={idx} className="p-4 rounded-lg bg-muted/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant={condition.status === 'True' ? 'default' : 'destructive'}>
                        {condition.type}
                      </Badge>
                      <Badge variant="outline">{condition.status}</Badge>
                    </div>
                    {condition.message && (
                      <p className="text-sm font-mono text-muted-foreground break-all">
                        {condition.message}
                      </p>
                    )}
                    {condition.error && (
                      <p className="text-sm text-destructive">
                        Error: {condition.error}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },
    { id: 'events', label: 'Events', content: <EventsSection events={mockEvents} /> },
    { id: 'yaml', label: 'YAML', content: <YamlViewer yaml={yaml} resourceName={cs.name} /> },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <ResourceHeader
        resourceType="ComponentStatus"
        resourceIcon={Activity}
        name={cs.name}
        status={cs.status}
        backLink="/componentstatuses"
        backLabel="Component Statuses"
        metadata={<span className="flex items-center gap-1.5 ml-2"><Clock className="h-3.5 w-3.5" />Age {cs.age}</span>}
      />
      <ResourceStatusCards cards={statusCards} />
      <ResourceTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
    </motion.div>
  );
}

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Gauge, Clock, Cpu, HardDrive, Download, Trash2, Box } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ResourceHeader, ResourceStatusCards, ResourceTabs,
  YamlViewer, EventsSection, ActionsSection,
  type ResourceStatus, type EventInfo,
} from '@/components/resources';

const mockQuota = {
  name: 'prod-quota',
  namespace: 'production',
  status: 'Active' as ResourceStatus,
  age: '90d',
  hard: {
    'requests.cpu': '20',
    'requests.memory': '64Gi',
    'limits.cpu': '40',
    'limits.memory': '128Gi',
    pods: '100',
    services: '20',
    secrets: '50',
    configmaps: '50',
  },
  used: {
    'requests.cpu': '10',
    'requests.memory': '32Gi',
    'limits.cpu': '20',
    'limits.memory': '64Gi',
    pods: '50',
    services: '10',
    secrets: '25',
    configmaps: '15',
  },
};

const mockEvents: EventInfo[] = [];

const yaml = `apiVersion: v1
kind: ResourceQuota
metadata:
  name: prod-quota
  namespace: production
spec:
  hard:
    requests.cpu: "20"
    requests.memory: 64Gi
    limits.cpu: "40"
    limits.memory: 128Gi
    pods: "100"
    services: "20"
    secrets: "50"
    configmaps: "50"
status:
  hard:
    requests.cpu: "20"
    requests.memory: 64Gi
  used:
    requests.cpu: "10"
    requests.memory: 32Gi`;

export default function ResourceQuotaDetail() {
  const { namespace, name } = useParams();
  const [activeTab, setActiveTab] = useState('overview');
  const quota = mockQuota;

  const getUsagePercent = (used: string, hard: string) => {
    const usedNum = parseFloat(used);
    const hardNum = parseFloat(hard);
    return Math.round((usedNum / hardNum) * 100);
  };

  const statusCards = [
    { label: 'CPU Used', value: `${quota.used['requests.cpu']}/${quota.hard['requests.cpu']}`, icon: Cpu, iconColor: 'primary' as const },
    { label: 'Memory Used', value: `${quota.used['requests.memory']}/${quota.hard['requests.memory']}`, icon: HardDrive, iconColor: 'info' as const },
    { label: 'Pods', value: `${quota.used.pods}/${quota.hard.pods}`, icon: Box, iconColor: 'success' as const },
    { label: 'Age', value: quota.age, icon: Clock, iconColor: 'muted' as const },
  ];

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Resource Usage</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(quota.hard).map(([key, hard]) => {
                  const used = quota.used[key as keyof typeof quota.used] || '0';
                  const percent = getUsagePercent(used, hard);
                  return (
                    <div key={key} className="p-4 rounded-lg bg-muted/50 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm">{key}</span>
                        <Badge variant={percent > 80 ? 'destructive' : percent > 60 ? 'secondary' : 'default'}>
                          {percent}%
                        </Badge>
                      </div>
                      <Progress value={percent} className="h-2" />
                      <p className="text-xs text-muted-foreground">{used} / {hard}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },
    { id: 'events', label: 'Events', content: <EventsSection events={mockEvents} /> },
    { id: 'yaml', label: 'YAML', content: <YamlViewer yaml={yaml} resourceName={quota.name} /> },
    {
      id: 'actions',
      label: 'Actions',
      content: (
        <ActionsSection actions={[
          { icon: Download, label: 'Download YAML', description: 'Export ResourceQuota definition' },
          { icon: Trash2, label: 'Delete Quota', description: 'Remove this resource quota', variant: 'destructive' },
        ]} />
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <ResourceHeader
        resourceType="ResourceQuota"
        resourceIcon={Gauge}
        name={quota.name}
        namespace={quota.namespace}
        status={quota.status}
        backLink="/resourcequotas"
        backLabel="Resource Quotas"
        metadata={<span className="flex items-center gap-1.5 ml-2"><Clock className="h-3.5 w-3.5" />Created {quota.age}</span>}
        actions={[
          { label: 'Delete', icon: Trash2, variant: 'destructive' },
        ]}
      />
      <ResourceStatusCards cards={statusCards} />
      <ResourceTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
    </motion.div>
  );
}

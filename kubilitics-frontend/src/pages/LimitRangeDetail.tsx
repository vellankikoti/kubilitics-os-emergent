import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Scale, Clock, Cpu, HardDrive, Download, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ResourceHeader, ResourceStatusCards, ResourceTabs,
  YamlViewer, YamlCompareViewer, EventsSection, ActionsSection,
  type ResourceStatus, type EventInfo, type YamlVersion,
} from '@/components/resources';
import { toast } from 'sonner';

const mockLimitRange = {
  name: 'prod-limits',
  namespace: 'production',
  status: 'Active' as ResourceStatus,
  age: '90d',
  limits: [
    {
      type: 'Container',
      default: { cpu: '500m', memory: '512Mi' },
      defaultRequest: { cpu: '100m', memory: '128Mi' },
      max: { cpu: '2', memory: '2Gi' },
      min: { cpu: '50m', memory: '64Mi' },
    },
    {
      type: 'Pod',
      max: { cpu: '4', memory: '4Gi' },
      min: { cpu: '100m', memory: '128Mi' },
    },
  ],
};

const mockEvents: EventInfo[] = [];

const yaml = `apiVersion: v1
kind: LimitRange
metadata:
  name: prod-limits
  namespace: production
spec:
  limits:
  - type: Container
    default:
      cpu: 500m
      memory: 512Mi
    defaultRequest:
      cpu: 100m
      memory: 128Mi
    max:
      cpu: "2"
      memory: 2Gi
    min:
      cpu: 50m
      memory: 64Mi
  - type: Pod
    max:
      cpu: "4"
      memory: 4Gi
    min:
      cpu: 100m
      memory: 128Mi`;

export default function LimitRangeDetail() {
  const { namespace, name } = useParams();
  const [activeTab, setActiveTab] = useState('overview');
  const lr = mockLimitRange;

  // Mock YAML versions for comparison
  const yamlVersions: YamlVersion[] = [
    { id: 'current', label: 'Current Version', yaml, timestamp: 'now' },
    { id: 'previous', label: 'Previous Version', yaml: yaml.replace('cpu: 500m', 'cpu: 400m'), timestamp: '2 hours ago' },
    { id: 'initial', label: 'Initial Version', yaml: yaml.replace('memory: 512Mi', 'memory: 256Mi'), timestamp: '1 day ago' },
  ];

  const handleSaveYaml = async (newYaml: string) => {
    toast.success('LimitRange updated successfully');
    console.log('Saving YAML:', newYaml);
  };

  const containerLimit = lr.limits.find(l => l.type === 'Container');
  const statusCards = [
    { label: 'Default CPU', value: containerLimit?.default?.cpu || '-', icon: Cpu, iconColor: 'primary' as const },
    { label: 'Default Memory', value: containerLimit?.default?.memory || '-', icon: HardDrive, iconColor: 'info' as const },
    { label: 'Limit Types', value: lr.limits.length, icon: Scale, iconColor: 'success' as const },
    { label: 'Age', value: lr.age, icon: Clock, iconColor: 'muted' as const },
  ];

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="space-y-6">
          {lr.limits.map((limit, idx) => (
            <Card key={idx}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Badge variant="outline">{limit.type}</Badge>
                  Limits
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {limit.default && (
                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground mb-2">Default</p>
                      <div className="space-y-1 text-sm font-mono">
                        {Object.entries(limit.default).map(([k, v]) => (
                          <p key={k}>{k}: {v}</p>
                        ))}
                      </div>
                    </div>
                  )}
                  {limit.defaultRequest && (
                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground mb-2">Default Request</p>
                      <div className="space-y-1 text-sm font-mono">
                        {Object.entries(limit.defaultRequest).map(([k, v]) => (
                          <p key={k}>{k}: {v}</p>
                        ))}
                      </div>
                    </div>
                  )}
                  {limit.max && (
                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground mb-2">Max</p>
                      <div className="space-y-1 text-sm font-mono">
                        {Object.entries(limit.max).map(([k, v]) => (
                          <p key={k}>{k}: {v}</p>
                        ))}
                      </div>
                    </div>
                  )}
                  {limit.min && (
                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground mb-2">Min</p>
                      <div className="space-y-1 text-sm font-mono">
                        {Object.entries(limit.min).map(([k, v]) => (
                          <p key={k}>{k}: {v}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ),
    },
    { id: 'events', label: 'Events', content: <EventsSection events={mockEvents} /> },
    { id: 'yaml', label: 'YAML', content: <YamlViewer yaml={yaml} resourceName={lr.name} editable onSave={handleSaveYaml} /> },
    { id: 'compare', label: 'Compare', content: <YamlCompareViewer versions={yamlVersions} resourceName={lr.name} /> },
    {
      id: 'actions',
      label: 'Actions',
      content: (
        <ActionsSection actions={[
          { icon: Download, label: 'Download YAML', description: 'Export LimitRange definition' },
          { icon: Trash2, label: 'Delete LimitRange', description: 'Remove this limit range', variant: 'destructive' },
        ]} />
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <ResourceHeader
        resourceType="LimitRange"
        resourceIcon={Scale}
        name={lr.name}
        namespace={lr.namespace}
        status={lr.status}
        backLink="/limitranges"
        backLabel="Limit Ranges"
        metadata={<span className="flex items-center gap-1.5 ml-2"><Clock className="h-3.5 w-3.5" />Created {lr.age}</span>}
        actions={[
          { label: 'Delete', icon: Trash2, variant: 'destructive' },
        ]}
      />
      <ResourceStatusCards cards={statusCards} />
      <ResourceTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
    </motion.div>
  );
}

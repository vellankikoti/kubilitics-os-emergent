import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Webhook, Clock, Shield, Download, Trash2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ResourceHeader, ResourceStatusCards, ResourceTabs,
  YamlViewer, EventsSection, ActionsSection,
  type ResourceStatus, type EventInfo,
} from '@/components/resources';

const mockWebhook = {
  name: 'cert-manager-webhook',
  status: 'Active' as ResourceStatus,
  age: '90d',
  webhooks: [
    {
      name: 'webhook.cert-manager.io',
      failurePolicy: 'Fail',
      matchPolicy: 'Equivalent',
      sideEffects: 'None',
      timeoutSeconds: 10,
      admissionReviewVersions: ['v1', 'v1beta1'],
      rules: [
        { apiGroups: ['cert-manager.io'], apiVersions: ['v1'], operations: ['CREATE', 'UPDATE'], resources: ['certificates'] },
      ],
      clientConfig: {
        service: { name: 'cert-manager-webhook', namespace: 'cert-manager', port: 443 },
        caBundle: '...',
      },
    },
  ],
};

const mockEvents: EventInfo[] = [];

const yaml = `apiVersion: admissionregistration.k8s.io/v1
kind: MutatingWebhookConfiguration
metadata:
  name: cert-manager-webhook
webhooks:
- name: webhook.cert-manager.io
  failurePolicy: Fail
  matchPolicy: Equivalent
  sideEffects: None
  timeoutSeconds: 10
  admissionReviewVersions:
  - v1
  - v1beta1
  rules:
  - apiGroups: ["cert-manager.io"]
    apiVersions: ["v1"]
    operations: ["CREATE", "UPDATE"]
    resources: ["certificates"]
  clientConfig:
    service:
      name: cert-manager-webhook
      namespace: cert-manager
      port: 443`;

export default function MutatingWebhookDetail() {
  const { name } = useParams();
  const [activeTab, setActiveTab] = useState('overview');
  const wh = mockWebhook;

  const statusCards = [
    { label: 'Webhooks', value: wh.webhooks.length, icon: Webhook, iconColor: 'primary' as const },
    { label: 'Failure Policy', value: wh.webhooks[0]?.failurePolicy || '-', icon: AlertTriangle, iconColor: 'warning' as const },
    { label: 'Side Effects', value: wh.webhooks[0]?.sideEffects || '-', icon: Shield, iconColor: 'info' as const },
    { label: 'Age', value: wh.age, icon: Clock, iconColor: 'muted' as const },
  ];

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="space-y-6">
          {wh.webhooks.map((webhook, idx) => (
            <Card key={idx}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Webhook className="h-4 w-4" />
                  {webhook.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">Failure Policy</p>
                    <Badge variant={webhook.failurePolicy === 'Fail' ? 'destructive' : 'secondary'}>
                      {webhook.failurePolicy}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Match Policy</p>
                    <Badge variant="outline">{webhook.matchPolicy}</Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Side Effects</p>
                    <Badge variant="outline">{webhook.sideEffects}</Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Timeout</p>
                    <p>{webhook.timeoutSeconds}s</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Rules</p>
                  <div className="space-y-2">
                    {webhook.rules.map((rule, ruleIdx) => (
                      <div key={ruleIdx} className="p-3 rounded-lg bg-muted/50 text-sm font-mono">
                        <p>Groups: {rule.apiGroups.join(', ')}</p>
                        <p>Versions: {rule.apiVersions.join(', ')}</p>
                        <p>Operations: {rule.operations.join(', ')}</p>
                        <p>Resources: {rule.resources.join(', ')}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Client Config</p>
                  <div className="p-3 rounded-lg bg-muted/50 text-sm">
                    <p>Service: {webhook.clientConfig.service.namespace}/{webhook.clientConfig.service.name}:{webhook.clientConfig.service.port}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ),
    },
    { id: 'events', label: 'Events', content: <EventsSection events={mockEvents} /> },
    { id: 'yaml', label: 'YAML', content: <YamlViewer yaml={yaml} resourceName={wh.name} /> },
    {
      id: 'actions',
      label: 'Actions',
      content: (
        <ActionsSection actions={[
          { icon: Download, label: 'Download YAML', description: 'Export Webhook configuration' },
          { icon: Trash2, label: 'Delete Webhook', description: 'Remove this webhook configuration', variant: 'destructive' },
        ]} />
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <ResourceHeader
        resourceType="MutatingWebhookConfiguration"
        resourceIcon={Webhook}
        name={wh.name}
        status={wh.status}
        backLink="/mutatingwebhooks"
        backLabel="Mutating Webhooks"
        metadata={<span className="flex items-center gap-1.5 ml-2"><Clock className="h-3.5 w-3.5" />Created {wh.age}</span>}
        actions={[
          { label: 'Delete', icon: Trash2, variant: 'destructive' },
        ]}
      />
      <ResourceStatusCards cards={statusCards} />
      <ResourceTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
    </motion.div>
  );
}

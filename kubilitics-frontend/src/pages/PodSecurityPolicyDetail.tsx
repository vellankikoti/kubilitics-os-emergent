import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Clock, Lock, Download, Trash2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ResourceHeader, ResourceStatusCards, ResourceTabs,
  YamlViewer, EventsSection, ActionsSection,
  type ResourceStatus, type EventInfo,
} from '@/components/resources';

const mockPSP = {
  name: 'restricted',
  status: 'Active' as ResourceStatus,
  age: '180d',
  privileged: false,
  allowPrivilegeEscalation: false,
  requiredDropCapabilities: ['ALL'],
  volumes: ['configMap', 'secret', 'emptyDir', 'persistentVolumeClaim'],
  hostNetwork: false,
  hostPID: false,
  hostIPC: false,
  runAsUser: { rule: 'MustRunAsNonRoot' },
  seLinux: { rule: 'RunAsAny' },
  fsGroup: { rule: 'RunAsAny' },
  supplementalGroups: { rule: 'RunAsAny' },
};

const mockEvents: EventInfo[] = [];

const yaml = `apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: restricted
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
  - ALL
  volumes:
  - 'configMap'
  - 'secret'
  - 'emptyDir'
  - 'persistentVolumeClaim'
  hostNetwork: false
  hostPID: false
  hostIPC: false
  runAsUser:
    rule: MustRunAsNonRoot
  seLinux:
    rule: RunAsAny
  fsGroup:
    rule: RunAsAny
  supplementalGroups:
    rule: RunAsAny`;

export default function PodSecurityPolicyDetail() {
  const { name } = useParams();
  const [activeTab, setActiveTab] = useState('overview');
  const psp = mockPSP;

  const statusCards = [
    { label: 'Privileged', value: psp.privileged ? 'Yes' : 'No', icon: Lock, iconColor: psp.privileged ? 'error' as const : 'success' as const },
    { label: 'Host Network', value: psp.hostNetwork ? 'Yes' : 'No', icon: Shield, iconColor: 'info' as const },
    { label: 'Volumes', value: psp.volumes.length, icon: AlertTriangle, iconColor: 'warning' as const },
    { label: 'Age', value: psp.age, icon: Clock, iconColor: 'muted' as const },
  ];

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Security Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">Privileged</p>
                  <Badge variant={psp.privileged ? 'destructive' : 'default'}>
                    {psp.privileged ? 'Allowed' : 'Denied'}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Privilege Escalation</p>
                  <Badge variant={psp.allowPrivilegeEscalation ? 'destructive' : 'default'}>
                    {psp.allowPrivilegeEscalation ? 'Allowed' : 'Denied'}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Host Network</p>
                  <Badge variant={psp.hostNetwork ? 'destructive' : 'secondary'}>
                    {psp.hostNetwork ? 'Allowed' : 'Denied'}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Host PID</p>
                  <Badge variant={psp.hostPID ? 'destructive' : 'secondary'}>
                    {psp.hostPID ? 'Allowed' : 'Denied'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Run As User</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">Run As User Rule</p>
                  <Badge variant="outline">{psp.runAsUser.rule}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">SELinux Rule</p>
                  <Badge variant="outline">{psp.seLinux.rule}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">FS Group Rule</p>
                  <Badge variant="outline">{psp.fsGroup.rule}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Supplemental Groups</p>
                  <Badge variant="outline">{psp.supplementalGroups.rule}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Allowed Volumes</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {psp.volumes.map((vol) => (
                  <Badge key={vol} variant="secondary">{vol}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Required Drop Capabilities</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {psp.requiredDropCapabilities.map((cap) => (
                  <Badge key={cap} variant="destructive">{cap}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },
    { id: 'events', label: 'Events', content: <EventsSection events={mockEvents} /> },
    { id: 'yaml', label: 'YAML', content: <YamlViewer yaml={yaml} resourceName={psp.name} /> },
    {
      id: 'actions',
      label: 'Actions',
      content: (
        <ActionsSection actions={[
          { icon: Download, label: 'Download YAML', description: 'Export PSP definition' },
          { icon: Trash2, label: 'Delete PSP', description: 'Remove this pod security policy', variant: 'destructive' },
        ]} />
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <ResourceHeader
        resourceType="PodSecurityPolicy"
        resourceIcon={Shield}
        name={psp.name}
        status={psp.status}
        backLink="/podsecuritypolicies"
        backLabel="Pod Security Policies"
        metadata={<span className="flex items-center gap-1.5 ml-2"><Clock className="h-3.5 w-3.5" />Created {psp.age}</span>}
        actions={[
          { label: 'Delete', icon: Trash2, variant: 'destructive' },
        ]}
      />
      <ResourceStatusCards cards={statusCards} />
      <ResourceTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
    </motion.div>
  );
}

import { motion } from 'framer-motion';
import { Gauge, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const mockComponents = [
  { name: 'controller-manager', status: 'Healthy', message: 'ok' },
  { name: 'scheduler', status: 'Healthy', message: 'ok' },
  { name: 'etcd-0', status: 'Healthy', message: '{"health":"true"}' },
];

export default function ComponentStatuses() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Component Statuses</h1>
        <p className="text-muted-foreground">Health status of control plane components</p>
      </div>

      <div className="grid gap-4">
        {mockComponents.map((component) => (
          <Card key={component.name}>
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg ${component.status === 'Healthy' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                  {component.status === 'Healthy' ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>
                <div>
                  <p className="font-medium">{component.name}</p>
                  <p className="text-sm text-muted-foreground font-mono">{component.message}</p>
                </div>
              </div>
              <Badge variant={component.status === 'Healthy' ? 'default' : 'destructive'}>
                {component.status}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}

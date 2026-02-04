import { motion } from 'framer-motion';
import { FileCode } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const mockCRs = [
  { name: 'Certificate', group: 'cert-manager.io', count: 12 },
  { name: 'IngressRoute', group: 'traefik.io', count: 8 },
  { name: 'PrometheusRule', group: 'monitoring.coreos.com', count: 24 },
];

export default function CustomResources() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Custom Resources</h1>
        <p className="text-muted-foreground">Browse custom resources by type</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {mockCRs.map((cr) => (
          <Card key={cr.name} className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileCode className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{cr.name}</p>
                  <p className="text-xs text-muted-foreground">{cr.group}</p>
                </div>
                <Badge variant="secondary">{cr.count}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}

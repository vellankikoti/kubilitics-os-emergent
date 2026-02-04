import { motion } from 'framer-motion';
import { 
  Container, 
  CheckCircle2, 
  XCircle, 
  Cpu, 
  MemoryStick,
  Clock,
  RotateCcw,
  Terminal,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface ContainerInfo {
  name: string;
  image: string;
  ready: boolean;
  restartCount: number;
  state: 'running' | 'waiting' | 'terminated';
  stateReason?: string;
  ports?: { containerPort: number; protocol: string }[];
  resources?: {
    requests?: { cpu?: string; memory?: string };
    limits?: { cpu?: string; memory?: string };
  };
  currentUsage?: { cpu: number; memory: number };
}

export interface ContainersSectionProps {
  containers: ContainerInfo[];
  className?: string;
}

const stateConfig = {
  running: { icon: CheckCircle2, color: 'text-[hsl(var(--success))]', bg: 'bg-[hsl(var(--success)/0.1)]', label: 'Running' },
  waiting: { icon: Clock, color: 'text-[hsl(var(--warning))]', bg: 'bg-[hsl(var(--warning)/0.1)]', label: 'Waiting' },
  terminated: { icon: XCircle, color: 'text-muted-foreground', bg: 'bg-muted', label: 'Terminated' },
};

export function ContainersSection({ containers, className }: ContainersSectionProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {containers.map((container, index) => {
        const state = stateConfig[container.state];
        const StateIcon = state.icon;
        
        return (
          <motion.div
            key={container.name}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="overflow-hidden">
              <CardHeader className="pb-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn('p-2 rounded-lg', state.bg)}>
                      <Container className={cn('h-5 w-5', state.color)} />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold">{container.name}</CardTitle>
                      <p className="text-sm text-muted-foreground font-mono">{container.image}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={cn('gap-1.5', state.bg, state.color)}>
                      <StateIcon className="h-3 w-3" />
                      {state.label}
                      {container.stateReason && ` (${container.stateReason})`}
                    </Badge>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <Terminal className="h-3.5 w-3.5" />
                      Shell
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      Logs
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Container Status */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-muted-foreground">Status</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <CheckCircle2 className={cn('h-4 w-4', container.ready ? 'text-[hsl(var(--success))]' : 'text-muted-foreground')} />
                          Ready
                        </span>
                        <span className="font-medium">{container.ready ? 'Yes' : 'No'}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <RotateCcw className="h-4 w-4 text-muted-foreground" />
                          Restarts
                        </span>
                        <span className={cn('font-medium', container.restartCount > 5 && 'text-[hsl(var(--error))]')}>
                          {container.restartCount}
                        </span>
                      </div>
                      {container.ports && container.ports.length > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span>Ports</span>
                          <span className="font-mono text-xs">
                            {container.ports.map(p => `${p.containerPort}/${p.protocol}`).join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Resource Requests/Limits */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-muted-foreground">Resources</h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Cpu className="h-4 w-4 text-muted-foreground" />
                          CPU Request
                        </span>
                        <span className="font-mono">{container.resources?.requests?.cpu || '-'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Cpu className="h-4 w-4 text-muted-foreground" />
                          CPU Limit
                        </span>
                        <span className="font-mono">{container.resources?.limits?.cpu || '-'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <MemoryStick className="h-4 w-4 text-muted-foreground" />
                          Memory Request
                        </span>
                        <span className="font-mono">{container.resources?.requests?.memory || '-'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <MemoryStick className="h-4 w-4 text-muted-foreground" />
                          Memory Limit
                        </span>
                        <span className="font-mono">{container.resources?.limits?.memory || '-'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Current Usage */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-muted-foreground">Current Usage</h4>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <Cpu className="h-4 w-4 text-primary" />
                            CPU
                          </span>
                          <span className="font-medium">{container.currentUsage?.cpu ?? 0}%</span>
                        </div>
                        <Progress 
                          value={container.currentUsage?.cpu ?? 0} 
                          className="h-2"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <MemoryStick className="h-4 w-4 text-primary" />
                            Memory
                          </span>
                          <span className="font-medium">{container.currentUsage?.memory ?? 0}%</span>
                        </div>
                        <Progress 
                          value={container.currentUsage?.memory ?? 0} 
                          className="h-2"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}

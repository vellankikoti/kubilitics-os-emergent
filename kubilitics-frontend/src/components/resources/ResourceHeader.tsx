import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type ResourceStatus = 'Running' | 'Pending' | 'Succeeded' | 'Failed' | 'Unknown' | 'Healthy' | 'Warning' | 'Error';

export interface ResourceAction {
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  variant?: 'default' | 'outline' | 'destructive';
}

export interface ResourceHeaderProps {
  resourceType: string;
  resourceIcon: LucideIcon;
  name: string;
  namespace?: string;
  status: ResourceStatus;
  backLink: string;
  backLabel: string;
  actions?: ResourceAction[];
  metadata?: ReactNode;
}

const statusConfig: Record<ResourceStatus, { bg: string; text: string; icon: string }> = {
  Running: { bg: 'bg-[hsl(var(--success)/0.1)]', text: 'text-[hsl(var(--success))]', icon: '✓' },
  Healthy: { bg: 'bg-[hsl(var(--success)/0.1)]', text: 'text-[hsl(var(--success))]', icon: '✓' },
  Succeeded: { bg: 'bg-[hsl(var(--success)/0.1)]', text: 'text-[hsl(var(--success))]', icon: '✓' },
  Pending: { bg: 'bg-[hsl(var(--warning)/0.1)]', text: 'text-[hsl(var(--warning))]', icon: '◔' },
  Warning: { bg: 'bg-[hsl(var(--warning)/0.1)]', text: 'text-[hsl(var(--warning))]', icon: '⚠' },
  Failed: { bg: 'bg-[hsl(var(--error)/0.1)]', text: 'text-[hsl(var(--error))]', icon: '✗' },
  Error: { bg: 'bg-[hsl(var(--error)/0.1)]', text: 'text-[hsl(var(--error))]', icon: '✗' },
  Unknown: { bg: 'bg-muted', text: 'text-muted-foreground', icon: '?' },
};

export function ResourceHeader({
  resourceType,
  resourceIcon: Icon,
  name,
  namespace,
  status,
  backLink,
  backLabel,
  actions = [],
  metadata,
}: ResourceHeaderProps) {
  const statusStyle = statusConfig[status] || statusConfig.Unknown;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      {/* Back Link */}
      <Link 
        to={backLink} 
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to {backLabel}
      </Link>

      {/* Main Header - subtle depth */}
      <div className="flex items-start justify-between rounded-xl border border-border/50 bg-card shadow-sm p-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-primary/10 shadow-sm">
            <Icon className="h-8 w-8 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
              <div className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium',
                statusStyle.bg,
                statusStyle.text
              )}>
                <span>{statusStyle.icon}</span>
                {status}
              </div>
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                {resourceType}
                {namespace && (
                  <>
                    {' '}in
                    <Badge variant="outline" className="ml-1">{namespace}</Badge>
                    namespace
                  </>
                )}
              </span>
              {metadata}
            </div>
          </div>
        </div>

        {/* Actions */}
        {actions.length > 0 && (
          <div className="flex items-center gap-2">
            {actions.map((action) => (
              <Button
                key={action.label}
                variant={action.variant || 'outline'}
                size="sm"
                onClick={action.onClick}
                className="gap-2"
              >
                <action.icon className="h-4 w-4" />
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

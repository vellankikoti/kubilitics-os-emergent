import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface ActionItem {
  icon: LucideIcon;
  label: string;
  description: string;
  variant?: 'default' | 'destructive';
  onClick?: () => void;
}

export interface ActionsSectionProps {
  actions: ActionItem[];
}

export function ActionsSection({ actions }: ActionsSectionProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {actions.map((action) => (
        <Card 
          key={action.label} 
          className="cursor-pointer hover:shadow-md transition-all duration-200"
          onClick={action.onClick}
        >
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className={cn(
                'p-2.5 rounded-xl',
                action.variant === 'destructive' ? 'bg-[hsl(var(--error)/0.1)]' : 'bg-muted'
              )}>
                <action.icon className={cn(
                  'h-5 w-5',
                  action.variant === 'destructive' ? 'text-[hsl(var(--error))]' : 'text-foreground'
                )} />
              </div>
              <div>
                <p className="font-medium">{action.label}</p>
                <p className="text-sm text-muted-foreground">{action.description}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

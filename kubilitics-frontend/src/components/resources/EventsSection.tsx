import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface EventInfo {
  type: 'Normal' | 'Warning' | 'Error';
  reason: string;
  message: string;
  time: string;
  count?: number;
}

export interface EventsSectionProps {
  events: EventInfo[];
}

const eventConfig = {
  Normal: { icon: CheckCircle2, color: 'text-muted-foreground', bg: 'bg-muted' },
  Warning: { icon: AlertTriangle, color: 'text-[hsl(var(--warning))]', bg: 'bg-[hsl(var(--warning)/0.1)]' },
  Error: { icon: XCircle, color: 'text-[hsl(var(--error))]', bg: 'bg-[hsl(var(--error)/0.1)]' },
};

export function EventsSection({ events }: EventsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Events</CardTitle>
        <CardDescription>Recent events for this resource</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {events.map((event, i) => {
            const config = eventConfig[event.type];
            const EventIcon = config.icon;
            
            return (
              <div key={i} className="flex items-start gap-4 pb-4 border-b border-border last:border-0 last:pb-0">
                <div className={cn('p-1.5 rounded-full mt-0.5', config.bg)}>
                  <EventIcon className={cn('h-3.5 w-3.5', config.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{event.reason}</span>
                    <span className="text-xs text-muted-foreground">{event.time}</span>
                    {event.count && event.count > 1 && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        ×{event.count}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{event.message}</p>
                </div>
              </div>
            );
          })}
          {events.length === 0 && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Info className="h-4 w-4 mr-2" />
              No events recorded
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

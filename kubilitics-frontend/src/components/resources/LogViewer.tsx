import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, 
  Download, 
  Search, 
  Pause, 
  Play, 
  Trash2,
  Filter,
  ChevronDown,
  Wifi,
  WifiOff,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useK8sPodLogs } from '@/hooks/useKubernetes';
import { useKubernetesConfigStore } from '@/stores/kubernetesConfigStore';

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  raw?: string;
}

export interface LogViewerProps {
  logs?: LogEntry[];
  podName?: string;
  namespace?: string;
  containerName?: string;
  containers?: string[];
  onContainerChange?: (container: string) => void;
  className?: string;
  tailLines?: number;
}

const levelColors: Record<string, string> = {
  info: 'text-[hsl(var(--info))]',
  warn: 'text-[hsl(var(--warning))]',
  error: 'text-[hsl(var(--error))]',
  debug: 'text-muted-foreground',
};

// Parse a raw log line into structured LogEntry
function parseLogLine(line: string): LogEntry {
  const trimmed = line.trim();
  if (!trimmed) {
    return { timestamp: '', level: 'info', message: '', raw: line };
  }

  // Try to extract timestamp (ISO format at start)
  const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^\s]*)\s+(.*)$/);
  if (isoMatch) {
    const [, timestamp, rest] = isoMatch;
    return {
      timestamp,
      level: detectLevel(rest),
      message: rest,
      raw: line,
    };
  }

  // Try to extract timestamp with brackets
  const bracketMatch = trimmed.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (bracketMatch) {
    const [, timestamp, rest] = bracketMatch;
    return {
      timestamp,
      level: detectLevel(rest),
      message: rest,
      raw: line,
    };
  }

  // No timestamp found
  return {
    timestamp: new Date().toISOString(),
    level: detectLevel(trimmed),
    message: trimmed,
    raw: line,
  };
}

// Detect log level from message content
function detectLevel(message: string): 'info' | 'warn' | 'error' | 'debug' {
  const lower = message.toLowerCase();
  if (lower.includes('error') || lower.includes('fatal') || lower.includes('panic') || lower.includes('exception')) {
    return 'error';
  }
  if (lower.includes('warn') || lower.includes('warning')) {
    return 'warn';
  }
  if (lower.includes('debug') || lower.includes('trace')) {
    return 'debug';
  }
  return 'info';
}

// Parse raw log text into entries
function parseRawLogs(rawLogs: string): LogEntry[] {
  if (!rawLogs) return [];
  return rawLogs
    .split('\n')
    .filter(line => line.trim())
    .map(parseLogLine);
}

const mockLogs: LogEntry[] = [
  { timestamp: '2025-12-30T09:42:47', level: 'info', message: '🚀 Application started successfully' },
  { timestamp: '2025-12-30T09:42:47', level: 'info', message: '  Version: v1.0.0' },
  { timestamp: '2025-12-30T09:42:48', level: 'info', message: "* Serving on port 8080" },
  { timestamp: '2025-12-30T09:42:48', level: 'debug', message: 'Debug mode: off' },
  { timestamp: '2025-12-30T09:42:48', level: 'warn', message: 'WARNING: This is a development server.' },
  { timestamp: '2025-12-30T09:42:48', level: 'info', message: '* Running on http://0.0.0.0:8080' },
  { timestamp: '2025-12-30T09:42:52', level: 'info', message: 'GET /health HTTP/1.1 200' },
  { timestamp: '2025-12-30T09:42:57', level: 'info', message: 'GET /health HTTP/1.1 200' },
];

export function LogViewer({ 
  logs: propLogs,
  podName,
  namespace,
  containerName = 'main',
  containers = [],
  onContainerChange,
  className,
  tailLines = 500,
}: LogViewerProps) {
  const { config } = useKubernetesConfigStore();
  const isConnected = config.isConnected;
  
  const [isStreaming, setIsStreaming] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [selectedContainer, setSelectedContainer] = useState(containerName);
  const [localLogs, setLocalLogs] = useState<LogEntry[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Fetch live logs from K8s API
  const { data: rawLogs, isLoading, error, refetch } = useK8sPodLogs(
    namespace || '',
    podName || '',
    selectedContainer,
    { 
      enabled: isConnected && !!podName && !!namespace && isStreaming,
      tailLines,
    }
  );

  // Parse raw logs when they change
  useEffect(() => {
    if (rawLogs) {
      const parsed = parseRawLogs(rawLogs);
      setLocalLogs(parsed);
    }
  }, [rawLogs]);

  // Determine which logs to display
  const displayLogs = isConnected && podName && namespace ? localLogs : (propLogs || mockLogs);

  // Auto-scroll when streaming
  useEffect(() => {
    if (isStreaming && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [displayLogs, isStreaming]);

  const filteredLogs = displayLogs.filter(log => {
    if (searchQuery && !log.message.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (selectedLevel && log.level !== selectedLevel) {
      return false;
    }
    return true;
  });

  const handleDownload = useCallback(() => {
    const content = displayLogs.map(l => `${l.timestamp} [${l.level.toUpperCase()}] ${l.message}`).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${podName || 'logs'}-${selectedContainer}.log`;
    a.click();
    URL.revokeObjectURL(url);
  }, [displayLogs, podName, selectedContainer]);

  const handleClear = useCallback(() => {
    setLocalLogs([]);
  }, []);

  return (
    <Card className={cn('overflow-hidden', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-medium">Container Logs</h3>
          
          {/* Connection Status */}
          {isConnected && podName && namespace ? (
            <Badge variant="outline" className="gap-1.5 text-xs">
              <Wifi className="h-3 w-3 text-[hsl(var(--success))]" />
              Live
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1.5 text-xs">
              <WifiOff className="h-3 w-3" />
              Mock Data
            </Badge>
          )}
          
          {containers.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  {selectedContainer}
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {containers.map(container => (
                  <DropdownMenuItem 
                    key={container}
                    onClick={() => {
                      setSelectedContainer(container);
                      onContainerChange?.(container);
                    }}
                  >
                    {container}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-48 h-8 text-sm"
            />
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Filter className="h-3.5 w-3.5" />
                {selectedLevel || 'All'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setSelectedLevel(null)}>All</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedLevel('info')}>Info</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedLevel('warn')}>Warning</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedLevel('error')}>Error</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedLevel('debug')}>Debug</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsStreaming(!isStreaming)}
            title={isStreaming ? 'Pause streaming' : 'Resume streaming'}
          >
            {isStreaming ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => refetch()}
            title="Refresh logs"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          
          <Button 
            variant="outline" 
            size="icon" 
            className="h-8 w-8"
            onClick={handleDownload}
            title="Download logs"
          >
            <Download className="h-4 w-4" />
          </Button>
          
          <Button 
            variant="outline" 
            size="icon" 
            className="h-8 w-8"
            onClick={handleClear}
            title="Clear logs"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Log Content */}
      <div 
        ref={logContainerRef}
        className="bg-[hsl(221_39%_11%)] text-[hsl(142_76%_73%)] font-mono text-sm overflow-auto"
        style={{ height: '400px' }}
      >
        {isLoading && isConnected && podName ? (
          <div className="p-4 space-y-2">
            <Skeleton className="h-4 w-full bg-[hsl(0_0%_100%/0.1)]" />
            <Skeleton className="h-4 w-3/4 bg-[hsl(0_0%_100%/0.1)]" />
            <Skeleton className="h-4 w-5/6 bg-[hsl(0_0%_100%/0.1)]" />
          </div>
        ) : error ? (
          <div className="p-4 text-[hsl(var(--error))]">
            <p>Failed to fetch logs: {error.message}</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={() => refetch()}
            >
              Retry
            </Button>
          </div>
        ) : (
          <div className="p-4 space-y-0.5">
            {filteredLogs.length === 0 ? (
              <div className="text-muted-foreground text-center py-8">
                {searchQuery || selectedLevel ? 'No logs match your filters' : 'No logs available'}
              </div>
            ) : (
              filteredLogs.map((log, i) => (
                <motion.div
                  key={`${log.timestamp}-${i}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.01, 0.5) }}
                  className="flex items-start gap-2 hover:bg-[hsl(0_0%_100%/0.05)] px-2 py-0.5 rounded group"
                >
                  <span className="text-[hsl(0_0%_100%/0.4)] shrink-0 text-xs">
                    {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '--:--:--'}
                  </span>
                  <span className={cn('shrink-0 font-medium text-xs uppercase w-12', levelColors[log.level])}>
                    [{log.level}]
                  </span>
                  <span className="text-[hsl(0_0%_100%/0.9)] break-all">{log.message}</span>
                </motion.div>
              ))
            )}
            
            {isStreaming && !error && (
              <motion.div
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-muted-foreground mt-2 flex items-center gap-2"
              >
                <span className="inline-block w-2 h-2 bg-[hsl(var(--success))] rounded-full animate-pulse" />
                Streaming logs... ({filteredLogs.length} lines)
              </motion.div>
            )}
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="px-4 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground flex items-center justify-between">
        <span>{filteredLogs.length} log entries</span>
        <span>
          {isConnected && podName ? `${namespace}/${podName}:${selectedContainer}` : 'Demo mode'}
        </span>
      </div>
    </Card>
  );
}

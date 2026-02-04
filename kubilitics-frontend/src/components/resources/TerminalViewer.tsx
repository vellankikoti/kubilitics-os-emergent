import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { Terminal, X, Maximize2, Minimize2, Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useKubernetesConfigStore } from '@/stores/kubernetesConfigStore';
import { toast } from 'sonner';

export interface TerminalLine {
  type: 'input' | 'output' | 'error' | 'system';
  content: string;
  timestamp?: string;
}

export interface TerminalViewerProps {
  podName?: string;
  namespace?: string;
  containerName?: string;
  containers?: string[];
  onContainerChange?: (container: string) => void;
  className?: string;
}

// Mock command responses for demo mode
const mockCommands: Record<string, string | ((args: string[]) => string)> = {
  'help': `Available commands:
  help          - Show this help message
  ls            - List directory contents
  pwd           - Print working directory
  whoami        - Display current user
  hostname      - Display hostname
  cat           - Display file contents
  env           - Display environment variables
  ps            - Display running processes
  df            - Display disk usage
  date          - Display current date/time
  echo          - Echo arguments
  clear         - Clear terminal`,
  'ls': 'app  bin  dev  etc  home  lib  media  mnt  opt  proc  root  run  sbin  srv  sys  tmp  usr  var',
  'ls -la': `total 64
drwxr-xr-x   1 root root 4096 Jan  2 10:00 .
drwxr-xr-x   1 root root 4096 Jan  2 10:00 ..
drwxr-xr-x   2 root root 4096 Jan  2 10:00 app
drwxr-xr-x   2 root root 4096 Dec 20 00:00 bin
drwxr-xr-x   5 root root  340 Jan  2 10:00 dev
drwxr-xr-x   1 root root 4096 Jan  2 10:00 etc
drwxr-xr-x   2 root root 4096 Dec 20 00:00 home`,
  'pwd': '/app',
  'whoami': 'root',
  'hostname': (args) => args[0] || 'nginx-deployment-7fb96c846b-abc12',
  'cat /etc/os-release': `NAME="Alpine Linux"
ID=alpine
VERSION_ID=3.19.0
PRETTY_NAME="Alpine Linux v3.19"`,
  'env': `PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
HOSTNAME=nginx-deployment-7fb96c846b-abc12
KUBERNETES_SERVICE_HOST=10.96.0.1
KUBERNETES_SERVICE_PORT=443
HOME=/root`,
  'ps': `  PID TTY          TIME CMD
    1 ?        00:00:00 nginx
   10 ?        00:00:00 nginx
   11 ?        00:00:00 nginx
   20 ?        00:00:00 sh`,
  'ps aux': `USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root         1  0.0  0.1  10648  5432 ?        Ss   10:00   0:00 nginx: master process
nginx       10  0.0  0.0  11056  2516 ?        S    10:00   0:00 nginx: worker process
nginx       11  0.0  0.0  11056  2516 ?        S    10:00   0:00 nginx: worker process
root        20  0.0  0.0   1680   984 pts/0    Ss   10:05   0:00 /bin/sh`,
  'df': `Filesystem     1K-blocks    Used Available Use% Mounted on
overlay         61255492 5234567  52881234   9% /
tmpfs              65536       0     65536   0% /dev
/dev/sda1       61255492 5234567  52881234   9% /etc/hosts`,
  'df -h': `Filesystem      Size  Used Avail Use% Mounted on
overlay          59G  5.0G   51G   9% /
tmpfs            64M     0   64M   0% /dev
/dev/sda1        59G  5.0G   51G   9% /etc/hosts`,
  'date': () => new Date().toString(),
  'uptime': ' 10:30:00 up 5 days,  3:45,  0 users,  load average: 0.15, 0.10, 0.05',
  'free': `              total        used        free      shared  buff/cache   available
Mem:        8052976     2345678     3456789       12345     2250509     5432198
Swap:             0           0           0`,
  'uname -a': 'Linux nginx-deployment-7fb96c846b-abc12 5.15.0-91-generic #101-Ubuntu SMP x86_64 GNU/Linux',
};

export function TerminalViewer({
  podName,
  namespace,
  containerName = 'main',
  containers = [],
  onContainerChange,
  className,
}: TerminalViewerProps) {
  const { config } = useKubernetesConfigStore();
  const isConnected = config.isConnected;
  
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [selectedContainer, setSelectedContainer] = useState(containerName);
  const [isMaximized, setIsMaximized] = useState(false);
  
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initial welcome message
  useEffect(() => {
    const welcomeLines: TerminalLine[] = [
      { type: 'system', content: `Connecting to ${podName || 'pod'}/${selectedContainer}...` },
      { type: 'system', content: isConnected 
        ? '⚠️  Note: Real exec requires a WebSocket proxy. Using demo mode.'
        : '📋 Demo mode - simulated terminal session' 
      },
      { type: 'system', content: `Container: ${selectedContainer} | Shell: /bin/sh` },
      { type: 'system', content: 'Type "help" for available commands.\n' },
    ];
    setLines(welcomeLines);
  }, [podName, selectedContainer, isConnected]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  // Focus input when clicking terminal
  const handleTerminalClick = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  // Execute command
  const executeCommand = useCallback((command: string) => {
    const trimmedCmd = command.trim();
    if (!trimmedCmd) return;

    // Add to history
    setCommandHistory(prev => [...prev, trimmedCmd]);
    setHistoryIndex(-1);

    // Add input line
    setLines(prev => [...prev, { 
      type: 'input', 
      content: `$ ${trimmedCmd}`,
      timestamp: new Date().toISOString(),
    }]);

    // Handle special commands
    if (trimmedCmd === 'clear') {
      setLines([]);
      return;
    }

    if (trimmedCmd === 'exit') {
      setLines(prev => [...prev, { type: 'system', content: 'Session terminated. Refresh to reconnect.' }]);
      return;
    }

    // Parse command and args
    const parts = trimmedCmd.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);
    const fullCmd = trimmedCmd;

    // Check for echo command
    if (cmd === 'echo') {
      setLines(prev => [...prev, { type: 'output', content: args.join(' ') }]);
      return;
    }

    // Look up command response
    let response = mockCommands[fullCmd] || mockCommands[cmd];
    
    if (response) {
      const output = typeof response === 'function' 
        ? response([podName || 'unknown-pod', ...args])
        : response;
      setLines(prev => [...prev, { type: 'output', content: output }]);
    } else {
      setLines(prev => [...prev, { 
        type: 'error', 
        content: `sh: ${cmd}: command not found` 
      }]);
    }
  }, [podName]);

  // Handle key events
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      executeCommand(currentInput);
      setCurrentInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setCurrentInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCurrentInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
      } else {
        setHistoryIndex(-1);
        setCurrentInput('');
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Simple tab completion
      const cmds = Object.keys(mockCommands).filter(c => c.startsWith(currentInput));
      if (cmds.length === 1) {
        setCurrentInput(cmds[0]);
      } else if (cmds.length > 1) {
        setLines(prev => [...prev, { type: 'output', content: cmds.join('  ') }]);
      }
    } else if (e.key === 'c' && e.ctrlKey) {
      setCurrentInput('');
      setLines(prev => [...prev, { type: 'input', content: `$ ${currentInput}^C` }]);
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
    }
  }, [currentInput, commandHistory, historyIndex, executeCommand]);

  const handleCopyOutput = useCallback(() => {
    const output = lines.map(l => l.content).join('\n');
    navigator.clipboard.writeText(output);
    toast.success('Terminal output copied to clipboard');
  }, [lines]);

  const handleClear = useCallback(() => {
    setLines([]);
  }, []);

  return (
    <Card className={cn(
      'overflow-hidden transition-all duration-300',
      isMaximized && 'fixed inset-4 z-50',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[hsl(221_39%_11%)] border-b border-[hsl(0_0%_100%/0.1)]">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <div className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>
          <Terminal className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-[hsl(0_0%_100%/0.9)]">
            {namespace}/{podName}:{selectedContainer}
          </span>
          <Badge variant="outline" className="text-xs border-[hsl(0_0%_100%/0.2)] text-[hsl(0_0%_100%/0.6)]">
            /bin/sh
          </Badge>
        </div>
        
        <div className="flex items-center gap-1">
          {containers.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-[hsl(0_0%_100%/0.7)] hover:text-white hover:bg-[hsl(0_0%_100%/0.1)]">
                  {selectedContainer}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {containers.map(c => (
                  <DropdownMenuItem 
                    key={c}
                    onClick={() => {
                      setSelectedContainer(c);
                      onContainerChange?.(c);
                    }}
                  >
                    {c}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-[hsl(0_0%_100%/0.5)] hover:text-white hover:bg-[hsl(0_0%_100%/0.1)]"
            onClick={handleCopyOutput}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-[hsl(0_0%_100%/0.5)] hover:text-white hover:bg-[hsl(0_0%_100%/0.1)]"
            onClick={handleClear}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-[hsl(0_0%_100%/0.5)] hover:text-white hover:bg-[hsl(0_0%_100%/0.1)]"
            onClick={() => setIsMaximized(!isMaximized)}
          >
            {isMaximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
      
      {/* Terminal Content */}
      <div
        ref={terminalRef}
        onClick={handleTerminalClick}
        className="bg-[hsl(221_39%_11%)] text-[hsl(142_76%_73%)] font-mono text-sm overflow-auto cursor-text"
        style={{ height: isMaximized ? 'calc(100vh - 120px)' : '400px' }}
      >
        <div className="p-4 space-y-0.5">
          {lines.map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={cn(
                'whitespace-pre-wrap break-all',
                line.type === 'input' && 'text-[hsl(0_0%_100%/0.9)]',
                line.type === 'output' && 'text-[hsl(142_76%_73%)]',
                line.type === 'error' && 'text-[hsl(var(--error))]',
                line.type === 'system' && 'text-[hsl(var(--info))] italic',
              )}
            >
              {line.content}
            </motion.div>
          ))}
          
          {/* Current input line */}
          <div className="flex items-center text-[hsl(0_0%_100%/0.9)]">
            <span className="text-[hsl(var(--success))] mr-1">$</span>
            <input
              ref={inputRef}
              type="text"
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent outline-none caret-[hsl(var(--success))]"
              autoFocus
              spellCheck={false}
              autoComplete="off"
            />
            <motion.span
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="w-2 h-4 bg-[hsl(var(--success))]"
            />
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div className="px-4 py-1.5 bg-[hsl(221_39%_13%)] border-t border-[hsl(0_0%_100%/0.1)] text-xs text-[hsl(0_0%_100%/0.4)] flex items-center justify-between">
        <span>Press Tab for autocomplete • Ctrl+L to clear • Ctrl+C to cancel</span>
        <span>{commandHistory.length} commands</span>
      </div>
    </Card>
  );
}

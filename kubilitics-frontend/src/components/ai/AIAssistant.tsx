import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, 
  Send, 
  X, 
  Sparkles, 
  Maximize2, 
  Minimize2,
  Copy,
  CheckCircle,
  Loader2,
  Terminal,
  Eye,
  Scale,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actions?: ActionButton[];
}

interface ActionButton {
  label: string;
  action: string;
  variant: 'default' | 'outline' | 'secondary';
  icon?: string;
}

const suggestedQueries = [
  "Why is my pod crashing?",
  "Show pods with high CPU usage",
  "Scale api-server to 5 replicas",
  "What's wrong with my deployment?",
  "Find services without endpoints",
  "Explain PersistentVolumeClaims",
];

// Mock responses for demo
const mockResponses: Record<string, { content: string; actions: ActionButton[] }> = {
  "default": {
    content: "I can help you manage your Kubernetes cluster. Try asking about pod status, scaling deployments, or diagnosing issues.",
    actions: []
  },
  "crash": {
    content: `I analyzed your pods and found an issue:

**Root Cause:** Out of Memory (OOMKilled)

**Evidence:**
• Last termination reason: OOMKilled
• Memory limit: 512Mi
• Peak usage before crash: 498Mi
• 5 restarts in last 2 hours

**Recommendation:**
Increase memory limit to at least 768Mi.`,
    actions: [
      { label: "Apply Fix", action: "apply-fix", variant: "default", icon: "check" },
      { label: "View Pod", action: "view-pod", variant: "outline", icon: "eye" },
    ]
  },
  "cpu": {
    content: `Found **3 pods** with CPU usage > 80%:

1. **worker-queue-a9c3d** (production) - 92% CPU
2. **data-processor-xyz** (analytics) - 87% CPU  
3. **batch-job-12345** (jobs) - 84% CPU

These pods may benefit from horizontal scaling or resource optimization.`,
    actions: [
      { label: "View Pods", action: "view-pods", variant: "outline", icon: "eye" },
      { label: "Scale Up", action: "scale", variant: "default", icon: "scale" },
    ]
  },
  "scale": {
    content: `Ready to scale **api-server** deployment:

**Current:** 3 replicas
**Target:** 5 replicas
**Namespace:** production

This will create 2 new pod instances.`,
    actions: [
      { label: "Confirm Scale", action: "confirm-scale", variant: "default", icon: "check" },
      { label: "Cancel", action: "cancel", variant: "outline" },
    ]
  },
  "deployment": {
    content: `Analyzing your deployment health...

**Issues Found:**
• 1 pod in CrashLoopBackOff state
• Image pull errors on 2 pods
• Resource quotas at 85% capacity

**Healthy:**
• 15/18 pods running normally
• All services have endpoints
• Ingress routes configured correctly`,
    actions: [
      { label: "Fix Issues", action: "fix", variant: "default" },
      { label: "View Details", action: "details", variant: "outline" },
    ]
  },
  "explain": {
    content: `**PersistentVolumeClaim (PVC)** is a request for storage by a user.

Think of it like this:
• **PersistentVolume (PV)** = A parking spot
• **PersistentVolumeClaim (PVC)** = A reservation for a parking spot

**Key Features:**
• Requests specific size and access mode
• Abstracts underlying storage details
• Survives pod restarts
• Can be dynamically provisioned

**Example Use Cases:**
• Database storage
• Application data persistence
• Shared file storage`,
    actions: [
      { label: "Create PVC", action: "create-pvc", variant: "default" },
      { label: "View PVCs", action: "view-pvcs", variant: "outline" },
    ]
  }
};

function getIconForAction(iconName?: string) {
  switch (iconName) {
    case 'check': return CheckCircle;
    case 'eye': return Eye;
    case 'scale': return Scale;
    default: return Terminal;
  }
}

export function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut: Cmd+Shift+P
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'p') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const getMockResponse = useCallback((query: string): { content: string; actions: ActionButton[] } => {
    const q = query.toLowerCase();
    if (q.includes('crash') || q.includes('failing') || q.includes('error')) {
      return mockResponses.crash;
    }
    if (q.includes('cpu') || q.includes('usage') || q.includes('resource')) {
      return mockResponses.cpu;
    }
    if (q.includes('scale')) {
      return mockResponses.scale;
    }
    if (q.includes('deployment') || q.includes('wrong')) {
      return mockResponses.deployment;
    }
    if (q.includes('explain') || q.includes('what is') || q.includes('pvc') || q.includes('persistent')) {
      return mockResponses.explain;
    }
    return mockResponses.default;
  }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Simulate AI response delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

    const response = getMockResponse(userMessage.content);
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: response.content,
      timestamp: new Date(),
      actions: response.actions
    };

    setMessages(prev => [...prev, assistantMessage]);
    setIsLoading(false);
  }, [input, isLoading, getMockResponse]);

  const handleSuggestedQuery = useCallback((query: string) => {
    setInput(query);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleCopy = useCallback((id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleActionClick = useCallback((action: string) => {
    // In a real app, this would execute the action
    console.log('Action clicked:', action);
  }, []);

  return (
    <>
      {/* Floating trigger button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <Button
              onClick={() => setIsOpen(true)}
              size="lg"
              className="h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Bot className="h-6 w-6" />
            </Button>
            <Badge 
              variant="secondary" 
              className="absolute -top-1 -right-1 text-[10px] px-1.5"
            >
              ⌘⇧P
            </Badge>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={cn(
              "fixed z-50 flex flex-col bg-card border border-border rounded-2xl shadow-xl overflow-hidden",
              isExpanded 
                ? "inset-6" 
                : "bottom-6 right-6 w-[420px] h-[600px] max-h-[80vh]"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Kubilitics AI</h3>
                  <p className="text-[10px] text-muted-foreground">Natural language K8s control</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
              {messages.length === 0 ? (
                <div className="space-y-4">
                  <div className="text-center py-8">
                    <Bot className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                    <h4 className="font-medium text-sm mb-1">How can I help?</h4>
                    <p className="text-xs text-muted-foreground">
                      Ask me anything about your Kubernetes cluster
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">Suggested queries</p>
                    <div className="flex flex-wrap gap-2">
                      {suggestedQueries.map((query) => (
                        <button
                          key={query}
                          onClick={() => handleSuggestedQuery(query)}
                          className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {query}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "flex",
                        message.role === 'user' ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                          message.role === 'user'
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-muted rounded-bl-md"
                        )}
                      >
                        <div className="whitespace-pre-wrap">{message.content}</div>
                        
                        {message.actions && message.actions.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/50">
                            {message.actions.map((action) => {
                              const Icon = getIconForAction(action.icon);
                              return (
                                <Button
                                  key={action.action}
                                  variant={action.variant}
                                  size="sm"
                                  className="h-7 text-xs gap-1.5"
                                  onClick={() => handleActionClick(action.action)}
                                >
                                  <Icon className="h-3 w-3" />
                                  {action.label}
                                </Button>
                              );
                            })}
                          </div>
                        )}
                        
                        {message.role === 'assistant' && (
                          <button
                            onClick={() => handleCopy(message.id, message.content)}
                            className="mt-2 text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                          >
                            {copiedId === message.id ? (
                              <>
                                <CheckCircle className="h-3 w-3" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                Copy
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  
                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex justify-start"
                    >
                      <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Thinking...
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t border-border bg-muted/20">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask anything about your cluster..."
                  className="flex-1 bg-background border border-input rounded-xl px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={isLoading}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  className="h-10 w-10 rounded-xl"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground text-center mt-2">
                Press ⌘⇧P to toggle • ESC to close
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

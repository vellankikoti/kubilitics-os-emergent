/**
 * Kubectl Shell — Rancher-style bottom panel with professional UX.
 * - Line-based: Enter to run; Tab for K8s autocomplete (with visible dropdown).
 * - ↑/↓ for command history (persisted per cluster in localStorage).
 * - Uses POST /shell and GET /shell/complete (no WebSocket required).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Terminal as TerminalIcon, X, GripHorizontal, History, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { postShellCommand, getShellComplete } from '@/services/backendApiClient';

const MIN_HEIGHT_PX = 160;
const MAX_HEIGHT_PX = 85;
const INITIAL_HEIGHT_PX = 260;
const HISTORY_MAX = 100;
const SHELL_HISTORY_KEY = 'kubilitics-shell-history';

function loadHistory(clusterId: string): string[] {
  try {
    const raw = localStorage.getItem(`${SHELL_HISTORY_KEY}-${clusterId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((e): e is string => typeof e === 'string').slice(-HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

function saveHistory(clusterId: string, history: string[]) {
  try {
    localStorage.setItem(`${SHELL_HISTORY_KEY}-${clusterId}`, JSON.stringify(history.slice(-HISTORY_MAX)));
  } catch {
    /* ignore */
  }
}

/**
 * Client-side fallback when the completion API fails or returns empty.
 * Matches backend semantics: first token "ku"/"kub" -> "kubectl"; then verbs; then resources.
 */
const KUBECTL_VERBS = ['get', 'describe', 'logs', 'top', 'version', 'api-resources', 'api-versions', 'explain', 'config', 'auth'];
const KUBECTL_RESOURCES = ['pods', 'pod', 'po', 'deployments', 'deploy', 'replicasets', 'rs', 'services', 'svc', 'configmaps', 'cm', 'secrets', 'namespaces', 'ns', 'nodes', 'node', 'no', 'events', 'ev', 'ingresses', 'ingress', 'daemonsets', 'ds', 'statefulsets', 'sts', 'jobs', 'cronjobs', 'cj'];

function clientSideCompletions(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed) return [];
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const words = parts.map((p) => p.trim()).filter(Boolean);
  if (words.length === 0) return [];

  const first = words[0]!.toLowerCase();
  // User is typing the command name: "ku", "kub", "kube" -> complete to "kubectl" only.
  if (words.length === 1 && first !== 'kubectl' && 'kubectl'.startsWith(first)) {
    return ['kubectl'];
  }
  // After "kubectl" we complete verbs or resources.
  const afterKubectl = first === 'kubectl' ? words.slice(1) : words;
  if (afterKubectl.length === 0) return KUBECTL_VERBS;
  if (afterKubectl.length === 1) {
    const prefix = afterKubectl[0]!.toLowerCase();
    return KUBECTL_VERBS.filter((v) => v.startsWith(prefix));
  }
  const last = (afterKubectl[afterKubectl.length - 1] ?? '').toLowerCase();
  return KUBECTL_RESOURCES.filter((r) => r.toLowerCase().startsWith(last));
}

export interface ClusterShellPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clusterId: string | null;
  clusterName: string;
  backendBaseUrl: string;
}

type OutputLine = { type: 'prompt' | 'stdout' | 'stderr' | 'error'; text: string };

export function ClusterShellPanel({
  open,
  onOpenChange,
  clusterId,
  clusterName,
  backendBaseUrl,
}: ClusterShellPanelProps) {
  const [heightPx, setHeightPx] = useState(INITIAL_HEIGHT_PX);
  const [dragging, setDragging] = useState(false);
  const [lines, setLines] = useState<OutputLine[]>([]);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completions, setCompletions] = useState<string[]>([]);
  const [completionIndex, setCompletionIndex] = useState(-1);
  const [completionLoading, setCompletionLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [savedInputBeforeHistory, setSavedInputBeforeHistory] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const completionAbortRef = useRef<AbortController | null>(null);
  const intellisenseDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const INTELLISENSE_DEBOUNCE_MS = 280;

  const baseUrl = backendBaseUrl || (typeof window !== 'undefined' ? window.location.origin : '');

  // Load history when cluster changes
  useEffect(() => {
    if (clusterId) {
      setHistory(loadHistory(clusterId));
      setHistoryIndex(-1);
    }
  }, [clusterId]);

  const appendOutput = useCallback((newLines: OutputLine[]) => {
    setLines((prev) => [...prev, ...newLines]);
    setTimeout(() => {
      outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight, behavior: 'smooth' });
    }, 0);
  }, []);

  const normalizeCommand = useCallback((cmd: string): string => {
    let s = cmd.trim();
    while (/^kubectl\s+/i.test(s)) s = s.replace(/^kubectl\s+/i, '').trim();
    if (/^kubectl$/i.test(s)) s = '';
    return s;
  }, []);

  const runCommand = useCallback(
    async (cmd: string) => {
      const trimmed = cmd.trim();
      if (!trimmed || !clusterId || running) return;

      setRunning(true);
      setError(null);
      setInput('');
      setCompletions([]);
      setCompletionIndex(-1);
      setHistoryIndex(-1);
      appendOutput([{ type: 'prompt', text: `$ ${trimmed}` }]);

      // Append to history (dedupe consecutive same command)
      setHistory((prev) => {
        const next = prev[prev.length - 1] === trimmed ? prev : [...prev, trimmed];
        if (clusterId) saveHistory(clusterId, next);
        return next;
      });

      const toSend = normalizeCommand(trimmed);
      try {
        const result = await postShellCommand(baseUrl, clusterId, toSend);
        if (result?.stdout)
          appendOutput(result.stdout.split('\n').map((t) => ({ type: 'stdout' as const, text: t || ' ' })));
        if (result?.stderr)
          appendOutput(result.stderr.split('\n').map((t) => ({ type: 'stderr' as const, text: t || ' ' })));
        if (result && result.exitCode !== 0 && !result.stdout && !result.stderr)
          appendOutput([{ type: 'error', text: `Command exited with code ${result.exitCode}` }]);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        appendOutput([{ type: 'error', text: msg }]);
      } finally {
        setRunning(false);
        // Keep focus in shell: run after paint so nothing else steals it
        const inputEl = inputRef.current;
        setTimeout(() => inputEl?.focus(), 0);
      }
    },
    [baseUrl, clusterId, running, appendOutput, normalizeCommand]
  );

  // Keep focus in shell input when panel is open and after command finishes
  useEffect(() => {
    if (!open || running) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open, running]);

  const fetchCompletions = useCallback(
    async (line: string): Promise<string[]> => {
      if (!clusterId) return [];
      if (!line.trim()) {
        setCompletions([]);
        setCompletionIndex(-1);
        setCompletionLoading(false);
        return [];
      }
      completionAbortRef.current?.abort();
      completionAbortRef.current = new AbortController();
      setCompletionLoading(true);
      setCompletions([]);
      setCompletionIndex(-1);
      try {
        const res = await getShellComplete(baseUrl, clusterId, line);
        let list = res?.completions?.filter(Boolean) ?? [];
        if (list.length === 0) list = clientSideCompletions(line);
        setCompletions(list);
        setCompletionIndex(list.length > 0 ? 0 : -1);
        return list;
      } catch {
        const fallback = clientSideCompletions(line);
        setCompletions(fallback);
        setCompletionIndex(fallback.length > 0 ? 0 : -1);
        return fallback;
      } finally {
        setCompletionLoading(false);
      }
    },
    [baseUrl, clusterId]
  );

  const insertCompletion = useCallback((word: string) => {
    setInput((prev) => {
      const trimmed = prev.trimEnd();
      const parts = trimmed.split(/\s+/).filter(Boolean);
      const lastToken = parts[parts.length - 1] ?? '';
      const base = parts.length > 1 ? parts.slice(0, -1).join(' ') + ' ' : '';

      // When completing a namespace value: keep -n/--namespace and never drop the flag.
      // Case 1: last token is exactly -n or --namespace (e.g. "kubectl get po -n ") -> keep flag, add value.
      // Case 2: last token is -n<partial> or --namespace<partial> (e.g. "kubectl get po -na") -> replace with -n <value>.
      const isNamespaceFlagOnly = lastToken === '-n' || lastToken === '--namespace';
      const isNamespaceFlagWithPartial =
        (lastToken.startsWith('-n') && lastToken !== '-n') ||
        (lastToken.startsWith('--namespace') && lastToken !== '--namespace');
      const replacement =
        isNamespaceFlagOnly
          ? lastToken + ' ' + word
          : isNamespaceFlagWithPartial
            ? lastToken.startsWith('--')
              ? '--namespace ' + word
              : '-n ' + word
            : word;
      const suffix = replacement.endsWith(' ') || word.startsWith('-') ? '' : ' ';
      return base + replacement + suffix;
    });
    setCompletions([]);
    setCompletionIndex(-1);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Completions panel open: ArrowUp/Down cycle completion list; Enter picks selected
      if (completions.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setCompletionIndex((i) => (i < completions.length - 1 ? i + 1 : 0));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setCompletionIndex((i) => (i > 0 ? i - 1 : completions.length - 1));
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          if (completionIndex >= 0 && completionIndex < completions.length) {
            insertCompletion(completions[completionIndex]);
          } else {
            runCommand(input);
          }
          return;
        }
      }

      // History: Up/Down when completion panel is closed
      if (completions.length === 0 && !completionLoading) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (history.length === 0) return;
          if (historyIndex === -1) {
            setSavedInputBeforeHistory(input);
            setHistoryIndex(history.length - 1);
            setInput(history[history.length - 1]);
          } else if (historyIndex > 0) {
            const next = historyIndex - 1;
            setHistoryIndex(next);
            setInput(history[next]);
          }
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (historyIndex === -1) return;
          if (historyIndex >= history.length - 1) {
            setHistoryIndex(-1);
            setInput(savedInputBeforeHistory);
          } else {
            const next = historyIndex + 1;
            setHistoryIndex(next);
            setInput(history[next]);
          }
          return;
        }
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (completions.length > 0 && completionIndex >= 0 && completionIndex < completions.length) {
          insertCompletion(completions[completionIndex]);
        } else {
          runCommand(input);
        }
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        if (completions.length > 0) {
          if (completions.length === 1) {
            insertCompletion(completions[0]);
          } else {
            setCompletionIndex((i) => (i < completions.length - 1 ? i + 1 : 0));
          }
        } else {
          fetchCompletions(input);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setCompletions([]);
        setCompletionIndex(-1);
      }
      setError(null);
    },
    [
      input,
      runCommand,
      completions,
      completionIndex,
      completionLoading,
      fetchCompletions,
      insertCompletion,
      history,
      historyIndex,
      savedInputBeforeHistory,
    ]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setInput(value);
      setCompletions([]);
      setCompletionIndex(-1);
      if (historyIndex !== -1) setHistoryIndex(-1);

      // Intellisense: show suggestions as you type (debounced) when in a completable context
      if (intellisenseDebounceRef.current) clearTimeout(intellisenseDebounceRef.current);
      const line = value.trim();
      const isCompletable =
        line.length > 0 &&
        (line.endsWith(' ') ||
          /\s-n\s+\S*$/.test(line) ||
          /\s-n\s*$/.test(line) ||
          /\s--namespace\s+\S*$/.test(line) ||
          /\s--namespace\s*$/.test(line));
      if (isCompletable && clusterId) {
        intellisenseDebounceRef.current = setTimeout(() => {
          intellisenseDebounceRef.current = null;
          fetchCompletions(value);
        }, INTELLISENSE_DEBOUNCE_MS);
      }
    },
    [historyIndex, clusterId, fetchCompletions]
  );

  // Drag to resize
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);
  const handleResizePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragStartY.current = e.clientY;
    dragStartHeight.current = heightPx;
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [heightPx]);
  const handleResizePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const deltaY = dragStartY.current - e.clientY;
    const vh = window.innerHeight;
    let next = dragStartHeight.current + deltaY;
    next = Math.max(MIN_HEIGHT_PX, Math.min((MAX_HEIGHT_PX / 100) * vh, next));
    setHeightPx(next);
  }, [dragging]);
  const handleResizePointerUp = useCallback((e: React.PointerEvent) => {
    setDragging(false);
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      const deltaY = dragStartY.current - e.clientY;
      const vh = window.innerHeight;
      let next = dragStartHeight.current + deltaY;
      next = Math.max(MIN_HEIGHT_PX, Math.min((MAX_HEIGHT_PX / 100) * vh, next));
      setHeightPx(next);
    };
    const onUp = () => setDragging(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging]);

  if (!open) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 flex flex-col border-t border-border bg-[hsl(221_39%_11%)] shadow-[0_-4px_20px_rgba(0,0,0,0.25)]"
      style={{ height: heightPx }}
      role="region"
      aria-label="Kubectl Shell"
    >
      <div
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerUp}
        onPointerLeave={dragging ? handleResizePointerUp : undefined}
        className={cn(
          'flex shrink-0 cursor-n-resize items-center justify-center border-b border-white/10 bg-[hsl(221_39%_13%)] py-1 transition-colors',
          dragging && 'bg-[hsl(221_39%_18%)]'
        )}
        title="Drag to resize"
      >
        <GripHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden />
      </div>

      <div className="flex shrink-0 items-center justify-between gap-4 px-4 py-2 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
          </div>
          <TerminalIcon className="h-4 w-4 text-[hsl(142_76%_73%)]" />
          <span className="text-sm font-medium text-white/90">Kubectl Shell — {clusterName}</span>
          <span className="text-xs text-white/60 flex items-center gap-1.5">
            <History className="h-3.5 w-3.5" />
            ↑↓ history
          </span>
          <span className="text-xs text-white/50">·</span>
          <span className="text-xs text-white/60">Tab complete</span>
          {running && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Running…
            </span>
          )}
          {error && (
            <>
              <span className="text-xs text-destructive max-w-[240px] truncate" title={error}>
                {error}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs border-white/20 text-muted-foreground hover:text-foreground hover:bg-white/10"
                onClick={() => setError(null)}
              >
                Dismiss
              </Button>
            </>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-white/10"
          onClick={() => onOpenChange(false)}
          aria-label="Close shell"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {!clusterId ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Select a cluster to run kubectl commands.
          </div>
        ) : (
          <>
            <div
              ref={outputRef}
              tabIndex={-1}
              className="flex-1 overflow-auto font-mono text-sm p-3 text-[hsl(142_76%_73%)] bg-[hsl(221_39%_8%)] whitespace-pre-wrap break-words outline-none"
              aria-label="Shell output"
            >
              {lines.length === 0 && (
                <div className="text-white/50 space-y-1">
                  <p>Run kubectl commands. Use ↑/↓ for history, Tab for completions.</p>
                  <p className="text-white/40 text-xs">Examples: get pods, describe node, logs -f deploy/name</p>
                </div>
              )}
              {lines.map((line, i) => (
                <div
                  key={i}
                  className={cn(
                    line.type === 'prompt' && 'text-white/90',
                    line.type === 'stderr' && 'text-amber-400/90',
                    line.type === 'error' && 'text-red-400'
                  )}
                >
                  {line.text}
                </div>
              ))}
            </div>

            {/* Completions panel: only show when loading or when we have suggestions (never show "No completions") */}
            {(completionLoading || completions.length > 0) && (
              <div className="shrink-0 border-t border-white/10 bg-[hsl(221_39%_14%)]">
                <div className="flex items-center gap-2 px-3 py-1.5 font-mono text-xs text-white/70">
                  {completionLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading completions…
                    </span>
                  ) : (
                    <>
                      <ChevronRight className="h-3.5 w-3.5 text-[hsl(142_76%_73%)]" />
                      <span className="text-white/50">Tab to cycle, Enter to pick:</span>
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5 max-h-20 overflow-auto">
                        {completions.slice(0, 30).map((c, i) => (
                          <button
                            key={`${c}-${i}`}
                            type="button"
                            onClick={() => insertCompletion(c)}
                            className={cn(
                              'px-1.5 py-0.5 rounded cursor-pointer transition-colors',
                              i === completionIndex
                                ? 'bg-[hsl(142_76%_73%)/30] text-[hsl(142_76%_73%)]'
                                : 'text-white/80 hover:bg-white/10'
                            )}
                          >
                            {c}
                          </button>
                        ))}
                        {completions.length > 30 && (
                          <span className="text-white/40">+{completions.length - 30} more</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="flex shrink-0 items-center gap-3 border-t border-white/10 bg-[hsl(221_39%_13%)] px-4 py-3 min-h-[52px]">
              <span className="text-white/70 font-mono text-base select-none shrink-0">$</span>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="kubectl get pods   (Tab or type for intellisense)"
                className="flex-1 min-w-0 min-h-[28px] bg-transparent font-mono text-base text-[hsl(142_76%_73%)] placeholder:text-white/40 outline-none border-none"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                disabled={running}
                aria-label="Shell command input"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

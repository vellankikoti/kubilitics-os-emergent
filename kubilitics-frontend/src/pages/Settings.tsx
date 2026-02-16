import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings as SettingsIcon,
  Monitor,
  Moon,
  Sun,
  Bell,
  BellOff,
  ZoomIn,
  Palette,
  Save,
  RotateCcw,
  CheckCircle2,
  Info,
  Server,
  Bot,
  Key,
  Eye,
  EyeOff,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useBackendConfigStore } from '@/stores/backendConfigStore';
import { DEFAULT_BACKEND_BASE_URL } from '@/lib/backendConstants';
import {
  saveLLMProviderConfig,
  loadLLMProviderConfig,
  clearLLMProviderConfig,
  getAIInfo,
  type LLMProviderConfig,
} from '@/services/aiService';

interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  defaultZoom: number;
  autoRefreshInterval: number;
  showNotifications: boolean;
  soundEnabled: boolean;
  compactMode: boolean;
  showMiniMap: boolean;
  animationsEnabled: boolean;
  defaultNamespace: string;
}

const defaultPreferences: UserPreferences = {
  theme: 'system',
  defaultZoom: 100,
  autoRefreshInterval: 30,
  showNotifications: true,
  soundEnabled: false,
  compactMode: false,
  showMiniMap: true,
  animationsEnabled: true,
  defaultNamespace: 'all',
};

const AI_PROVIDER_OPTIONS = [
  { value: 'none', label: 'None (AI disabled)' },
  { value: 'openai', label: 'OpenAI (GPT-4, GPT-3.5)' },
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'ollama', label: 'Ollama (Local)' },
  { value: 'custom', label: 'Custom (OpenAI-compatible)' },
] as const;

export default function Settings() {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [hasChanges, setHasChanges] = useState(false);
  const backendBaseUrl = useBackendConfigStore((s) => s.backendBaseUrl);
  const setBackendBaseUrl = useBackendConfigStore((s) => s.setBackendBaseUrl);
  const [backendUrlInput, setBackendUrlInput] = useState(backendBaseUrl);
  const [backendUrlDirty, setBackendUrlDirty] = useState(false);

  // AI Provider Configuration
  const [aiConfig, setAiConfig] = useState<LLMProviderConfig>({ provider: 'none' });
  const [aiConfigDirty, setAiConfigDirty] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [aiConnected, setAiConnected] = useState<boolean | null>(null);
  const [aiTestLoading, setAiTestLoading] = useState(false);

  useEffect(() => {
    setBackendUrlInput(backendBaseUrl);
  }, [backendBaseUrl]);

  // Load preferences from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('kubilitics-preferences');
    if (saved) {
      try {
        setPreferences(JSON.parse(saved));
      } catch {
        // Use defaults
      }
    }
  }, []);

  // Track changes
  useEffect(() => {
    const saved = localStorage.getItem('kubilitics-preferences');
    const current = JSON.stringify(preferences);
    setHasChanges(saved !== current);
  }, [preferences]);

  // Load saved AI provider config
  useEffect(() => {
    const saved = loadLLMProviderConfig();
    if (saved) setAiConfig(saved);
  }, []);

  const handleAiConfigChange = (updates: Partial<LLMProviderConfig>) => {
    setAiConfig((prev) => ({ ...prev, ...updates }));
    setAiConfigDirty(true);
    setAiConnected(null);
  };

  const handleSaveAiConfig = () => {
    if (aiConfig.provider === 'none') {
      clearLLMProviderConfig();
    } else {
      saveLLMProviderConfig(aiConfig);
    }
    setAiConfigDirty(false);
    toast.success('AI provider settings saved');
  };

  const handleTestAiConnection = async () => {
    setAiTestLoading(true);
    setAiConnected(null);
    try {
      await getAIInfo();
      setAiConnected(true);
      toast.success('Connected to AI service');
    } catch {
      setAiConnected(false);
      toast.error('Failed to connect to AI service');
    } finally {
      setAiTestLoading(false);
    }
  };

  const handleSave = () => {
    localStorage.setItem('kubilitics-preferences', JSON.stringify(preferences));
    setHasChanges(false);
    toast.success('Settings saved successfully');
    
    // Apply theme immediately
    applyTheme(preferences.theme);
  };

  const handleReset = () => {
    setPreferences(defaultPreferences);
    localStorage.removeItem('kubilitics-preferences');
    applyTheme('system');
    toast.success('Settings reset to defaults');
  };

  const applyTheme = (theme: 'light' | 'dark' | 'system') => {
    const root = document.documentElement;
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    } else {
      root.classList.toggle('dark', theme === 'dark');
    }
  };

  const updatePreference = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
    
    // Apply theme changes immediately for preview
    if (key === 'theme') {
      applyTheme(value as 'light' | 'dark' | 'system');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 max-w-4xl"
    >
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <SettingsIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground">
              Customize your Kubilitics experience
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge variant="secondary" className="gap-1.5">
              <Info className="h-3 w-3" />
              Unsaved changes
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!hasChanges} className="gap-2">
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Backend API (A3.5: configure backend URL; recovery from unreachable) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Backend API
          </CardTitle>
          <CardDescription>
            Kubilitics backend base URL. When set (or when using default on this device), clusters load from the backend.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="backend-url">Backend base URL</Label>
            <Input
              id="backend-url"
              type="url"
              placeholder={DEFAULT_BACKEND_BASE_URL}
              value={backendUrlInput}
              onChange={(e) => {
                setBackendUrlInput(e.target.value.trim());
                setBackendUrlDirty(e.target.value.trim() !== backendBaseUrl);
              }}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to use default on this device ({DEFAULT_BACKEND_BASE_URL} when running locally or in the desktop app).
            </p>
          </div>
          {backendUrlDirty && (
            <Button
              size="sm"
              onClick={() => {
                setBackendBaseUrl(backendUrlInput);
                setBackendUrlDirty(false);
                toast.success('Backend URL saved');
              }}
            >
              Save backend URL
            </Button>
          )}
        </CardContent>
      </Card>

      {/* AI Provider Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Configuration
          </CardTitle>
          <CardDescription>
            Configure your LLM provider for AI-powered insights, anomaly detection, and the AI assistant.
            Bring your own API key — Kubilitics does not bundle any API keys.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Provider selection */}
          <div className="space-y-2">
            <Label htmlFor="ai-provider">AI Provider</Label>
            <Select
              value={aiConfig.provider}
              onValueChange={(v) => handleAiConfigChange({ provider: v as LLMProviderConfig['provider'] })}
            >
              <SelectTrigger id="ai-provider" className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_PROVIDER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Model */}
          {aiConfig.provider !== 'none' && (
            <div className="space-y-2">
              <Label htmlFor="ai-model">Model</Label>
              <Input
                id="ai-model"
                placeholder={
                  aiConfig.provider === 'openai' ? 'gpt-4o' :
                  aiConfig.provider === 'anthropic' ? 'claude-3-5-sonnet-20241022' :
                  aiConfig.provider === 'ollama' ? 'llama3' : 'your-model-name'
                }
                value={aiConfig.model ?? ''}
                onChange={(e) => handleAiConfigChange({ model: e.target.value })}
                className="max-w-xs font-mono"
              />
            </div>
          )}

          {/* API Key (OpenAI / Anthropic) */}
          {(aiConfig.provider === 'openai' || aiConfig.provider === 'anthropic') && (
            <div className="space-y-2">
              <Label htmlFor="ai-api-key">API Key</Label>
              <div className="relative max-w-sm">
                <Key className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="ai-api-key"
                  type={showApiKey ? 'text' : 'password'}
                  placeholder={aiConfig.provider === 'openai' ? 'sk-...' : 'sk-ant-...'}
                  value={aiConfig.api_key ?? ''}
                  onChange={(e) => handleAiConfigChange({ api_key: e.target.value })}
                  className="pl-9 pr-9 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey((v) => !v)}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                  aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Stored in browser local storage. Never sent to Kubilitics servers.
              </p>
            </div>
          )}

          {/* Base URL (Ollama / Custom) */}
          {(aiConfig.provider === 'ollama' || aiConfig.provider === 'custom') && (
            <div className="space-y-2">
              <Label htmlFor="ai-base-url">Base URL</Label>
              <Input
                id="ai-base-url"
                type="url"
                placeholder={aiConfig.provider === 'ollama' ? 'http://localhost:11434' : 'http://localhost:8000/v1'}
                value={aiConfig.base_url ?? ''}
                onChange={(e) => handleAiConfigChange({ base_url: e.target.value })}
                className="max-w-sm font-mono"
              />
            </div>
          )}

          {/* API Key for custom (optional) */}
          {aiConfig.provider === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="ai-custom-key">API Key (optional)</Label>
              <div className="relative max-w-sm">
                <Key className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="ai-custom-key"
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="Optional bearer token"
                  value={aiConfig.api_key ?? ''}
                  onChange={(e) => handleAiConfigChange({ api_key: e.target.value })}
                  className="pl-9 pr-9 font-mono"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          {aiConfig.provider !== 'none' && (
            <div className="flex items-center gap-3 pt-1">
              {aiConfigDirty && (
                <Button size="sm" onClick={handleSaveAiConfig} className="gap-2">
                  <Save className="h-4 w-4" />
                  Save AI Config
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={handleTestAiConnection}
                disabled={aiTestLoading}
                className="gap-2"
              >
                {aiTestLoading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : aiConnected === true ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : aiConnected === false ? (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
                Test Connection
              </Button>
              {aiConnected === true && (
                <span className="text-sm text-green-600 dark:text-green-400">Connected</span>
              )}
              {aiConnected === false && (
                <span className="text-sm text-destructive">Connection failed</span>
              )}
            </div>
          )}
          {aiConfig.provider === 'none' && (
            <p className="text-sm text-muted-foreground">
              Select a provider above to enable AI features. Analytics without LLM still works.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Appearance Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Appearance
          </CardTitle>
          <CardDescription>
            Customize the look and feel of Kubilitics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Theme */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Theme</Label>
              <p className="text-xs text-muted-foreground">
                Choose your preferred color scheme
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={preferences.theme === 'light' ? 'default' : 'outline'}
                size="sm"
                className="gap-1.5"
                onClick={() => updatePreference('theme', 'light')}
              >
                <Sun className="h-4 w-4" />
                Light
              </Button>
              <Button
                variant={preferences.theme === 'dark' ? 'default' : 'outline'}
                size="sm"
                className="gap-1.5"
                onClick={() => updatePreference('theme', 'dark')}
              >
                <Moon className="h-4 w-4" />
                Dark
              </Button>
              <Button
                variant={preferences.theme === 'system' ? 'default' : 'outline'}
                size="sm"
                className="gap-1.5"
                onClick={() => updatePreference('theme', 'system')}
              >
                <Monitor className="h-4 w-4" />
                System
              </Button>
            </div>
          </div>

          <Separator />

          {/* Compact Mode */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Compact Mode</Label>
              <p className="text-xs text-muted-foreground">
                Use smaller spacing and fonts for denser views
              </p>
            </div>
            <Switch
              checked={preferences.compactMode}
              onCheckedChange={(checked) => updatePreference('compactMode', checked)}
            />
          </div>

          <Separator />

          {/* Animations */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Animations</Label>
              <p className="text-xs text-muted-foreground">
                Enable smooth transitions and animations
              </p>
            </div>
            <Switch
              checked={preferences.animationsEnabled}
              onCheckedChange={(checked) => updatePreference('animationsEnabled', checked)}
            />
          </div>
        </CardContent>
      </Card>


      {/* Notifications Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>
            Configure alerts and notification preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Show Notifications */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Desktop Notifications</Label>
              <p className="text-xs text-muted-foreground">
                Show browser notifications for important events
              </p>
            </div>
            <Switch
              checked={preferences.showNotifications}
              onCheckedChange={(checked) => updatePreference('showNotifications', checked)}
            />
          </div>

          <Separator />

          {/* Sound */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Sound Alerts</Label>
              <p className="text-xs text-muted-foreground">
                Play sound for critical alerts
              </p>
            </div>
            <Switch
              checked={preferences.soundEnabled}
              onCheckedChange={(checked) => updatePreference('soundEnabled', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Data Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            Data & Refresh
          </CardTitle>
          <CardDescription>
            Configure data fetching and defaults
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Auto Refresh Interval */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Auto Refresh Interval</Label>
              <p className="text-xs text-muted-foreground">
                How often to refresh resource data
              </p>
            </div>
            <Select
              value={String(preferences.autoRefreshInterval)}
              onValueChange={(value) => updatePreference('autoRefreshInterval', Number(value))}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 seconds</SelectItem>
                <SelectItem value="30">30 seconds</SelectItem>
                <SelectItem value="60">1 minute</SelectItem>
                <SelectItem value="300">5 minutes</SelectItem>
                <SelectItem value="0">Manual only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Default Namespace */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Default Namespace</Label>
              <p className="text-xs text-muted-foreground">
                Default namespace filter for resource views
              </p>
            </div>
            <Select
              value={preferences.defaultNamespace}
              onValueChange={(value) => updatePreference('defaultNamespace', value)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Namespaces</SelectItem>
                <SelectItem value="default">default</SelectItem>
                <SelectItem value="kube-system">kube-system</SelectItem>
                <SelectItem value="production">production</SelectItem>
                <SelectItem value="staging">staging</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Save Reminder */}
      {hasChanges && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 right-6 bg-card border border-border rounded-lg shadow-lg p-4 flex items-center gap-3"
        >
          <Info className="h-5 w-5 text-primary" />
          <span className="text-sm">You have unsaved changes</span>
          <Button size="sm" onClick={handleSave} className="gap-1.5">
            <Save className="h-4 w-4" />
            Save
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}

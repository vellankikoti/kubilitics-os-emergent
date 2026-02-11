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

export default function Settings() {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [hasChanges, setHasChanges] = useState(false);
  const backendBaseUrl = useBackendConfigStore((s) => s.backendBaseUrl);
  const setBackendBaseUrl = useBackendConfigStore((s) => s.setBackendBaseUrl);
  const [backendUrlInput, setBackendUrlInput] = useState(backendBaseUrl);
  const [backendUrlDirty, setBackendUrlDirty] = useState(false);

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
            Kubilitics backend base URL. When set (or when using default on this device), clusters and topology load from the backend.
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

      {/* Topology Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ZoomIn className="h-5 w-5" />
            Topology & Visualization
          </CardTitle>
          <CardDescription>
            Configure topology view defaults
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Default Zoom */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Default Zoom Level</Label>
                <p className="text-xs text-muted-foreground">
                  Initial zoom level for topology views
                </p>
              </div>
              <Badge variant="secondary">{preferences.defaultZoom}%</Badge>
            </div>
            <Slider
              value={[preferences.defaultZoom]}
              onValueChange={([value]) => updatePreference('defaultZoom', value)}
              min={25}
              max={200}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>25%</span>
              <span>100%</span>
              <span>200%</span>
            </div>
          </div>

          <Separator />

          {/* Mini-map */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Show Mini-map</Label>
              <p className="text-xs text-muted-foreground">
                Display a mini-map for large topology views
              </p>
            </div>
            <Switch
              checked={preferences.showMiniMap}
              onCheckedChange={(checked) => updatePreference('showMiniMap', checked)}
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

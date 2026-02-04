import { useState } from 'react';
import { motion } from 'framer-motion';
import { Server, Link2, Unlink, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useKubernetesConfigStore } from '@/stores/kubernetesConfigStore';
import { useTestK8sConnection } from '@/hooks/useKubernetes';

export function K8sConnectionDialog() {
  const { config, setApiUrl, setToken, disconnect } = useKubernetesConfigStore();
  const testConnection = useTestK8sConnection();
  const [open, setOpen] = useState(false);
  const [apiUrl, setApiUrlLocal] = useState(config.apiUrl);
  const [token, setTokenLocal] = useState(config.token || '');

  const handleConnect = () => {
    setApiUrl(apiUrl);
    setToken(token);
    testConnection.mutate();
  };

  const handleDisconnect = () => {
    disconnect();
    setApiUrlLocal('');
    setTokenLocal('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Server className="h-4 w-4" />
          {config.isConnected ? (
            <>
              <span className="hidden sm:inline">Connected</span>
              <Badge variant="default" className="h-5 px-1.5">
                <CheckCircle2 className="h-3 w-3" />
              </Badge>
            </>
          ) : (
            <>
              <span className="hidden sm:inline">Connect Cluster</span>
              <Badge variant="secondary" className="h-5 px-1.5">
                <XCircle className="h-3 w-3" />
              </Badge>
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Kubernetes Connection
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          {config.isConnected ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <Card className="border-green-500/20 bg-green-500/5">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="font-medium">Connected</p>
                      <p className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">
                        {config.apiUrl}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => testConnection.mutate()}
                  disabled={testConnection.isPending}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${testConnection.isPending ? 'animate-spin' : ''}`} />
                  Test Connection
                </Button>
                <Button variant="destructive" className="flex-1" onClick={handleDisconnect}>
                  <Unlink className="h-4 w-4 mr-2" />
                  Disconnect
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="apiUrl">Kubernetes API URL</Label>
                <Input
                  id="apiUrl"
                  value={apiUrl}
                  onChange={(e) => setApiUrlLocal(e.target.value)}
                  placeholder="https://your-cluster-api:6443"
                />
                <p className="text-xs text-muted-foreground">
                  The URL of your Kubernetes API server or proxy
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="token">Bearer Token (optional)</Label>
                <Input
                  id="token"
                  type="password"
                  value={token}
                  onChange={(e) => setTokenLocal(e.target.value)}
                  placeholder="Your service account token"
                />
                <p className="text-xs text-muted-foreground">
                  Required for authenticated access
                </p>
              </div>
              <Button
                className="w-full"
                onClick={handleConnect}
                disabled={!apiUrl || testConnection.isPending}
              >
                {testConnection.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4 mr-2" />
                )}
                Connect to Cluster
              </Button>
              {testConnection.isError && (
                <p className="text-sm text-destructive text-center">
                  {testConnection.error?.message}
                </p>
              )}
            </motion.div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

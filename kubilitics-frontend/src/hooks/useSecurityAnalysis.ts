import { useState, useCallback } from 'react';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface SecurityIssue {
  type: string;
  severity: Severity;
  title: string;
  description: string;
  remediation: string;
  resource: string;
  namespace?: string;
  timestamp: string;
}

export interface IssueSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface SecurityAnalysisResult {
  issues: SecurityIssue[];
  score: number;
  grade: string;
  summary: IssueSummary;
}

export interface PodSecurityConfig {
  name: string;
  namespace: string;
  run_as_non_root?: boolean;
  run_as_user?: number;
  read_only_root_fs?: boolean;
  privileged?: boolean;
  allow_privilege_escalation?: boolean;
  capabilities?: {
    add?: string[];
    drop?: string[];
  };
}

export interface RBACConfig {
  role_name: string;
  rules: Array<{
    verbs: string[];
    resources: string[];
    api_groups: string[];
  }>;
}

export interface UseSecurityAnalysisOptions {
  autoAnalyze?: boolean;
}

export interface UseSecurityAnalysisResult {
  analysisResult: SecurityAnalysisResult | null;
  isLoading: boolean;
  error: Error | null;
  analyzePod: (config: PodSecurityConfig) => Promise<void>;
  analyzeRBAC: (config: RBACConfig) => Promise<void>;
}

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080';

export function useSecurityAnalysis(
  options: UseSecurityAnalysisOptions = {}
): UseSecurityAnalysisResult {
  const [analysisResult, setAnalysisResult] = useState<SecurityAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const analyzePod = useCallback(async (config: PodSecurityConfig) => {
    if (!config.name) {
      setError(new Error('Pod name is required'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/v1/security/analyze/pod`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      const data: SecurityAnalysisResult = await response.json();
      setAnalysisResult(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setAnalysisResult(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const analyzeRBAC = useCallback(async (config: RBACConfig) => {
    if (!config.role_name) {
      setError(new Error('Role name is required'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/v1/security/analyze/rbac`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      const data: SecurityAnalysisResult = await response.json();
      setAnalysisResult(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setAnalysisResult(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    analysisResult,
    isLoading,
    error,
    analyzePod,
    analyzeRBAC,
  };
}

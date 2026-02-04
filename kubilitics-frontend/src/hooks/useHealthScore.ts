import { useMemo } from 'react';
import { useClusterStore } from '@/stores/clusterStore';

interface HealthMetrics {
  podsRunning: number;
  podsPending: number;
  podsFailed: number;
  nodeHealth: number;
  restartCount: number;
  warningEvents: number;
  errorEvents: number;
}

interface HealthScore {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  breakdown: {
    podHealth: number;
    nodeHealth: number;
    stability: number;
    eventHealth: number;
  };
  details: string[];
}

export function useHealthScore(): HealthScore {
  const { activeCluster } = useClusterStore();

  return useMemo(() => {
    if (!activeCluster) {
      return {
        score: 0,
        grade: 'F',
        status: 'critical',
        breakdown: { podHealth: 0, nodeHealth: 0, stability: 0, eventHealth: 0 },
        details: ['No cluster connected'],
      };
    }

    // Mock metrics - in real app these would come from the Kubernetes API
    const metrics: HealthMetrics = {
      podsRunning: activeCluster.pods.running,
      podsPending: activeCluster.pods.pending,
      podsFailed: activeCluster.pods.failed,
      nodeHealth: 95, // percentage of healthy nodes
      restartCount: 3, // total restarts in last hour
      warningEvents: 5,
      errorEvents: 1,
    };

    const totalPods = metrics.podsRunning + metrics.podsPending + metrics.podsFailed;
    const details: string[] = [];

    // Calculate Pod Health (40% weight)
    const podHealthRatio = totalPods > 0 
      ? (metrics.podsRunning / totalPods) * 100 
      : 100;
    
    // Penalize for pending pods
    const pendingPenalty = metrics.podsPending > 0 ? (metrics.podsPending / totalPods) * 20 : 0;
    // Penalize heavily for failed pods
    const failedPenalty = metrics.podsFailed > 0 ? (metrics.podsFailed / totalPods) * 50 : 0;
    
    const podHealth = Math.max(0, Math.min(100, podHealthRatio - pendingPenalty - failedPenalty));

    if (metrics.podsFailed > 0) {
      details.push(`${metrics.podsFailed} pod(s) in failed state`);
    }
    if (metrics.podsPending > 2) {
      details.push(`${metrics.podsPending} pod(s) pending - possible resource constraints`);
    }

    // Calculate Node Health (30% weight)
    const nodeHealth = metrics.nodeHealth;
    
    if (nodeHealth < 100) {
      details.push(`${100 - nodeHealth}% of nodes reporting issues`);
    }

    // Calculate Stability Score (20% weight)
    // Based on restart count - fewer restarts = higher stability
    let stability = 100;
    if (metrics.restartCount > 0) {
      stability = Math.max(0, 100 - (metrics.restartCount * 10));
    }
    
    if (metrics.restartCount > 5) {
      details.push(`High restart count: ${metrics.restartCount} restarts in the last hour`);
    }

    // Calculate Event Health (10% weight)
    // Based on warning/error events
    let eventHealth = 100;
    eventHealth -= metrics.warningEvents * 2;
    eventHealth -= metrics.errorEvents * 10;
    eventHealth = Math.max(0, eventHealth);

    if (metrics.errorEvents > 0) {
      details.push(`${metrics.errorEvents} error event(s) detected`);
    }
    if (metrics.warningEvents > 3) {
      details.push(`${metrics.warningEvents} warning events in cluster`);
    }

    // Calculate weighted overall score
    const score = Math.round(
      (podHealth * 0.4) +
      (nodeHealth * 0.3) +
      (stability * 0.2) +
      (eventHealth * 0.1)
    );

    // Determine grade and status
    let grade: HealthScore['grade'];
    let status: HealthScore['status'];

    if (score >= 90) {
      grade = 'A';
      status = 'excellent';
      if (details.length === 0) {
        details.push('All systems operating normally');
      }
    } else if (score >= 80) {
      grade = 'B';
      status = 'good';
    } else if (score >= 70) {
      grade = 'C';
      status = 'fair';
    } else if (score >= 60) {
      grade = 'D';
      status = 'poor';
    } else {
      grade = 'F';
      status = 'critical';
    }

    return {
      score,
      grade,
      status,
      breakdown: {
        podHealth: Math.round(podHealth),
        nodeHealth: Math.round(nodeHealth),
        stability: Math.round(stability),
        eventHealth: Math.round(eventHealth),
      },
      details,
    };
  }, [activeCluster]);
}

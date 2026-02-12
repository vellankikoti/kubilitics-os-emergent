import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { AnomalyList } from "@/components/AnomalyList";
import { CapacityAlert } from "@/components/CapacityAlert";
import { useAnomalyDetection, DataPoint } from "@/hooks/useAnomalyDetection";
import { useTrendAnalysis } from "@/hooks/useTrendAnalysis";

// Mock data generator - in production, this would come from your metrics API
const generateMockMetricData = (): DataPoint[] => {
  const now = Date.now();
  const data: DataPoint[] = [];

  for (let i = 0; i < 30; i++) {
    const timestamp = new Date(now - (30 - i) * 60000).toISOString(); // Last 30 minutes
    const baseValue = 45;
    const noise = Math.random() * 10;
    const trend = i * 0.5; // Increasing trend

    // Add anomaly spike at index 20
    const value = i === 20 ? baseValue + 50 : baseValue + noise + trend;

    data.push({
      timestamp,
      value
    });
  }

  return data;
};

export const SmartInsightsSection = () => {
  const [metricData, setMetricData] = useState<DataPoint[]>([]);
  const [dismissedCapacity, setDismissedCapacity] = useState(false);

  // Initialize mock data
  useEffect(() => {
    setMetricData(generateMockMetricData());
  }, []);

  // Anomaly detection
  const { anomalies, isLoading: anomaliesLoading } = useAnomalyDetection({
    metricName: 'cluster_cpu_usage',
    metricType: 'cpu',
    data: metricData,
    sensitivity: 'medium',
    enabled: metricData.length > 0,
    refreshInterval: 30000 // 30 seconds
  });

  // Trend analysis for capacity forecasting
  const { trend } = useTrendAnalysis({
    metricName: 'cluster_cpu_usage',
    metricType: 'cpu',
    data: metricData,
    forecastSteps: 10,
    enabled: metricData.length > 0,
    refreshInterval: 60000 // 1 minute
  });

  const currentValue = metricData.length > 0 ? metricData[metricData.length - 1].value : 0;
  const capacity = 100; // 100% capacity

  return (
    <div className="space-y-4">
      {/* Capacity Alert */}
      {trend && !dismissedCapacity && (
        <CapacityAlert
          trend={trend}
          resourceName="Cluster CPU"
          currentValue={currentValue}
          capacity={capacity}
          onDismiss={() => setDismissedCapacity(true)}
        />
      )}

      {/* Anomaly Cards */}
      {!anomaliesLoading && anomalies.length > 0 && (
        <Card className="border-none glass-panel">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Sparkles className="w-4 h-4 text-cosmic-purple fill-current" />
              <span className="text-gradient font-bold">Detected Anomalies</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AnomalyList anomalies={anomalies} maxVisible={3} />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

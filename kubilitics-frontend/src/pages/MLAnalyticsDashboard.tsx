import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Download,
  Activity,
  BarChart3
} from 'lucide-react';
import { MLAnomalyChart } from '@/components/MLAnomalyChart';
import { ForecastChart } from '@/components/ForecastChart';
import { ModelExplainabilityPanel } from '@/components/ModelExplainabilityPanel';
import { useMLAnomalyDetection } from '@/hooks/useMLAnomalyDetection';
import { useTimeSeriesForecast } from '@/hooks/useTimeSeriesForecast';

export function MLAnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedMetric, setSelectedMetric] = useState<'cpu' | 'memory' | 'network'>('cpu');

  // Generate example data for CPU usage
  const generateExampleData = (metric: string, days: number = 30) => {
    const data = [];
    const now = Date.now();
    const baseValue = metric === 'cpu' ? 50 : metric === 'memory' ? 4096 : 1000;
    const variance = metric === 'cpu' ? 20 : metric === 'memory' ? 1024 : 500;

    for (let i = days * 24; i >= 0; i--) {
      const timestamp = new Date(now - i * 3600000);
      const normalValue = baseValue + (Math.random() - 0.5) * variance;

      // Add some anomalies
      const isAnomaly = Math.random() < 0.05;
      const value = isAnomaly ? baseValue + variance * (2 + Math.random()) : normalValue;

      data.push({
        timestamp: timestamp.toISOString(),
        value,
        label: `${metric}-usage`
      });
    }
    return data;
  };

  // ML Anomaly Detection
  const {
    anomalies: cpuAnomalies,
    modelInfo: cpuModelInfo,
    isLoading: isCpuLoading,
    detectAnomalies: detectCpuAnomalies
  } = useMLAnomalyDetection({
    metric: 'cpu_usage',
    autoDetect: false
  });

  // Time Series Forecasting
  const {
    forecast: cpuForecast,
    confidence: cpuConfidence,
    isLoading: isForecastLoading,
    generateForecast: generateCpuForecast
  } = useTimeSeriesForecast({
    metric: 'cpu_usage',
    autoForecast: false
  });

  const exampleData = generateExampleData(selectedMetric);

  const handleDetectAnomalies = async () => {
    await detectCpuAnomalies(exampleData);
  };

  const handleGenerateForecast = async () => {
    const timeSeriesData = exampleData.map(d => d.value);
    await generateCpuForecast(timeSeriesData, 24); // Forecast 24 hours
  };

  const getSeverityBadge = (count: number) => {
    if (count === 0) return <Badge variant="secondary">None</Badge>;
    if (count < 5) return <Badge variant="default">{count} Detected</Badge>;
    return <Badge variant="destructive">{count} Detected</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="h-8 w-8 text-purple-600" />
            ML Analytics Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Machine learning-powered anomaly detection and forecasting
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDetectAnomalies} disabled={isCpuLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isCpuLoading ? 'animate-spin' : ''}`} />
            Detect Anomalies
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Anomalies Detected */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Anomalies (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-red-600">
                {cpuAnomalies?.length || 0}
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600 opacity-50" />
            </div>
            <div className="mt-2">
              {getSeverityBadge(cpuAnomalies?.length || 0)}
            </div>
          </CardContent>
        </Card>

        {/* Model Accuracy */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Model Accuracy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-green-600">
                {cpuModelInfo?.accuracy ? `${(cpuModelInfo.accuracy * 100).toFixed(1)}%` : 'N/A'}
              </div>
              <Activity className="h-8 w-8 text-green-600 opacity-50" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Isolation Forest Algorithm
            </p>
          </CardContent>
        </Card>

        {/* Forecast Confidence */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Forecast Confidence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-blue-600">
                {cpuConfidence ? `${(cpuConfidence * 100).toFixed(0)}%` : 'N/A'}
              </div>
              <TrendingUp className="h-8 w-8 text-blue-600 opacity-50" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              ARIMA Model
            </p>
          </CardContent>
        </Card>

        {/* Data Points */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Training Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-purple-600">
                {exampleData.length}
              </div>
              <BarChart3 className="h-8 w-8 text-purple-600 opacity-50" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Last 30 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Metric Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Select Metric</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant={selectedMetric === 'cpu' ? 'default' : 'outline'}
              onClick={() => setSelectedMetric('cpu')}
            >
              CPU Usage
            </Button>
            <Button
              variant={selectedMetric === 'memory' ? 'default' : 'outline'}
              onClick={() => setSelectedMetric('memory')}
            >
              Memory Usage
            </Button>
            <Button
              variant={selectedMetric === 'network' ? 'default' : 'outline'}
              onClick={() => setSelectedMetric('network')}
            >
              Network I/O
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Different Views */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="anomalies">Anomaly Detection</TabsTrigger>
          <TabsTrigger value="forecasts">Forecasts</TabsTrigger>
          <TabsTrigger value="models">Model Info</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Anomaly Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Real-time Anomaly Detection</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Isolation Forest algorithm identifies unusual patterns
                </p>
              </CardHeader>
              <CardContent>
                {cpuAnomalies && cpuAnomalies.length > 0 ? (
                  <MLAnomalyChart
                    title={`${selectedMetric.toUpperCase()} Usage Anomalies`}
                    data={exampleData}
                    anomalies={cpuAnomalies}
                    showConfidenceBands={true}
                    height={300}
                  />
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Click "Detect Anomalies" to analyze the data</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Forecast Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Resource Forecasting</CardTitle>
                <p className="text-xs text-muted-foreground">
                  ARIMA model predicts future resource usage
                </p>
              </CardHeader>
              <CardContent>
                <Button onClick={handleGenerateForecast} disabled={isForecastLoading} className="mb-4">
                  {isForecastLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Forecasting...
                    </>
                  ) : (
                    <>
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Generate Forecast
                    </>
                  )}
                </Button>

                {cpuForecast && cpuForecast.length > 0 ? (
                  <ForecastChart
                    title={`${selectedMetric.toUpperCase()} Usage Forecast`}
                    historicalData={exampleData.map(d => ({
                      timestamp: d.timestamp,
                      value: d.value
                    }))}
                    forecasts={cpuForecast}
                    unit={selectedMetric === 'cpu' ? '%' : selectedMetric === 'memory' ? 'MB' : 'Mbps'}
                    height={300}
                    showConfidenceBands={true}
                  />
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Click "Generate Forecast" to predict future usage</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Stats */}
          {cpuAnomalies && cpuAnomalies.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Recent Anomalies</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {cpuAnomalies.slice(0, 5).map((anomaly, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className={`h-4 w-4 ${
                          anomaly.severity === 'critical' ? 'text-red-600' :
                          anomaly.severity === 'high' ? 'text-orange-600' :
                          anomaly.severity === 'medium' ? 'text-yellow-600' : 'text-blue-600'
                        }`} />
                        <div>
                          <p className="text-sm font-semibold">{anomaly.metric}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(anomaly.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{anomaly.value.toFixed(2)}</p>
                        <Badge variant="outline" className="text-xs capitalize">
                          {anomaly.severity}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Anomaly Detection Tab */}
        <TabsContent value="anomalies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Anomaly Detection Analysis</CardTitle>
              <p className="text-xs text-muted-foreground">
                Using Isolation Forest algorithm to identify outliers and unusual patterns
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={handleDetectAnomalies} disabled={isCpuLoading}>
                {isCpuLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4 mr-2" />
                    Detect Anomalies
                  </>
                )}
              </Button>

              {cpuAnomalies && cpuAnomalies.length > 0 && (
                <MLAnomalyChart
                  title={`${selectedMetric.toUpperCase()} Usage Anomalies - Detailed View`}
                  data={exampleData}
                  anomalies={cpuAnomalies}
                  showConfidenceBands={true}
                  height={400}
                />
              )}

              {!cpuAnomalies && !isCpuLoading && (
                <div className="text-center py-12 text-muted-foreground">
                  <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Click "Detect Anomalies" to start the analysis</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Forecasting Tab */}
        <TabsContent value="forecasts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Time Series Forecasting</CardTitle>
              <p className="text-xs text-muted-foreground">
                ARIMA model predicts future resource usage with confidence intervals
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button onClick={handleGenerateForecast} disabled={isForecastLoading}>
                  {isForecastLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Forecasting...
                    </>
                  ) : (
                    <>
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Generate 24-Hour Forecast
                    </>
                  )}
                </Button>
              </div>

              {cpuForecast && cpuForecast.length > 0 && (
                <ForecastChart
                  title={`${selectedMetric.toUpperCase()} Usage Forecast - Next 24 Hours`}
                  historicalData={exampleData.map(d => ({
                    timestamp: d.timestamp,
                    value: d.value
                  }))}
                  forecasts={cpuForecast}
                  unit={selectedMetric === 'cpu' ? '%' : selectedMetric === 'memory' ? 'MB' : 'Mbps'}
                  height={400}
                  showConfidenceBands={true}
                />
              )}

              {!cpuForecast && !isForecastLoading && (
                <div className="text-center py-12 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Click "Generate Forecast" to predict future resource usage</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Model Info Tab */}
        <TabsContent value="models" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Isolation Forest Model */}
            <ModelExplainabilityPanel
              modelType="isolation_forest"
              modelInfo={cpuModelInfo || {
                algorithm: 'Isolation Forest',
                num_trees: 100,
                contamination: 0.1,
                max_depth: 10
              }}
              features={[
                { name: selectedMetric + '_usage', importance: 0.85 },
                { name: 'timestamp', importance: 0.15 }
              ]}
            />

            {/* ARIMA Model */}
            <ModelExplainabilityPanel
              modelType="arima"
              modelInfo={{
                algorithm: 'ARIMA',
                p: 2,
                d: 1,
                q: 2,
                confidence_level: cpuConfidence || 0.95
              }}
              features={[
                { name: 'autoregressive_terms', importance: 0.6 },
                { name: 'moving_average', importance: 0.4 }
              ]}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

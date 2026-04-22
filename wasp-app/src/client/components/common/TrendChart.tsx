import React from 'react';
import Chart from 'react-apexcharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

type Series = {
  name: string;
  data: number[];
};

export function TrendChart({ categories, series, loading = false }: { categories: string[]; series: Series[]; loading?: boolean }) {
  const options = {
    chart: { toolbar: { show: false } },
    xaxis: { categories, labels: { rotate: -45 } },
    stroke: { curve: 'smooth' },
    legend: { position: 'top' },
    tooltip: { theme: 'dark' },
  } as any;

  const chartSeries = series.map(s => ({ name: s.name, data: s.data }));

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle>Trends</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-48 bg-muted/20 rounded animate-pulse">
            <p className="text-muted-foreground">Loading trends...</p>
          </div>
        ) : (
          <div>
            <Chart options={options} series={chartSeries} type="area" height={280} width="100%" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

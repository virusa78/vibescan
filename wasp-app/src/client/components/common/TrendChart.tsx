import React from 'react';
import Chart from 'react-apexcharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';

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
          <div className="space-y-3">
            <Skeleton className="h-48 w-full" />
            <div className="grid grid-cols-3 gap-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
            </div>
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

import React from 'react';
import Chart from 'react-apexcharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
/**
 * Vulnerability severity distribution chart
 */
export function SeverityChart({ data, loading = false }) {
    const chartOptions = {
        chart: {
            type: 'donut',
            toolbar: {
                show: false,
            },
        },
        labels: ['Critical', 'High', 'Medium', 'Low', 'Info'],
        colors: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#6b7280'],
        plotOptions: {
            pie: {
                donut: {
                    size: '65%',
                },
            },
        },
        dataLabels: {
            enabled: true,
            formatter: (val) => {
                return Math.round(val) + '%';
            },
        },
        legend: {
            position: 'bottom',
            fontSize: '12',
            fontFamily: 'inherit',
            labels: {
                colors: '#9ca3af',
            },
        },
        tooltip: {
            theme: 'dark',
        },
    };
    const chartSeries = [
        data.critical,
        data.high,
        data.medium,
        data.low,
        data.info,
    ];
    return (<Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle>Vulnerability Severity</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Distribution across all scans ({data.total} total)
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (<div className="space-y-4">
            <Skeleton className="h-64 w-full"/>
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-16 w-full"/>
              <Skeleton className="h-16 w-full"/>
              <Skeleton className="h-16 w-full"/>
              <Skeleton className="h-16 w-full"/>
            </div>
          </div>) : data.total === 0 ? (<div className="flex items-center justify-center h-64 bg-muted/20 rounded">
            <p className="text-muted-foreground">No vulnerabilities found</p>
          </div>) : (<div className="flex flex-col items-center">
            <Chart options={chartOptions} series={chartSeries} type="donut" height={300} width="100%"/>
            <div className="grid grid-cols-2 gap-3 w-full mt-4 text-sm">
              <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3">
                <p className="text-xs text-muted-foreground">CRITICAL</p>
                <p className="text-xl font-bold text-red-500">{data.critical}</p>
              </div>
              <div className="rounded-md border border-orange-500/30 bg-orange-500/10 p-3">
                <p className="text-xs text-muted-foreground">HIGH</p>
                <p className="text-xl font-bold text-orange-500">{data.high}</p>
              </div>
              <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3">
                <p className="text-xs text-muted-foreground">MEDIUM</p>
                <p className="text-xl font-bold text-yellow-500">{data.medium}</p>
              </div>
              <div className="rounded-md border border-green-500/30 bg-green-500/10 p-3">
                <p className="text-xs text-muted-foreground">LOW</p>
                <p className="text-xl font-bold text-green-500">{data.low}</p>
              </div>
            </div>
          </div>)}
      </CardContent>
    </Card>);
}
//# sourceMappingURL=SeverityChart.jsx.map
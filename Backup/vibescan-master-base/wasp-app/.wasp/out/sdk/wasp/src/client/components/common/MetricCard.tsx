import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: React.ReactNode;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    text: string;
  };
  loading?: boolean;
}

/**
 * Reusable metric card component for dashboard
 */
export function MetricCard({
  label,
  value,
  subtext,
  icon,
  trend,
  loading = false,
}: MetricCardProps) {
  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </CardTitle>
          {icon && <div className="text-primary">{icon}</div>}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <div className="h-8 bg-muted rounded animate-pulse"></div>
            <div className="h-3 bg-muted/50 rounded w-20 animate-pulse"></div>
          </div>
        ) : (
          <>
            <p className="text-3xl font-bold text-foreground">{value}</p>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-muted-foreground">{subtext}</p>
              {trend && (
                <span
                  className={`text-xs font-medium ${
                    trend.direction === 'up' ? 'text-green-500' : 'text-red-500'
                  }`}
                >
                  {trend.text}
                </span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

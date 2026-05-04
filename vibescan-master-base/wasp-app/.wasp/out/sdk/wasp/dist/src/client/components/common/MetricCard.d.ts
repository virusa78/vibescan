import React from 'react';
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
export declare function MetricCard({ label, value, subtext, icon, trend, loading, }: MetricCardProps): React.JSX.Element;
export {};
//# sourceMappingURL=MetricCard.d.ts.map
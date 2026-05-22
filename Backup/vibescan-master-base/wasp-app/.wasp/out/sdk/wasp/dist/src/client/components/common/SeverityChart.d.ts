import React from 'react';
interface SeverityChartProps {
    data: {
        critical: number;
        high: number;
        medium: number;
        low: number;
        info: number;
        total: number;
    };
    loading?: boolean;
}
/**
 * Vulnerability severity distribution chart
 */
export declare function SeverityChart({ data, loading }: SeverityChartProps): React.JSX.Element;
export {};
//# sourceMappingURL=SeverityChart.d.ts.map
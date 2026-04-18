import React from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  getStatusBadge,
  getScanTypeDisplay,
  formatRelativeTime,
} from '../../utils/severity';

interface ScanTableProps {
  scans: Array<{
    id: string;
    status: string;
    inputType: string;
    inputRef: string;
    created_at: string;
    vulnerability_count: number;
  }>;
  loading?: boolean;
  onRefresh?: () => void;
}

/**
 * Table displaying recent scans with real data
 */
export function ScanTable({ scans, loading = false, onRefresh }: ScanTableProps) {
  const navigate = useNavigate();

  const handleRowClick = (scanId: string) => {
    navigate(`/scans/${scanId}`);
  };

  const renderSkeletonRow = () => (
    <tr className="border-b border-border/20">
      <td className="py-3 px-4">
        <div className="h-4 bg-muted rounded animate-pulse w-24"></div>
      </td>
      <td className="py-3 px-4">
        <div className="h-4 bg-muted rounded animate-pulse w-16"></div>
      </td>
      <td className="py-3 px-4">
        <div className="h-4 bg-muted rounded animate-pulse w-20"></div>
      </td>
      <td className="py-3 px-4">
        <div className="h-4 bg-muted rounded animate-pulse w-12"></div>
      </td>
      <td className="py-3 px-4">
        <div className="h-4 bg-muted rounded animate-pulse w-20"></div>
      </td>
    </tr>
  );

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Recent Scans</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Latest vulnerability scan results
          </p>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="text-xs px-3 py-1 border border-primary/50 text-primary rounded hover:bg-primary/10 transition"
          >
            Refresh
          </button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">
                    ID
                  </th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">
                    TYPE
                  </th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">
                    STATUS
                  </th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">
                    FINDINGS
                  </th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">
                    DATE
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...Array(3)].map((_, idx) => (
                  <React.Fragment key={idx}>{renderSkeletonRow()}</React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : scans.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No scans yet.</p>
            <button
              onClick={() => navigate('/scans/new')}
              className="text-sm px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition"
            >
              Create First Scan
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">
                    ID
                  </th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">
                    TYPE
                  </th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">
                    STATUS
                  </th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">
                    FINDINGS
                  </th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">
                    DATE
                  </th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">
                    ACTION
                  </th>
                </tr>
              </thead>
              <tbody>
                {scans.map(scan => {
                  const statusBadge = getStatusBadge(scan.status);
                  const scanType = getScanTypeDisplay(scan.inputType);
                  const relativeTime = formatRelativeTime(scan.created_at);

                  return (
                    <tr
                      key={scan.id}
                      className="border-b border-border/20 hover:bg-accent/5 transition-colors cursor-pointer"
                      onClick={() => handleRowClick(scan.id)}
                    >
                      <td className="py-3 px-4 text-foreground font-mono text-xs">
                        {scan.id.slice(0, 8)}...
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs px-2 py-1 border border-primary/50 text-primary rounded">
                          {scanType}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs px-2 py-1 border rounded font-medium ${statusBadge.color} ${statusBadge.border}`}
                        >
                          {scan.status.charAt(0).toUpperCase() + scan.status.slice(1)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-foreground font-medium">
                          {scan.vulnerability_count}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">
                        {relativeTime}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          className="text-xs px-3 py-1 text-primary hover:bg-primary/10 rounded transition"
                          onClick={e => {
                            e.stopPropagation();
                            handleRowClick(scan.id);
                          }}
                        >
                          View →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * ScanDetailsPage - Real-time scan status and full vulnerability results
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { getScanById, useQuery } from 'wasp/client/operations';
import { useScanPolling } from '../client/hooks/useScanPolling';
import { Card, CardContent, CardHeader, CardTitle } from '../client/components/ui/card';
import { Badge } from '../client/components/ui/badge';
import { AlertTriangle, CheckCircle, Clock, Zap, ArrowLeft } from 'lucide-react';
import { api } from 'wasp/client/api';

interface Report {
  scanId: string;
  status: 'completed' | 'failed' | 'partial';
  severity_breakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  total_free: number;
  total_enterprise: number;
  delta_count: number;
  vulnerabilities?: any[];
}

function getSeverityColor(severity: string): string {
  const sev = (severity || '').toLowerCase();
  if (sev === 'critical') return 'text-red-600 bg-red-100 border-red-300';
  if (sev === 'high') return 'text-orange-600 bg-orange-100 border-orange-300';
  if (sev === 'medium') return 'text-yellow-600 bg-yellow-100 border-yellow-300';
  if (sev === 'low') return 'text-green-600 bg-green-100 border-green-300';
  return 'text-gray-600 bg-gray-100 border-gray-300';
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
}

export function ScanDetailsPage() {
  const params = useParams<{ scanId?: string }>();
  const scanId = params.scanId || '';
  const navigate = useNavigate();
  const { scan, isPolling, status, progress, error } = useScanPolling(scanId);
  const scanDetailsQuery = useQuery(
    getScanById,
    { scanId },
    {
      enabled: status === 'completed' && !!scanId,
      refetchInterval: 3000,
    },
  );
  
  const [report, setReport] = useState<Report | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // Fetch report once scan is completed
  useEffect(() => {
    if (status === 'completed' && !report) {
      const fetchReport = async () => {
        try {
          setReportLoading(true);
          setReportError(null);
          
          const response = await api.get(`/api/v1/reports/${scanId}`);
          const data: Report = response.data;
          setReport(data);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Failed to load report';
          setReportError(msg);
        } finally {
          setReportLoading(false);
        }
      };

      fetchReport();
    }
  }, [status, scanId, report]);

  // Loading state
  if (!scan && isPolling) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 mb-8">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-blue-400 hover:text-blue-300"
            >
              <ArrowLeft size={20} />
              Back to Dashboard
            </button>
          </div>

          <Card className="border-slate-700 bg-slate-800/50">
            <CardHeader>
              <CardTitle>Loading Scan Details...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin">
                  <Zap className="text-blue-400" size={32} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Error state
  if (status === 'error' || (status === 'failed' && scan?.errorMessage)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 mb-8">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-blue-400 hover:text-blue-300"
            >
              <ArrowLeft size={20} />
              Back to Dashboard
            </button>
          </div>

          <Card className="border-red-700 bg-red-900/20" data-testid="scan-status-failed">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-red-500" size={24} />
                <CardTitle>Scan Failed</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-red-400">{scan?.errorMessage || error}</p>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
              >
                Return to Dashboard
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Scanning state
  if (isPolling && status === 'running') {
    const elapsedMs = scan ? Date.now() - new Date(scan.createdAt).getTime() : 0;
    const elapsedSecs = Math.floor(elapsedMs / 1000);
    const estimatedRemaining = Math.max(0, 60 - elapsedSecs);

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 mb-8">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-blue-400 hover:text-blue-300"
            >
              <ArrowLeft size={20} />
              Back to Dashboard
            </button>
          </div>

          <Card className="border-blue-700 bg-blue-900/20" data-testid="scan-status-running">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="text-blue-400 animate-pulse" size={24} />
                  <CardTitle>Scanning in Progress...</CardTitle>
                </div>
                <Badge className="bg-blue-600">Running</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Scan Details */}
              {scan && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-400 text-xs uppercase">Scan Type</p>
                    <p className="text-white font-medium">{scan.inputType}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs uppercase">Input</p>
                    <p className="text-white font-medium truncate">{scan.inputRef}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs uppercase">Started</p>
                    <p className="text-white font-medium">{formatDate(scan.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs uppercase">Plan</p>
                    <p className="text-white font-medium">{scan.planAtSubmission}</p>
                  </div>
                </div>
              )}

              {/* Progress Bar */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-slate-400 text-sm">Progress</p>
                  <p className="text-blue-400 text-sm font-medium">{progress}%</p>
                </div>
                <div className="w-full bg-slate-700/50 rounded-full h-3">
                  <div
                    className="bg-blue-500 rounded-full h-3 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Time Estimate */}
              <div className="flex items-center gap-2 text-slate-300 text-sm">
                <Clock size={18} className="text-blue-400" />
                <span>Estimated time remaining: ~{estimatedRemaining} seconds</span>
              </div>

              <p className="text-slate-400 text-xs">
                Scanning for vulnerabilities using dual-scanner pipeline...
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Completed state
  if (status === 'completed' && report) {
    const totalVulnerabilities = report.total_free + report.total_enterprise;
    const scanDetails = scanDetailsQuery.data;
    const scanResults = scanDetails?.scanResults ?? [];
    const scanDeltas = scanDetails?.scanDeltas ?? [];
    const latestDelta = scanDeltas[0];

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
        <div className="max-w-6xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mb-8">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-blue-400 hover:text-blue-300"
            >
              <ArrowLeft size={20} />
              Dashboard
            </button>
            <span className="text-slate-500">/</span>
            <span className="text-slate-300">{scanId}</span>
          </div>

          {/* Header */}
          <div className="flex items-center justify-between mb-8" data-testid="scan-status-completed">
            <div className="flex items-center gap-3">
              <CheckCircle className="text-green-500" size={32} />
              <div>
                <h1 className="text-3xl font-bold text-white">Scan Complete</h1>
                <p className="text-slate-400">{scan?.inputRef}</p>
              </div>
            </div>
            {scan && (
              <div className="text-right">
                <p className="text-slate-400 text-sm">Completed</p>
                <p className="text-white font-medium">{formatDate(scan.completedAt || new Date())}</p>
              </div>
            )}
          </div>

          {/* Severity Breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            {/* Total */}
            <Card className="border-slate-700 bg-slate-800/50">
              <CardContent className="pt-6">
                <p className="text-slate-400 text-xs uppercase mb-2">Total</p>
                <p className="text-3xl font-bold text-white">{totalVulnerabilities}</p>
              </CardContent>
            </Card>

            {/* Critical */}
            <Card className="border-red-700 bg-red-900/20">
              <CardContent className="pt-6">
                <p className="text-red-400 text-xs uppercase mb-2">Critical</p>
                <p className="text-3xl font-bold text-red-500">{report.severity_breakdown.critical}</p>
              </CardContent>
            </Card>

            {/* High */}
            <Card className="border-orange-700 bg-orange-900/20">
              <CardContent className="pt-6">
                <p className="text-orange-400 text-xs uppercase mb-2">High</p>
                <p className="text-3xl font-bold text-orange-500">{report.severity_breakdown.high}</p>
              </CardContent>
            </Card>

            {/* Medium */}
            <Card className="border-yellow-700 bg-yellow-900/20">
              <CardContent className="pt-6">
                <p className="text-yellow-400 text-xs uppercase mb-2">Medium</p>
                <p className="text-3xl font-bold text-yellow-500">{report.severity_breakdown.medium}</p>
              </CardContent>
            </Card>

            {/* Low */}
            <Card className="border-green-700 bg-green-900/20">
              <CardContent className="pt-6">
                <p className="text-green-400 text-xs uppercase mb-2">Low</p>
                <p className="text-3xl font-bold text-green-500">{report.severity_breakdown.low}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-8">
            <Card className="border-slate-700 bg-slate-800/50" data-testid="scanner-summary">
              <CardHeader>
                <CardTitle>Scanner Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {scanResults.length > 0 ? (
                  scanResults.map((result) => (
                    <div
                      key={result.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-700/70 bg-slate-900/40 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium capitalize text-white">{result.source}</p>
                        <p className="text-xs text-slate-400">{result.scannerVersion}</p>
                      </div>
                      <span className="text-xs text-slate-300">
                        {Array.isArray(result.vulnerabilities) ? result.vulnerabilities.length : 0} findings
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">No scanner results yet.</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-700 bg-slate-800/50" data-testid="delta-summary">
              <CardHeader>
                <CardTitle>Delta / dedup</CardTitle>
              </CardHeader>
              <CardContent>
                {latestDelta ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-lg border border-slate-700/70 bg-slate-900/40 px-3 py-3">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Free</p>
                        <p className="text-xl font-bold text-blue-400">{latestDelta.totalFreeCount}</p>
                      </div>
                      <div className="rounded-lg border border-slate-700/70 bg-slate-900/40 px-3 py-3">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Enterprise</p>
                        <p className="text-xl font-bold text-purple-400">
                          {latestDelta.totalEnterpriseCount}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-700/70 bg-slate-900/40 px-3 py-3">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Delta</p>
                        <p className="text-xl font-bold text-indigo-400">{latestDelta.deltaCount}</p>
                      </div>
                    </div>
                    <div className="text-sm text-slate-400">
                      Fingerprint dedup keeps shared CVEs collapsed into a single stored finding.
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No delta recorded yet.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Vulnerabilities Table */}
          {report.vulnerabilities && report.vulnerabilities.length > 0 ? (
            <Card className="border-slate-700 bg-slate-800/50">
              <CardHeader>
                <CardTitle>Vulnerabilities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">CVE ID</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">Package</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">Installed</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">Fixed</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">Severity</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">CVSS</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">Status</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.vulnerabilities.map((vuln: any, idx: number) => (
                        <React.Fragment key={vuln.id ?? `${vuln.cveId}-${idx}`}>
                          <tr className="border-b border-slate-700 hover:bg-slate-700/20">
                            <td className="py-3 px-4 text-blue-400 font-mono">{vuln.cveId}</td>
                            <td className="py-3 px-4 text-white">{vuln.packageName}</td>
                            <td className="py-3 px-4 text-slate-300">{vuln.installedVersion}</td>
                            <td className="py-3 px-4 text-green-400">{vuln.fixedVersion || '-'}</td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 text-xs rounded font-semibold border ${getSeverityColor(vuln.severity)}`}>
                                {vuln.severity}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-300">{vuln.cvssScore || '-'}</td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-1 text-xs rounded bg-slate-700 text-slate-300 capitalize">
                                {vuln.status || 'active'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-1 text-xs rounded bg-slate-700 text-slate-300">
                                {vuln.source}
                              </span>
                            </td>
                          </tr>
                          {(vuln.description || vuln.filePath) && (
                            <tr className="border-b border-slate-700 bg-slate-800/40">
                              <td className="px-4 pb-3 pt-2 text-xs text-slate-400" colSpan={8}>
                                <div className="space-y-1">
                                  {vuln.description && (
                                    <p className="text-slate-300">{vuln.description}</p>
                                  )}
                                  {vuln.filePath && (
                                    <p>
                                      Path: <span className="font-mono text-slate-200">{vuln.filePath}</span>
                                    </p>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-slate-700 bg-slate-800/50">
              <CardContent className="pt-6">
                <p className="text-slate-400 text-center py-8">No vulnerabilities found</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // Default fallback
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-8"
        >
          <ArrowLeft size={20} />
          Back to Dashboard
        </button>

        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader>
            <CardTitle>Loading...</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-400">Please wait...</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

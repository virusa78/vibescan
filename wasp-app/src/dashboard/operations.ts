import { type User, type Scan, type Finding } from "wasp/entities";
import { HttpError, prisma } from "wasp/server";
import * as z from "zod";
import { ensureArgsSchemaOrThrowHttpError } from "../server/validation";

// Get dashboard metrics
const getDashboardMetricsInputSchema = z.object({
  timeRange: z.enum(["7d", "30d", "all"]).optional(),
});

type GetDashboardMetricsInput = z.infer<typeof getDashboardMetricsInputSchema>;

type DashboardContext = {
  user?: {
    id: string;
    subscriptionStatus?: string | null;
  } | null;
};

export type DashboardMetrics = {
  totalScans: number;
  scansThisMonth: number;
  totalVulnerabilities: number;
  avgSeverity: string;
  quotaUsed: number;
  quotaLimit: number;
  planTier: string;
};

export const getDashboardMetrics = async (
  rawArgs: unknown,
  context: DashboardContext
): Promise<DashboardMetrics> => {
  const { timeRange: _timeRange = "30d" } = ensureArgsSchemaOrThrowHttpError(
    getDashboardMetricsInputSchema,
    rawArgs
  );

  const user = context.user;
  if (!user) {
    throw new HttpError(
      401,
      "Only authenticated users are allowed to perform this operation"
    );
  }

  const allScans = await prisma.scan.findMany({
    where: { userId: user.id },
    include: { findings: true },
  });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const scansThisMonth = allScans.filter(
    (s) => new Date(s.createdAt) > thirtyDaysAgo
  ).length;

  const allFindings = allScans.flatMap((s) => s.findings);
  const severities = {
    critical: allFindings.filter((f: any) => f.severity === "critical").length,
    high: allFindings.filter((f: any) => f.severity === "high").length,
    medium: allFindings.filter((f: any) => f.severity === "medium").length,
    low: allFindings.filter((f: any) => f.severity === "low").length,
  };

  const totalVulnerabilities = allFindings.length;
  let avgSeverity = "medium";
  if (severities.critical > 0) avgSeverity = "critical";
  else if (severities.high > 0) avgSeverity = "high";

  return {
    totalScans: allScans.length,
    scansThisMonth,
    totalVulnerabilities,
    avgSeverity,
    quotaUsed: allScans.length,
    quotaLimit: user.subscriptionStatus === "pro" ? 1000 : 100,
    planTier: user.subscriptionStatus || "free_trial",
  };
};

// Get quota status
export const getQuotaStatus = async (
  _rawArgs: unknown,
  context: DashboardContext
): Promise<{
  used: number;
  limit: number;
  percentage: number;
  resetDate: Date;
  trend: "increasing" | "decreasing" | "stable";
}> => {
  const user = context.user;
  if (!user) {
    throw new HttpError(
      401,
      "Only authenticated users are allowed to perform this operation"
    );
  }

  const scans = await prisma.scan.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const now = new Date();
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const scansThisMonth = scans.filter((s) => new Date(s.createdAt) >= currentMonth).length;

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const scansLastSevenDays = scans.filter(
    (s) => new Date(s.createdAt) >= sevenDaysAgo
  ).length;

  const limit =
    user.subscriptionStatus === "pro" ? 1000 : 100;

  let trend: "increasing" | "decreasing" | "stable" = "stable";
  if (scansLastSevenDays > scansThisMonth / 4) {
    trend = "increasing";
  } else if (scansLastSevenDays < scansThisMonth / 10) {
    trend = "decreasing";
  }

  const nextMonth = new Date(currentMonth);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  return {
    used: scansThisMonth,
    limit,
    percentage: Math.round((scansThisMonth / limit) * 100),
    resetDate: nextMonth,
    trend,
  };
};

// Get recent scans
const getRecentScansInputSchema = z.object({
  limit: z.number().min(1).max(50).optional(),
});

type GetRecentScansInput = z.infer<typeof getRecentScansInputSchema>;

export const getRecentScans = async (
  rawArgs: unknown,
  context: DashboardContext
): Promise<Array<{
  id: string;
  inputRef: string;
  status: string;
  createdAt: Date;
  findingsCount: number;
  severity: { critical: number; high: number; medium: number; low: number; info: number };
}>> => {
  const { limit = 10 } = ensureArgsSchemaOrThrowHttpError(
    getRecentScansInputSchema,
    rawArgs
  );

  const user = context.user;
  if (!user) {
    throw new HttpError(
      401,
      "Only authenticated users are allowed to perform this operation"
    );
  }

  const scans = await prisma.scan.findMany({
    where: { userId: user.id },
    include: { findings: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return scans.map((s) => {
    const findings = s.findings || [];
    const severity = {
      critical: findings.filter((f) => f.severity === "critical").length,
      high: findings.filter((f) => f.severity === "high").length,
      medium: findings.filter((f) => f.severity === "medium").length,
      low: findings.filter((f) => f.severity === "low").length,
      info: findings.filter((f) => f.severity === "info").length,
    };

    return {
      id: s.id,
      inputRef: s.inputRef || "Unknown",
      status: s.status,
      createdAt: s.createdAt,
      findingsCount: findings.length,
      severity,
    };
  });
};

// Get severity breakdown
const getSeverityBreakdownInputSchema = z.object({
  timeRange: z.enum(["7d", "30d", "all"]).optional(),
});

type GetSeverityBreakdownInput = z.infer<typeof getSeverityBreakdownInputSchema>;

export const getSeverityBreakdown = async (
  rawArgs: unknown,
  context: DashboardContext
): Promise<{
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
}> => {
  const { timeRange: _timeRange = "30d" } = ensureArgsSchemaOrThrowHttpError(
    getSeverityBreakdownInputSchema,
    rawArgs
  );

  const user = context.user;
  if (!user) {
    throw new HttpError(
      401,
      "Only authenticated users are allowed to perform this operation"
    );
  }

  const scans = await prisma.scan.findMany({
    where: { userId: user.id },
    include: { findings: true },
  });

  const findings = scans.flatMap((s) => s.findings);

  return {
    critical: findings.filter((f) => f.severity === "critical").length,
    high: findings.filter((f) => f.severity === "high").length,
    medium: findings.filter((f) => f.severity === "medium").length,
    low: findings.filter((f) => f.severity === "low").length,
    info: findings.filter((f) => f.severity === "info").length,
    total: findings.length,
  };
};

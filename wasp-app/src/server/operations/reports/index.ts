import { type User, type Scan, type Finding } from "wasp/entities";
import { HttpError, prisma } from "wasp/server";
import * as z from "zod";
import { ensureArgsSchemaOrThrowHttpError } from "../../validation";

// Get report for a scan
const getReportInputSchema = z.object({
  scanId: z.string().nonempty(),
});

type GetReportInput = z.infer<typeof getReportInputSchema>;

export type ReportFinding = {
  id: string;
  cve: string;
  title: string;
  severity: string;
  description: string;
  source: string;
  discoveredAt: Date;
};

export type Report = {
  scanId: string;
  scanStatus: string;
  completedAt: Date | null;
  findings: ReportFinding[];
  totalFindings: number;
  severity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
};

export const getReport = async (
  rawArgs: any,
  context: any
): Promise<Report> => {
  const { scanId } = ensureArgsSchemaOrThrowHttpError(
    getReportInputSchema,
    rawArgs
  );

  if (!context.user) {
    throw new HttpError(
      401,
      "Only authenticated users are allowed to perform this operation"
    );
  }

  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    include: { findings: true },
  });

  if (!scan) {
    throw new HttpError(404, "Scan not found");
  }

  if (scan.userId !== context.user.id) {
    throw new HttpError(403, "You do not have permission to view this scan");
  }

  const findings: ReportFinding[] = scan.findings.map((f: any) => ({
    id: f.id,
    cve: f.cve,
    title: f.title,
    severity: f.severity,
    description: f.description || "",
    source: f.source || "unknown",
    discoveredAt: f.discoveredAt,
  }));

  const severity = {
    critical: findings.filter((f) => f.severity === "critical").length,
    high: findings.filter((f) => f.severity === "high").length,
    medium: findings.filter((f) => f.severity === "medium").length,
    low: findings.filter((f) => f.severity === "low").length,
    info: findings.filter((f) => f.severity === "info").length,
  };

  return {
    scanId: scan.id,
    scanStatus: scan.status,
    completedAt: scan.completedAt,
    findings: findings.slice(0, 100),
    totalFindings: findings.length,
    severity,
  };
};

// Get report summary (counts only)
const getReportSummaryInputSchema = z.object({
  scanId: z.string().nonempty(),
});

type GetReportSummaryInput = z.infer<typeof getReportSummaryInputSchema>;

export type ReportSummary = {
  scanId: string;
  scanStatus: string;
  totalFindings: number;
  severity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  lastUpdated: Date;
};

export const getReportSummary = async (
  rawArgs: any,
  context: any
): Promise<ReportSummary> => {
  const { scanId } = ensureArgsSchemaOrThrowHttpError(
    getReportSummaryInputSchema,
    rawArgs
  );

  if (!context.user) {
    throw new HttpError(
      401,
      "Only authenticated users are allowed to perform this operation"
    );
  }

  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    include: { findings: true },
  });

  if (!scan) {
    throw new HttpError(404, "Scan not found");
  }

  if (scan.userId !== context.user.id) {
    throw new HttpError(403, "You do not have permission to view this scan");
  }

  const findings = scan.findings || [];
  const severity = {
    critical: findings.filter((f: any) => f.severity === "critical").length,
    high: findings.filter((f: any) => f.severity === "high").length,
    medium: findings.filter((f: any) => f.severity === "medium").length,
    low: findings.filter((f: any) => f.severity === "low").length,
    info: findings.filter((f: any) => f.severity === "info").length,
  };

  return {
    scanId: scan.id,
    scanStatus: scan.status,
    totalFindings: findings.length,
    severity,
    lastUpdated: scan.updatedAt,
  };
};

// Generate PDF (trigger generation)
const generateReportPDFInputSchema = z.object({
  scanId: z.string().nonempty(),
  format: z.enum(["full", "summary"]).optional(),
});

type GenerateReportPDFInput = z.infer<typeof generateReportPDFInputSchema>;

export type PDFGenerationResponse = {
  scanId: string;
  jobId: string;
  status: string;
  estimatedTime: string;
};

export const generateReportPDF = async (
  rawArgs: any,
  context: any
): Promise<PDFGenerationResponse> => {
  const { scanId, format = "full" } = ensureArgsSchemaOrThrowHttpError(
    generateReportPDFInputSchema,
    rawArgs
  );

  if (!context.user) {
    throw new HttpError(
      401,
      "Only authenticated users are allowed to perform this operation"
    );
  }

  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
  });

  if (!scan) {
    throw new HttpError(404, "Scan not found");
  }

  if (scan.userId !== context.user.id) {
    throw new HttpError(403, "You do not have permission to generate PDF");
  }

  // Generate a job ID for tracking
  const jobId = `pdf-${scanId}-${Date.now()}`;

  return {
    scanId: scan.id,
    jobId,
    status: "queued",
    estimatedTime: "~30 seconds",
  };
};

// Get CI Decision
const getCIDecisionInputSchema = z.object({
  scanId: z.string().nonempty(),
});

type GetCIDecisionInput = z.infer<typeof getCIDecisionInputSchema>;

export type CIDecision = {
  scanId: string;
  decision: "pass" | "fail";
  reason: string;
  criticalIssues: number;
};

export const getCIDecision = async (
  rawArgs: any,
  context: any
): Promise<CIDecision> => {
  const { scanId } = ensureArgsSchemaOrThrowHttpError(
    getCIDecisionInputSchema,
    rawArgs
  );

  if (!context.user) {
    throw new HttpError(
      401,
      "Only authenticated users are allowed to perform this operation"
    );
  }

  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    include: { findings: true },
  });

  if (!scan) {
    throw new HttpError(404, "Scan not found");
  }

  if (scan.userId !== context.user.id) {
    throw new HttpError(403, "You do not have permission to view this scan");
  }

  const findings = scan.findings || [];
  const criticalIssues = findings.filter(
    (f: any) => f.severity === "critical"
  ).length;

  return {
    scanId: scan.id,
    decision: criticalIssues === 0 ? "pass" : "fail",
    reason:
      criticalIssues === 0
        ? "No critical vulnerabilities found"
        : `Found ${criticalIssues} critical vulnerabilities`,
    criticalIssues,
  };
};

import type { PrismaClient, ScanSource } from '@prisma/client';
import type { NormalizedFinding } from '../operations/scans/normalizeFindings.js';
import type { ScannerCredentialSource, ScannerProviderKind } from '../lib/scanners/providerTypes.js';

export type ScannerExecutionPrismaClient = Pick<
  PrismaClient,
  'scan' | 'scanResult' | 'finding' | 'user'
>;

export type ScannerExecutionRequest = {
  prisma: ScannerExecutionPrismaClient;
  scanId: string;
  userId: string;
  source: ScanSource;
  providerKind: ScannerProviderKind;
  credentialSource?: ScannerCredentialSource;
  loggerLabel: string;
};

export type ScannerExecutionResult = {
  status: 'completed' | 'skipped';
  findingsCount: number;
  scanResultId: string | null;
};

export type ScannerFindingForPersistence = Pick<
  NormalizedFinding,
  'cveId' | 'severity' | 'package' | 'version' | 'fixedVersion' | 'description' | 'cvssScore'
>;

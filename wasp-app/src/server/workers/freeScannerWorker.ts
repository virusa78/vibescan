/**
 * Free Scanner Worker - Runs Grype vulnerability scanner
 * Handles source_zip and sbom_upload input types
 */

import { Job } from 'bullmq';
import { PrismaClient, type Prisma, type ScanSource, type ScanStatus } from '@prisma/client';
import { normalizeGrypeFindings } from '../operations/scans/normalizeFindings.js';
import { scanWithGrype, isGrypInstalled } from '../lib/scanners/grypeScannerUtil.js';
import { emitWebhookEvent, buildWebhookPayload } from '../services/webhookEventEmitter.js';
import type { ScanJob } from '../queues/jobContract.js';
import type { NormalizedComponent } from '../services/inputAdapterService.js';

const prisma = new PrismaClient();

export async function freeScannerWorker(job: Job<ScanJob>) {
  const { scanId, userId, inputType, inputRef, s3Bucket } = job.data;

  try {
    console.log(`[Free Scanner] Starting scan ${scanId} for user ${userId}`);

    // Update scan status to scanning
    await prisma.scan.update({
      where: { id: scanId },
      data: { status: 'scanning' },
    });

    // Check if Grype is installed
    if (!isGrypInstalled()) {
      throw new Error('Grype CLI not found - please install Grype');
    }

    // Fetch scan from database to get components
    const scan = await prisma.scan.findUnique({
      where: { id: scanId },
    });

    if (!scan) {
      throw new Error(`Scan ${scanId} not found`);
    }

    // Get components from scan record (stored as JSON, so parse/cast safely)
    const components = Array.isArray(scan.components) 
      ? (scan.components as unknown as NormalizedComponent[])
      : ([] as NormalizedComponent[]);

    if (components.length === 0) {
      console.log(`[Free Scanner] No components to scan for ${scanId}`);
    }

    // Execute Grype scan
    const startTime = Date.now();
    let grypFindings: any[] = [];
    
    if (components.length > 0) {
      grypFindings = await scanWithGrype(components, scanId);
    }

    const durationMs = Date.now() - startTime;

    console.log(`[Free Scanner] Grype execution completed for scan ${scanId} in ${durationMs}ms`);

    // Convert to Grype output format for normalization
    const grypOutput = {
      matches: grypFindings.map(f => ({
        vulnerability: {
          id: f.cveId,
          severity: f.severity,
          cvssScore: { baseScore: f.cvssScore },
          description: f.description,
          fix: f.fixedVersion ? { versions: [f.fixedVersion] } : { versions: [] },
        },
        artifact: {
          name: f.package,
          version: f.version,
        },
        matchDetails: [{ found: 'grype' }],
      })),
    };

    // Normalize findings
    const normalizedFindings = normalizeGrypeFindings(grypOutput);

    // Store raw output in ScanResult
    const scanResult = await prisma.scanResult.upsert({
      where: {
        scanId_source: {
          scanId,
          source: 'free',
        },
      },
      create: {
        scanId,
        source: 'free',
        rawOutput: grypOutput as any,
        vulnerabilities: normalizedFindings as any,
        scannerVersion: 'grype-0.111.0', // Get actual version from Grype
        cveDbTimestamp: new Date(),
        durationMs,
      },
      update: {
        rawOutput: grypOutput as any,
        vulnerabilities: normalizedFindings as any,
        cveDbTimestamp: new Date(),
        durationMs,
      },
    });

    // Create Finding records
    for (const finding of normalizedFindings) {
      const fingerprint = `${finding.cveId}|${finding.package}|${finding.version}`;

      await prisma.finding.upsert({
        where: {
          scanId_fingerprint: {
            scanId,
            fingerprint,
          },
        },
        create: {
          scanId,
          userId,
          fingerprint,
          cveId: finding.cveId,
          packageName: finding.package,
          installedVersion: finding.version,
          severity: finding.severity.toUpperCase(),
          cvssScore: finding.cvssScore,
          fixedVersion: finding.fixedVersion,
          description: finding.description,
          source: 'free',
          detectedData: finding as any,
        },
        update: {
          severity: finding.severity.toUpperCase(),
          cvssScore: finding.cvssScore,
          fixedVersion: finding.fixedVersion,
          description: finding.description,
        },
      });
    }

    console.log(`[Free Scanner] Created ${normalizedFindings.length} findings for scan ${scanId}`);

    // Update scan with completion timestamp based on plan
    const currentScan = await prisma.scan.findUnique({
      where: { id: scanId },
      include: { scanResults: true },
    });

    if (currentScan && currentScan.status === 'scanning') {
      // Determine expected scanners based on plan at submission
      const isEnterprisePlan = currentScan.planAtSubmission === 'enterprise';
      const expectedScanners: ScanSource[] = isEnterprisePlan ? ['free', 'enterprise'] : ['free'];
      
      // Check which scanners have completed
      const completedScanners: ScanSource[] = currentScan.scanResults.map((r) => r.source as ScanSource);
      const allExpectedComplete = expectedScanners.every((scanner) => completedScanners.includes(scanner));
      
      if (allExpectedComplete) {
        // All expected scanners completed, mark as done
        const completedScan = await prisma.scan.update({
          where: { id: scanId },
          data: {
            status: 'done',
            completedAt: new Date(),
          },
        });

        // Emit webhook event for scan completion
        try {
          await emitWebhookEvent({
            scanId: scanId,
            eventType: 'scan_complete',
            userId: userId,
            payload: buildWebhookPayload('scan_complete', scanId, userId, {
              status: 'done',
              completedAt: completedScan.completedAt,
              findingsCount: normalizedFindings.length,
            }),
            timestamp: new Date(),
          });
        } catch (webhookError) {
          console.error(`[Free Scanner] Failed to emit webhook for scan ${scanId}:`, webhookError);
          // Don't fail the scan if webhook emission fails
        }
      }
    }

    return {
      status: 'completed',
      findingsCount: normalizedFindings.length,
      scanResultId: scanResult.id,
    };
  } catch (error) {
    console.error(`[Free Scanner] Error in scan ${scanId}:`, error);

    // Mark scan as error (allow partial-complete if enterprise succeeded for enterprise plan)
    const existingScan = await prisma.scan.findUnique({
      where: { id: scanId },
      include: { scanResults: true },
    });

    const errorMessage = error instanceof Error ? error.message : String(error);
    let statusUpdate: Prisma.ScanUpdateInput = {
      status: 'error' as ScanStatus,
      errorMessage: `Free scanner failed: ${errorMessage}`,
    };

    if (existingScan && existingScan.status === 'scanning') {
      const isEnterprisePlan = existingScan.planAtSubmission === 'enterprise';
      
      // For enterprise plans, check if enterprise succeeded
      if (isEnterprisePlan) {
        const enterpriseResult = existingScan.scanResults.some((r) => r.source === 'enterprise');
        if (enterpriseResult) {
          // Enterprise completed, mark as partial (done)
          statusUpdate = {
            status: 'done' as ScanStatus,
            completedAt: new Date(),
            errorMessage: `Free scanner failed: ${errorMessage}`,
          };
        } else {
          // Both failed (enterprise plan)
          statusUpdate = {
            status: 'error' as ScanStatus,
            completedAt: new Date(),
            errorMessage: `Free scanner failed: ${errorMessage}`,
          };
        }
      } else {
        // For non-enterprise plans, only free scanner expected, so this is an error
        statusUpdate = {
          status: 'error' as ScanStatus,
          completedAt: new Date(),
          errorMessage: `Free scanner failed: ${errorMessage}`,
        };
      }

      // Update scan status
      const updatedScan = await prisma.scan.update({
        where: { id: scanId },
        data: statusUpdate,
      });

      // Emit webhook event for error or partial completion
      try {
        const eventType = statusUpdate.status === 'error' ? 'scan_failed' : 'scan_complete';
        await emitWebhookEvent({
          scanId: scanId,
          eventType: eventType,
          userId: userId,
          payload: buildWebhookPayload(eventType, scanId, userId, {
            status: updatedScan.status,
            errorMessage: statusUpdate.errorMessage,
          }),
          timestamp: new Date(),
        });
      } catch (webhookError) {
        console.error(`[Free Scanner] Failed to emit webhook for scan ${scanId}:`, webhookError);
        // Don't fail if webhook emission fails
      }
    }

    throw error;
  }
}

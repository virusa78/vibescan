/**
 * Enterprise Scanner Worker - Calls Codescoring/BlackDuck API
 * Handles premium vulnerability scanning for enterprise plans
 */

import { Job } from 'bullmq';
import { PrismaClient, type Prisma, type ScanSource, type ScanStatus } from '@prisma/client';
import { normalizeCodescoringFindings } from '../operations/scans/normalizeFindings.js';
import { scanWithCodescoring } from '../lib/scanners/codescoringApiClient.js';
import { emitWebhookEvent, buildWebhookPayload } from '../services/webhookEventEmitter.js';
import type { ScanJob } from '../queues/jobContract.js';
import { loadScanArtifacts, type NormalizedComponent } from '../services/inputAdapterService.js';

const prisma = new PrismaClient();

export async function enterpriseScannerWorker(job: Job<ScanJob>) {
  const { scanId, userId, inputType, inputRef, s3Bucket } = job.data;

  try {
    console.log(`[Enterprise Scanner] Starting scan ${scanId} for user ${userId}`);

    // Update scan status to scanning
    await prisma.scan.update({
      where: { id: scanId },
      data: { status: 'scanning' },
    });

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

    let hydratedComponents = components;
    if (hydratedComponents.length === 0) {
      const hydrated = await loadScanArtifacts(scan.inputType, scan.inputRef);
      hydratedComponents = hydrated.components;

      await prisma.scan.update({
        where: { id: scanId },
        data: {
          components: hydratedComponents as unknown as Prisma.InputJsonValue,
          sbomRaw: hydrated.sbomRaw as unknown as Prisma.InputJsonValue,
        },
      });
    }

    if (hydratedComponents.length === 0) {
      console.log(`[Enterprise Scanner] No components to scan for ${scanId}`);
    }

    // Call Codescoring/BlackDuck API
    const startTime = Date.now();
    let codescoringFindings: any[] = [];

    if (hydratedComponents.length > 0) {
      codescoringFindings = await scanWithCodescoring(hydratedComponents, scanId);
    }

    const durationMs = Date.now() - startTime;

    console.log(`[Enterprise Scanner] Codescoring API call completed for scan ${scanId} in ${durationMs}ms`);

    // Convert to Codescoring format for normalization
    const codescoringOutput = {
      components: hydratedComponents.map(comp => ({
        name: comp.name,
        version: comp.version,
        vulnerabilities: codescoringFindings
          .filter(f => f.package === comp.name && f.version === comp.version)
          .map(f => ({
            cveId: f.cveId,
            severity: f.severity,
            cvssScore: f.cvssScore,
            description: f.description,
            fixedVersion: f.fixedVersion,
          })),
      })),
    };

    // Normalize findings
    const normalizedFindings = normalizeCodescoringFindings(codescoringOutput);

    // Store raw output in ScanResult
    const scanResult = await prisma.scanResult.upsert({
      where: {
        scanId_source: {
          scanId,
          source: 'enterprise',
        },
      },
      create: {
        scanId,
        source: 'enterprise',
        rawOutput: codescoringOutput as any,
        vulnerabilities: normalizedFindings as any,
        scannerVersion: 'codescoring-1.0',
        cveDbTimestamp: new Date(),
        durationMs,
      },
      update: {
        rawOutput: codescoringOutput as any,
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
          source: 'enterprise',
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

    console.log(`[Enterprise Scanner] Created ${normalizedFindings.length} findings for scan ${scanId}`);

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
          console.error(`[Enterprise Scanner] Failed to emit webhook for scan ${scanId}:`, webhookError);
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
    console.error(`[Enterprise Scanner] Error in scan ${scanId}:`, error);

    // Mark scan as error (allow partial-complete if free succeeded for enterprise plan)
    const existingScan = await prisma.scan.findUnique({
      where: { id: scanId },
      include: { scanResults: true },
    });

    const errorMessage = error instanceof Error ? error.message : String(error);
    let statusUpdate: Prisma.ScanUpdateInput = {
      status: 'error' as ScanStatus,
      errorMessage: `Enterprise scanner failed: ${errorMessage}`,
    };

    if (existingScan && existingScan.status === 'scanning') {
      const isEnterprisePlan = existingScan.planAtSubmission === 'enterprise';
      
      // For enterprise plans, check if free succeeded
      if (isEnterprisePlan) {
        const freeResult = existingScan.scanResults.some((r) => r.source === 'free');
        if (freeResult) {
          // Free completed, mark as partial (done)
          statusUpdate = {
            status: 'done' as ScanStatus,
            completedAt: new Date(),
            errorMessage: `Enterprise scanner failed: ${errorMessage}`,
          };
        } else {
          // Both failed
          statusUpdate = {
            status: 'error' as ScanStatus,
            completedAt: new Date(),
            errorMessage: `Enterprise scanner failed: ${errorMessage}`,
          };
        }
      } else {
        // Enterprise scanner running on non-enterprise plan is unexpected
        // Mark error but don't override done if free succeeded
        const freeResult = existingScan.scanResults.some((r) => r.source === 'free');
        if (!freeResult) {
          statusUpdate = {
            status: 'error' as ScanStatus,
            completedAt: new Date(),
            errorMessage: `Enterprise scanner failed: ${errorMessage}`,
          };
        }
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
        console.error(`[Enterprise Scanner] Failed to emit webhook for scan ${scanId}:`, webhookError);
        // Don't fail if webhook emission fails
      }
    }

    throw error;
  }
}

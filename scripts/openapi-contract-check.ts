import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { generateOpenApiSpec } from '../wasp-app/src/server/swagger/openapiSpec';
import { validateV1OpenApiContract } from '../wasp-app/src/server/swagger/openapiContractPolicy';

async function main(): Promise<void> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const repoRoot = path.resolve(__dirname, '..');
  const mainWaspPath = path.resolve(repoRoot, 'wasp-app/main.wasp');

  const mainWaspSource = fs.readFileSync(mainWaspPath, 'utf8');
  const spec = await generateOpenApiSpec();
  const report = validateV1OpenApiContract({ mainWaspSource, spec });

  if (!report.ok) {
    console.error('[openapi:contract] FAILED');
    console.error(`main.wasp routes: ${report.routeCountMainWasp}`);
    console.error(`swagger spec routes: ${report.routeCountSpec}`);
    for (const violation of report.violations) {
      console.error(`- ${violation.code}: ${violation.route} :: ${violation.detail}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('[openapi:contract] OK');
  console.log(`main.wasp routes: ${report.routeCountMainWasp}`);
  console.log(`swagger spec routes: ${report.routeCountSpec}`);
}

main().catch((error) => {
  console.error('[openapi:contract] FAILED with unhandled error');
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});

import { type NormalizedComponent } from '../../services/inputAdapterService.js';
import type { SnykRuntimeExecutor, SnykScanRun, SnykSshExecutor } from './snykTypes.js';
import type { ScannerResolvedCredentials } from './providerTypes.js';
export declare function runSnykScan(components: NormalizedComponent[], scanId: string, resolvedCredentials: ScannerResolvedCredentials | undefined, localExecutor?: SnykRuntimeExecutor, sshExecutor?: SnykSshExecutor): Promise<SnykScanRun>;
//# sourceMappingURL=snykRuntime.d.ts.map
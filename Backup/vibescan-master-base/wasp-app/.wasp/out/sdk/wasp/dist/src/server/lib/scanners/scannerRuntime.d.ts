type ScannerTool = 'syft' | 'grype';
interface ScannerExecutionPlan {
    tool: ScannerTool;
    targetPath: string;
    timeoutMs: number;
    dockerImage: string;
    localArgs: string[];
    dockerArgs: string[];
}
declare function defaultExecutor(command: string, args: string[], timeoutMs: number): string;
export declare function buildDockerScannerArgs(targetPath: string, image: string, toolArgs: string[]): string[];
export declare function runScannerTool(plan: ScannerExecutionPlan, executor?: typeof defaultExecutor): string;
export declare function runSyftCycloneDxScan(targetPath: string, timeoutMs: number, executor?: typeof defaultExecutor): string;
export declare function runGrypeCycloneDxScan(sbomPath: string, timeoutMs: number, executor?: typeof defaultExecutor): string;
export {};
//# sourceMappingURL=scannerRuntime.d.ts.map
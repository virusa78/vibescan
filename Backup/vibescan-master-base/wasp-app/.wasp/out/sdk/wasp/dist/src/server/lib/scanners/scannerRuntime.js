import { execFileSync } from 'child_process';
import { statSync } from 'fs';
import { basename, dirname, resolve } from 'path';
function getRuntimeMode() {
    const value = process.env.VIBESCAN_SCANNER_RUNTIME?.trim().toLowerCase();
    if (value === 'docker' || value === 'local') {
        return value;
    }
    return 'auto';
}
function defaultExecutor(command, args, timeoutMs) {
    return execFileSync(command, args, {
        encoding: 'utf8',
        timeout: timeoutMs,
        stdio: 'pipe',
    });
}
function isMissingExecutable(error, executable) {
    if (error && typeof error === 'object' && 'code' in error) {
        const code = error.code;
        if (code === 'ENOENT') {
            return true;
        }
    }
    const message = error instanceof Error ? error.message : String(error);
    return message.toLowerCase().includes(executable.toLowerCase()) && /not found|enoent/i.test(message);
}
function buildDockerMount(targetPath) {
    const resolvedTarget = resolve(targetPath);
    const stats = statSync(resolvedTarget);
    if (stats.isDirectory()) {
        return {
            mountSource: resolvedTarget,
            containerTarget: '/work',
        };
    }
    return {
        mountSource: dirname(resolvedTarget),
        containerTarget: `/work/${basename(resolvedTarget)}`,
    };
}
export function buildDockerScannerArgs(targetPath, image, toolArgs) {
    const resolvedTargetPath = resolve(targetPath);
    const { mountSource, containerTarget } = buildDockerMount(targetPath);
    return [
        'run',
        '--rm',
        '--network=none',
        '--read-only',
        '--cap-drop=ALL',
        '--security-opt',
        'no-new-privileges',
        '--pids-limit',
        '64',
        '-v',
        `${mountSource}:/work:ro`,
        '-w',
        '/work',
        image,
        ...toolArgs.map((arg) => arg.replace(resolvedTargetPath, containerTarget)),
    ];
}
function buildPlan(plan) {
    return {
        dockerCommand: 'docker',
        dockerArgs: buildDockerScannerArgs(plan.targetPath, plan.dockerImage, plan.dockerArgs),
        localCommand: plan.tool,
        localArgs: plan.localArgs,
    };
}
export function runScannerTool(plan, executor = defaultExecutor) {
    const runtimeMode = getRuntimeMode();
    const commands = buildPlan(plan);
    if (runtimeMode !== 'local') {
        try {
            return executor(commands.dockerCommand, commands.dockerArgs, plan.timeoutMs);
        }
        catch (error) {
            if (runtimeMode === 'docker') {
                throw error;
            }
            if (!isMissingExecutable(error, 'docker')) {
                console.warn(`[ScannerRuntime] Docker execution failed for ${plan.tool}, falling back to local CLI: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }
    return executor(commands.localCommand, commands.localArgs, plan.timeoutMs);
}
export function runSyftCycloneDxScan(targetPath, timeoutMs, executor = defaultExecutor) {
    return runScannerTool({
        tool: 'syft',
        targetPath,
        timeoutMs,
        dockerImage: process.env.VIBESCAN_SYFT_IMAGE ?? 'anchore/syft:latest',
        localArgs: [`dir:${resolve(targetPath)}`, '-o', 'cyclonedx-json'],
        dockerArgs: ['syft', `dir:${resolve(targetPath)}`, '-o', 'cyclonedx-json'],
    }, executor);
}
export function runGrypeCycloneDxScan(sbomPath, timeoutMs, executor = defaultExecutor) {
    return runScannerTool({
        tool: 'grype',
        targetPath: sbomPath,
        timeoutMs,
        dockerImage: process.env.VIBESCAN_GRYPE_IMAGE ?? 'anchore/grype:latest',
        localArgs: [`sbom:${resolve(sbomPath)}`, '-o', 'json'],
        dockerArgs: ['grype', `sbom:${resolve(sbomPath)}`, '-o', 'json'],
    }, executor);
}
//# sourceMappingURL=scannerRuntime.js.map
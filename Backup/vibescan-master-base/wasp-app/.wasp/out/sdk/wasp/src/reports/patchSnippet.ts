export function buildPatchSnippet(
  ecosystem: string | null | undefined,
  packageName: string | null | undefined,
  fixedVersion: string | null | undefined,
): string {
  const pkg = (packageName ?? '').trim();
  const version = (fixedVersion ?? '').trim();

  if (!pkg || !version) {
    return '';
  }

  const normalizedEcosystem = (ecosystem ?? '').trim().toLowerCase();

  if (normalizedEcosystem === 'npm') {
    return `"${pkg}": "^${version}"`;
  }

  if (normalizedEcosystem === 'pypi' || normalizedEcosystem === 'python') {
    return `${pkg}==${version}`;
  }

  if (normalizedEcosystem === 'go' || normalizedEcosystem === 'golang') {
    return `go get ${pkg}@${version}`;
  }

  if (normalizedEcosystem === 'maven') {
    if (pkg.includes(':')) {
      const [groupId, artifactId] = pkg.split(':', 2);
      if (groupId && artifactId) {
        return [
          '<dependency>',
          `  <groupId>${groupId}</groupId>`,
          `  <artifactId>${artifactId}</artifactId>`,
          `  <version>${version}</version>`,
          '</dependency>',
        ].join('\n');
      }
    }
  }

  if (normalizedEcosystem === 'docker') {
    return `${pkg}:${version}`;
  }

  return `${pkg}@${version}`;
}

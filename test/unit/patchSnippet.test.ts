import { describe, expect, test } from "@jest/globals";
import { buildPatchSnippet } from '../../wasp-app/src/reports/patchSnippet';

describe('buildPatchSnippet', () => {
  test('npm', () => {
    expect(buildPatchSnippet('npm', 'lodash', '4.17.21')).toBe('"lodash": "^4.17.21"');
  });

  test('pypi', () => {
    expect(buildPatchSnippet('pypi', 'urllib3', '2.2.1')).toBe('urllib3==2.2.1');
  });

  test('go', () => {
    expect(buildPatchSnippet('go', 'github.com/pkg/errors', '0.9.1')).toBe('go get github.com/pkg/errors@0.9.1');
  });

  test('maven with group artifact', () => {
    expect(buildPatchSnippet('maven', 'org.slf4j:slf4j-api', '2.0.13')).toBe(
      '<dependency>\n  <groupId>org.slf4j</groupId>\n  <artifactId>slf4j-api</artifactId>\n  <version>2.0.13</version>\n</dependency>',
    );
  });

  test('docker', () => {
    expect(buildPatchSnippet('docker', 'alpine', '3.20.0')).toBe('alpine:3.20.0');
  });

  test('fallback', () => {
    expect(buildPatchSnippet('unknown', 'leftpad', '1.0.1')).toBe('leftpad@1.0.1');
  });

  test('empty data returns empty snippet', () => {
    expect(buildPatchSnippet('npm', '', '1.0.0')).toBe('');
    expect(buildPatchSnippet('npm', 'pkg', '')).toBe('');
  });
});

// Lightweight test globals shim that reads Jest globals from globalThis to avoid
// circular initialization issues when tests import './testGlobals'.

const g: any = globalThis as any;

// Jest may expose helpers on globalThis.jest; fall back to requiring '@jest/globals' if needed.
let jestRef: any = g.jest;
try {
  if (!jestRef) {
    // Use require to avoid ESM circular import issues in some test environments
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@jest/globals');
    jestRef = mod && (mod.jest || mod);
  }
} catch (e) {
  // leave as undefined if not available
}

export const afterAll = g.afterAll;
export const afterEach = g.afterEach;
export const beforeAll = g.beforeAll;
export const beforeEach = g.beforeEach;
export const describe = g.describe;
export const expect = g.expect;
export const it = g.it;
export const test = g.test;
export const jest = jestRef;
export const vi = jestRef;

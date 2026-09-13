/**
 * إعلانات أنواع محلية minimal لوحدة `bun:test`.
 * تُستعمل فقط حتى يبقى `tsc --noEmit` أخضر دون إضافة dependencies جديدة.
 * في وقت التشغيل يوفّر Bun هذه الوحدة أصلياً.
 */
declare module "bun:test" {
  export function describe(name: string, fn: () => void | Promise<void>): void;
  export function test(name: string, fn: () => void | Promise<void>): void;
  export function beforeEach(fn: () => void | Promise<void>): void;
  export function afterEach(fn: () => void | Promise<void>): void;
  export interface ExpectMatchers {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toContain(expected: unknown): void;
    toBeGreaterThan(expected: number): void;
    toBeGreaterThanOrEqual(expected: number): void;
    toBeLessThan(expected: number): void;
    toHaveLength(expected: number): void;
    toBeDefined(): void;
    toBeUndefined(): void;
    toBeInstanceOf(expected: abstract new (...args: never[]) => unknown): void;
    toThrow(expected?: unknown): void;
    readonly rejects: ExpectMatchers;
    readonly resolves: ExpectMatchers;
  }
  export function expect(actual: unknown): ExpectMatchers;
}

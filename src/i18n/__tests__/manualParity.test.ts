import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import ko from '../locales/ko';
import en from '../locales/en';
import vi from '../locales/vi';

/**
 * M-10 / M-11 regression guard.
 *
 * UserManual.tsx renders the help manual entirely from `manual.*` translation
 * keys. When en.ts / vi.ts rename a key (drift) or omit one, i18next silently
 * falls back to ko — so English / Vietnamese users see Korean text. This test
 * asserts that every `manual.*` key UserManual actually references is defined,
 * with a matching value SHAPE (scalar vs string[] vs string[][]), in ko, en
 * and vi.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const manualSource = readFileSync(
  resolve(__dirname, '../../pages/UserManual.tsx'),
  'utf8',
);

type Shape = 'scalar' | 'array' | 'array2d' | 'arrobj';

function shapeOf(value: unknown): Shape | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) {
    const first = value[0];
    if (Array.isArray(first)) return 'array2d';
    if (first && typeof first === 'object') return 'arrobj';
    return 'array';
  }
  if (typeof value === 'object') return undefined; // it's a parent node, not a leaf
  return 'scalar';
}

function lookup(translation: Record<string, unknown>, dotted: string): unknown {
  // dotted starts with "manual."
  const parts = dotted.split('.');
  let node: unknown = translation;
  for (const part of parts) {
    if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return node;
}

/** Extract every `manual.*` key the manual page references. */
function referencedKeys(): string[] {
  const keys = new Set<string>();
  // `${s}.xxx` where s = 'manual.sections', and literal 'manual.xxx'
  const tmplRe = /\$\{s\}\.([a-zA-Z0-9.]+)/g;
  const litRe = /'(manual\.[a-zA-Z0-9.]+)'/g;
  let m: RegExpExecArray | null;
  while ((m = tmplRe.exec(manualSource))) keys.add(`manual.sections.${m[1]}`);
  while ((m = litRe.exec(manualSource))) keys.add(m[1]);
  // `manual.sections` itself is the namespace prefix, not a leaf.
  keys.delete('manual.sections');
  return [...keys].sort();
}

const REFS = referencedKeys();
const koT = ko.translation as unknown as Record<string, unknown>;
const enT = en.translation as unknown as Record<string, unknown>;
const viT = vi.translation as unknown as Record<string, unknown>;

describe('manual.* locale parity (M-10 / M-11)', () => {
  it('UserManual references a non-trivial set of manual keys', () => {
    expect(REFS.length).toBeGreaterThan(200);
  });

  it('ko defines every referenced key as a leaf (structural template)', () => {
    const broken = REFS.filter((k) => shapeOf(lookup(koT, k)) === undefined);
    expect(broken).toEqual([]);
  });

  it('en defines every referenced manual key (no Korean fallback leaks)', () => {
    const missing = REFS.filter((k) => shapeOf(lookup(enT, k)) === undefined);
    expect(missing).toEqual([]);
  });

  it('en matches ko value shapes (no scalar-vs-array drift)', () => {
    const mismatched = REFS.filter((k) => {
      const koS = shapeOf(lookup(koT, k));
      const enS = shapeOf(lookup(enT, k));
      return enS !== undefined && koS !== undefined && enS !== koS;
    }).map((k) => `${k}: ko=${shapeOf(lookup(koT, k))} en=${shapeOf(lookup(enT, k))}`);
    expect(mismatched).toEqual([]);
  });

  it('vi defines every referenced manual key (no Korean fallback leaks)', () => {
    const missing = REFS.filter((k) => shapeOf(lookup(viT, k)) === undefined);
    expect(missing).toEqual([]);
  });

  it('vi matches ko value shapes (no scalar-vs-array drift)', () => {
    const mismatched = REFS.filter((k) => {
      const koS = shapeOf(lookup(koT, k));
      const viS = shapeOf(lookup(viT, k));
      return viS !== undefined && koS !== undefined && viS !== koS;
    }).map((k) => `${k}: ko=${shapeOf(lookup(koT, k))} vi=${shapeOf(lookup(viT, k))}`);
    expect(mismatched).toEqual([]);
  });
});

/**
 * L-11 regression guard: the recurring-task modal now renders from i18n keys
 * (labels.frequency.*, labels.dayOfWeek.*, recurringTask.*) instead of the
 * static Korean maps in types/index.ts. These keys must exist in all three
 * locales so language switching is reactive.
 */
describe('recurring-task modal i18n parity (L-11)', () => {
  const requiredKeys = [
    'labels.frequency.daily',
    'labels.frequency.weekly',
    'labels.frequency.biweekly',
    'labels.frequency.monthly',
    'labels.dayOfWeek.0',
    'labels.dayOfWeek.1',
    'labels.dayOfWeek.2',
    'labels.dayOfWeek.3',
    'labels.dayOfWeek.4',
    'labels.dayOfWeek.5',
    'labels.dayOfWeek.6',
    // Every visible string the modal renders via recurringTask.*
    'recurringTask.title',
    'recurringTask.empty',
    'recurringTask.addRule',
    'recurringTask.editRule',
    'recurringTask.newRule',
    'recurringTask.generateNow',
    'recurringTask.edit',
    'recurringTask.delete',
    'recurringTask.taskName',
    'recurringTask.output',
    'recurringTask.level',
    'recurringTask.parentTask',
    'recurringTask.noParent',
    'recurringTask.assignee',
    'recurringTask.unassigned',
    'recurringTask.frequency',
    'recurringTask.dayOfWeekLabel',
    'recurringTask.dayOfMonthLabel',
    'recurringTask.dayOfMonthOption',
    'recurringTask.cancel',
    'recurringTask.update',
    'recurringTask.add',
    'recurringTask.everyDay',
    'recurringTask.everyWeek',
    'recurringTask.everyBiweek',
    'recurringTask.everyMonth',
  ];

  for (const [name, t] of [
    ['ko', koT],
    ['en', enT],
    ['vi', viT],
  ] as const) {
    it(`${name} defines all recurring-task modal keys`, () => {
      const missing = requiredKeys.filter((k) => shapeOf(lookup(t, k)) === undefined);
      expect(missing).toEqual([]);
    });
  }
});

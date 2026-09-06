import { describe, expect, it } from 'vitest';
import fixture from '../../../backend/tests/fixtures/receipt_fixture.json';
import { computeReceipt, type ReceiptInputs } from './receipt';

const inputs = fixture.inputs as unknown as ReceiptInputs;

describe('computeReceipt reproduces the Python receipt_lines() fixture', () => {
  for (const c of fixture.cases as { miles_per_week: number; household_size: number; expected: Record<string, number> }[]) {
    it(`${c.miles_per_week} mi/week, ${c.household_size} people`, () => {
      const r = computeReceipt(inputs, { milesPerWeek: c.miles_per_week, householdSize: c.household_size });
      const got = Object.fromEntries(r.lines.map((l) => [l.key, l.monthly_usd]));
      for (const [k, v] of Object.entries(c.expected)) {
        expect(Math.abs((got[k] ?? NaN) - v)).toBeLessThan(0.005);
      }
    });
  }

  it('totals the lines and computes months elapsed from the latest as-of date', () => {
    const r = computeReceipt(inputs, { milesPerWeek: 240, householdSize: 2 });
    const sum = r.lines.reduce((s, l) => s + l.monthly_usd, 0);
    expect(Math.abs(r.monthly_usd - sum)).toBeLessThan(0.005);
    expect(r.months_elapsed).toBeGreaterThan(12);
    expect(r.cumulative_usd).toBeGreaterThan(r.monthly_usd * 12);
  });

  it('switches the fuel line to a regional EIA price when a region is chosen', () => {
    const withRegion: ReceiptInputs = {
      ...inputs,
      regions: { SCA: { name: 'California', latest: { date: '2026-08-31', value: 5.52 }, handover: { date: '2025-01-20', value: 4.3 }, delta: 1.22 } },
    };
    const nat = computeReceipt(withRegion, { milesPerWeek: 240, householdSize: 2 });
    const ca = computeReceipt(withRegion, { milesPerWeek: 240, householdSize: 2, region: 'SCA' });
    expect(ca.lines[0].source).toContain('California');
    expect(ca.lines[0].monthly_usd).not.toBe(nat.lines[0].monthly_usd);
    // Groceries are national in both.
    expect(ca.lines[1].monthly_usd).toBe(nat.lines[1].monthly_usd);
  });
});

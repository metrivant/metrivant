import '../helpers/env';
import {
  classifyProcurementEvent,
  HIGH_VALUE_PROCUREMENT_TYPES,
} from '../../lib/procurement-classifier';

describe('classifyProcurementEvent', () => {
  it('classifies "contract award" → major_contract_award / high', () => {
    const result = classifyProcurementEvent('Acme wins contract awarded by US Navy', null, null);
    expect(result.procurementEventType).toBe('major_contract_award');
    expect(result.significanceTier).toBe('high');
    expect(result.confidence).toBe(0.85);
  });

  it('classifies "framework agreement" → framework_award / medium', () => {
    const result = classifyProcurementEvent('Acme signs framework agreement with agency', null, null);
    expect(result.procurementEventType).toBe('framework_award');
    expect(result.significanceTier).toBe('medium');
    expect(result.confidence).toBe(0.78);
  });

  it('classifies "rfp" → bid_notice / low', () => {
    const result = classifyProcurementEvent('Agency issues RFP for system modernisation', null, null);
    expect(result.procurementEventType).toBe('bid_notice');
    expect(result.significanceTier).toBe('low');
  });

  it('classifies "contract extension" → contract_extension / medium', () => {
    const result = classifyProcurementEvent('US Air Force exercises contract extension option for Acme', null, null);
    expect(result.procurementEventType).toBe('contract_extension');
    expect(result.significanceTier).toBe('medium');
  });

  it('classifies "program award" → program_award / high', () => {
    const result = classifyProcurementEvent('Acme receives task order under IDIQ program', null, null);
    expect(result.procurementEventType).toBe('program_award');
    expect(result.significanceTier).toBe('high');
  });

  it('falls through to other_procurement_event when no keywords match', () => {
    const result = classifyProcurementEvent('Acme joins trade show', null, null);
    expect(result.procurementEventType).toBe('other_procurement_event');
    expect(result.significanceTier).toBe('other');
  });

  it('revenue scale marker alone → major_contract_award', () => {
    const result = classifyProcurementEvent('Acme secures £150M vessel maintenance deal', null, null);
    expect(result.procurementEventType).toBe('major_contract_award');
  });

  it('upgrades framework_award tier to high when contract_value ≥ $50M', () => {
    const result = classifyProcurementEvent('Acme framework agreement signed', null, 50_000_001);
    expect(result.procurementEventType).toBe('framework_award');
    expect(result.significanceTier).toBe('high');
  });

  it('applies large-value confidence boost (+0.03) for contract_value ≥ $50M', () => {
    const withoutValue  = classifyProcurementEvent('Acme wins contract awarded', null, null);
    const withLargeValue = classifyProcurementEvent('Acme wins contract awarded', null, 100_000_000);
    expect(withLargeValue.confidence).toBeGreaterThan(withoutValue.confidence);
    expect(withLargeValue.confidence - withoutValue.confidence).toBeCloseTo(0.03, 5);
  });

  it('applies medium-value boost (+0.01) for contract_value ≥ $5M', () => {
    const withoutValue = classifyProcurementEvent('Acme wins contract awarded', null, null);
    const withMedValue = classifyProcurementEvent('Acme wins contract awarded', null, 10_000_000);
    expect(withMedValue.confidence - withoutValue.confidence).toBeCloseTo(0.01, 5);
  });

  it('caps confidence at 0.95', () => {
    const result = classifyProcurementEvent('Acme wins contract awarded', null, 1_000_000_000);
    expect(result.confidence).toBeLessThanOrEqual(0.95);
  });

  it('HIGH_VALUE_PROCUREMENT_TYPES contains major_contract_award, program_award, framework_award', () => {
    expect(HIGH_VALUE_PROCUREMENT_TYPES.has('major_contract_award')).toBe(true);
    expect(HIGH_VALUE_PROCUREMENT_TYPES.has('program_award')).toBe(true);
    expect(HIGH_VALUE_PROCUREMENT_TYPES.has('framework_award')).toBe(true);
    expect(HIGH_VALUE_PROCUREMENT_TYPES.has('bid_notice' as never)).toBe(false);
  });
});

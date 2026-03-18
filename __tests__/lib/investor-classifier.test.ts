import '../helpers/env';
import { classifyInvestorEvent } from '../../lib/investor-classifier';

describe('classifyInvestorEvent', () => {
  it('classifies acquisition keywords → acquisition / high', () => {
    const result = classifyInvestorEvent('Acme Corp acquires Rival Inc for $500M', null);
    expect(result.investorEventType).toBe('acquisition');
    expect(result.significanceTier).toBe('high');
    expect(result.confidence).toBe(0.85);
  });

  it('classifies "merger" keyword → acquisition / high', () => {
    const result = classifyInvestorEvent('Acme Corp announces merger with Beta Corp', 'Definitive agreement signed');
    expect(result.investorEventType).toBe('acquisition');
    expect(result.significanceTier).toBe('high');
  });

  it('classifies earnings keywords → earnings_release / medium', () => {
    const result = classifyInvestorEvent('Acme Reports Q3 Financial Results', 'Revenue up 12% YoY');
    expect(result.investorEventType).toBe('earnings_release');
    expect(result.significanceTier).toBe('medium');
    expect(result.confidence).toBe(0.80);
  });

  it('classifies capital raise → capital_raise / high', () => {
    const result = classifyInvestorEvent('Acme Corp Prices $300M Senior Notes Offering', null);
    expect(result.investorEventType).toBe('capital_raise');
    expect(result.significanceTier).toBe('high');
  });

  it('classifies partnership keywords → partnership / standard', () => {
    const result = classifyInvestorEvent('Acme and Beta form strategic alliance', 'Collaboration agreement signed');
    expect(result.investorEventType).toBe('partnership');
    expect(result.significanceTier).toBe('standard');
    expect(result.confidence).toBe(0.75);
  });

  it('classifies guidance_update → medium tier', () => {
    const result = classifyInvestorEvent('Acme raises full-year guidance on strong demand', null);
    expect(result.investorEventType).toBe('guidance_update');
    expect(result.significanceTier).toBe('medium');
  });

  it('classifies investor_presentation → standard tier', () => {
    const result = classifyInvestorEvent('Acme Corp to Present at Investor Day 2025', null);
    expect(result.investorEventType).toBe('investor_presentation');
    expect(result.significanceTier).toBe('standard');
  });

  it('falls through to other_investor_event when no keywords match', () => {
    const result = classifyInvestorEvent('Acme Corp Updates Website', null);
    expect(result.investorEventType).toBe('other_investor_event');
    expect(result.significanceTier).toBe('other');
    expect(result.confidence).toBe(0.72);
  });

  it('revenue scale pattern without other keywords → major_contract / high', () => {
    const result = classifyInvestorEvent('Acme secures $500M deal', null);
    expect(result.investorEventType).toBe('major_contract');
    expect(result.significanceTier).toBe('high');
  });

  it('is case-insensitive — ACQUISITION in title still matches', () => {
    const result = classifyInvestorEvent('ACME CORP ACQUISITION COMPLETE', null);
    expect(result.investorEventType).toBe('acquisition');
  });

  it('matches keyword in summary when title alone does not match', () => {
    const result = classifyInvestorEvent('Strategic announcement', 'Joint venture established for new market');
    expect(result.investorEventType).toBe('partnership');
  });

  it('prioritises higher-significance rules — acquisition wins over earnings', () => {
    // "earnings" and "acquisition" both present — acquisition is listed first in RULES
    const result = classifyInvestorEvent('Acme acquires Beta Corp after strong earnings quarter', null);
    expect(result.investorEventType).toBe('acquisition');
  });
});

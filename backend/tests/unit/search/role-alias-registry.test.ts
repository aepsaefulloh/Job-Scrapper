import { describe, it, expect } from 'vitest';
import { expandRoleAliases, normalizeKeyword } from '../../../src/search/role-alias-registry.js';

describe('normalizeKeyword', () => {
  it('lowercases and trims whitespace', () => {
    expect(normalizeKeyword('  HR Manager  ')).toBe('hr manager');
  });
  it('collapses internal whitespace', () => {
    expect(normalizeKeyword('Digital  Marketing')).toBe('digital marketing');
  });
});

describe('expandRoleAliases', () => {
  it('returns aliases for accountant', () => {
    const result = expandRoleAliases('accountant');
    expect(result).toContain('accountant');
    expect(result).toContain('accounting staff');
    expect(result).toContain('finance accounting');
  });
  it('returns aliases for human resources', () => {
    const result = expandRoleAliases('human resources');
    expect(result).toContain('hr');
    expect(result).toContain('hr officer');
    expect(result).toContain('people operations');
  });
  it('returns aliases for frontend developer', () => {
    const result = expandRoleAliases('frontend developer');
    expect(result).toContain('frontend developer');
    expect(result).toContain('frontend engineer');
    expect(result).toContain('web developer');
  });
  it('returns at least the original role when no alias exists', () => {
    const result = expandRoleAliases('some unknown role');
    expect(result).toContain('some unknown role');
  });
  it('returns aliases for staff administrasi', () => {
    const result = expandRoleAliases('Staff Administrasi');
    expect(result).toContain('admin');
    expect(result).toContain('administrasi');
    expect(result).toContain('staff administrasi');
  });
  it('deduplicates aliases', () => {
    const result = expandRoleAliases('accountant');
    const unique = new Set(result.map(r => r.toLowerCase()));
    expect(unique.size).toBe(result.length);
  });
});

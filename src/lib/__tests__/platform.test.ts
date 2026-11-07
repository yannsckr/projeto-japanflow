import { describe, expect, it } from 'vitest';
import { detectPlatform, selectOperationalExperience } from '../platform';

describe('COSMOS platform', () => {
  it('navegador comum nao vira app nativo', () => {
    expect(detectPlatform({ userAgent: 'Android Chrome' })).toBe('web');
  });
  it('identifica os contêineres nativos', () => {
    expect(detectPlatform({ isTauri: true })).toBe('windows');
    expect(detectPlatform({ isCapacitorNative: true })).toBe('android');
  });
  it('prepara experiencia de motoboy sem mudar privilegios', () => {
    expect(selectOperationalExperience('android', ['Motoboys'])).toBe('mobile-motoboy');
    expect(selectOperationalExperience('web', ['Motoboys'])).toBe('standard');
  });
});

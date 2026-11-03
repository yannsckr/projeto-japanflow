import { describe, expect, it } from 'vitest';
import { asDiagram, positionFromPoint, positionPercent } from '../referenceDiagrams';

describe('Marcações de imagens técnicas', () => {
  it('mantém coordenadas relativas ao mudar o tamanho', () => {
    expect(positionFromPoint(150, 250, { left: 50, top: 150, width: 400, height: 200 })).toEqual({
      x: 25,
      y: 50,
    });
    expect(positionFromPoint(250, 350, { left: 50, top: 150, width: 800, height: 400 })).toEqual({
      x: 25,
      y: 50,
    });
  });
  it('não permite posições fora da imagem', () => {
    expect(positionPercent(-12)).toBe(0);
    expect(positionPercent(125)).toBe(100);
  });
  it('ignora dados de marcas desconhecidas', () => {
    expect(asDiagram('x', { brand: 'Marca inválida', system: 'Suspensão' })).toBeNull();
  });
});

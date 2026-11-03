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

describe('Referências V3 e compatibilidade', () => {
  it('carrega registros antigos de peças sem novos campos', () => {
    const result = asDiagram('v1', {
      brand: 'Mitsubishi',
      system: 'Suspensão',
      title: 'Suspensão traseira',
      vehicle: 'Pajero TR4',
      markers: [
        {
          id: 'a',
          x: 30,
          y: 50,
          label: 'Bucha',
          parts: [
            {
              id: 'p1',
              name: 'Bucha',
              manufacturer: 'Marca',
              model: 'TR4',
              code: 'XYZ',
              notes: '',
            },
          ],
        },
      ],
    });
    expect(result?.markers[0].parts[0].name).toBe('Bucha');
    expect(result?.markers[0].parts[0].compatibleModels).toEqual([]);
    expect(result?.markers[0].parts[0].useTypes).toEqual([]);
  });
  it('normaliza coordenadas herdadas e conserva campos V3', () => {
    const result = asDiagram('v3', {
      brand: 'Toyota',
      system: 'Direção',
      markers: [
        {
          id: 'a',
          x: 120,
          y: -5,
          label: 'A',
          parts: [
            {
              id: 'b',
              name: 'B',
              manufacturer: 'C',
              model: 'Corolla',
              code: 'D',
              notes: 'Nota',
              manufacturerHex: '#112233',
              yearRange: '2010-2015',
              photoUrl: 'https://example.com/photo.jpg',
              compatibleModels: ['Corolla', 'Yaris'],
              useTypes: ['Bucha', 'Coxim'],
            },
          ],
        },
      ],
    });
    expect(result?.markers[0].x).toBe(100);
    expect(result?.markers[0].y).toBe(0);
    expect(result?.markers[0].parts[0].manufacturerHex).toBe('#112233');
    expect(result?.markers[0].parts[0].compatibleModels).toEqual(['Corolla', 'Yaris']);
  });
});

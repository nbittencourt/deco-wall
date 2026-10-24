import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Parede sintética em perspectiva (tests/fixtures/paredes/perspectiva.jpg) e sua medida conhecida
// (perspectiva.medidas.json): o retângulo marcado mede 300 × 200 cm. Cantos em sentido horário
// a partir do superior esquerdo.
const PASTA = fileURLToPath(new URL('./paredes/', import.meta.url));

interface MedidasJson {
  larguraCm: number;
  alturaCm: number;
  cantosPx: [number, number][];
}

const medidas = JSON.parse(readFileSync(`${PASTA}perspectiva.medidas.json`, 'utf8')) as MedidasJson;

export const CAMINHO_PERSPECTIVA = `${PASTA}perspectiva.jpg`;
export const CAMINHO_FRONTAL = `${PASTA}frontal.jpg`;

export const PERSPECTIVA = {
  larguraImagemPx: 1600,
  alturaImagemPx: 1200,
  larguraCm: medidas.larguraCm,
  alturaCm: medidas.alturaCm,
  cantosPx: medidas.cantosPx.map(([x, y]) => ({ x, y })),
};

export const FRONTAL = { larguraImagemPx: 1200, alturaImagemPx: 900 };

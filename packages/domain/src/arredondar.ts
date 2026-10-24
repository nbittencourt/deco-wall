// RN-27 / DM-08: medidas em cm arredondadas a 0,1 cm (1 mm).
// O Number.EPSILON evita que 0,15 × 10 = 1,4999… vire 1,4.
export function arredondarCm(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 10) / 10;
}

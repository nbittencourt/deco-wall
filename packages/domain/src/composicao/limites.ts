import { arredondarCm } from '../arredondar';
import { MINIMO_DENTRO_CM } from '../constantes';
import type { AreaUtil, FotoNaParede } from '../schemas';
import { retanguloExterno } from './foto';

// Limite de posição (M2-11, RN-12; docs/specs/M2-biblioteca-e-composicao.md §4.1): a foto pode sair da parede
// inteira, mas não por completo. O arraste, o teclado, os campos X/Y, adicionar e duplicar mantêm pelo menos
// 1 cm do retângulo externo dentro da parede inteira, em cada eixo. Só movimentos do usuário chamam esta função:
// nunca ao abrir o projeto nem ao refazer a escala (RN-10).
export function limitarPosicao(
  foto: Pick<FotoNaParede, 'xCm' | 'yCm' | 'tamanho' | 'borda'>,
  paredeInteira: AreaUtil,
): { xCm: number; yCm: number } {
  const externo = retanguloExterno(foto);
  const limitar = (valor: number, origem: number, comprimento: number, tamanhoExterno: number) =>
    arredondarCm(
      Math.min(
        Math.max(valor, origem - tamanhoExterno + MINIMO_DENTRO_CM),
        origem + comprimento - MINIMO_DENTRO_CM,
      ),
    );
  return {
    xCm: limitar(foto.xCm, paredeInteira.xCm, paredeInteira.larguraCm, externo.larguraCm),
    yCm: limitar(foto.yCm, paredeInteira.yCm, paredeInteira.alturaCm, externo.alturaCm),
  };
}

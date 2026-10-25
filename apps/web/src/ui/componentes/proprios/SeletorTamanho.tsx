import { formatarTamanho, TAMANHOS_SUGERIDOS, type GrupoTamanho } from '@deco-wall/domain';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

// DESIGN §6 (seletor de tamanho) e protótipos 03b e 17: itens agrupados Padrão · Quadrados · Grandes e
// "Personalizado…", rótulo mono "20 × 30 cm".
const GRUPOS: [GrupoTamanho, string][] = [
  ['padrao', 'Padrão'],
  ['quadrado', 'Quadrados'],
  ['grande', 'Grandes'],
];

export const VALOR_PERSONALIZADO = 'personalizado';

export function SeletorTamanho({
  valor,
  texto,
  rotulo = 'Tamanho',
  onEscolherSugerido,
  onPersonalizado,
}: {
  // id do sugerido, ou VALOR_PERSONALIZADO.
  valor: string;
  // O que o gatilho mostra (ex.: "20 × 30 cm", "21,0 × 29,7 cm" ou "Personalizado").
  texto: string;
  rotulo?: string;
  onEscolherSugerido: (id: string) => void;
  onPersonalizado: () => void;
}) {
  return (
    <Select
      value={valor}
      onValueChange={(novo) => {
        if (novo === VALOR_PERSONALIZADO) onPersonalizado();
        else onEscolherSugerido(novo);
      }}
    >
      <SelectTrigger aria-label={rotulo} className="font-mono text-medida">
        <SelectValue>{texto}</SelectValue>
      </SelectTrigger>
      <SelectContent dicaRolagem="Role para ver mais tamanhos" className="w-[220px]">
        {GRUPOS.map(([grupo, nome]) => (
          <SelectGroup key={grupo}>
            <SelectLabel>{nome}</SelectLabel>
            {TAMANHOS_SUGERIDOS.filter((t) => t.grupo === grupo).map((t) => (
              <SelectItem key={t.id} value={t.id} className="font-mono text-medida">
                {formatarTamanho({ sugeridoId: t.id, larguraCm: t.menorCm, alturaCm: t.maiorCm })} cm
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
        <SelectGroup>
          <SelectItem value={VALOR_PERSONALIZADO}>Personalizado…</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

import {
  aplicarCampoAreaUtil,
  formatarCm,
  lerCm,
  type AreaUtil,
  type CampoAreaUtil,
} from '@deco-wall/domain';
import { useState, type KeyboardEvent } from 'react';
import { CampoCm } from '../componentes/proprios/CampoCm';

// Os quatro campos da área útil (A-13, A-14): Largura, Altura, X e Y em cm. Enter ou sair do campo aplica;
// valor fora da faixa mostra a faixa válida e não aplica.

const CAMPOS: { campo: CampoAreaUtil; rotulo: string; prefixo?: string }[] = [
  { campo: 'larguraCm', rotulo: 'Largura' },
  { campo: 'alturaCm', rotulo: 'Altura' },
  { campo: 'xCm', rotulo: 'X', prefixo: 'X' },
  { campo: 'yCm', rotulo: 'Y', prefixo: 'Y' },
];

type Textos = Record<CampoAreaUtil, string>;

const textosDe = (area: AreaUtil | null): Textos => ({
  larguraCm: area ? formatarCm(area.larguraCm) : '',
  alturaCm: area ? formatarCm(area.alturaCm) : '',
  xCm: area ? formatarCm(area.xCm) : '',
  yCm: area ? formatarCm(area.yCm) : '',
});

export function CamposAreaUtil({
  area,
  paredeInteira,
  onChange,
}: {
  // null = sem escala ainda: campos inativos.
  area: AreaUtil | null;
  paredeInteira: AreaUtil | null;
  onChange: (area: AreaUtil) => void;
}) {
  const [textos, setTextos] = useState<Textos>(() => textosDe(area));
  const [erros, setErros] = useState<Partial<Record<CampoAreaUtil, string>>>({});

  // Quando a área muda por fora (arrastar no canvas, "Usar a parede inteira"), os campos acompanham
  // (padrão "estado derivado durante o render": não perde o que o usuário está digitando se nada mudou).
  const chave = area ? `${area.xCm}|${area.yCm}|${area.larguraCm}|${area.alturaCm}` : '';
  const [chaveVista, setChaveVista] = useState(chave);
  if (chaveVista !== chave) {
    setChaveVista(chave);
    setTextos(textosDe(area));
    setErros({});
  }

  const aplicar = (campo: CampoAreaUtil) => {
    if (!area || !paredeInteira) return;
    if (textos[campo] === formatarCm(area[campo])) {
      setErros((atual) => ({ ...atual, [campo]: undefined }));
      return;
    }
    const valor = lerCm(textos[campo]);
    if (valor === null) {
      setErros((atual) => ({ ...atual, [campo]: 'Digite um número em cm.' }));
      return;
    }
    const resultado = aplicarCampoAreaUtil(area, campo, valor, paredeInteira);
    if (!resultado.ok) {
      const { min, max } = resultado.faixa;
      setErros((atual) => ({
        ...atual,
        [campo]: `Faixa válida: ${formatarCm(min)} a ${formatarCm(max)} cm.`,
      }));
      return;
    }
    setErros((atual) => ({ ...atual, [campo]: undefined }));
    onChange(resultado.area);
  };

  const aoTeclar = (campo: CampoAreaUtil) => (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key !== 'Enter') return;
    // Enter aplica o campo; não deve confirmar o modo inteiro (atalho da janela).
    evento.preventDefault();
    evento.stopPropagation();
    aplicar(campo);
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      {CAMPOS.map(({ campo, rotulo, prefixo }) => (
        <CampoCm
          key={campo}
          rotulo={rotulo}
          prefixo={prefixo}
          valor={textos[campo]}
          inativo={!area}
          erro={erros[campo]}
          onChange={(texto) => setTextos((atual) => ({ ...atual, [campo]: texto }))}
          onBlur={() => aplicar(campo)}
          onKeyDown={aoTeclar(campo)}
        />
      ))}
    </div>
  );
}

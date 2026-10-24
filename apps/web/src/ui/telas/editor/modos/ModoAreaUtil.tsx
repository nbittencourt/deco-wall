import type { AreaUtil } from '@deco-wall/domain';
import { useState } from 'react';
import { useEditor, useStoreEditor } from '../../../../app/StoreContext';
import { Palco } from '../../../canvas/Palco';
import { BarraModo } from '../../../paineis/BarraModo';
import { PainelAreaUtil } from '../../../paineis/PainelAreaUtil';
import { cenaDaAreaUtil, cenaDaParede, dadosDaParede } from '../cenas';
import { LayoutModo } from './LayoutModo';
import { useAtalhosDoModo } from './atalhos';

// Modo Área útil (spec M1 §3.6; protótipo 13): retângulo com 8 alças sobre a parede, livre a 0,1 cm (M1-07).
// Cancelar descarta só o ajuste: a primeira escala já gravou a parede inteira (M1-08).
const SUBTITULO = {
  perspectiva: 'Perspectiva aplicada. Agora defina onde as fotos podem ficar.',
  linear: 'Escala aplicada. Agora defina onde as fotos podem ficar.',
  ajuste: 'Ajuste onde as fotos podem ficar.',
} as const;

export function ModoAreaUtil() {
  const store = useStoreEditor();
  const projeto = useEditor((s) => s.documento.projeto)!;
  const variante = useEditor((s) => s.documento.variante)!;
  const contexto = useEditor((s) => s.ui.contextoAreaUtil);
  const { interior, metodo } = dadosDaParede(projeto);

  const [area, setArea] = useState<AreaUtil | null>(() => variante.areaUtil ?? interior);

  const aoConfirmar = () => {
    if (area) store.getState().confirmarAreaUtil(area);
  };
  const aoCancelar = () => store.getState().definirModo('editor');
  useAtalhosDoModo({ podeConfirmar: area !== null, onConfirmar: aoConfirmar, onCancelar: aoCancelar });

  if (!interior || !area) return null;
  const cena = cenaDaAreaUtil(cenaDaParede(projeto, variante), area, setArea);

  return (
    <LayoutModo
      fundo="claro"
      barra={
        <BarraModo
          titulo="Área útil"
          subtitulo={SUBTITULO[contexto]}
          rotuloConfirmar="Confirmar área"
          onCancelar={aoCancelar}
          onConfirmar={aoConfirmar}
        />
      }
      palco={<Palco cena={cena} />}
      painel={
        <PainelAreaUtil
          area={area}
          paredeInteira={interior}
          onAreaChange={setArea}
          onUsarParedeInteira={() => setArea(interior)}
          origem={metodo === 'linear' ? 'foto' : 'retificada'}
        />
      }
    />
  );
}

import {
  formatarCmCurto,
  segmentoPadrao,
  SEGMENTO_MIN_PX,
  validarMedidaReferencia,
  type Pt,
} from '@deco-wall/domain';
import { useState } from 'react';
import { useEditor, useStoreEditor } from '../../../../app/StoreContext';
import { urlArquivoParede } from '../../../../infra/clienteApi';
import type { Cena } from '../../../canvas/cena';
import { Palco } from '../../../canvas/Palco';
import { BarraModo } from '../../../paineis/BarraModo';
import { PainelCalibracao } from '../../../paineis/PainelCalibracao';
import { LayoutModo } from './LayoutModo';
import { useAtalhosDoModo } from './atalhos';

// Modo Calibração linear (spec M1 §3.5; protótipo 05): um segmento sobre algo de comprimento conhecido.
export function ModoCalibracao() {
  const store = useStoreEditor();
  const projeto = useEditor((s) => s.documento.projeto)!;
  const parede = projeto.parede!;
  const salvo = parede.escala.metodo === 'linear' ? parede.escala.linear : undefined;

  const [segmento, setSegmento] = useState<{ p1: Pt; p2: Pt }>(() =>
    salvo ? { p1: salvo.p1, p2: salvo.p2 } : segmentoPadrao(parede.larguraPx, parede.alturaPx),
  );
  const [comprimento, setComprimento] = useState(salvo ? formatarCmCurto(salvo.comprimentoCm) : '');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const medida = validarMedidaReferencia(comprimento);
  const segmentoPx = Math.hypot(segmento.p2.x - segmento.p1.x, segmento.p2.y - segmento.p1.y);
  const pronto = medida.ok && segmentoPx >= SEGMENTO_MIN_PX;

  const aoAplicar = async () => {
    if (!pronto || !medida.ok || ocupado) return;
    setErro(null);
    setOcupado(true);
    try {
      await store
        .getState()
        .aplicarCalibracao({ p1: segmento.p1, p2: segmento.p2, comprimentoCm: medida.valor });
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível aplicar a escala.');
      setOcupado(false);
    }
  };

  const aoCancelar = () => store.getState().definirModo('editor');
  useAtalhosDoModo({
    podeConfirmar: pronto && !ocupado,
    onConfirmar: () => void aoAplicar(),
    onCancelar: aoCancelar,
  });

  const cena: Cena = {
    tipo: 'calibracao',
    chave: `foto:${projeto._id}:${projeto.revisao}`,
    imagemUrl: urlArquivoParede(projeto._id, 'original', projeto.revisao),
    larguraPx: parede.larguraPx,
    alturaPx: parede.alturaPx,
    p1: segmento.p1,
    p2: segmento.p2,
    onSegmentoChange: (p1, p2) => setSegmento({ p1, p2 }),
  };

  return (
    <LayoutModo
      fundo="escuro"
      barra={
        <BarraModo
          titulo="Calibração linear"
          subtitulo="Trace um segmento sobre algo de comprimento conhecido"
          rotuloConfirmar="Aplicar escala"
          confirmarDesabilitado={!pronto}
          ocupado={ocupado ? 'Aplicando escala…' : undefined}
          onCancelar={aoCancelar}
          onConfirmar={() => void aoAplicar()}
        />
      }
      palco={<Palco cena={cena} />}
      painel={
        <PainelCalibracao
          comprimentoCm={comprimento}
          onComprimentoChange={setComprimento}
          segmentoPx={segmentoPx}
          onUsarPerspectiva={() => store.getState().definirModo('perspectiva')}
          erro={erro}
        />
      }
    />
  );
}

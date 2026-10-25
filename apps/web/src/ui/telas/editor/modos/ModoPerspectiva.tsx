import {
  cantosPadrao,
  formatarCmCurto,
  ordenarCantos,
  PERFIS,
  validarMedidaReferencia,
  validarQuadrilatero,
  type Pt,
} from '@deco-wall/domain';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, useStoreEditor } from '../../../../app/StoreContext';
import { urlArquivoParede } from '../../../../infra/clienteApi';
import { gerarPrevia, retificarParede } from '../../../../infra/retificacao';
import type { Cena } from '../../../canvas/cena';
import { Palco } from '../../../canvas/Palco';
import { BarraModo } from '../../../paineis/BarraModo';
import { PainelPerspectiva, type EstadoPrevia } from '../../../paineis/PainelPerspectiva';
import { LayoutModo } from './LayoutModo';
import { useAtalhosDoModo } from './atalhos';

// Modo Perspectiva (spec M1 §3.4; protótipos 04 e 04a): quatro alças já prontas sobre a foto, medidas reais,
// prévia frontal sob demanda e retificação completa no Worker ao aplicar.

interface PreviaGerada {
  url: string;
  geradaEm: Date;
  larguraCm: number;
  alturaCm: number;
  // Cantos e medidas com que foi gerada: se mudarem, a prévia fica desatualizada (DV-06).
  chave: string;
}

const ERRO_ABORTO = 'AbortError';

export function ModoPerspectiva() {
  const store = useStoreEditor();
  const projeto = useEditor((s) => s.documento.projeto)!;
  const parede = projeto.parede!;
  const salvo = parede.escala.metodo === 'perspectiva' ? parede.escala.perspectiva : undefined;
  const urlImagem = urlArquivoParede(projeto._id, 'original', projeto.revisao);

  const [cantos, setCantos] = useState<Pt[]>(
    () => salvo?.cantosPx ?? cantosPadrao(parede.larguraPx, parede.alturaPx),
  );
  const [medidas, setMedidas] = useState({
    larguraCm: salvo ? formatarCmCurto(salvo.larguraCm) : '',
    alturaCm: salvo ? formatarCmCurto(salvo.alturaCm) : '',
  });
  const [geradaPrevia, setGeradaPrevia] = useState<PreviaGerada | null>(null);
  const [gerando, setGerando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const operacao = useRef<AbortController | null>(null);

  const ordenados = useMemo(() => ordenarCantos(cantos), [cantos]);
  const quadrilatero = validarQuadrilatero(ordenados, parede.larguraPx * parede.alturaPx);
  const largura = validarMedidaReferencia(medidas.larguraCm);
  const altura = validarMedidaReferencia(medidas.alturaCm);
  const pronto = quadrilatero.ok && largura.ok && altura.ok;

  const chaveAtual = `${ordenados.map((c) => `${Math.round(c.x)},${Math.round(c.y)}`).join(';')}|${medidas.larguraCm}|${medidas.alturaCm}`;
  const previa: EstadoPrevia = gerando
    ? { tipo: 'gerando' }
    : geradaPrevia
      ? geradaPrevia.chave === chaveAtual
        ? { tipo: 'pronta', ...geradaPrevia }
        : { tipo: 'desatualizada', url: geradaPrevia.url }
      : { tipo: 'vazia' };

  // Libera a URL da prévia ao trocá-la e ao sair do modo.
  const urlAnterior = useRef<string | null>(null);
  useEffect(() => {
    const atual = geradaPrevia?.url ?? null;
    if (urlAnterior.current && urlAnterior.current !== atual) URL.revokeObjectURL(urlAnterior.current);
    urlAnterior.current = atual;
  }, [geradaPrevia]);
  useEffect(
    () => () => {
      if (urlAnterior.current) URL.revokeObjectURL(urlAnterior.current);
      operacao.current?.abort();
    },
    [],
  );

  const aoGerarPrevia = async () => {
    if (!pronto || !largura.ok || !altura.ok) {
      setErro('Posicione os quatro cantos e informe as medidas reais (de 10 a 2000 cm) para gerar a prévia.');
      return;
    }
    setErro(null);
    setGerando(true);
    const chave = chaveAtual;
    const controle = new AbortController();
    operacao.current = controle;
    try {
      const resultado = await gerarPrevia(
        { urlImagem, cantosPx: ordenados, larguraCm: largura.valor, alturaCm: altura.valor },
        controle.signal,
      );
      setGeradaPrevia({
        url: URL.createObjectURL(resultado.blob),
        geradaEm: new Date(),
        larguraCm: largura.valor,
        alturaCm: altura.valor,
        chave,
      });
    } catch (falha) {
      if ((falha as Error).name !== ERRO_ABORTO)
        setErro(mensagemDe(falha, 'Não foi possível gerar a prévia.'));
    } finally {
      setGerando(false);
    }
  };

  const aoAplicar = async () => {
    if (!pronto || !largura.ok || !altura.ok || aplicando) return;
    setErro(null);
    setAplicando(true);
    const controle = new AbortController();
    operacao.current = controle;
    try {
      const perspectiva = { cantosPx: ordenados, larguraCm: largura.valor, alturaCm: altura.valor };
      const retificada = await retificarParede(
        {
          urlImagem,
          entrada: {
            cantosPx: ordenados,
            larguraCm: largura.valor,
            alturaCm: altura.valor,
            larguraImagemPx: parede.larguraPx,
            alturaImagemPx: parede.alturaPx,
            ladoMaxPx: PERFIS[parede.perfil].ladoParedePx,
          },
          qualidadeWebp: PERFIS[parede.perfil].qualidadeWebp,
        },
        controle.signal,
      );
      await store.getState().aplicarPerspectiva(perspectiva, retificada.blob, controle.signal);
    } catch (falha) {
      if ((falha as Error).name !== ERRO_ABORTO)
        setErro(mensagemDe(falha, 'Não foi possível aplicar a perspectiva.'));
      setAplicando(false);
    }
  };

  const aoCancelar = () => {
    operacao.current?.abort();
    store.getState().definirModo('editor');
  };

  useAtalhosDoModo({
    podeConfirmar: pronto && !aplicando,
    onConfirmar: () => void aoAplicar(),
    onCancelar: aoCancelar,
  });

  const cena: Cena = {
    tipo: 'perspectiva',
    chave: `foto:${projeto._id}:${projeto.revisao}`,
    imagemUrl: urlImagem,
    larguraPx: parede.larguraPx,
    alturaPx: parede.alturaPx,
    cantos,
    // Ao soltar a alça, reordena em sentido horário a partir do superior esquerdo (A-10).
    onCantosChange: (novos, final) => setCantos(final ? ordenarCantos(novos) : novos),
  };

  return (
    <LayoutModo
      fundo="escuro"
      barra={
        <BarraModo
          titulo="Correção de perspectiva"
          subtitulo="Marque os quatro cantos de um retângulo real da parede"
          rotuloConfirmar="Aplicar"
          confirmarDesabilitado={!pronto}
          ocupado={aplicando ? 'Aplicando perspectiva…' : undefined}
          onCancelar={aoCancelar}
          onConfirmar={() => void aoAplicar()}
        />
      }
      palco={<Palco cena={cena} />}
      painel={
        <PainelPerspectiva
          cantos={ordenados}
          motivoInvalido={quadrilatero.ok ? null : quadrilatero.motivo}
          medidas={medidas}
          onMedidasChange={setMedidas}
          previa={previa}
          onGerarPrevia={() => void aoGerarPrevia()}
          permitirPular={parede.escala.metodo !== 'perspectiva'}
          onPular={() => store.getState().definirModo('calibracao')}
          erro={erro}
        />
      }
    />
  );
}

function mensagemDe(falha: unknown, padrao: string): string {
  return falha instanceof Error && falha.message ? falha.message : padrao;
}

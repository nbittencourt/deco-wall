import {
  formatarCm,
  formatarCmCurto,
  formatarDimensao,
  nomeDoTemplateUnico,
  type DirecaoSeta,
} from '@deco-wall/domain';
import { useEffect } from 'react';
import { useEditor, useStoreEditor, useVistaDaVariante } from '../../../../app/StoreContext';
import { Palco } from '../../../canvas/Palco';
import { Alert } from '../../../componentes/ui/alert';
import { BarraModo } from '../../../paineis/BarraModo';
import { PainelTemplate } from '../../../paineis/PainelTemplate';
import { cenaDaParede, cenaDoTemplate, dadosDaParede } from '../cenas';
import { LayoutModo } from './LayoutModo';
import { useAtalhosDoModo } from './atalhos';

const DIRECOES: Record<string, DirecaoSeta> = {
  ArrowLeft: 'esquerda',
  ArrowRight: 'direita',
  ArrowUp: 'cima',
  ArrowDown: 'baixo',
};

// Modo Posicionar template (RN-32, TPL-06; protótipos 15 e 15b; DESIGN §7, §7.3; spec M3 §3.7, A-20 a A-22): o conjunto
// entra centralizado na área útil, arrasta com snap no canto, e Confirmar cria a variante nova.
export function ModoTemplate() {
  const store = useStoreEditor();
  const projeto = useEditor((s) => s.documento.projeto)!;
  const variante = useVistaDaVariante();
  const imagens = useEditor((s) => s.biblioteca.imagens);
  const lista = useEditor((s) => s.documento.lista);
  const template = useEditor((s) => s.ui.template);

  const confirmar = () => void store.getState().confirmarTemplate();
  const cancelar = () => store.getState().cancelarTemplate();
  useAtalhosDoModo({
    podeConfirmar: template !== null && !template.criando,
    onConfirmar: confirmar,
    onCancelar: cancelar,
  });

  // A-21: as setas movem o conjunto (Shift: 5 passos), exceto quando o foco está num campo.
  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      const direcao = DIRECOES[evento.key];
      if (!direcao || evento.defaultPrevented || evento.ctrlKey || evento.metaKey) return;
      const alvo = evento.target;
      if (
        alvo instanceof Element &&
        alvo.closest('input, textarea, select, [contenteditable="true"], [role="combobox"]')
      ) {
        return;
      }
      evento.preventDefault();
      store.getState().moverConjuntoPorSeta(direcao, evento.shiftKey);
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [store]);

  if (!template) return null;
  const { interior } = dadosDaParede(projeto);
  const nomeNovo = nomeDoTemplateUnico(
    template.nome,
    lista.map((i) => i.nome),
  );
  const total = formatarDimensao(template.conjunto.larguraCm, template.conjunto.alturaCm);

  const cena = cenaDoTemplate(cenaDaParede(projeto, variante, imagens), {
    conjunto: template.conjunto,
    fotos: template.fotos,
    maiorQueAreaUtil: template.maiorQueAreaUtil,
    rotuloTotal: total,
    onMoverConjunto: (x, y) => store.getState().moverConjunto(x, y),
  });

  const snap = variante.grid.snap
    ? `Encaixe no grid de ${formatarCmCurto(variante.grid.passoCm)} cm`
    : 'Sem encaixe';

  return (
    <LayoutModo
      fundo="escuro"
      barra={
        <BarraModo
          titulo={`Posicionar template · ${template.nome}`}
          subtitulo={`${template.fotos.length} vagas · nova variante “${nomeNovo}”`}
          rotuloConfirmar="Confirmar posição"
          ocupado={template.criando ? 'Criando variante…' : undefined}
          onCancelar={cancelar}
          onConfirmar={confirmar}
        />
      }
      palco={
        <>
          <Palco cena={cena} />
          {template.maiorQueAreaUtil && variante.areaUtil && (
            <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-4">
              <Alert variant="alerta" className="pointer-events-auto max-w-[560px]">
                O template é maior que a área útil. Você pode confirmar assim mesmo e ajustar as fotos depois.
              </Alert>
            </div>
          )}
        </>
      }
      painel={
        <PainelTemplate
          nome={template.nome}
          vagas={template.fotos.length}
          conjunto={template.conjunto}
          borda={template.borda}
          areaUtil={variante.areaUtil ?? interior}
          maiorQueAreaUtil={template.maiorQueAreaUtil}
          vagasMaiores={template.vagasMaiores}
          erro={template.erro}
          onMover={(x, y) => {
            store.getState().moverConjunto(x, y);
            return null;
          }}
          onCentralizar={() => store.getState().centralizarConjunto()}
        />
      }
      rodape={
        <footer className="flex h-8 shrink-0 items-center gap-4 border-t border-line-soft bg-surface px-4">
          <span className="text-body-sm text-ink-2">
            Arraste para posicionar · Enter confirma · Esc cancela
          </span>
          <span className="font-mono text-medida text-ink-2">
            X {formatarCm(template.conjunto.xCm)} · Y {formatarCm(template.conjunto.yCm)} cm
          </span>
          <span className="text-xs text-ink-3">{snap}</span>
        </footer>
      }
    />
  );
}

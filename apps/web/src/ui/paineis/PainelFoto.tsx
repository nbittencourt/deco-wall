import {
  formatarCm,
  formatarDimensao,
  formatarTamanho,
  LIMITE_BORDA_CM,
  orientacaoDoTamanho,
  tamanhoExterno,
  tamanhoSugerido,
  type AlertasDaFoto,
  type Borda,
  type FotoNaParede,
  type Tamanho,
} from '@deco-wall/domain';
import { Copy, Crop } from 'lucide-react';
import { urlArquivoImagem } from '../../infra/clienteApi';
import type { ImagemDto } from '../../infra/dto';
import { CampoCmEditavel } from '../componentes/proprios/CampoCmEditavel';
import { SeletorCor } from '../componentes/proprios/SeletorCor';
import { SeletorTamanho, VALOR_PERSONALIZADO } from '../componentes/proprios/SeletorTamanho';
import { Alert } from '../componentes/ui/alert';
import { Button } from '../componentes/ui/button';
import { ToggleGroup, ToggleGroupItem } from '../componentes/ui/toggle-group';

// Painel da foto selecionada (RF-60; DESIGN §7, protótipo 03; spec M2 §3.4).

export interface PropsPainelFoto {
  foto: FotoNaParede;
  imagem?: ImagemDto;
  alertas?: AlertasDaFoto;
  onTrocarTamanho: (tamanho: Tamanho) => void;
  onTrocarOrientacao: (orientacao: 'retrato' | 'paisagem') => void;
  onAlterarBorda: (parcial: Partial<Borda>) => void;
  onMover: (xCm: number, yCm: number) => void;
  onAjustarRecorte: () => void;
  onPersonalizado: () => void;
  onDuplicar: () => void;
  onRemover: () => void;
}

const MENSAGEM_BORDA = `Entre ${formatarCm(LIMITE_BORDA_CM.min)} e ${formatarCm(LIMITE_BORDA_CM.max)} cm.`;

export function PainelFoto({
  foto,
  imagem,
  alertas,
  onTrocarTamanho,
  onTrocarOrientacao,
  onAlterarBorda,
  onMover,
  onAjustarRecorte,
  onPersonalizado,
  onDuplicar,
  onRemover,
}: PropsPainelFoto) {
  const orientacao = orientacaoDoTamanho(foto.tamanho);
  const quadrado = orientacao === 'quadrado';
  const externo = tamanhoExterno(foto);
  const orientacaoDaImagem = imagem
    ? imagem.orientacaoNatural === 'paisagem'
      ? 'Paisagem natural'
      : 'Retrato natural'
    : '';

  const avisos: string[] = [];
  if (alertas?.fora === 'parede') avisos.push('Esta foto passa dos limites da parede.');
  if (alertas?.fora === 'area-util') avisos.push('Esta foto passa dos limites da área útil.');
  if (alertas?.sobreposicao) avisos.push('Esta foto sobrepõe outra na parede.');

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex items-center gap-3">
        <div className="size-[60px] w-[46px] shrink-0 overflow-hidden rounded-xs bg-sand ring-4 ring-surface outline outline-[5px] outline-line-soft">
          {imagem && (
            <img
              src={urlArquivoImagem(imagem._id, 'thumb')}
              alt=""
              className="size-full object-cover"
              draggable={false}
            />
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-0.5 pl-1">
          <span className="truncate text-display-sm text-[18px] text-ink">
            {imagem?.nomeOriginal ?? 'Imagem indisponível'}
          </span>
          <span className="text-xs text-ink-3">{orientacaoDaImagem}</span>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-label">Tamanho</span>
          <SeletorTamanho
            valor={foto.tamanho.sugeridoId ?? VALOR_PERSONALIZADO}
            texto={formatarTamanho(foto.tamanho)}
            onEscolherSugerido={(id) =>
              onTrocarTamanho(tamanhoSugerido(id, orientacao === 'paisagem' ? 'paisagem' : 'retrato'))
            }
            onPersonalizado={onPersonalizado}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-label">Orientação</span>
          <ToggleGroup
            type="single"
            aria-label="Orientação"
            className="w-[152px]"
            value={quadrado ? '' : orientacao}
            onValueChange={(valor) => valor && onTrocarOrientacao(valor as 'retrato' | 'paisagem')}
          >
            <ToggleGroupItem value="retrato" disabled={quadrado}>
              Retrato
            </ToggleGroupItem>
            <ToggleGroupItem value="paisagem" disabled={quadrado}>
              Paisagem
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-label">Borda</span>
        <div className="grid grid-cols-2 items-end gap-2">
          <CampoCmEditavel
            rotulo="Largura da borda"
            rotuloOculto
            valor={foto.borda.larguraCm}
            onConfirmar={(cm) => {
              if (cm < LIMITE_BORDA_CM.min || cm > LIMITE_BORDA_CM.max) return MENSAGEM_BORDA;
              onAlterarBorda({ larguraCm: cm });
              return null;
            }}
          />
          <SeletorCor
            valor={foto.borda.cor}
            rotulo="Cor da borda"
            onChange={(cor) => onAlterarBorda({ cor })}
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-paper p-3">
        <span className="text-body-sm text-ink-2">Tamanho externo</span>
        <span className="font-mono text-medida font-medium text-ink">
          {formatarDimensao(externo.larguraCm, externo.alturaCm)}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-label">Posição do canto superior esquerdo</span>
        <div className="grid grid-cols-2 gap-2">
          <CampoCmEditavel
            rotulo="X"
            rotuloOculto
            prefixo="X"
            valor={foto.xCm}
            onConfirmar={(cm) => {
              onMover(cm, foto.yCm);
              return null;
            }}
          />
          <CampoCmEditavel
            rotulo="Y"
            rotuloOculto
            prefixo="Y"
            valor={foto.yCm}
            onConfirmar={(cm) => {
              onMover(foto.xCm, cm);
              return null;
            }}
          />
        </div>
      </div>

      {avisos.length > 0 && (
        <Alert variant="alerta">
          {avisos.map((aviso) => (
            <p key={aviso}>{aviso}</p>
          ))}
        </Alert>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-label">Enquadramento</span>
        <Button variant="outline" className="justify-start" onClick={onAjustarRecorte}>
          <Crop aria-hidden="true" />
          Ajustar recorte
        </Button>
      </div>

      <div className="mt-auto flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onDuplicar}>
          <Copy aria-hidden="true" />
          Duplicar
        </Button>
        <Button variant="outline" className="flex-1 text-danger-ink" onClick={onRemover}>
          Remover
        </Button>
      </div>
    </div>
  );
}

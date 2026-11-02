import {
  formatarCm,
  formatarDimensao,
  formatarTamanhoComUnidade,
  BORDA_MAX_CM,
  orientacaoDe,
  tamanhoExterno,
  tamanhoSugerido,
  type AlertasDaFoto,
  type Borda,
  type FotoNaParede,
  type Tamanho,
} from '@deco-wall/domain';
import { Copy, Crop, ImageOff, ImagePlus } from 'lucide-react';
import { urlArquivoImagem } from '../../infra/clienteApi';
import type { ImagemDto } from '../../infra/dto';
import { BotaoInativo } from '../componentes/proprios/BotaoEmBreve';
import { CampoCmEditavel } from '../componentes/proprios/CampoCmEditavel';
import { ComDica } from '../componentes/proprios/ComDica';
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
  // M3-01, A-23: preencher a vaga com a miniatura escolhida na biblioteca; só no placeholder.
  onPreencher: () => void;
  podePreencher: boolean;
  // M4-08 (RF-30a): a imagem anterior do placeholder, se estiver ativa na biblioteca; "Usar" preenche com ela.
  recomendada?: ImagemDto;
  onUsarAnterior?: () => void;
  onEscolherOutra?: () => void;
}

// Retrato · Paisagem (152 px); inativo em tamanho quadrado (RN-05).
function seletorDeOrientacao(
  orientacao: 'retrato' | 'paisagem' | 'quadrado',
  onTrocar: (orientacao: 'retrato' | 'paisagem') => void,
) {
  const quadrado = orientacao === 'quadrado';
  return (
    <ToggleGroup
      type="single"
      aria-label="Orientação"
      className="w-[152px]"
      value={quadrado ? '' : orientacao}
      onValueChange={(valor) => valor && onTrocar(valor as 'retrato' | 'paisagem')}
    >
      <ToggleGroupItem value="retrato" disabled={quadrado}>
        Retrato
      </ToggleGroupItem>
      <ToggleGroupItem value="paisagem" disabled={quadrado}>
        Paisagem
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

const MENSAGEM_BORDA = `Entre ${formatarCm(0)} e ${formatarCm(BORDA_MAX_CM)} cm.`;

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
  onPreencher,
  podePreencher,
  recomendada,
  onUsarAnterior,
  onEscolherOutra,
}: PropsPainelFoto) {
  const orientacao = orientacaoDe(foto.tamanho);
  const quadrado = orientacao === 'quadrado';
  const externo = tamanhoExterno(foto.tamanho, foto.borda);
  const placeholder = foto.imagemId === null; // M2-06: sem imagem associada
  const orientacaoDaImagem = imagem
    ? imagem.orientacaoNatural === 'paisagem'
      ? 'Paisagem natural'
      : 'Retrato natural'
    : '';

  const avisos: string[] = [];
  if (alertas?.fora === 'parede') avisos.push('Esta foto está fora da parede.');
  if (alertas?.fora === 'area-util') avisos.push('Esta foto está fora da área útil.');
  if (alertas?.sobreposicao) avisos.push('Esta foto sobrepõe outra na parede.');

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex items-center gap-3">
        <div className="flex size-[60px] w-[46px] shrink-0 items-center justify-center overflow-hidden rounded-xs bg-sand ring-4 ring-surface outline outline-[5px] outline-line-soft">
          {placeholder && (
            <ImageOff data-testid="icone-sem-foto" className="size-5 text-danger-ink" aria-hidden="true" />
          )}
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
            {placeholder ? 'Sem foto' : (imagem?.nomeOriginal ?? 'Imagem indisponível')}
          </span>
          <span className="text-xs text-ink-3">{orientacaoDaImagem}</span>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-label">Tamanho</span>
          <SeletorTamanho
            valor={foto.tamanho.sugeridoId ?? VALOR_PERSONALIZADO}
            texto={formatarTamanhoComUnidade(foto.tamanho)}
            onEscolherSugerido={(id) =>
              // A-10: escolher um sugerido mantém a orientação; vindo de um quadrado, usa a natural da imagem.
              onTrocarTamanho(
                tamanhoSugerido(
                  id,
                  orientacao === 'quadrado' ? (imagem?.orientacaoNatural ?? 'retrato') : orientacao,
                ),
              )
            }
            onPersonalizado={onPersonalizado}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-label">Orientação</span>
          {quadrado ? (
            <ComDica texto="Quadrado: sem orientação">
              {seletorDeOrientacao(orientacao, onTrocarOrientacao)}
            </ComDica>
          ) : (
            seletorDeOrientacao(orientacao, onTrocarOrientacao)
          )}
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
              if (cm < 0 || cm > BORDA_MAX_CM) return MENSAGEM_BORDA;
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

      {placeholder && recomendada && (
        <div className="flex flex-col gap-2 rounded-lg border-2 border-accent bg-accent-wash p-3">
          <span className="text-label">Foto anterior, restaurada</span>
          <div className="flex items-center gap-2">
            <img
              src={urlArquivoImagem(recomendada._id, 'thumb')}
              alt=""
              draggable={false}
              className="h-8 w-12 shrink-0 rounded-[4px] bg-sand object-cover"
            />
            <span className="min-w-0 truncate text-body-sm text-ink">{recomendada.nomeOriginal}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onUsarAnterior}>Usar</Button>
            <Button variant="ghost" onClick={onEscolherOutra}>
              Escolher outra na biblioteca
            </Button>
          </div>
        </div>
      )}

      {placeholder &&
        (podePreencher ? (
          <Button variant="outline" className="justify-start" onClick={onPreencher}>
            <ImagePlus aria-hidden="true" />
            Preencher com a foto selecionada
          </Button>
        ) : (
          <BotaoInativo
            variant="outline"
            className="justify-start"
            motivo="Selecione uma foto na biblioteca."
          >
            <ImagePlus aria-hidden="true" />
            Preencher com a foto selecionada
          </BotaoInativo>
        ))}

      <div className="flex flex-col gap-1.5">
        <span className="text-label">Enquadramento</span>
        {placeholder ? (
          <BotaoInativo variant="outline" className="justify-start" motivo="Sem imagem para enquadrar.">
            <Crop aria-hidden="true" />
            Ajustar recorte
          </BotaoInativo>
        ) : (
          <Button variant="outline" className="justify-start" onClick={onAjustarRecorte}>
            <Crop aria-hidden="true" />
            Ajustar recorte
          </Button>
        )}
      </div>

      <div className="mt-auto flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onDuplicar}>
          <Copy aria-hidden="true" />
          Duplicar
        </Button>
        <ComDica texto="Tira a foto desta variante. A imagem continua na biblioteca.">
          <Button variant="outline" className="flex-1 text-danger-ink" onClick={onRemover}>
            Remover
          </Button>
        </ComDica>
      </div>
    </div>
  );
}

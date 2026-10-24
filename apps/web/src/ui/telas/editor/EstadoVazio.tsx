import { PERFIL_PADRAO, validarArquivoImagem, type Perfil } from '@deco-wall/domain';
import { ImagePlus, Upload } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { Button } from '../../componentes/ui/button';
import { ToggleGroup, ToggleGroupItem } from '../../componentes/ui/toggle-group';

// Projeto sem parede (spec M1 §3.2; protótipo 02): convite, escolha da qualidade (RF-25) e envio da foto.
// O formato e o tamanho são conferidos no browser antes do envio (RF-15).

const LIMITE_UPLOAD_MB = 50;

const PERFIS: { valor: Perfil; rotulo: string }[] = [
  { valor: 'leve', rotulo: 'Leve' },
  { valor: 'medio', rotulo: 'Médio' },
  { valor: 'alto', rotulo: 'Alto' },
];

export function EstadoVazio({
  onArquivo,
  enviando,
  erro,
  onCancelar,
}: {
  onArquivo: (arquivo: File, perfil: Perfil) => void;
  // Fração de 0 a 1 do envio em andamento; null quando parado.
  enviando: number | null;
  // Falha do servidor no último envio.
  erro?: string | null;
  // Aparece ao trocar a parede (M1-05): volta à parede atual.
  onCancelar?: () => void;
}) {
  const [perfil, setPerfil] = useState<Perfil>(PERFIL_PADRAO);
  const [recusa, setRecusa] = useState<string | null>(null);
  const [sobre, setSobre] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  const receber = (arquivo: File | undefined) => {
    if (!arquivo) return;
    const motivo = validarArquivoImagem(
      { nome: arquivo.name, tipo: arquivo.type, tamanhoBytes: arquivo.size },
      LIMITE_UPLOAD_MB,
    );
    setRecusa(motivo);
    if (!motivo) onArquivo(arquivo, perfil);
  };

  const aoSoltar = (evento: DragEvent) => {
    evento.preventDefault();
    setSobre(false);
    receber(evento.dataTransfer.files[0]);
  };

  const mensagem = recusa ?? erro ?? null;

  return (
    <div className="flex size-full items-center justify-center p-8">
      <div className="flex w-full max-w-[560px] flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-display-lg text-ink">Comece pela parede</h2>
          <p className="text-body text-ink-2">
            Envie uma foto da parede que será decorada. Depois você marca a escala e posiciona as fotos.
          </p>
        </div>

        <div
          onDragOver={(evento) => {
            evento.preventDefault();
            setSobre(true);
          }}
          onDragLeave={() => setSobre(false)}
          onDrop={aoSoltar}
          className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
            sobre ? 'border-accent bg-accent-wash' : 'border-line bg-surface'
          }`}
        >
          <ImagePlus className="size-8 text-ink-3" aria-hidden="true" />
          <p className="text-body text-ink">Arraste a foto da parede aqui · JPG, PNG ou WEBP</p>
          <input
            ref={entrada}
            type="file"
            aria-label="Foto da parede"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            className="sr-only"
            tabIndex={-1}
            onChange={(evento) => {
              receber(evento.target.files?.[0]);
              evento.target.value = '';
            }}
          />
          <Button variant="default" disabled={enviando !== null} onClick={() => entrada.current?.click()}>
            <Upload aria-hidden="true" />
            Escolher arquivo
          </Button>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="text-label">Qualidade</span>
          <ToggleGroup
            type="single"
            aria-label="Qualidade"
            value={perfil}
            onValueChange={(valor) => valor && setPerfil(valor as Perfil)}
            className="w-[240px]"
          >
            {PERFIS.map(({ valor, rotulo }) => (
              <ToggleGroupItem key={valor} value={valor}>
                {rotulo}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {enviando !== null && (
          <div className="flex flex-col gap-1.5" role="status">
            <span className="text-body-sm text-ink-2">Enviando a foto…</span>
            <div className="h-1.5 overflow-hidden rounded-full bg-sand">
              <div
                className="h-full bg-ink-2 transition-[width]"
                style={{ width: `${Math.round(enviando * 100)}%` }}
              />
            </div>
          </div>
        )}

        {mensagem && (
          <p
            role="alert"
            className="rounded-lg bg-danger-tint px-3 py-2.5 text-body-sm text-danger-ink-strong"
          >
            {mensagem}
          </p>
        )}

        <ol className="flex items-center gap-4 text-body-sm text-ink-3">
          <li className="font-medium text-ink">1 Parede</li>
          <li>2 Escala</li>
          <li>3 Fotos</li>
        </ol>

        {onCancelar && (
          <Button variant="ghost" className="w-fit" onClick={onCancelar}>
            Cancelar a troca
          </Button>
        )}
      </div>
    </div>
  );
}

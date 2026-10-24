import { Button } from '../componentes/ui/button';

// DS-05: perspectiva, calibração e área útil trocam o header por uma barra escura (Tinta) com Cancelar
// e a ação principal.
export function BarraModo({
  titulo,
  subtitulo,
  rotuloConfirmar,
  confirmarDesabilitado = false,
  ocupado,
  onCancelar,
  onConfirmar,
}: {
  titulo: string;
  subtitulo: string;
  rotuloConfirmar: string;
  confirmarDesabilitado?: boolean;
  // Texto de andamento (ex.: "Aplicando perspectiva…"): bloqueia a confirmação; Cancelar segue ativo.
  ocupado?: string;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 bg-ink px-4 text-white">
      <div className="flex min-w-0 flex-1 items-baseline gap-3">
        <span className="text-display-sm whitespace-nowrap">{titulo}</span>
        <span className="truncate text-body-sm text-white/70">{subtitulo}</span>
      </div>
      {ocupado && (
        <span role="status" className="text-body-sm text-accent-on-dark">
          {ocupado}
        </span>
      )}
      <Button variant="ghost" className="text-white hover:bg-white/10" onClick={onCancelar}>
        Cancelar
      </Button>
      <Button disabled={confirmarDesabilitado || Boolean(ocupado)} onClick={onConfirmar}>
        {rotuloConfirmar}
      </Button>
    </header>
  );
}

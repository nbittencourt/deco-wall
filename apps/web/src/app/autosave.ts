// Temporizador do salvamento automático (RF-71, SV-01, A-07; docs/specs/M3-variantes-templates-e-salvamento.md §3.3).
// Fica atrás de um objeto para os testes capturarem o intervalo e dispararem os ticks à mão, sem relógio falso.
export const agendador = {
  periodico(tick: () => void, intervaloMs: number): () => void {
    const id = setInterval(tick, intervaloMs);
    return () => clearInterval(id);
  },
};

export const MS_POR_MINUTO = 60_000;

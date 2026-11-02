import { esbocoDeFotos, type AreaUtil, type FotoNaParede } from '@deco-wall/domain';
import { cn } from '../../../lib/utils';

// Esboço de uma variante em SVG (A-15; docs/specs/M3-variantes-templates-e-salvamento.md §4.7): a caixa da parede
// com um retângulo por foto. Sem Konva e sem imagens; igual nos cartões do conflito, da recuperação e dos templates.
// Foto = `sand` com contorno `line`; placeholder = `danger-tint` tracejado.

const LADO_MAXIMO = 240;

export function EsbocoVariante({
  fotos,
  caixaCm,
  rotulo,
  decorativo = false,
  className,
}: {
  fotos: readonly FotoNaParede[];
  caixaCm: AreaUtil;
  rotulo: string;
  // Nos cartões que já têm nome (templates), o esboço só enfeita: some para o leitor de tela.
  decorativo?: boolean;
  className?: string;
}) {
  // viewBox em 0 a LADO_MAXIMO no maior lado: a proporção da caixa se mantém.
  const razao = caixaCm.larguraCm / caixaCm.alturaCm;
  const largura = razao >= 1 ? LADO_MAXIMO : LADO_MAXIMO * razao;
  const altura = razao >= 1 ? LADO_MAXIMO / razao : LADO_MAXIMO;
  const retangulos = esbocoDeFotos(fotos, caixaCm);

  return (
    <svg
      role={decorativo ? undefined : 'img'}
      aria-label={decorativo ? undefined : rotulo}
      aria-hidden={decorativo ? true : undefined}
      viewBox={`0 0 ${largura} ${altura}`}
      className={cn('w-full rounded-md bg-paper', className)}
    >
      <rect width={largura} height={altura} className="fill-paper stroke-line-soft" strokeWidth={1} />
      {retangulos.map((r, i) => (
        <rect
          key={i}
          data-tipo={r.tipo}
          x={r.x * largura}
          y={r.y * altura}
          width={r.w * largura}
          height={r.h * altura}
          className={r.tipo === 'placeholder' ? 'fill-danger-tint stroke-danger' : 'fill-sand stroke-line'}
          strokeWidth={1}
          strokeDasharray={r.tipo === 'placeholder' ? '4 3' : undefined}
        />
      ))}
    </svg>
  );
}

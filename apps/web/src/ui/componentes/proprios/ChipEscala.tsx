import { formatarEscala } from '@deco-wall/domain';

// DESIGN §6: chip "sand", raio 6, mono 12 px ("4,0 px/cm").
export function ChipEscala({ pxPorCm }: { pxPorCm: number }) {
  return (
    <span className="inline-flex items-center rounded-sm bg-sand px-2 py-1 text-medida whitespace-nowrap text-ink-2">
      {formatarEscala(pxPorCm)}
    </span>
  );
}

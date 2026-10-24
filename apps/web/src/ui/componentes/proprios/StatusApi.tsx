import { useEffect, useState } from 'react';
import { buscarSaude, type Saude } from '../../../infra/api';
import { cn } from '../../../lib/utils';

// Indicador de status consumindo /api/saude (docs/specs/M0-setup.md §5.4). Texto e cor, nunca só cor.
type Estado = { tipo: 'carregando' } | { tipo: 'erro' } | { tipo: 'ok'; saude: Saude };

const ROTULOS: { chave: 'api' | 'mongo' | 'pasta'; nome: string }[] = [
  { chave: 'api', nome: 'API' },
  { chave: 'mongo', nome: 'MongoDB' },
  { chave: 'pasta', nome: 'Pasta de fotos' },
];

export function StatusApi() {
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });

  useEffect(() => {
    let ativo = true;
    buscarSaude()
      .then((saude) => ativo && setEstado({ tipo: 'ok', saude }))
      .catch(() => ativo && setEstado({ tipo: 'erro' }));
    return () => {
      ativo = false;
    };
  }, []);

  if (estado.tipo === 'carregando') {
    return <span className="text-body-sm text-ink-3">Verificando serviços…</span>;
  }
  if (estado.tipo === 'erro') {
    return (
      <span role="status" className="text-body-sm text-danger-ink">
        Servidor local indisponível
      </span>
    );
  }

  return (
    <ul aria-label="Estado dos serviços locais" className="flex items-center gap-4 text-body-sm text-ink-2">
      {ROTULOS.map(({ chave, nome }) => {
        const resultado = estado.saude[chave];
        return (
          <li key={chave} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cn('size-[7px] rounded-full', resultado === 'ok' ? 'bg-success' : 'bg-danger')}
            />
            <span>
              {nome}: <span className={resultado === 'ok' ? '' : 'text-danger-ink'}>{resultado}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

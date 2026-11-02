import { describe, expect, it } from 'vitest';
import { estadoDeSalvamento, rascunhoDesatualizado, rascunhoElegivel, rascunhoObsoleto } from './salvamento';

// Estado de salvamento (A-06, SV-08) e rascunho (M3-08, §4.6; docs/specs/M3-variantes-templates-e-salvamento.md).

const t = (hora: string) => new Date(`2026-11-02T${hora}:00-03:00`);

const base = {
  conflito: false,
  salvando: false,
  sujoOficial: false,
  sujoRascunho: false,
  salvoEm: t('10:00'),
  rascunhoEm: undefined as Date | undefined,
};

describe('estadoDeSalvamento — prioridade (A-06)', () => {
  it('conflito vence tudo', () => {
    expect(
      estadoDeSalvamento({ ...base, conflito: true, salvando: true, sujoOficial: true, sujoRascunho: true }),
    ).toEqual({ tipo: 'conflito' });
  });

  it('salvando vem depois do conflito', () => {
    expect(estadoDeSalvamento({ ...base, salvando: true, sujoOficial: true, sujoRascunho: true })).toEqual({
      tipo: 'salvando',
    });
  });

  it('difere da oficial e mudou depois do último rascunho: "Alterações não salvas"', () => {
    expect(
      estadoDeSalvamento({ ...base, sujoOficial: true, sujoRascunho: true, rascunhoEm: t('10:05') }),
    ).toEqual({ tipo: 'alteracoes' });
  });

  it('difere da oficial e nada mudou depois do rascunho: "Rascunho salvo às hh:mm"', () => {
    const rascunhoEm = t('10:05');
    expect(estadoDeSalvamento({ ...base, sujoOficial: true, sujoRascunho: false, rascunhoEm })).toEqual({
      tipo: 'rascunho',
      em: rascunhoEm,
    });
  });

  it('igual à oficial: "Salvo às hh:mm" com a hora do último salvamento', () => {
    expect(estadoDeSalvamento(base)).toEqual({ tipo: 'salvo', em: base.salvoEm });
  });

  it('sem hora de salvamento (estado recém-aberto): "Salvo" sem hora', () => {
    expect(estadoDeSalvamento({ ...base, salvoEm: undefined })).toEqual({ tipo: 'salvo', em: undefined });
  });

  it('voltar por desfazer ao conteúdo oficial vale "Salvo", ainda que exista rascunho (M2 A-26)', () => {
    expect(
      estadoDeSalvamento({ ...base, sujoOficial: false, sujoRascunho: true, rascunhoEm: t('10:05') }),
    ).toEqual({
      tipo: 'salvo',
      em: base.salvoEm,
    });
  });

  it('difere da oficial, sem nenhum rascunho: "Alterações não salvas"', () => {
    expect(estadoDeSalvamento({ ...base, sujoOficial: true, sujoRascunho: false })).toEqual({
      tipo: 'alteracoes',
    });
  });
});

describe('rascunhoElegivel (M3-08, §4.6)', () => {
  const variante = { salvaEm: t('10:00') };
  const r = (id: string, hora: string) => ({ id, salvoEm: t(hora) });

  it('o mais recente com salvoEm maior que a salvaEm da variante', () => {
    expect(rascunhoElegivel(variante, [r('a', '10:05'), r('b', '10:20'), r('c', '10:10')])?.id).toBe('b');
  });

  it('rascunho igual ou mais velho que a versão oficial não é elegível', () => {
    expect(rascunhoElegivel(variante, [r('a', '10:00'), r('b', '09:00')])).toBeNull();
  });

  it('sem rascunhos: null', () => {
    expect(rascunhoElegivel(variante, [])).toBeNull();
  });
});

describe('rascunhoDesatualizado / rascunhoObsoleto (§4.6)', () => {
  it('desatualizado: revisaoBase menor que a revisão oficial', () => {
    expect(rascunhoDesatualizado({ revisaoBase: 2 }, { revisao: 3 })).toBe(true);
    expect(rascunhoDesatualizado({ revisaoBase: 3 }, { revisao: 3 })).toBe(false);
  });

  it('obsoleto: salvoEm menor ou igual à salvaEm da variante', () => {
    expect(rascunhoObsoleto({ salvoEm: t('10:00') }, t('10:00'))).toBe(true);
    expect(rascunhoObsoleto({ salvoEm: t('09:59') }, t('10:00'))).toBe(true);
    expect(rascunhoObsoleto({ salvoEm: t('10:01') }, t('10:00'))).toBe(false);
  });
});

import { tamanhoSugerido, type FotoNaParede } from '@deco-wall/domain';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ImagemDto } from '../../infra/dto';
import { TooltipProvider } from '../componentes/ui/tooltip';
import { PainelFoto, type PropsPainelFoto } from './PainelFoto';

// Painel da foto selecionada (spec M2 §3.4; RF-60, RN-02, RN-05, RN-28, RN-36; protótipo 03).

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(cleanup);

const hex = (n: number) => n.toString(16).padStart(24, '0');

const FOTO: FotoNaParede = {
  _id: hex(10),
  imagemId: hex(1),
  imagemAnteriorId: null,
  tamanho: tamanhoSugerido('20x30'),
  xCm: 112.5,
  yCm: 40,
  recorte: { offsetX: 0, offsetY: 0 },
  borda: { larguraCm: 2, cor: '#FFFFFF' },
};

const IMAGEM: ImagemDto = {
  _id: hex(1),
  nomeOriginal: 'IMG_2041.jpg',
  perfil: 'leve',
  larguraPx: 600,
  alturaPx: 800,
  orientacaoNatural: 'retrato',
  bytes: 1,
  arquivos: { render: 'r', thumb: 't' },
  mime: 'image/webp',
  criadaEm: '2026-10-25T12:00:00.000Z',
  projetos: [],
  excluidaEm: null,
  purgaEm: null,
  schemaVersion: 1,
};

function montar(sobrescrita: Partial<PropsPainelFoto> = {}) {
  const props: PropsPainelFoto = {
    foto: FOTO,
    imagem: IMAGEM,
    onTrocarTamanho: vi.fn(),
    onTrocarOrientacao: vi.fn(),
    onAlterarBorda: vi.fn(),
    onMover: vi.fn(),
    onAjustarRecorte: vi.fn(),
    onPersonalizado: vi.fn(),
    onDuplicar: vi.fn(),
    onRemover: vi.fn(),
    ...sobrescrita,
  };
  render(
    <TooltipProvider>
      <PainelFoto {...props} />
    </TooltipProvider>,
  );
  return props;
}

const campo = (nome: string) => screen.getByLabelText(nome, { selector: 'input' }) as HTMLInputElement;

describe('cabeçalho e resumo', () => {
  it('nome da imagem e a orientação natural da imagem', () => {
    montar();
    expect(screen.getByText('IMG_2041.jpg')).toBeTruthy();
    expect(screen.getByText('Retrato natural')).toBeTruthy();
  });

  it('imagem fora da biblioteca: "Imagem indisponível"', () => {
    montar({ imagem: undefined });
    expect(screen.getByText('Imagem indisponível')).toBeTruthy();
  });

  it('tamanho no gatilho, tamanho externo e posição com vírgula decimal (RN-02, DS-02)', () => {
    montar();
    expect(screen.getByRole('combobox', { name: 'Tamanho' }).textContent).toContain('20 × 30');
    expect(screen.getByText('24,0 × 34,0 cm')).toBeTruthy(); // 20 × 30 com borda de 2 cm
    expect(campo('X').value).toBe('112,5');
    expect(campo('Y').value).toBe('40,0');
    expect(campo('Largura da borda').value).toBe('2,0');
  });

  it('tamanho personalizado aparece com 1 casa decimal', () => {
    montar({ foto: { ...FOTO, tamanho: { sugeridoId: null, larguraCm: 21, alturaCm: 29.7 } } });
    expect(screen.getByRole('combobox', { name: 'Tamanho' }).textContent).toContain('21,0 × 29,7');
  });
});

describe('orientação (RN-05, RN-28)', () => {
  it('retrato marcado e troca para paisagem', () => {
    const props = montar();
    expect(screen.getByRole('radio', { name: 'Retrato' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: 'Paisagem' }));
    expect(props.onTrocarOrientacao).toHaveBeenCalledWith('paisagem');
  });

  it('tamanho quadrado: orientação inativa', () => {
    montar({ foto: { ...FOTO, tamanho: tamanhoSugerido('13x13') } });
    expect((screen.getByRole('radio', { name: 'Retrato' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('radio', { name: 'Paisagem' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('campos (B-04)', () => {
  it('borda aplica em Enter', () => {
    const props = montar();
    fireEvent.change(campo('Largura da borda'), { target: { value: '3,5' } });
    fireEvent.keyDown(campo('Largura da borda'), { key: 'Enter' });
    expect(props.onAlterarBorda).toHaveBeenCalledWith({ larguraCm: 3.5 });
  });

  it('borda fora de 0 a 20 cm mostra a faixa e não aplica', () => {
    const props = montar();
    fireEvent.change(campo('Largura da borda'), { target: { value: '21' } });
    fireEvent.keyDown(campo('Largura da borda'), { key: 'Enter' });
    expect(screen.getByText('Entre 0,0 e 20,0 cm.')).toBeTruthy();
    expect(props.onAlterarBorda).not.toHaveBeenCalled();
  });

  it('texto que não é número: pede um número em cm', () => {
    const props = montar();
    fireEvent.change(campo('X'), { target: { value: 'abc' } });
    fireEvent.keyDown(campo('X'), { key: 'Enter' });
    expect(screen.getByText('Digite um número em cm.')).toBeTruthy();
    expect(props.onMover).not.toHaveBeenCalled();
  });

  it('X e Y aceitam negativos e aplicam ao sair do campo, mantendo o outro eixo', () => {
    const props = montar();
    fireEvent.change(campo('X'), { target: { value: '-7,5' } });
    fireEvent.blur(campo('X'));
    expect(props.onMover).toHaveBeenCalledWith(-7.5, 40);
    fireEvent.change(campo('Y'), { target: { value: '12' } });
    fireEvent.keyDown(campo('Y'), { key: 'Enter' });
    expect(props.onMover).toHaveBeenLastCalledWith(112.5, 12);
  });

  it('o campo acompanha a foto quando ela muda por fora (desfazer, arrastar)', () => {
    const { rerender } = render(
      <TooltipProvider>
        <PainelFoto {...baseProps()} />
      </TooltipProvider>,
    );
    expect((screen.getAllByLabelText('X', { selector: 'input' })[0] as HTMLInputElement).value).toBe('112,5');
    rerender(
      <TooltipProvider>
        <PainelFoto {...baseProps({ foto: { ...FOTO, xCm: 50 } })} />
      </TooltipProvider>,
    );
    expect((screen.getAllByLabelText('X', { selector: 'input' })[0] as HTMLInputElement).value).toBe('50,0');
  });
});

function baseProps(sobrescrita: Partial<PropsPainelFoto> = {}): PropsPainelFoto {
  return {
    foto: FOTO,
    imagem: IMAGEM,
    onTrocarTamanho: vi.fn(),
    onTrocarOrientacao: vi.fn(),
    onAlterarBorda: vi.fn(),
    onMover: vi.fn(),
    onAjustarRecorte: vi.fn(),
    onPersonalizado: vi.fn(),
    onDuplicar: vi.fn(),
    onRemover: vi.fn(),
    ...sobrescrita,
  };
}

describe('alertas e ações', () => {
  it('mostra o texto de cada alerta da foto (RN-11, RN-12, RN-34)', () => {
    montar({ alertas: { sobreposicao: true, fora: 'parede' } });
    expect(screen.getByText('Esta foto passa dos limites da parede.')).toBeTruthy();
    expect(screen.getByText('Esta foto sobrepõe outra na parede.')).toBeTruthy();
  });

  it('fora da área útil tem texto próprio; sem alerta, sem caixa', () => {
    montar({ alertas: { sobreposicao: false, fora: 'area-util' } });
    expect(screen.getByText('Esta foto passa dos limites da área útil.')).toBeTruthy();
    cleanup();
    montar({ alertas: { sobreposicao: false, fora: null } });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('Ajustar recorte, Duplicar e Remover chamam as ações', () => {
    const props = montar();
    fireEvent.click(screen.getByRole('button', { name: 'Ajustar recorte' }));
    fireEvent.click(screen.getByRole('button', { name: 'Duplicar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
    expect(props.onAjustarRecorte).toHaveBeenCalledTimes(1);
    expect(props.onDuplicar).toHaveBeenCalledTimes(1);
    expect(props.onRemover).toHaveBeenCalledTimes(1);
  });
});

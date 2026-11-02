import { tamanhoSugerido, type FotoNaParede } from '@deco-wall/domain';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ImagemDto } from '../../infra/dto';
import { TooltipProvider } from '../componentes/ui/tooltip';
import { PainelFoto, type PropsPainelFoto } from './PainelFoto';

// Painel da foto selecionada (spec M2 §3.4; RF-60, RN-02, RN-05, RN-28; protótipo 03).

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
    onPreencher: vi.fn(),
    podePreencher: false,
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
    expect(screen.getByRole('combobox', { name: 'Tamanho' }).textContent).toBe('20 × 30 cm'); // A-10
    expect(screen.getByText('24,0 × 34,0 cm')).toBeTruthy(); // 20 × 30 com borda de 2 cm
    expect(campo('X').value).toBe('112,5');
    expect(campo('Y').value).toBe('40,0');
    expect(campo('Largura da borda').value).toBe('2,0');
  });

  it('tamanho personalizado aparece com 1 casa decimal', () => {
    montar({ foto: { ...FOTO, tamanho: { sugeridoId: null, larguraCm: 21, alturaCm: 29.7 } } });
    expect(screen.getByRole('combobox', { name: 'Tamanho' }).textContent).toBe('21,0 × 29,7 cm');
  });
});

describe('orientação (RN-05, RN-28)', () => {
  it('retrato marcado e troca para paisagem', () => {
    const props = montar();
    expect(screen.getByRole('radio', { name: 'Retrato' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: 'Paisagem' }));
    expect(props.onTrocarOrientacao).toHaveBeenCalledWith('paisagem');
  });

  it('tamanho quadrado: orientação inativa, com o tooltip "Quadrado: sem orientação" (A-10)', async () => {
    montar({ foto: { ...FOTO, tamanho: tamanhoSugerido('13x13') } });
    expect((screen.getByRole('radio', { name: 'Retrato' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('radio', { name: 'Paisagem' }) as HTMLButtonElement).disabled).toBe(true);
    const grupo = screen.getByRole('radiogroup', { name: 'Orientação' });
    fireEvent.pointerMove(grupo.parentElement!, { pointerType: 'mouse' });
    fireEvent.pointerMove(grupo, { pointerType: 'mouse' });
    expect((await screen.findAllByText('Quadrado: sem orientação')).length).toBeGreaterThan(0);
  });

  it('de um quadrado para um sugerido, a orientação vem da imagem; do contrário, mantém a atual (A-10)', () => {
    const props = montar({ foto: { ...FOTO, tamanho: tamanhoSugerido('13x13') } });
    fireEvent.click(screen.getByRole('combobox', { name: 'Tamanho' }));
    fireEvent.click(screen.getByRole('option', { name: '20 × 30 cm' }));
    // Imagem retrato → retrato (largura 20, altura 30)
    expect(props.onTrocarTamanho).toHaveBeenCalledWith(tamanhoSugerido('20x30', 'retrato'));
  });
});

describe('campos (A-09)', () => {
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

  it('Esc restaura o valor do campo sem aplicar (A-09)', () => {
    const props = montar();
    fireEvent.change(campo('X'), { target: { value: '99' } });
    fireEvent.keyDown(campo('X'), { key: 'Escape' });
    expect(campo('X').value).toBe('112,5');
    expect(props.onMover).not.toHaveBeenCalled();
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
    onPreencher: vi.fn(),
    podePreencher: false,
    ...sobrescrita,
  };
}

describe('alertas e ações', () => {
  it('mostra o texto de cada alerta da foto (RN-11, RN-12, RN-34, A-15)', () => {
    montar({ alertas: { sobreposicao: true, fora: 'parede' } });
    expect(screen.getByText('Esta foto está fora da parede.')).toBeTruthy();
    expect(screen.getByText('Esta foto sobrepõe outra na parede.')).toBeTruthy();
  });

  it('fora da área útil tem texto próprio; sem alerta, sem caixa', () => {
    montar({ alertas: { sobreposicao: false, fora: 'area-util' } });
    expect(screen.getByText('Esta foto está fora da área útil.')).toBeTruthy();
    cleanup();
    montar({ alertas: { sobreposicao: false, fora: null } });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('"Remover" tem o tooltip que diz que a imagem continua na biblioteca (M2-04)', async () => {
    montar();
    act(() => screen.getByRole('button', { name: 'Remover' }).focus());
    expect(
      (await screen.findAllByText('Tira a foto desta variante. A imagem continua na biblioteca.')).length,
    ).toBeGreaterThan(0);
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

describe('placeholder (M2-06, A-15)', () => {
  const PLACEHOLDER: FotoNaParede = { ...FOTO, imagemId: null };

  it('cabeçalho "Sem foto" com o ícone de imagem cortada', () => {
    montar({ foto: PLACEHOLDER, imagem: undefined });
    expect(screen.getByText('Sem foto')).toBeTruthy();
    expect(screen.queryByText('Imagem indisponível')).toBeNull();
    expect(screen.getByTestId('icone-sem-foto')).toBeTruthy();
  });

  it('"Ajustar recorte" fica inativo, com o tooltip "Sem imagem para enquadrar."', async () => {
    const props = montar({ foto: PLACEHOLDER, imagem: undefined });
    const botao = screen.getByRole('button', { name: 'Ajustar recorte' });
    expect(botao.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(botao);
    expect(props.onAjustarRecorte).not.toHaveBeenCalled();
    act(() => botao.focus());
    expect((await screen.findAllByText('Sem imagem para enquadrar.')).length).toBeGreaterThan(0);
  });

  it('"Preencher com a foto selecionada" usa a miniatura da biblioteca (M3-01, A-23)', () => {
    const props = montar({ foto: PLACEHOLDER, imagem: undefined, podePreencher: true });
    const botao = screen.getByRole('button', { name: 'Preencher com a foto selecionada' });
    expect(botao.getAttribute('aria-disabled')).toBeNull();
    fireEvent.click(botao);
    expect(props.onPreencher).toHaveBeenCalledTimes(1);
  });

  it('sem miniatura selecionada, o botão fica inativo com o motivo', async () => {
    const props = montar({ foto: PLACEHOLDER, imagem: undefined, podePreencher: false });
    const botao = screen.getByRole('button', { name: 'Preencher com a foto selecionada' });
    expect(botao.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(botao);
    expect(props.onPreencher).not.toHaveBeenCalled();
    act(() => botao.focus());
    expect((await screen.findAllByText('Selecione uma foto na biblioteca.')).length).toBeGreaterThan(0);
  });

  it('foto com imagem não mostra o botão de preencher', () => {
    montar({ podePreencher: true });
    expect(screen.queryByRole('button', { name: 'Preencher com a foto selecionada' })).toBeNull();
  });

  it('tamanho, orientação, borda, posição, Duplicar e Remover continuam ativos', () => {
    const props = montar({ foto: PLACEHOLDER, imagem: undefined });
    fireEvent.click(screen.getByRole('radio', { name: 'Paisagem' }));
    expect(props.onTrocarOrientacao).toHaveBeenCalledWith('paisagem');
    fireEvent.click(screen.getByRole('button', { name: 'Duplicar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
    expect(props.onDuplicar).toHaveBeenCalled();
    expect(props.onRemover).toHaveBeenCalled();
  });
});

describe('placeholder: foto anterior restaurada (RF-30a, M4-08, A-08)', () => {
  const VAGA: FotoNaParede = { ...FOTO, imagemId: null, imagemAnteriorId: hex(1) };

  it('com recomendação, mostra o card com o nome do arquivo e as ações Usar e Escolher outra', () => {
    const props = montar({
      foto: VAGA,
      imagem: undefined,
      recomendada: IMAGEM,
      onUsarAnterior: vi.fn(),
      onEscolherOutra: vi.fn(),
    });
    expect(screen.getByText('Foto anterior, restaurada')).toBeTruthy();
    expect(screen.getByText('IMG_2041.jpg')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Usar' }));
    expect(props.onUsarAnterior).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Escolher outra na biblioteca' }));
    expect(props.onEscolherOutra).toHaveBeenCalledTimes(1);
  });

  it('o card vem acima de "Preencher com a foto selecionada", que continua como está', () => {
    montar({
      foto: VAGA,
      imagem: undefined,
      recomendada: IMAGEM,
      onUsarAnterior: vi.fn(),
      onEscolherOutra: vi.fn(),
    });
    const card = screen.getByText('Foto anterior, restaurada');
    const preencher = screen.getByText('Preencher com a foto selecionada');
    expect(card.compareDocumentPosition(preencher) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('sem recomendação (imagem anterior excluída ou purgada), o card não aparece', () => {
    montar({ foto: VAGA, imagem: undefined });
    expect(screen.queryByText('Foto anterior, restaurada')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Usar' })).toBeNull();
    expect(screen.getByText('Preencher com a foto selecionada')).toBeTruthy();
  });

  it('foto com imagem nunca mostra o card', () => {
    montar({ recomendada: IMAGEM, onUsarAnterior: vi.fn(), onEscolherOutra: vi.fn() });
    expect(screen.queryByText('Foto anterior, restaurada')).toBeNull();
  });
});

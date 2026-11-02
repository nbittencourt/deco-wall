/// <reference lib="dom" />
import { dirname } from 'node:path';
import { expect, test } from '@playwright/test';
import {
  caminhoImagem,
  criarProjetoComEscalaLinear,
  enviarImagem,
  nomeUnico,
  type ImagemE2E,
} from './ajudantes';

// Biblioteca e upload em lote (spec M2 §3.1, §3.2, §7; RF-20 a RF-22, RF-25, RF-27, RF-28, RN-20; PRD aceite 9 e 10).

async function listarImagens(request: import('@playwright/test').APIRequestContext) {
  return (await (await request.get('/api/imagens')).json()) as (ImagemE2E & { larguraPx: number })[];
}

test.describe('upload em lote (RF-20, RF-21, DV-10, A-17, A-18)', () => {
  test('perfil → fila → enviar: concluídas, falha listada e ignorados contados; persiste ao recarregar', async ({
    page,
    request,
  }) => {
    const p = await criarProjetoComEscalaLinear(request, nomeUnico('Upload'));
    const antes = (await listarImagens(request)).length;
    await page.goto(`/projetos/${p.id}`);

    await page.getByRole('button', { name: 'Carregar fotos' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Carregar fotos' });
    await expect(dialogo).toBeVisible();

    // O perfil é escolhido antes de enviar e é definitivo (RF-25): Médio nesta fila.
    await dialogo.getByRole('radio', { name: /Médio/ }).click();

    await dialogo.getByTestId('entrada-arquivos').setInputFiles([
      caminhoImagem('retrato.jpg'),
      caminhoImagem('paisagem.jpg'),
      caminhoImagem('texto-invalido.jpg'), // extensão .jpg, mas o conteúdo não é imagem: o servidor recusa
      caminhoImagem('documento.heic'), // formato não suportado: ignorado antes de enviar (RN-20, RF-15)
    ]);

    // Escolher os arquivos já inicia o envio (A-17); o inválido por formato vai para a lista com o motivo.
    await expect(dialogo.getByText('1 arquivo ignorado por formato')).toBeVisible();
    await expect(dialogo.getByText('Formato não suportado', { exact: true })).toBeVisible();
    await expect(dialogo.getByRole('button', { name: /^Enviar \d/ })).toHaveCount(0);
    await expect(dialogo.getByText('2 de 3 enviadas')).toBeVisible({ timeout: 20_000 });
    // O servidor recusa o que não é imagem (415): sem "Tentar de novo".
    await expect(dialogo.getByText('Não foi possível ler a imagem.')).toBeVisible();
    await expect(dialogo.getByRole('button', { name: 'Tentar de novo' })).toHaveCount(0);
    await expect(dialogo.getByText(/^Concluída/)).toHaveCount(2);
    // A qualidade continua travada com o lote terminado, enquanto o diálogo está aberto.
    await expect(dialogo.getByRole('radio', { name: /Leve/ })).toBeDisabled();

    await dialogo.getByRole('button', { name: 'Concluir' }).click();
    await expect(dialogo).toBeHidden();

    // As duas entram na biblioteca já no perfil escolhido, com nome e orientação (RF-22).
    // A biblioteca é global e o banco de teste acumula imagens: as mais recentes vêm primeiro.
    await expect(page.getByRole('button', { name: 'retrato.jpg, Retrato' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'paisagem.jpg, Paisagem' }).first()).toBeVisible();
    const depois = await listarImagens(request);
    expect(depois.length).toBe(antes + 2);
    expect(depois.slice(0, 2).map((i) => i.perfil)).toEqual(['medio', 'medio']);

    await page.reload();
    await expect(page.getByRole('button', { name: 'retrato.jpg, Retrato' }).first()).toBeVisible();
  });

  test('arquivos soltos aguardam o "Enviar"; cancelar não grava nada; a mesma foto duas vezes são duas imagens (RN-25)', async ({
    page,
    request,
  }) => {
    const p = await criarProjetoComEscalaLinear(request, nomeUnico('Upload 2'));
    const antes = (await listarImagens(request)).length;
    await page.goto(`/projetos/${p.id}`);
    const biblioteca = page.getByRole('complementary', { name: 'Biblioteca' });
    const dialogo = page.getByRole('dialog', { name: 'Carregar fotos' });

    const dataTransfer = await page.evaluateHandle(() => {
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array(10)], 'solta.jpg', { type: 'image/jpeg' }));
      return dt;
    });
    await biblioteca.dispatchEvent('dragover', { dataTransfer });
    await biblioteca.dispatchEvent('drop', { dataTransfer });
    await expect(dialogo.getByText('Aguardando')).toBeVisible();
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogo).toBeHidden();
    expect((await listarImagens(request)).length).toBe(antes);

    for (let i = 0; i < 2; i++) {
      await page.getByRole('button', { name: 'Carregar fotos' }).click();
      await dialogo.getByTestId('entrada-arquivos').setInputFiles([caminhoImagem('quadrada.jpg')]);
      await expect(dialogo.getByText('1 de 1 enviadas')).toBeVisible({ timeout: 15_000 });
      await dialogo.getByRole('button', { name: 'Concluir' }).click();
    }
    expect((await listarImagens(request)).length).toBe(antes + 2);
  });

  test('"Selecionar pasta" envia os arquivos da pasta, ignorando os que não são imagem (RF-20, RN-20)', async ({
    page,
    request,
  }) => {
    const p = await criarProjetoComEscalaLinear(request, nomeUnico('Pasta'));
    await page.goto(`/projetos/${p.id}`);
    await page.getByRole('button', { name: 'Carregar fotos' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Carregar fotos' });
    // A pasta das fixtures tem 7 arquivos com extensão de imagem (um deles é texto renomeado) e 1 HEIC (RN-20).
    await dialogo.getByTestId('entrada-pasta').setInputFiles(dirname(caminhoImagem('retrato.jpg')));
    await expect(dialogo.getByText('1 arquivo ignorado por formato')).toBeVisible();
    await expect(dialogo.getByText('6 de 7 enviadas')).toBeVisible({ timeout: 40_000 });
    await expect(dialogo.getByRole('button', { name: 'Concluir' })).toBeVisible();
  });

  test('soltar arquivos sobre a coluna abre o diálogo com os arquivos aguardando o "Enviar" (A-17)', async ({
    page,
    request,
  }) => {
    const p = await criarProjetoComEscalaLinear(request, nomeUnico('Soltar'));
    await page.goto(`/projetos/${p.id}`);
    const biblioteca = page.getByRole('complementary', { name: 'Biblioteca' });

    // Arrasto de arquivos do sistema simulado com um DataTransfer real no navegador.
    const dataTransfer = await page.evaluateHandle(() => {
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array(10)], 'solta.jpg', { type: 'image/jpeg' }));
      return dt;
    });
    await biblioteca.dispatchEvent('dragover', { dataTransfer });
    await biblioteca.dispatchEvent('drop', { dataTransfer });

    const dialogo = page.getByRole('dialog', { name: 'Carregar fotos' });
    await expect(dialogo).toBeVisible();
    await expect(dialogo.getByText('solta.jpg')).toBeVisible();
    await expect(dialogo.getByText('Aguardando')).toBeVisible();
    await expect(dialogo.getByRole('button', { name: 'Enviar 1 foto' })).toBeVisible();
  });
});

test.describe('biblioteca global e filtros (RF-27, RF-28, PRD aceite 10)', () => {
  test('imagem carregada no projeto A aparece na biblioteca do projeto B; "Projeto" separa as do projeto', async ({
    page,
    request,
  }) => {
    const a = await criarProjetoComEscalaLinear(request, nomeUnico('Projeto A'));
    const b = await criarProjetoComEscalaLinear(request, nomeUnico('Projeto B'));
    const deA = await enviarImagem(request, a.id, 'paisagem.jpg');
    expect(deA.projetos).toEqual([a.id]);

    await page.goto(`/projetos/${b.id}`);
    await expect(page.getByRole('button', { name: 'paisagem.jpg, Paisagem' }).first()).toBeVisible();

    // Filtro "Projeto": a imagem do projeto A não é do B (carregada em outro e não usada aqui).
    const naBiblioteca = page.getByRole('complementary', { name: 'Biblioteca' });
    await naBiblioteca.getByRole('radio', { name: 'Projeto' }).click();
    await expect(naBiblioteca.getByText('Nenhuma foto neste projeto ainda.')).toBeVisible();

    // Os filtros mostram só o estado salvo (M2-05): adicionada e não salva, a foto ainda não é do projeto.
    await naBiblioteca.getByRole('radio', { name: 'Todas' }).click();
    await naBiblioteca.getByRole('button', { name: 'paisagem.jpg, Paisagem' }).first().click();
    await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
    await naBiblioteca.getByRole('radio', { name: 'Variante' }).click();
    await expect(naBiblioteca.getByText('Nenhuma foto salva nesta variante ainda.')).toBeVisible();

    // Depois do Salvar, a biblioteca recarrega: a imagem passa a ser "do projeto" e "da variante".
    await page.keyboard.press('Control+s');
    await expect(page.getByText(/Salvo às \d{2}:\d{2}/)).toBeVisible();
    await expect(naBiblioteca.getByRole('button', { name: 'paisagem.jpg, Paisagem' })).toHaveCount(1);
    await naBiblioteca.getByRole('radio', { name: 'Projeto' }).click();
    await expect(naBiblioteca.getByRole('button', { name: 'paisagem.jpg, Paisagem' })).toHaveCount(1);
  });

  test('a busca segue inativa (RF-33c) e "Excluídas" ficou ativa no M4 (A-07)', async ({ page, request }) => {
    const p = await criarProjetoComEscalaLinear(request, nomeUnico('Inativos'));
    await page.goto(`/projetos/${p.id}`);
    await expect(page.getByLabel('Buscar por nome')).toHaveAttribute('aria-disabled', 'true');
    await page.getByRole('button', { name: 'Mais filtros' }).click();
    await expect(page.getByRole('menuitem', { name: 'Excluídas' })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  test('sem escala: "Carregar fotos" ativo, miniaturas sem arrastar e o texto da biblioteca (A-20, §3.1)', async ({
    page,
    request,
  }) => {
    const res = await request.post('/api/projetos', { data: { nome: nomeUnico('Sem escala') } });
    const { projeto } = (await res.json()) as { projeto: { _id: string } };
    await page.goto(`/projetos/${projeto._id}`);
    await expect(page.getByRole('button', { name: 'Carregar fotos' })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await expect(page.getByText('Defina a escala da parede para colocar fotos nela.')).toBeVisible();
    await page.getByRole('button', { name: 'Carregar fotos' }).click();
    await expect(page.getByRole('dialog', { name: 'Carregar fotos' })).toBeVisible();
  });
});

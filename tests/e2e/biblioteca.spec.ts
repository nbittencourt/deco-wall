/// <reference lib="dom" />
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

test.describe('upload em lote (RF-20, RF-21, DV-10, M2-07)', () => {
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

    await expect(dialogo.getByText('1 arquivo ignorado por formato')).toBeVisible();
    await expect(dialogo.getByText('Aguardando')).toHaveCount(3);
    // Nada foi enviado ainda (M2-07).
    expect((await listarImagens(request)).length).toBe(antes);

    await dialogo.getByRole('button', { name: 'Enviar 3 fotos' }).click();
    await expect(dialogo.getByText('2 de 3 enviadas')).toBeVisible({ timeout: 20_000 });
    await expect(dialogo.getByText('Falhou: Formato não suportado. Use JPG, PNG ou WEBP.')).toBeVisible();
    await expect(dialogo.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
    await expect(dialogo.getByText('Concluída')).toHaveCount(2);

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

  test('cancelar a fila antes de enviar não grava nada; a mesma foto duas vezes são duas imagens (RN-25)', async ({
    page,
    request,
  }) => {
    const p = await criarProjetoComEscalaLinear(request, nomeUnico('Upload 2'));
    const antes = (await listarImagens(request)).length;
    await page.goto(`/projetos/${p.id}`);

    await page.getByRole('button', { name: 'Carregar fotos' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Carregar fotos' });
    await dialogo.getByTestId('entrada-arquivos').setInputFiles([caminhoImagem('quadrada.jpg')]);
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogo).toBeHidden();
    expect((await listarImagens(request)).length).toBe(antes);

    for (let i = 0; i < 2; i++) {
      await page.getByRole('button', { name: 'Carregar fotos' }).click();
      await dialogo.getByTestId('entrada-arquivos').setInputFiles([caminhoImagem('quadrada.jpg')]);
      await dialogo.getByRole('button', { name: 'Enviar 1 foto' }).click();
      await expect(dialogo.getByText('1 de 1 enviadas')).toBeVisible({ timeout: 15_000 });
      await dialogo.getByRole('button', { name: 'Concluir' }).click();
    }
    expect((await listarImagens(request)).length).toBe(antes + 2);
  });

  test('soltar arquivos sobre a coluna abre o diálogo com a fila pronta', async ({ page, request }) => {
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
    await expect(naBiblioteca.getByText('Nenhuma foto neste filtro.')).toBeVisible();

    // Usada numa foto da variante aberta (mesmo sem salvar), passa a ser "do projeto" e "da variante".
    await naBiblioteca.getByRole('radio', { name: 'Todas' }).click();
    await naBiblioteca.getByRole('button', { name: 'paisagem.jpg, Paisagem' }).first().dblclick();
    await naBiblioteca.getByRole('radio', { name: 'Variante' }).click();
    await expect(naBiblioteca.getByRole('button', { name: 'paisagem.jpg, Paisagem' })).toHaveCount(1);
    await naBiblioteca.getByRole('radio', { name: 'Projeto' }).click();
    await expect(naBiblioteca.getByRole('button', { name: 'paisagem.jpg, Paisagem' })).toHaveCount(1);
  });

  test('"Excluídas" e a busca seguem visíveis e inativas (M4 e RF-33c)', async ({ page, request }) => {
    const p = await criarProjetoComEscalaLinear(request, nomeUnico('Inativos'));
    await page.goto(`/projetos/${p.id}`);
    await expect(page.getByLabel('Buscar por nome')).toHaveAttribute('aria-disabled', 'true');
    await page.getByRole('button', { name: 'Mais filtros' }).click();
    await expect(page.getByRole('menuitem', { name: 'Excluídas' })).toHaveAttribute('aria-disabled', 'true');
  });

  test('sem escala: "Carregar fotos" inativo e a biblioteca avisa (M2-01)', async ({ page, request }) => {
    const res = await request.post('/api/projetos', { data: { nome: nomeUnico('Sem escala') } });
    const { projeto } = (await res.json()) as { projeto: { _id: string } };
    await page.goto(`/projetos/${projeto._id}`);
    await expect(page.getByRole('button', { name: 'Carregar fotos' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await expect(
      page.getByText('As fotos ficam disponíveis depois que a escala da parede for definida.'),
    ).toBeVisible();
  });
});

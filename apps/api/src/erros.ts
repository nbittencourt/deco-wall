// Erros de negócio da API. Os serviços lançam ErroHttp; o handler do app responde `{ erro }` em pt-BR
// (ou o corpo próprio, como no 409 do salvamento da variante).
export class ErroHttp extends Error {
  readonly status: number;
  readonly corpo: unknown;

  constructor(status: number, mensagem: string, corpo?: unknown) {
    super(mensagem);
    this.name = 'ErroHttp';
    this.status = status;
    this.corpo = corpo ?? { erro: mensagem };
  }
}

export const naoEncontrado = (mensagem = 'Projeto não encontrado.') => new ErroHttp(404, mensagem);

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ErroConfiguracao, lerConfig } from './config';

const minimo = {
  PASTA_FOTOS: 'C:\\fotos',
  MONGODB_URI: 'mongodb://localhost:27017/parede-fotos',
};

describe('lerConfig (ADR-11, §5.3)', () => {
  it('aplica padrões: AUTOSAVE_MINUTOS 5, UPLOAD_MAX_MB 50, portas 3001/5173', () => {
    const c = lerConfig(minimo);
    expect(c).toMatchObject({
      pastaFotos: 'C:\\fotos',
      mongoUri: minimo.MONGODB_URI,
      apiPort: 3001,
      webPort: 5173,
      autosaveMinutos: 5,
      uploadMaxMb: 50,
    });
  });

  it('converte valores numéricos do ambiente para número', () => {
    const c = lerConfig({
      ...minimo,
      API_PORT: '4000',
      WEB_PORT: '5174',
      AUTOSAVE_MINUTOS: '10',
      UPLOAD_MAX_MB: '20',
    });
    expect(c).toMatchObject({ apiPort: 4000, webPort: 5174, autosaveMinutos: 10, uploadMaxMb: 20 });
  });

  it('aceita AUTOSAVE_MINUTOS fracionário e positivo', () => {
    expect(lerConfig({ ...minimo, AUTOSAVE_MINUTOS: '0.5' }).autosaveMinutos).toBe(0.5);
  });

  it('API escuta sempre em 127.0.0.1 (RNF-01)', () => {
    expect(lerConfig(minimo).hostApi).toBe('127.0.0.1');
  });

  it('exige PASTA_FOTOS com mensagem clara', () => {
    expect(() => lerConfig({ MONGODB_URI: minimo.MONGODB_URI })).toThrow(/PASTA_FOTOS/);
  });

  it('lança ErroConfiguracao com a lista de mensagens', () => {
    try {
      lerConfig({ MONGODB_URI: minimo.MONGODB_URI });
      expect.unreachable();
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroConfiguracao);
      expect((erro as ErroConfiguracao).mensagens.some((m) => m.includes('PASTA_FOTOS'))).toBe(true);
    }
  });

  it('rejeita MONGODB_URI que não começa com mongodb:// ou mongodb+srv://', () => {
    expect(() => lerConfig({ ...minimo, MONGODB_URI: 'http://localhost:27017' })).toThrow(/MONGODB_URI/);
  });

  it.each(['abc', '0', '-5'])('rejeita AUTOSAVE_MINUTOS inválido: %s', (valor) => {
    expect(() => lerConfig({ ...minimo, AUTOSAVE_MINUTOS: valor })).toThrow(/AUTOSAVE_MINUTOS/);
  });

  it.each(['x', '0', '-50'])('rejeita UPLOAD_MAX_MB inválido: %s', (valor) => {
    expect(() => lerConfig({ ...minimo, UPLOAD_MAX_MB: valor })).toThrow(/UPLOAD_MAX_MB/);
  });

  it.each(['3.5', '0', '70000', 'abc'])('rejeita API_PORT inválida: %s', (valor) => {
    expect(() => lerConfig({ ...minimo, API_PORT: valor })).toThrow(/API_PORT/);
  });

  it('rejeita WEB_PORT não numérica', () => {
    expect(() => lerConfig({ ...minimo, WEB_PORT: 'abc' })).toThrow(/WEB_PORT/);
  });

  it('reúne todos os erros de uma vez', () => {
    try {
      lerConfig({ AUTOSAVE_MINUTOS: 'x', API_PORT: '0' });
      expect.unreachable();
    } catch (erro) {
      const mensagens = (erro as ErroConfiguracao).mensagens;
      expect(mensagens.length).toBeGreaterThanOrEqual(3);
      expect(mensagens.join('\n')).toMatch(/PASTA_FOTOS/);
      expect(mensagens.join('\n')).toMatch(/AUTOSAVE_MINUTOS/);
      expect(mensagens.join('\n')).toMatch(/API_PORT/);
    }
  });
});

describe('.env.example (ADR-11)', () => {
  it('lista todas as variáveis da ADR-11', () => {
    const conteudo = readFileSync(new URL('../../../.env.example', import.meta.url), 'utf8');
    for (const chave of [
      'PASTA_FOTOS',
      'MONGODB_URI',
      'API_PORT',
      'WEB_PORT',
      'AUTOSAVE_MINUTOS',
      'UPLOAD_MAX_MB',
    ]) {
      expect(conteudo).toMatch(new RegExp(`^${chave}=`, 'm'));
    }
  });
});

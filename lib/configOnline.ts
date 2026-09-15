import fs from "node:fs/promises";
import path from "node:path";

/**
 * Conexão com a planilha do Google (ID + credencial da conta de serviço) —
 * cadastrada pelo usuário na tela de Configurações, não por variável de
 * ambiente. Fica num arquivo à parte, fora do Estado normal (que é a mesma
 * coisa gravada na planilha do Google): guardar a credencial dentro do que
 * é sincronizado com o Google seria círculo vicioso (e vazaria a chave
 * privada pra quem só tem acesso de leitura à planilha).
 */

export const CAMINHO_CONFIG_ONLINE =
  process.env.CONFIG_ONLINE ?? path.join(process.cwd(), "dados", "conexao-google.json");

export interface CredenciaisGoogle {
  client_email: string;
  private_key: string;
}

export interface ConfiguracaoOnline {
  planilhaId: string;
  credenciais: CredenciaisGoogle | null;
}

const VAZIA: ConfiguracaoOnline = { planilhaId: "", credenciais: null };

export async function lerConfiguracaoOnline(): Promise<ConfiguracaoOnline> {
  let texto: string;
  try {
    texto = await fs.readFile(/*turbopackIgnore: true*/ CAMINHO_CONFIG_ONLINE, "utf-8");
  } catch {
    return VAZIA;
  }
  try {
    const json = JSON.parse(texto) as Partial<ConfiguracaoOnline>;
    return {
      planilhaId: json.planilhaId ?? "",
      credenciais: json.credenciais?.client_email && json.credenciais?.private_key
        ? json.credenciais
        : null,
    };
  } catch {
    return VAZIA;
  }
}

export async function gravarConfiguracaoOnline(config: ConfiguracaoOnline): Promise<void> {
  await fs.mkdir(path.dirname(CAMINHO_CONFIG_ONLINE), { recursive: true });
  await fs.writeFile(CAMINHO_CONFIG_ONLINE, JSON.stringify(config, null, 2), "utf-8");
}

/** Só o necessário pra mostrar na tela — nunca a chave privada de volta ao navegador. */
export async function statusConfiguracaoOnline(): Promise<{
  planilhaId: string;
  clientEmail: string;
  configurado: boolean;
}> {
  const cfg = await lerConfiguracaoOnline();
  return {
    planilhaId: cfg.planilhaId,
    clientEmail: cfg.credenciais?.client_email ?? "",
    configurado: Boolean(cfg.planilhaId && cfg.credenciais),
  };
}

import crypto from "node:crypto";
import { lerConfiguracaoOnline } from "./configOnline";

/**
 * Cliente mínimo da API do Google Sheets (v4), autenticado com uma conta de
 * serviço. Sem dependências externas: o JWT é assinado com o `crypto` do
 * próprio Node. O ID da planilha e a credencial vêm da tela de
 * Configurações (lib/configOnline.ts), não de variável de ambiente.
 */

const base64Url = (base64: string) => base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

let tokenCache: { valor: string; expiraEm: number; assinatura: string } | null = null;

/** Chamado depois de salvar uma nova credencial, pra não usar um token velho. */
export function invalidarTokenCache(): void {
  tokenCache = null;
}

async function obterToken(): Promise<string> {
  const { credenciais } = await lerConfiguracaoOnline();
  if (!credenciais)
    throw new Error(
      "Nenhuma credencial do Google cadastrada — configure em Configurações → Planilha do Google."
    );
  const { client_email, private_key } = credenciais;
  const assinaturaCredencial = client_email; // troca de conta invalida o cache sozinha

  if (
    tokenCache &&
    tokenCache.assinatura === assinaturaCredencial &&
    tokenCache.expiraEm > Date.now() + 30_000
  )
    return tokenCache.valor;

  const agora = Math.floor(Date.now() / 1000);
  const cabecalho = base64Url(Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64"));
  const corpo = base64Url(
    Buffer.from(
      JSON.stringify({
        iss: client_email,
        scope: "https://www.googleapis.com/auth/spreadsheets",
        aud: "https://oauth2.googleapis.com/token",
        iat: agora,
        exp: agora + 3600,
      })
    ).toString("base64")
  );
  const assinatura = base64Url(
    crypto.createSign("RSA-SHA256").update(`${cabecalho}.${corpo}`).sign(private_key, "base64")
  );
  const jwt = `${cabecalho}.${corpo}.${assinatura}`;

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
    cache: "no-store",
  });
  const json = (await r.json()) as {
    access_token?: string; expires_in?: number; error?: string; error_description?: string;
  };
  if (!r.ok || !json.access_token)
    throw new Error(
      `Não foi possível autenticar com o Google (${json.error ?? r.status}): ${
        json.error_description ?? "verifique a credencial e se a Sheets API está habilitada."
      }`
    );

  tokenCache = {
    valor: json.access_token,
    expiraEm: Date.now() + (json.expires_in ?? 3600) * 1000,
    assinatura: assinaturaCredencial,
  };
  return tokenCache.valor;
}

async function chamar(caminho: string, opcoes: RequestInit = {}): Promise<unknown> {
  const { planilhaId } = await lerConfiguracaoOnline();
  if (!planilhaId)
    throw new Error(
      "Nenhuma planilha do Google cadastrada — configure em Configurações → Planilha do Google."
    );
  const token = await obterToken();
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${planilhaId}${caminho}`, {
    ...opcoes,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...opcoes.headers,
    },
    cache: "no-store",
  });
  if (!r.ok) {
    const corpo = await r.text();
    throw new Error(`Google Sheets recusou a operação (HTTP ${r.status}): ${corpo.slice(0, 400)}`);
  }
  const texto = await r.text();
  return texto ? JSON.parse(texto) : {};
}

/* -------------------------------------------------------------- planilha */

export async function listarAbasExistentes(): Promise<string[]> {
  const json = (await chamar("?fields=sheets.properties.title")) as {
    sheets: { properties: { title: string } }[];
  };
  return json.sheets.map((s) => s.properties.title);
}

export async function criarAbas(titulos: string[]): Promise<void> {
  if (!titulos.length) return;
  await chamar(":batchUpdate", {
    method: "POST",
    body: JSON.stringify({
      requests: titulos.map((titulo) => ({ addSheet: { properties: { title: titulo } } })),
    }),
  });
}

/** Lê várias abas de uma vez (uma chamada só à API), na ordem pedida. */
export async function lerVariasAbas(intervalos: string[]): Promise<unknown[][][]> {
  const params = intervalos.map((r) => `ranges=${encodeURIComponent(r)}`).join("&");
  const json = (await chamar(`/values:batchGet?${params}&valueRenderOption=UNFORMATTED_VALUE`)) as {
    valueRanges: { values?: unknown[][] }[];
  };
  return json.valueRanges.map((v) => v.values ?? []);
}

/** Apaga o conteúdo de várias abas de uma vez. */
export async function limparVariasAbas(intervalos: string[]): Promise<void> {
  if (!intervalos.length) return;
  await chamar("/values:batchClear", {
    method: "POST",
    body: JSON.stringify({ ranges: intervalos }),
  });
}

/** Escreve em várias abas de uma vez. Valores nativos (RAW): sem autoformatação do Sheets. */
export async function escreverVariasAbas(
  dados: { intervalo: string; valores: (string | number)[][] }[]
): Promise<void> {
  const data = dados.filter((d) => d.valores.length).map((d) => ({ range: d.intervalo, values: d.valores }));
  if (!data.length) return;
  await chamar("/values:batchUpdate", {
    method: "POST",
    body: JSON.stringify({ valueInputOption: "RAW", data }),
  });
}

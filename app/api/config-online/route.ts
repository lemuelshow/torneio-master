import { NextResponse } from "next/server";
import {
  gravarConfiguracaoOnline, lerConfiguracaoOnline, statusConfiguracaoOnline,
  type CredenciaisGoogle,
} from "@/lib/configOnline";
import { invalidarTokenCache, listarAbasExistentes } from "@/lib/googleSheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Status atual (sem nunca devolver a chave privada ao navegador). */
export async function GET() {
  const status = await statusConfiguracaoOnline();
  return NextResponse.json(status);
}

/** Salva o ID da planilha + a credencial colada, e testa a conexão. */
export async function POST(request: Request) {
  let corpo: { planilhaId?: unknown; credenciaisJson?: unknown };
  try {
    corpo = (await request.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  const planilhaId = String(corpo.planilhaId ?? "").trim();
  const credenciaisTexto = String(corpo.credenciaisJson ?? "").trim();

  if (!planilhaId)
    return NextResponse.json({ erro: "Informe o ID da planilha do Google." }, { status: 400 });

  let credenciais: CredenciaisGoogle | null;
  if (credenciaisTexto) {
    let json: Partial<CredenciaisGoogle>;
    try {
      json = JSON.parse(credenciaisTexto) as Partial<CredenciaisGoogle>;
    } catch {
      return NextResponse.json(
        { erro: "O conteúdo colado não é um JSON válido — cole o arquivo .json inteiro, sem alterar nada." },
        { status: 400 }
      );
    }
    if (!json.client_email || !json.private_key)
      return NextResponse.json(
        { erro: "Esse JSON não parece ser a credencial certa — falta client_email ou private_key." },
        { status: 400 }
      );
    credenciais = { client_email: json.client_email, private_key: json.private_key };
  } else {
    // sem credencial nova colada: mantém a que já estava salva (permite só trocar o ID)
    credenciais = (await lerConfiguracaoOnline()).credenciais;
    if (!credenciais)
      return NextResponse.json(
        { erro: "Cole o conteúdo do arquivo de credenciais (.json) da conta de serviço." },
        { status: 400 }
      );
  }

  await gravarConfiguracaoOnline({ planilhaId, credenciais });
  invalidarTokenCache();

  try {
    const abas = await listarAbasExistentes();
    return NextResponse.json({
      ok: true,
      mensagem: "Conectado com sucesso à planilha do Google.",
      abas,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      erro:
        e instanceof Error
          ? `Salvo, mas a conexão falhou: ${e.message}`
          : "Salvo, mas não foi possível confirmar a conexão.",
    });
  }
}

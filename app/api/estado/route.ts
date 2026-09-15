import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { CAMINHO_PLANILHA, erroDeArmazenamento, lerEstado } from "@/lib/armazenamento";
import { COOKIE_OFFLINE } from "@/lib/constantes";
import { categoriasAtivas } from "@/lib/regras";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const offline = (await cookies()).get(COOKIE_OFFLINE)?.value === "1";
  try {
    const estado = await lerEstado(offline);
    return NextResponse.json({
      estado,
      categorias: categoriasAtivas(estado.config),
      planilha: CAMINHO_PLANILHA,
      offline,
    });
  } catch (e) {
    return NextResponse.json({ erro: erroDeArmazenamento(e, offline) }, { status: 500 });
  }
}

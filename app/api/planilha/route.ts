import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { erroDeArmazenamento, lerEstado } from "@/lib/armazenamento";
import { COOKIE_OFFLINE } from "@/lib/constantes";
import { montarWorkbook } from "@/lib/excel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Baixa um .xlsx com os dados atuais — do arquivo local ou da planilha do Google, conforme o modo. */
export async function GET() {
  const offline = (await cookies()).get(COOKIE_OFFLINE)?.value === "1";
  try {
    const estado = await lerEstado(offline);
    const wb = await montarWorkbook(estado);
    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="torneio-futevolei.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ erro: erroDeArmazenamento(e, offline) }, { status: 500 });
  }
}

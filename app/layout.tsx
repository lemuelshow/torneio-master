import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { CAMINHO_PLANILHA, erroDeArmazenamento, lerEstado } from "@/lib/armazenamento";
import { COOKIE_OFFLINE } from "@/lib/constantes";
import { configPadrao } from "@/lib/excel";
import { categoriasAtivas } from "@/lib/regras";
import { ProvedorDados } from "@/lib/cliente";
import { Shell } from "@/components/Shell";
import type { Estado } from "@/lib/tipos";

export const metadata: Metadata = {
  title: "Futevôlei Master Brasil — gestão de torneios",
  description:
    "Campeonatos, atletas, sorteios, classificação, súmulas e chave final, com a planilha Excel como banco de dados.",
};

// o estado é lido a cada requisição — nada de dado congelado no build
export const dynamic = "force-dynamic";

const estadoVazio = (): Estado => ({
  config: configPadrao(),
  atletas: [],
  campeonatos: [],
  participantes: [],
  grupos: [],
  jogos: [],
  duplas: [],
  mataMata: [],
});

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const offline = cookieStore.get(COOKIE_OFFLINE)?.value === "1";

  let estado: Estado;
  let erro = "";
  try {
    estado = await lerEstado(offline);
  } catch (e) {
    erro = erroDeArmazenamento(e, offline);
    estado = estadoVazio();
  }

  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <ProvedorDados
          inicial={{
            estado,
            categorias: categoriasAtivas(estado.config),
            planilha: CAMINHO_PLANILHA,
            offline,
            erro,
          }}
        >
          <Shell>{children}</Shell>
        </ProvedorDados>
      </body>
    </html>
  );
}

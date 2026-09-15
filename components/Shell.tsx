"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  Download, FileSpreadsheet, RefreshCw, Settings, Trophy, Users, Wallet,
  Wifi, WifiOff,
} from "lucide-react";
import { useDados } from "@/lib/cliente";
import { Alerta, cx } from "@/components/ui";
import { Escudo, FaixaBandeira } from "@/components/Marca";

const NAV = [
  { href: "/", rotulo: "Torneios", icone: Trophy, grupo: "Competições" },
  { href: "/financeiro", rotulo: "Financeiro", icone: Wallet, grupo: "Competições" },
  { href: "/atletas", rotulo: "Base de atletas", icone: Users, grupo: "Cadastro" },
  { href: "/config", rotulo: "Configurações", icone: Settings, grupo: "Sistema" },
];

const GRUPOS = ["Competições", "Cadastro", "Sistema"];

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const {
    erro, avisos, salvando, estado, planilha, limparMensagens,
    offline, alternarOffline, sincronizando, mensagemSincronizacao, sincronizar,
  } = useDados();

  const ativo = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="min-h-screen bg-plane">
      {/* ------------------------------------------------ painel lateral */}
      <aside className="painel-marinho nao-imprime fixed inset-y-0 left-0 z-30 hidden w-64 flex-col text-white lg:flex">
        <div className="flex flex-col items-center gap-2 px-4 pb-4 pt-5">
          <Escudo tamanho={112} prioridade />
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-marinho-200">
            Gestão do torneio
          </p>
        </div>
        <FaixaBandeira />

        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
          {GRUPOS.map((grupo) => {
            const itens = NAV.filter((i) => i.grupo === grupo);
            if (!itens.length) return null;
            return (
              <div key={grupo}>
                <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-marinho-300/80">
                  {grupo}
                </p>
                <div className="space-y-0.5">
                  {itens.map((item) => {
                    const Icone = item.icone;
                    const on = ativo(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cx(
                          "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                          on
                            ? "bg-white/12 text-white shadow-[inset_2px_0_0_0_var(--color-ouro-500)]"
                            : "text-marinho-100/85 hover:bg-white/8 hover:text-white"
                        )}
                      >
                        <Icone
                          className={cx("size-4", on ? "text-ouro-500" : "text-marinho-200")}
                        />
                        {item.rotulo}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <a
            href="/api/planilha"
            className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-white/16"
          >
            <Download className="size-4 text-ouro-500" />
            Baixar planilha
          </a>
          <p
            className="mt-2 flex items-center gap-1.5 text-[10px] text-marinho-200/70"
            title={offline ? planilha : "Planilha do Google (modo online)"}
          >
            <FileSpreadsheet className="size-3 shrink-0" />
            <span className="truncate">
              {offline
                ? planilha
                  ? planilha.replace(/^.*[\\/]/, "")
                  : "torneio.xlsx"
                : "Planilha do Google"}
            </span>
          </p>
        </div>
      </aside>

      {/* ----------------------------------------------------- conteúdo */}
      <div className="lg:pl-64">
        <header className="nao-imprime sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
            <span className="lg:hidden">
              <Escudo tamanho={38} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-bold tracking-tight text-marinho-800">
                {estado.config.organizacao}
              </p>
              <p className="hidden text-[11px] text-ink-3 sm:block">
                Gestão de torneios ·{" "}
                {offline ? "banco de dados no arquivo Excel local" : "banco de dados na planilha do Google"}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {salvando && (
                <span className="hidden items-center gap-2 rounded-full bg-marinho-50 px-3 py-1 text-[12px] font-medium text-marinho-700 sm:flex">
                  <span className="size-1.5 animate-pulse rounded-full bg-ouro-500" />
                  gravando na planilha…
                </span>
              )}
              {!salvando && mensagemSincronizacao && (
                <span className="hidden items-center gap-1.5 rounded-full bg-verde-100 px-3 py-1 text-[12px] font-medium text-verde-700 sm:flex">
                  {mensagemSincronizacao}
                </span>
              )}
              <button
                type="button"
                onClick={alternarOffline}
                title={
                  offline
                    ? "Modo offline: os dados ficam só no arquivo Excel local (não sincroniza com o Google)."
                    : "Modo online: lê e grava direto na planilha do Google — compartilhada entre PCs."
                }
                className={cx(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors",
                  offline
                    ? "border-marinho-300 bg-marinho-50 text-marinho-700"
                    : "border-line bg-surface text-ink-2 hover:bg-plane"
                )}
              >
                {offline ? <WifiOff className="size-3.5" /> : <Wifi className="size-3.5" />}
                <span className="hidden sm:inline">Utilizar offline</span>
              </button>
              <button
                type="button"
                onClick={sincronizar}
                disabled={sincronizando}
                title={
                  offline
                    ? "Reler o arquivo Excel local"
                    : "Buscar os dados mais recentes da planilha do Google (o que outro PC gravou, por exemplo)"
                }
                className="flex items-center gap-1.5 rounded-full border border-marinho-600 bg-marinho-600 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-marinho-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className={cx("size-3.5", sincronizando && "animate-spin")} />
                <span className="hidden sm:inline">
                  {sincronizando ? "Sincronizando…" : "Sincronizar"}
                </span>
              </button>
            </div>
          </div>
          <FaixaBandeira />
        </header>

        <nav className="nao-imprime border-b border-line bg-surface px-4 py-2 lg:hidden">
          <div className="scroll-x flex gap-1.5 overflow-x-auto">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cx(
                  "shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-medium",
                  ativo(item.href)
                    ? "border-marinho-600 bg-marinho-600 text-white"
                    : "border-line text-ink-2"
                )}
              >
                {item.rotulo}
              </Link>
            ))}
          </div>
        </nav>

        <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
          {erro && (
            <div className="nao-imprime surge mb-4">
              <Alerta tom="erro">
                <div className="flex items-start justify-between gap-3">
                  <span>{erro}</span>
                  <button
                    onClick={limparMensagens}
                    className="shrink-0 text-[12px] underline"
                  >
                    fechar
                  </button>
                </div>
              </Alerta>
            </div>
          )}

          {avisos.length > 0 && (
            <div className="nao-imprime surge mb-4">
              <Alerta tom="alerta">
                <div className="flex items-start justify-between gap-3">
                  <ul className="list-disc space-y-0.5 pl-4">
                    {avisos.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                  <button
                    onClick={limparMensagens}
                    className="shrink-0 text-[12px] underline"
                  >
                    fechar
                  </button>
                </div>
              </Alerta>
            </div>
          )}

          {children}
        </main>
      </div>
    </div>
  );
}

"use client";

import {
  createContext, useCallback, useContext, useMemo, useState,
  type ReactNode,
} from "react";
import type { Estado, LinhaClassificacao, ParticipanteCalculado } from "./tipos";
import { categoriasAtivas, classificar, participantesDo } from "./regras";
import { COOKIE_OFFLINE } from "./constantes";

interface Resposta {
  estado: Estado;
  categorias?: string[];
  planilha?: string;
  avisos?: string[];
  erro?: string;
  offline?: boolean;
}

interface Ctx {
  salvando: boolean;
  erro: string;
  avisos: string[];
  estado: Estado;
  categorias: string[];
  planilha: string;
  nomeDe: (atletaId: string) => string;
  participantesDe: (campeonatoId: string) => ParticipanteCalculado[];
  classificacaoDe: (campeonatoId: string) => LinhaClassificacao[];
  recarregar: () => Promise<boolean>;
  executar: (acao: string, dados?: Record<string, unknown>) => Promise<boolean>;
  limparMensagens: () => void;
  offline: boolean;
  alternarOffline: () => Promise<void>;
  sincronizando: boolean;
  mensagemSincronizacao: string;
  sincronizar: () => Promise<void>;
}

const Contexto = createContext<Ctx | null>(null);

/**
 * O estado inicial vem do servidor: o layout lê a fonte certa (planilha do
 * Google, ou o arquivo local no modo offline) e passa por props. Sem fetch
 * no primeiro render e sem divergir na hidratação.
 */
export function ProvedorDados({
  inicial,
  children,
}: {
  inicial: Resposta;
  children: ReactNode;
}) {
  const [dados, setDados] = useState<Resposta>(inicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(inicial.erro ?? "");
  const [avisos, setAvisos] = useState<string[]>([]);
  const [offline, setOffline] = useState(inicial.offline ?? false);
  const [sincronizando, setSincronizando] = useState(false);
  const [mensagemSincronizacao, setMensagemSincronizacao] = useState("");

  const recarregar = useCallback(async (): Promise<boolean> => {
    try {
      const r = await fetch("/api/estado", { cache: "no-store" });
      const json = (await r.json()) as Resposta;
      if (!r.ok) {
        setErro(json.erro ?? "Falha ao ler os dados.");
        return false;
      }
      setDados(json);
      setOffline(json.offline ?? false);
      setErro("");
      return true;
    } catch {
      setErro("Não foi possível falar com o servidor local.");
      return false;
    }
  }, []);

  const executar = useCallback(
    async (acao: string, extra: Record<string, unknown> = {}) => {
      setSalvando(true);
      setErro("");
      setAvisos([]);
      try {
        const r = await fetch("/api/acao", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ acao, ...extra }),
        });
        const json = (await r.json()) as Resposta & { ok?: boolean };
        if (!r.ok || !json.ok) {
          setErro(json.erro ?? "A operação falhou.");
          return false;
        }
        setDados((anterior) => ({ ...anterior, estado: json.estado }));
        setAvisos(json.avisos ?? []);
        return true;
      } catch {
        setErro("Não foi possível falar com o servidor local.");
        return false;
      } finally {
        setSalvando(false);
      }
    },
    []
  );

  /** Busca de novo o estado da fonte atual — útil pra ver o que outro PC gravou. */
  const sincronizar = useCallback(async () => {
    setSincronizando(true);
    setErro("");
    setAvisos([]);
    setMensagemSincronizacao("");
    const ok = await recarregar();
    if (ok) setMensagemSincronizacao("Dados atualizados.");
    setSincronizando(false);
  }, [recarregar]);

  /** Troca a fonte (planilha do Google / arquivo local) e recarrega a partir dela. */
  const alternarOffline = useCallback(async () => {
    const novo = !offline;
    document.cookie = `${COOKIE_OFFLINE}=${novo ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
    setOffline(novo);
    setMensagemSincronizacao("");
    setErro("");
    setAvisos([]);
    await recarregar();
  }, [offline, recarregar]);

  const estado = dados.estado;

  const nomes = useMemo(
    () => new Map(estado.atletas.map((a) => [a.id, a.nome])),
    [estado.atletas]
  );

  const valor: Ctx = {
    salvando,
    erro,
    avisos,
    estado,
    categorias: categoriasAtivas(estado.config),
    planilha: dados.planilha ?? "",
    nomeDe: (id) => nomes.get(id) ?? id,
    participantesDe: (campeonatoId) => participantesDo(estado, campeonatoId),
    classificacaoDe: (campeonatoId) => classificar(estado, campeonatoId),
    recarregar,
    executar,
    limparMensagens: () => {
      setErro("");
      setAvisos([]);
      setMensagemSincronizacao("");
    },
    offline,
    alternarOffline,
    sincronizando,
    mensagemSincronizacao,
    sincronizar,
  };

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useDados() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useDados precisa estar dentro de <ProvedorDados>");
  return ctx;
}

/* ------------------------------------------------------------ formatação */

export const dataBr = (iso: string) => {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  return a && m && d ? `${d}/${m}/${a}` : iso;
};

export const dinheiro = (v: number) =>
  (Number.isFinite(v) ? v : 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export const ROTULO_LADO: Record<string, string> = {
  D: "Destro",
  E: "Esquerdo",
  Ambos: "Ambos",
};

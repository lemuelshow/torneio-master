"use client";

import { useState } from "react";
import type {
  ButtonHTMLAttributes, InputHTMLAttributes, ReactNode,
  SelectHTMLAttributes, TextareaHTMLAttributes,
} from "react";
import { ChevronLeft, ChevronRight, Tag } from "lucide-react";

export const cx = (...v: (string | false | null | undefined)[]) =>
  v.filter(Boolean).join(" ");

/* ------------------------------------------------------------------ Card */

export function Card({
  children,
  className,
  padding = true,
}: {
  children: ReactNode;
  className?: string;
  padding?: boolean;
}) {
  return (
    <div
      className={cx(
        "rounded-xl border border-line bg-surface shadow-[0_1px_2px_0_rgba(13,21,38,0.04)]",
        padding && "p-4",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Titulo({
  children,
  dica,
  acao,
}: {
  children: ReactNode;
  dica?: ReactNode;
  acao?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-[15px] font-bold tracking-tight text-marinho-800">
          {children}
        </h2>
        {dica ? <p className="mt-0.5 text-[13px] text-ink-2">{dica}</p> : null}
      </div>
      {acao}
    </div>
  );
}

export function Cabecalho({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-marinho-800 sm:text-2xl">
          {titulo}
        </h1>
        {descricao && <p className="mt-1 text-[13px] text-ink-2">{descricao}</p>}
        <span aria-hidden className="mt-2 block h-[3px] w-12 rounded-full bg-ouro-500" />
      </div>
      {acao}
    </div>
  );
}

/* ---------------------------------------------------------------- Botões */

type Variante = "primario" | "secundario" | "fantasma" | "perigo" | "ouro" | "verde";

const VARIANTES: Record<Variante, string> = {
  primario: "bg-marinho-600 text-white hover:bg-marinho-700 border-transparent",
  secundario: "bg-surface text-marinho-800 hover:bg-marinho-50 border-line",
  fantasma: "bg-transparent text-ink-2 hover:bg-plane border-transparent",
  perigo:
    "bg-surface text-[var(--color-erro)] border-[color-mix(in_oklab,var(--color-erro)_35%,white)] hover:bg-[color-mix(in_oklab,var(--color-erro)_8%,white)]",
  ouro: "bg-ouro-500 text-marinho-900 hover:bg-ouro-600 border-transparent",
  verde: "bg-verde-500 text-white hover:bg-verde-600 border-transparent",
};

export function Botao({
  children,
  variante = "primario",
  pequeno,
  bloco,
  className,
  ...rest
}: {
  variante?: Variante;
  pequeno?: boolean;
  bloco?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cx(
        "inline-flex select-none items-center justify-center gap-2 rounded-lg border font-semibold transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marinho-500",
        "disabled:cursor-not-allowed disabled:opacity-50",
        pequeno ? "h-9 px-3 text-[13px]" : "h-11 px-4 text-sm",
        VARIANTES[variante],
        bloco && "w-full",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------- Campos */

// sem w-full aqui: quem manda na largura é o contexto. Dentro de <Campo> os
// controles ocupam 100%; fora dele (tabelas, chaves) cada um define a sua.
const base =
  "rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-3 transition-colors focus:border-marinho-400 focus:outline-none focus:ring-4 focus:ring-marinho-500/12 disabled:bg-plane";

export function Campo({
  rotulo,
  dica,
  children,
  className,
}: {
  rotulo?: string;
  dica?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cx(
        "block [&_input]:w-full [&_select]:w-full [&_textarea]:w-full",
        className
      )}
    >
      {rotulo && (
        <span className="mb-1 block text-[12px] font-semibold text-marinho-700">
          {rotulo}
        </span>
      )}
      {children}
      {dica && <span className="mt-1 block text-[11px] text-ink-3">{dica}</span>}
    </label>
  );
}

export const Entrada = ({
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) => (
  <input className={cx(base, "h-10", className)} {...rest} />
);

export const Selecao = ({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select className={cx(base, "h-10", className)} {...rest}>
    {children}
  </select>
);

export const Area = ({
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea className={cx(base, "min-h-20 py-2", className)} {...rest} />
);

/* ----------------------------------------------------------------- Selos */

export function Selo({
  tom = "neutro",
  children,
}: {
  tom?: "neutro" | "ok" | "alerta" | "erro" | "info" | "ouro" | "prata";
  children: ReactNode;
}) {
  const tons: Record<string, string> = {
    neutro: "bg-plane text-ink-2 border-line",
    ok: "bg-verde-100 text-verde-700 border-[color-mix(in_oklab,var(--color-verde-500)_28%,white)]",
    alerta:
      "bg-[color-mix(in_oklab,var(--color-alerta)_12%,white)] text-[var(--color-alerta)] border-[color-mix(in_oklab,var(--color-alerta)_30%,white)]",
    erro: "bg-[color-mix(in_oklab,var(--color-erro)_10%,white)] text-[var(--color-erro)] border-[color-mix(in_oklab,var(--color-erro)_28%,white)]",
    info: "bg-marinho-50 text-marinho-700 border-marinho-200",
    ouro: "bg-ouro-100 text-ouro-700 border-ouro-300",
    prata: "bg-plane text-ink-2 border-[#c3cbd9]",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-tight",
        tons[tom]
      )}
    >
      {children}
    </span>
  );
}

export function Vazio({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-marinho-200 bg-surface px-6 py-10 text-center">
      <p className="text-sm font-bold text-marinho-800">{titulo}</p>
      {descricao && <p className="max-w-md text-[13px] text-ink-2">{descricao}</p>}
      {acao}
    </div>
  );
}

export function Tabela({
  colunas,
  children,
  minimo = 640,
}: {
  colunas: string[];
  children: ReactNode;
  minimo?: number;
}) {
  return (
    <div className="scroll-x overflow-x-auto">
      <table className="w-full text-left text-[13px]" style={{ minWidth: minimo }}>
        <thead className="bg-marinho-50 text-[11px] uppercase tracking-wide text-marinho-700">
          <tr>
            {colunas.map((c, i) => (
              <th key={`${i}-${c}`} className="px-3 py-2 font-bold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

/* ----------------------------------------------------------------- Abas */

/**
 * Guarda qual aba está selecionada, voltando pra primeira sozinho quando a
 * atual some da lista (ex.: categoria sem mais participantes).
 */
export function useAbaSelecionada(chaves: string[], padrao?: string): [string, (v: string) => void] {
  const [selecionada, setSelecionada] = useState(padrao ?? chaves[0] ?? "");
  if (chaves.length && !chaves.includes(selecionada)) {
    const proxima = padrao && chaves.includes(padrao) ? padrao : chaves[0];
    setSelecionada(proxima);
    return [proxima, setSelecionada];
  }
  return [selecionada, setSelecionada];
}

export function Abas({
  itens,
  selecionada,
  aoSelecionar,
}: {
  itens: { chave: string; rotulo: ReactNode; contagem?: number }[];
  selecionada: string;
  aoSelecionar: (chave: string) => void;
}) {
  if (itens.length <= 1) return null;
  return (
    <div className="scroll-x overflow-x-auto">
      <div className="flex min-w-max gap-1.5 pb-1">
        {itens.map((item) => {
          const ativa = item.chave === selecionada;
          return (
            <button
              key={item.chave}
              type="button"
              onClick={() => aoSelecionar(item.chave)}
              className={cx(
                "shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors",
                ativa
                  ? "border-marinho-600 bg-marinho-600 text-white"
                  : "border-line bg-surface text-ink-2 hover:border-marinho-300"
              )}
            >
              {item.rotulo}
              {item.contagem !== undefined && (
                <span className={cx("ml-1.5", ativa ? "text-marinho-100" : "text-ink-3")}>
                  {item.contagem}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Deixa explícito qual categoria está selecionada nas abas acima — útil em
 * telas com várias categorias e conteúdo longo, onde as abas somem ao rolar.
 */
export function IndicadorCategoria({ categoria }: { categoria: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border-2 border-marinho-700 bg-marinho-600 px-4 py-3 shadow-sm">
      <Tag className="size-6 shrink-0 text-ouro-400" />
      <span className="text-[13px] font-semibold uppercase tracking-wide text-marinho-100">
        Categoria selecionada
      </span>
      <span className="text-xl font-extrabold tracking-tight text-white">{categoria}</span>
    </div>
  );
}

/* ------------------------------------------------------------ Paginação */

/**
 * Fatia uma lista já filtrada/ordenada em páginas. `chaveReset` é qualquer
 * valor que, ao mudar (ex.: o texto de uma busca), volta pra página 1 —
 * sem isso o usuário poderia ficar preso numa página vazia depois de filtrar.
 */
export function usePaginacao<T>(itens: T[], porPagina: number, chaveReset?: unknown) {
  const [pagina, setPagina] = useState(1);
  const [chaveAnterior, setChaveAnterior] = useState(chaveReset);

  if (chaveReset !== chaveAnterior) {
    setChaveAnterior(chaveReset);
    if (pagina !== 1) setPagina(1);
  }

  const total = itens.length;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const paginaEfetiva = Math.min(Math.max(1, pagina), totalPaginas);
  const inicio = (paginaEfetiva - 1) * porPagina;
  const itensDaPagina = itens.slice(inicio, inicio + porPagina);

  return {
    itensDaPagina,
    pagina: paginaEfetiva,
    totalPaginas,
    total,
    inicioExibido: total ? inicio + 1 : 0,
    fimExibido: Math.min(inicio + porPagina, total),
    anterior: () => setPagina((p) => Math.max(1, p - 1)),
    proxima: () => setPagina((p) => Math.min(totalPaginas, p + 1)),
  };
}

export function Paginacao({
  pagina,
  totalPaginas,
  total,
  inicioExibido,
  fimExibido,
  anterior,
  proxima,
}: {
  pagina: number;
  totalPaginas: number;
  total: number;
  inicioExibido: number;
  fimExibido: number;
  anterior: () => void;
  proxima: () => void;
}) {
  if (totalPaginas <= 1) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3">
      <p className="text-[12px] text-ink-2">
        {inicioExibido}–{fimExibido} de {total}
      </p>
      <div className="flex items-center gap-2">
        <Botao variante="secundario" pequeno onClick={anterior} disabled={pagina <= 1}>
          <ChevronLeft className="size-4" />
          Anterior
        </Botao>
        <span className="text-[12px] text-ink-2">
          Página {pagina} de {totalPaginas}
        </span>
        <Botao variante="secundario" pequeno onClick={proxima} disabled={pagina >= totalPaginas}>
          Próxima
          <ChevronRight className="size-4" />
        </Botao>
      </div>
    </div>
  );
}

export function Alerta({
  tom = "info",
  children,
}: {
  tom?: "info" | "alerta" | "erro";
  children: ReactNode;
}) {
  const tons = {
    info: "border-marinho-200 bg-marinho-50 text-marinho-700",
    alerta:
      "border-[color-mix(in_oklab,var(--color-alerta)_35%,white)] bg-[color-mix(in_oklab,var(--color-alerta)_10%,white)] text-[var(--color-alerta)]",
    erro: "border-[color-mix(in_oklab,var(--color-erro)_30%,white)] bg-[color-mix(in_oklab,var(--color-erro)_8%,white)] text-[var(--color-erro)]",
  };
  return (
    <div
      className={cx("rounded-xl border px-4 py-3 text-[13px] leading-relaxed", tons[tom])}
    >
      {children}
    </div>
  );
}

export function Indicador({
  rotulo,
  valor,
  detalhe,
  icone,
  tom = "neutro",
}: {
  rotulo: string;
  valor: ReactNode;
  detalhe?: string;
  icone?: ReactNode;
  tom?: "neutro" | "ouro" | "verde" | "erro";
}) {
  const cores = {
    neutro: {
      borda: "border-line",
      valor: "text-marinho-800",
      chip: "bg-marinho-50 text-marinho-600",
    },
    ouro: {
      borda: "border-ouro-300",
      valor: "text-ouro-700",
      chip: "bg-ouro-100 text-ouro-700",
    },
    verde: {
      borda: "border-[color-mix(in_oklab,var(--color-verde-500)_30%,white)]",
      valor: "text-verde-700",
      chip: "bg-verde-100 text-verde-700",
    },
    erro: {
      borda: "border-[color-mix(in_oklab,var(--color-erro)_30%,white)]",
      valor: "text-[var(--color-erro)]",
      chip: "bg-[color-mix(in_oklab,var(--color-erro)_10%,white)] text-[var(--color-erro)]",
    },
  }[tom];

  return (
    <div className={cx("rounded-xl border bg-surface px-4 py-3", cores.borda)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] font-medium text-ink-2">{rotulo}</p>
        {icone && (
          <span className={cx("grid size-7 place-items-center rounded-lg", cores.chip)}>
            {icone}
          </span>
        )}
      </div>
      <p className={cx("mt-0.5 text-xl font-bold tracking-tight", cores.valor)}>{valor}</p>
      {detalhe && <p className="text-[11px] text-ink-3">{detalhe}</p>}
    </div>
  );
}

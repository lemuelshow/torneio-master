"use client";

import { useState } from "react";
import { Crown, FileDown, Shuffle } from "lucide-react";
import { useDados } from "@/lib/cliente";
import { ehDuplasFechadas, vencedorDoJogo } from "@/lib/regras";
import type { Campeonato, Divisao, JogoMataMata } from "@/lib/tipos";
import {
  Abas, Alerta, Botao, Card, IndicadorCategoria, Selo, Titulo, useAbaSelecionada, Vazio,
} from "@/components/ui";

const DIVISOES: Divisao[] = ["Ouro", "Prata"];
const txt = (v: number | null) => (v === null ? "" : String(v));

function Confronto({
  jogo,
  rotulo,
  bloqueado,
}: {
  jogo: JogoMataMata;
  rotulo: (duplaId: string | null) => string;
  bloqueado: boolean;
}) {
  const { executar, salvando } = useDados();
  const assinatura = `${jogo.duplaA}|${jogo.duplaB}|${jogo.pontosA}|${jogo.pontosB}`;
  const [rascunho, setRascunho] = useState(() => ({
    assinatura,
    a: txt(jogo.pontosA),
    b: txt(jogo.pontosB),
  }));

  if (rascunho.assinatura !== assinatura)
    setRascunho({ assinatura, a: txt(jogo.pontosA), b: txt(jogo.pontosB) });

  const bye = Boolean(jogo.duplaA) !== Boolean(jogo.duplaB);
  const completo = Boolean(jogo.duplaA && jogo.duplaB);
  const vencedor = vencedorDoJogo(jogo);
  const sujo = rascunho.a !== txt(jogo.pontosA) || rascunho.b !== txt(jogo.pontosB);

  const salvar = () => {
    if (!sujo || !completo) return;
    executar("salvarResultadoMataMata", {
      jogoId: jogo.id,
      pontosA: rascunho.a === "" ? null : Number(rascunho.a),
      pontosB: rascunho.b === "" ? null : Number(rascunho.b),
    });
  };

  const linha = (lado: "A" | "B") => {
    const duplaId = lado === "A" ? jogo.duplaA : jogo.duplaB;
    const chave = lado === "A" ? "a" : "b";
    const ganhou = vencedor !== null && vencedor === duplaId;
    return (
      <div
        className={`flex items-center gap-2 px-2.5 py-1.5 ${
          ganhou ? "bg-verde-100/70" : ""
        }`}
      >
        <span
          className={`min-w-0 flex-1 truncate text-[12px] ${
            duplaId
              ? ganhou
                ? "font-bold text-verde-700"
                : "text-ink"
              : "italic text-ink-3"
          }`}
          title={rotulo(duplaId)}
        >
          {rotulo(duplaId)}
        </span>
        {completo && !bloqueado ? (
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={rascunho[chave]}
            onChange={(e) => setRascunho({ ...rascunho, [chave]: e.target.value })}
            onBlur={salvar}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            disabled={salvando}
            className="h-7 w-11 shrink-0 rounded-md border border-line bg-surface text-center text-[12px] font-bold text-marinho-800 focus:border-marinho-400 focus:outline-none focus:ring-2 focus:ring-marinho-500/20"
            aria-label={`Pontos da dupla ${lado}`}
          />
        ) : (
          <span className="w-11 shrink-0 text-center text-[12px] font-bold text-ink-2">
            {lado === "A" ? txt(jogo.pontosA) : txt(jogo.pontosB)}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="flex items-center justify-between bg-plane px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-ink-3">
        <span>Jogo {jogo.jogo}</span>
        {bye && <span className="text-ouro-700">bye</span>}
      </div>
      {linha("A")}
      <div className="h-px bg-line" />
      {linha("B")}
    </div>
  );
}

function Chave({
  campeonato,
  categoria,
  divisao,
  jogos,
  bloqueado,
  rotuloDaChave,
  rotuloDoCampeao,
}: {
  campeonato: Campeonato;
  categoria: string;
  divisao: Divisao;
  jogos: JogoMataMata[];
  bloqueado: boolean;
  rotuloDaChave: string;
  rotuloDoCampeao: string;
}) {
  const { estado, executar, salvando, nomeDe } = useDados();

  const rotulo = (duplaId: string | null) => {
    if (!duplaId) return "a definir";
    const d = estado.duplas.find((x) => x.id === duplaId);
    return d ? `${nomeDe(d.atletaD)} + ${nomeDe(d.atletaE)}` : duplaId;
  };

  const fases = [...new Set(jogos.map((j) => j.ordemFase))].sort((a, b) => a - b);
  const final = jogos.find((j) => j.ordemFase === Math.max(...fases));
  const campeao = final ? vencedorDoJogo(final) : null;

  return (
    <div className="rounded-xl border border-line">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-xl bg-plane px-3 py-2">
        <span className="flex items-center gap-2 text-[13px] font-bold text-marinho-800">
          {rotuloDaChave}
          <Selo tom={divisao === "Ouro" ? "ouro" : "prata"}>{jogos.length} jogos</Selo>
        </span>
        {!bloqueado && (
          <Botao
            variante="secundario"
            pequeno
            disabled={salvando}
            onClick={() =>
              executar("gerarMataMata", {
                campeonatoId: campeonato.id,
                categoria,
                divisao,
              })
            }
          >
            <Shuffle className="size-3.5" />
            Refazer chave
          </Botao>
        )}
      </div>

      <div className="scroll-x overflow-x-auto p-3">
        <div className="flex min-w-max gap-4">
          {fases.map((ordem) => {
            const daFase = jogos
              .filter((j) => j.ordemFase === ordem)
              .sort((a, b) => a.jogo - b.jogo);
            return (
              <div key={ordem} className="flex w-64 flex-col gap-2">
                <p className="text-center text-[11px] font-bold uppercase tracking-wide text-marinho-600">
                  {daFase[0]?.fase}
                </p>
                <div className="flex flex-1 flex-col justify-around gap-2">
                  {daFase.map((jogo) => (
                    <Confronto
                      key={jogo.id}
                      jogo={jogo}
                      rotulo={rotulo}
                      bloqueado={bloqueado}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          <div className="flex w-64 flex-col justify-center">
            <div
              className={`rounded-xl border-2 border-dashed px-3 py-4 text-center ${
                campeao ? "border-ouro-500 bg-ouro-100/60" : "border-line"
              }`}
            >
              <Crown
                className={`mx-auto size-5 ${campeao ? "text-ouro-600" : "text-ink-3"}`}
              />
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-ink-3">
                {rotuloDoCampeao}
              </p>
              <p
                className={`text-[13px] ${
                  campeao ? "font-bold text-marinho-800" : "italic text-ink-3"
                }`}
              >
                {campeao ? rotulo(campeao) : "aguardando a final"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EtapaFinal({
  campeonato,
  bloqueado,
}: {
  campeonato: Campeonato;
  bloqueado: boolean;
}) {
  const { estado, nomeDe } = useDados();
  const [gerando, setGerando] = useState("");
  const duplasFechadas = ehDuplasFechadas(campeonato);
  const chave = estado.mataMata.filter((m) => m.campeonatoId === campeonato.id);
  const duplas = estado.duplas.filter((d) => d.campeonatoId === campeonato.id);
  const categorias = [
    ...new Set([...chave.map((m) => m.categoria), ...duplas.map((d) => d.categoria)]),
  ].sort();
  const [categoriaSelecionada, selecionarCategoria] = useAbaSelecionada(categorias);

  const baixarChave = async (cat?: string) => {
    setGerando(cat ?? "todas");
    try {
      const { gerarPdfSumulasDuplas } = await import("@/lib/pdf");
      await gerarPdfSumulasDuplas({
        estado,
        campeonato,
        categoria: cat,
        chaveUnica: true,
      });
    } finally {
      setGerando("");
    }
  };

  if (!chave.length && !duplas.length)
    return (
      <Vazio
        titulo="Chave final não montada"
        descricao="Na etapa das duplas, use “Gerar chave final” para montar o mata-mata."
      />
    );

  return (
    <div className="space-y-4">
      <Alerta tom="info">
        Quem vence avança sozinho para a próxima fase. Quando o número de duplas não
        fecha uma potência de 2, alguém passa direto (bye) — esse confronto não aceita
        placar.
        {duplasFechadas && (
          <>
            {" "}
            A chave é única por categoria, montada por{" "}
            <strong>cruzamento olímpico</strong>: o 1º e o 2º de um mesmo grupo caem em
            metades opostas e só podem se reencontrar na final.
          </>
        )}
      </Alerta>

      {duplasFechadas && (
        <Card>
          <Titulo
            dica="Uma folha por categoria, com as duplas classificadas e os confrontos da chave."
            acao={
              <Botao
                variante="ouro"
                onClick={() => baixarChave()}
                disabled={gerando !== ""}
              >
                <FileDown className="size-4" />
                {gerando === "todas" ? "Gerando…" : "Baixar súmulas da chave (PDF)"}
              </Botao>
            }
          >
            Súmula da chave
          </Titulo>
          <div className="flex flex-wrap gap-2">
            {categorias.map((c) => (
              <Botao
                key={c}
                variante="secundario"
                pequeno
                onClick={() => baixarChave(c)}
                disabled={gerando !== ""}
              >
                <FileDown className="size-3.5" />
                {gerando === c ? "Gerando…" : c}
              </Botao>
            ))}
          </div>
        </Card>
      )}

      <Abas
        itens={categorias.map((c) => ({ chave: c, rotulo: c }))}
        selecionada={categoriaSelecionada}
        aoSelecionar={selecionarCategoria}
      />
      {categoriaSelecionada && <IndicadorCategoria categoria={categoriaSelecionada} />}

      {categorias
        .filter((categoria) => categoria === categoriaSelecionada)
        .map((categoria) => (
        <Card key={categoria}>
          <Titulo>{categoria}</Titulo>
          <div className="space-y-3">
            {(duplasFechadas ? (["Ouro"] as Divisao[]) : DIVISOES).map((divisao) => {
              const jogos = chave.filter(
                (m) => m.categoria === categoria && m.divisao === divisao
              );
              if (jogos.length)
                return (
                  <Chave
                    key={divisao}
                    campeonato={campeonato}
                    categoria={categoria}
                    divisao={divisao}
                    jogos={jogos}
                    bloqueado={bloqueado}
                    rotuloDaChave={
                      duplasFechadas ? "Chave da categoria" : `Divisão ${divisao}`
                    }
                    rotuloDoCampeao={duplasFechadas ? "Campeão" : `Campeão ${divisao}`}
                  />
                );

              // uma dupla sozinha na divisão: não há o que disputar
              const sozinha = duplas.filter(
                (d) => d.categoria === categoria && d.divisao === divisao
              );
              if (!sozinha.length) return null;
              return (
                <div
                  key={divisao}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-ouro-300 bg-ouro-100/40 px-3 py-3"
                >
                  <Crown className="size-5 text-ouro-600" />
                  <span className="text-[13px] text-ink">
                    <strong className="font-bold">
                      {duplasFechadas ? categoria : `Divisão ${divisao}`}
                    </strong>{" "}
                    tem apenas uma dupla —{" "}
                    <strong className="font-semibold">
                      {nomeDe(sozinha[0].atletaD)} + {nomeDe(sozinha[0].atletaE)}
                    </strong>{" "}
                    é campeã sem disputa. Não há chave a montar.
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}

"use client";

import { useState } from "react";
import { FileDown, Shuffle, Users2 } from "lucide-react";
import { useDados } from "@/lib/cliente";
import type { Campeonato, Divisao } from "@/lib/tipos";
import {
  Abas, Alerta, Botao, Card, IndicadorCategoria, Selo, Titulo, useAbaSelecionada, Vazio,
} from "@/components/ui";

const DIVISOES: Divisao[] = ["Ouro", "Prata"];

export function EtapaDuplas({
  campeonato,
  bloqueado,
}: {
  campeonato: Campeonato;
  bloqueado: boolean;
}) {
  const { estado, executar, salvando, nomeDe } = useDados();
  const [gerando, setGerando] = useState("");

  const duplas = estado.duplas.filter((d) => d.campeonatoId === campeonato.id);
  const categorias = [...new Set(duplas.map((d) => d.categoria))].sort();
  const [categoriaSelecionada, selecionarCategoria] = useAbaSelecionada(categorias);

  const baixar = async (chave: string, categoria?: string, divisao?: Divisao) => {
    setGerando(chave);
    try {
      const { gerarPdfSumulasDuplas } = await import("@/lib/pdf");
      await gerarPdfSumulasDuplas({ estado, campeonato, categoria, divisao });
    } finally {
      setGerando("");
    }
  };

  if (!duplas.length)
    return (
      <Vazio
        titulo="Duplas ainda não sorteadas"
        descricao="Na etapa de classificação, use “Ir para a segunda etapa” para sortear as duplas do Ouro e da Prata."
      />
    );

  return (
    <div className="space-y-4">
      <Alerta tom="info">
        A partir daqui a dupla é fixa. O 1º e o 2º de cada grupo formam o{" "}
        <strong>Ouro</strong>; o 3º e o 4º, a <strong>Prata</strong>. O sorteio junta um
        atleta do lado direito com um do lado esquerdo e evita repetir a dupla do mesmo
        grupo.
      </Alerta>

      <Card>
        <Titulo
          dica="Uma folha por divisão, com as duplas fixas, os confrontos da chave e espaço para assinatura."
          acao={
            <Botao
              variante="ouro"
              onClick={() => baixar("todas")}
              disabled={gerando !== ""}
            >
              <FileDown className="size-4" />
              {gerando === "todas" ? "Gerando…" : "Baixar súmulas do 2º sorteio (PDF)"}
            </Botao>
          }
        >
          Súmulas das duplas
        </Titulo>
        <div className="flex flex-wrap gap-2">
          {categorias.map((c) => (
            <Botao
              key={c}
              variante="secundario"
              pequeno
              onClick={() => baixar(c, c)}
              disabled={gerando !== ""}
            >
              <FileDown className="size-3.5" />
              {gerando === c ? "Gerando…" : c}
            </Botao>
          ))}
        </div>
      </Card>

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
          <Titulo dica={`${duplas.filter((d) => d.categoria === categoria).length} duplas formadas`}>
            {categoria}
          </Titulo>
          <div className="grid gap-3 lg:grid-cols-2">
            {DIVISOES.map((divisao) => {
              const daDivisao = duplas
                .filter((d) => d.categoria === categoria && d.divisao === divisao)
                .sort((a, b) => a.numero - b.numero);
              const chave = `${categoria}||${divisao}`;
              return (
                <div key={divisao} className="rounded-xl border border-line">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-xl bg-plane px-3 py-2">
                    <span className="flex items-center gap-2 text-[13px] font-bold text-marinho-800">
                      <Users2 className="size-4 text-marinho-500" />
                      Divisão {divisao}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {daDivisao.length > 0 && (
                        <Botao
                          variante="secundario"
                          pequeno
                          disabled={gerando !== ""}
                          onClick={() => baixar(chave, categoria, divisao)}
                        >
                          <FileDown className="size-3.5" />
                          {gerando === chave ? "Gerando…" : "Súmula (PDF)"}
                        </Botao>
                      )}
                      {!bloqueado && (
                        <Botao
                          variante="secundario"
                          pequeno
                          disabled={salvando}
                          onClick={() =>
                            executar("sortearDuplas", {
                              campeonatoId: campeonato.id,
                              categoria,
                              divisao,
                            })
                          }
                        >
                          <Shuffle className="size-3.5" />
                          Sortear
                        </Botao>
                      )}
                    </div>
                  </div>
                  {daDivisao.length === 0 ? (
                    <p className="px-3 py-4 text-[13px] text-ink-3">
                      Nenhuma dupla nesta divisão.
                    </p>
                  ) : (
                    <ul className="divide-y divide-line">
                      {daDivisao.map((d) => (
                        <li key={d.id} className="flex items-center gap-3 px-3 py-2">
                          <Selo tom={divisao === "Ouro" ? "ouro" : "prata"}>
                            {d.numero}
                          </Selo>
                          <span className="flex-1 text-[13px] text-ink">
                            <strong className="font-semibold">{nomeDe(d.atletaD)}</strong>
                            <span className="mx-1.5 text-ink-3">+</span>
                            <strong className="font-semibold">{nomeDe(d.atletaE)}</strong>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}

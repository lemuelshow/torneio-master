"use client";

import { useState } from "react";
import { FileDown, Medal } from "lucide-react";
import { useDados } from "@/lib/cliente";
import type { Campeonato } from "@/lib/tipos";
import {
  Abas, Alerta, Botao, Card, IndicadorCategoria, Selo, Tabela, Titulo, useAbaSelecionada,
  Vazio,
} from "@/components/ui";

export function EtapaClassificacao({ campeonato }: { campeonato: Campeonato }) {
  const { estado, classificacaoDe } = useDados();
  const [gerando, setGerando] = useState("");

  const linhas = classificacaoDe(campeonato.id);
  const categorias = [...new Set(linhas.map((l) => l.categoria))].sort();
  const [categoriaSelecionada, selecionarCategoria] = useAbaSelecionada(categorias);

  const baixar = async (categoria?: string) => {
    setGerando(categoria ?? "todas");
    try {
      const { gerarPdfSumulas } = await import("@/lib/pdf");
      await gerarPdfSumulas({
        estado,
        campeonato,
        classificacao: linhas,
        categoria,
      });
    } finally {
      setGerando("");
    }
  };

  if (!linhas.length)
    return (
      <Vazio
        titulo="Sem classificação"
        descricao="A classificação nasce dos placares da fase de grupos. Lance os resultados antes de processar."
      />
    );

  const semJogo = linhas.filter((l) => l.jogos === 0).length;

  return (
    <div className="space-y-4">
      <Card>
        <Titulo
          dica="As súmulas saem com o escudo do torneio, a tabela de cada grupo, os jogos e o espaço para assinatura."
          acao={
            <Botao
              variante="ouro"
              onClick={() => baixar()}
              disabled={gerando !== ""}
            >
              <FileDown className="size-4" />
              {gerando === "todas" ? "Gerando…" : "Baixar súmulas + classificação (PDF)"}
            </Botao>
          }
        >
          Súmulas em PDF
        </Titulo>
        <div className="flex flex-wrap gap-2">
          {categorias.map((c) => (
            <Botao
              key={c}
              variante="secundario"
              pequeno
              onClick={() => baixar(c)}
              disabled={gerando !== ""}
            >
              <FileDown className="size-3.5" />
              {gerando === c ? "Gerando…" : c}
            </Botao>
          ))}
        </div>
      </Card>

      {semJogo > 0 && (
        <Alerta tom="alerta">
          {semJogo} atleta(s) ainda sem nenhum jogo lançado — eles aparecem no fim do
          grupo e não recebem divisão.
        </Alerta>
      )}

      <Abas
        itens={categorias.map((c) => ({ chave: c, rotulo: c }))}
        selecionada={categoriaSelecionada}
        aoSelecionar={selecionarCategoria}
      />
      {categoriaSelecionada && <IndicadorCategoria categoria={categoriaSelecionada} />}

      {categorias
        .filter((categoria) => categoria === categoriaSelecionada)
        .map((categoria) => {
        const daCategoria = linhas.filter((l) => l.categoria === categoria);
        const numeros = [...new Set(daCategoria.map((l) => l.grupo))].sort((a, b) => a - b);
        return (
          <Card key={categoria} padding={false}>
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <Medal className="size-4 text-ouro-600" />
              <h2 className="text-[15px] font-bold tracking-tight text-marinho-800">
                {categoria}
              </h2>
            </div>
            {numeros.map((numero) => (
              <div key={numero} className="border-b border-line last:border-b-0">
                <p className="bg-plane px-4 py-1.5 text-[12px] font-bold uppercase tracking-wide text-marinho-600">
                  Grupo {numero}
                </p>
                <Tabela
                  minimo={620}
                  colunas={["Pos.", "Atleta", "V", "Pontos pró", "Contra", "Saldo", "Divisão"]}
                >
                  {daCategoria
                    .filter((l) => l.grupo === numero)
                    .map((l) => (
                      <tr key={l.atletaId} className="hover:bg-marinho-50/40">
                        <td className="px-3 py-2 font-bold text-marinho-700">
                          {l.posicao}º
                        </td>
                        <td className="px-3 py-2 font-medium text-ink">{l.nome}</td>
                        <td className="px-3 py-2 font-bold text-marinho-800">
                          {l.vitorias}
                        </td>
                        <td className="px-3 py-2 text-ink-2">{l.pontosPro}</td>
                        <td className="px-3 py-2 text-ink-2">{l.pontosContra}</td>
                        <td className="px-3 py-2 text-ink-2">
                          {l.saldo > 0 ? `+${l.saldo}` : l.saldo}
                        </td>
                        <td className="px-3 py-2">
                          {l.jogos === 0 ? (
                            <span className="text-ink-3">—</span>
                          ) : (
                            <Selo tom={l.divisao === "Ouro" ? "ouro" : "prata"}>
                              {l.divisao}
                            </Selo>
                          )}
                        </td>
                      </tr>
                    ))}
                </Tabela>
              </div>
            ))}
          </Card>
        );
      })}
    </div>
  );
}

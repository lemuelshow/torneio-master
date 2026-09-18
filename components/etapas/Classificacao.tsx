"use client";

import { useState } from "react";
import {
  ArrowDown, ArrowUp, FileDown, ListOrdered, Medal, RotateCcw, Save, X,
} from "lucide-react";
import { useDados } from "@/lib/cliente";
import { chaveDaLinha, ehDuplasFechadas } from "@/lib/regras";
import type { Campeonato, LinhaClassificacao } from "@/lib/tipos";
import {
  Abas, Alerta, Botao, Card, IndicadorCategoria, Selo, Tabela, Titulo, useAbaSelecionada,
  Vazio,
} from "@/components/ui";

const chaveGrupo = (categoria: string, grupo: number) => `${categoria}||${grupo}`;

export function EtapaClassificacao({ campeonato }: { campeonato: Campeonato }) {
  const { estado, classificacaoDe, executar, salvando } = useDados();
  const [gerando, setGerando] = useState("");
  const [editando, setEditando] = useState(false);
  // ordem rascunhada por grupo enquanto a edição está aberta
  const [ordens, setOrdens] = useState<Record<string, string[]>>({});

  const linhas = classificacaoDe(campeonato.id);
  const categorias = [...new Set(linhas.map((l) => l.categoria))].sort();
  const [categoriaSelecionada, selecionarCategoria] = useAbaSelecionada(categorias);
  const duplasFechadas = ehDuplasFechadas(campeonato);
  const rotuloOcupante = duplasFechadas ? "Dupla" : "Atleta";

  const baixar = async (categoria?: string) => {
    setGerando(categoria ?? "todas");
    try {
      if (duplasFechadas) {
        const { gerarPdfSumulasGruposDuplas } = await import("@/lib/pdf");
        await gerarPdfSumulasGruposDuplas({ estado, campeonato, categoria });
      } else {
        const { gerarPdfSumulas } = await import("@/lib/pdf");
        await gerarPdfSumulas({ estado, campeonato, classificacao: linhas, categoria });
      }
    } finally {
      setGerando("");
    }
  };

  const alternarEdicao = () => {
    setEditando((v) => !v);
    setOrdens({});
  };

  const descartar = (chave: string) =>
    setOrdens((atual) => {
      const copia = { ...atual };
      delete copia[chave];
      return copia;
    });

  const mover = (chave: string, ordem: string[], de: number, passo: number) => {
    const para = de + passo;
    if (para < 0 || para >= ordem.length) return;
    const nova = [...ordem];
    [nova[de], nova[para]] = [nova[para], nova[de]];
    setOrdens((atual) => ({ ...atual, [chave]: nova }));
  };

  /** Lista vazia devolve o grupo para a ordenação automática. */
  const gravarOrdem = async (categoria: string, grupo: number, ordem: string[]) => {
    const ok = await executar("ajustarClassificacao", {
      campeonatoId: campeonato.id,
      categoria,
      grupo,
      ordem,
    });
    if (ok) descartar(chaveGrupo(categoria, grupo));
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
          dica="As súmulas saem com o escudo do torneio, a classificação de cada grupo com as vitórias, os jogos e o espaço para assinatura."
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

      {editando && (
        <Alerta tom="info">
          Use as setas para reordenar cada grupo e depois salve. A ordem manual manda na
          classificação{" "}
          {duplasFechadas ? (
            <>e é ela que define quem entra na chave final.</>
          ) : (
            <>
              : o 1º e o 2º vão para o <strong>Ouro</strong>, o 3º e o 4º para a{" "}
              <strong>Prata</strong>.
            </>
          )}{" "}
          Ela fica valendo até você editar de novo ou voltar ao automático.
        </Alerta>
      )}

      {semJogo > 0 && (
        <Alerta tom="alerta">
          {semJogo} {duplasFechadas ? "dupla(s)" : "atleta(s)"} ainda sem nenhum jogo
          lançado — {duplasFechadas ? "elas" : "eles"} aparecem no fim do grupo
          {duplasFechadas ? " e ficam fora da chave." : " e não recebem divisão."}
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
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <h2 className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-marinho-800">
                <Medal className="size-4 text-ouro-600" />
                {categoria}
              </h2>
              <Botao
                variante={editando ? "secundario" : "primario"}
                pequeno
                onClick={alternarEdicao}
              >
                {editando ? (
                  <X className="size-3.5" />
                ) : (
                  <ListOrdered className="size-3.5" />
                )}
                {editando ? "Fechar edição" : "Editar classificação"}
              </Botao>
            </div>
            {numeros.map((numero) => {
              const doGrupo = daCategoria.filter((l) => l.grupo === numero);
              const chave = chaveGrupo(categoria, numero);
              // a identidade é o atleta no sorteio e a dupla nas duplas fechadas
              const salva = doGrupo.map((l) => chaveDaLinha(l));
              const ordem = ordens[chave] ?? salva;
              const porId = new Map(doGrupo.map((l) => [chaveDaLinha(l), l]));
              const visiveis = ordem
                .map((id) => porId.get(id))
                .filter((l): l is LinhaClassificacao => Boolean(l));
              const sujo = ordem.join("|") !== salva.join("|");
              const manual = doGrupo.some((l) => l.manual);

              return (
                <div key={numero} className="border-b border-line last:border-b-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-plane px-4 py-1.5">
                    <p className="text-[12px] font-bold uppercase tracking-wide text-marinho-600">
                      Grupo {numero}
                    </p>
                    {manual && <Selo tom="neutro">ordem ajustada à mão</Selo>}
                  </div>
                  <Tabela
                    minimo={editando ? 720 : 620}
                    colunas={[
                      "Pos.",
                      rotuloOcupante,
                      "V",
                      "Pontos pró",
                      "Contra",
                      "Saldo",
                      ...(duplasFechadas ? [] : ["Divisão"]),
                      ...(editando ? ["Mover"] : []),
                    ]}
                  >
                    {visiveis.map((l, i) => (
                      <tr key={chaveDaLinha(l)} className="hover:bg-marinho-50/40">
                        <td className="px-3 py-2 font-bold text-marinho-700">{i + 1}º</td>
                        <td className="px-3 py-2 font-medium text-ink">{l.nome}</td>
                        <td className="px-3 py-2 font-bold text-marinho-800">
                          {l.vitorias}
                        </td>
                        <td className="px-3 py-2 text-ink-2">{l.pontosPro}</td>
                        <td className="px-3 py-2 text-ink-2">{l.pontosContra}</td>
                        <td className="px-3 py-2 text-ink-2">
                          {l.saldo > 0 ? `+${l.saldo}` : l.saldo}
                        </td>
                        {!duplasFechadas && (
                          <td className="px-3 py-2">
                            {l.jogos === 0 ? (
                              <span className="text-ink-3">—</span>
                            ) : (
                              <Selo tom={i < 2 ? "ouro" : "prata"}>
                                {i < 2 ? "Ouro" : "Prata"}
                              </Selo>
                            )}
                          </td>
                        )}
                        {editando && (
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => mover(chave, ordem, i, -1)}
                                disabled={i === 0 || salvando}
                                className="grid size-7 place-items-center rounded-md border border-line bg-surface text-marinho-700 transition-colors hover:bg-marinho-50 disabled:cursor-not-allowed disabled:opacity-40"
                                aria-label={`Subir ${l.nome}`}
                                title="Subir"
                              >
                                <ArrowUp className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => mover(chave, ordem, i, 1)}
                                disabled={i === visiveis.length - 1 || salvando}
                                className="grid size-7 place-items-center rounded-md border border-line bg-surface text-marinho-700 transition-colors hover:bg-marinho-50 disabled:cursor-not-allowed disabled:opacity-40"
                                aria-label={`Descer ${l.nome}`}
                                title="Descer"
                              >
                                <ArrowDown className="size-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </Tabela>
                  {editando && (sujo || manual) && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2">
                      {sujo ? (
                        <>
                          <Botao
                            pequeno
                            variante="verde"
                            onClick={() => gravarOrdem(categoria, numero, ordem)}
                            disabled={salvando}
                          >
                            <Save className="size-3.5" />
                            Salvar ordem do grupo {numero}
                          </Botao>
                          <Botao
                            pequeno
                            variante="fantasma"
                            onClick={() => descartar(chave)}
                            disabled={salvando}
                          >
                            Descartar
                          </Botao>
                        </>
                      ) : (
                        <Botao
                          pequeno
                          variante="secundario"
                          onClick={() => gravarOrdem(categoria, numero, [])}
                          disabled={salvando}
                        >
                          <RotateCcw className="size-3.5" />
                          Voltar ao automático
                        </Botao>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        );
      })}
    </div>
  );
}

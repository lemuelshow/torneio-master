"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  BadgeCheck, CalendarDays, ChevronLeft, CircleAlert, Coins, Eraser, Lock,
  MapPin, Search, TrendingUp, Trophy, Unlock, Wallet,
} from "lucide-react";
import { dataBr, dinheiro, useDados } from "@/lib/cliente";
import {
  Abas, Alerta, Botao, Cabecalho, Campo, Card, Entrada, Indicador, Paginacao,
  Selecao, Selo, Tabela, useAbaSelecionada, usePaginacao, Vazio,
} from "@/components/ui";

/* mesma leitura de cor do resto do Financeiro: verde = dinheiro que entrou */
const COR_PAGA = "#009c3b";

const PARCELAS = [1, 2, 3, 4] as const;
type ChaveParcela = "p1" | "p2" | "p3" | "p4";
type ChaveData = "dataP1" | "dataP2" | "dataP3" | "dataP4";

export default function FinanceiroDoTorneio() {
  const parametros = useParams<{ id: string }>();
  const id = String(parametros?.id ?? "");
  const { estado, executar, salvando, participantesDe } = useDados();

  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState("todos");
  const [destravado, setDestravado] = useState(false);

  const campeonato = estado.campeonatos.find((c) => c.id === id);
  const participantes = participantesDe(id);

  const totais = useMemo(() => {
    const previsto = participantes.reduce((s, p) => s + p.valorTotal, 0);
    const recebido = participantes.reduce((s, p) => s + p.totalPago, 0);
    return {
      previsto,
      recebido,
      aReceber: previsto - recebido,
      quitados: participantes.filter((p) => p.parcelasPagas === 4).length,
      pendentes: participantes.filter((p) => p.saldo > 0).length,
      parcelasPagas: participantes.reduce((s, p) => s + p.parcelasPagas, 0),
    };
  }, [participantes]);

  const categorias = [
    ...new Set(
      participantes.map((p) => p.categoria).filter((c): c is string => Boolean(c))
    ),
  ].sort();
  const temSemCategoria = participantes.some((p) => !p.categoria);
  const abas =
    categorias.length + (temSemCategoria ? 1 : 0) > 1
      ? [
          { chave: "todas", rotulo: "Todas", contagem: participantes.length },
          ...categorias.map((c) => ({
            chave: c,
            rotulo: c,
            contagem: participantes.filter((p) => p.categoria === c).length,
          })),
          ...(temSemCategoria
            ? [
                {
                  chave: "sem",
                  rotulo: "Sem categoria",
                  contagem: participantes.filter((p) => !p.categoria).length,
                },
              ]
            : []),
        ]
      : [];
  const [categoria, selecionarCategoria] = useAbaSelecionada(
    abas.map((a) => a.chave),
    "todas"
  );

  const termo = busca.trim().toLowerCase();
  const lista = participantes.filter((p) => {
    if (categoria === "sem" && p.categoria) return false;
    if (categoria !== "todas" && categoria !== "sem" && p.categoria !== categoria)
      return false;
    if (situacao === "pendentes" && p.saldo <= 0) return false;
    if (situacao === "quitados" && p.parcelasPagas !== 4) return false;
    return !termo || p.nome.toLowerCase().includes(termo);
  });

  const paginacao = usePaginacao(lista, 25, `${categoria}|${situacao}|${termo}`);

  if (!campeonato)
    return (
      <Vazio
        titulo="Torneio não encontrado"
        descricao="Ele pode ter sido excluído da planilha."
        acao={
          <Link href="/financeiro">
            <Botao variante="secundario">
              <ChevronLeft className="size-4" />
              Voltar para o Financeiro
            </Botao>
          </Link>
        }
      />
    );

  const inscricao = (atletaId: string) =>
    estado.participantes.find(
      (p) => p.campeonatoId === campeonato.id && p.atletaId === atletaId
    );

  const alternarParcela = (atletaId: string, chave: ChaveParcela) => {
    const atual = inscricao(atletaId);
    if (!atual) return;
    executar("salvarParcelas", {
      campeonatoId: campeonato.id,
      atletaId,
      parcelas: { [chave]: !atual[chave] },
    });
  };

  const definirTodas = (atletaId: string, paga: boolean) =>
    executar("salvarParcelas", {
      campeonatoId: campeonato.id,
      atletaId,
      parcelas: { p1: paga, p2: paga, p3: paga, p4: paga },
    });

  return (
    <div className="space-y-5">
      <Link
        href="/financeiro"
        className="inline-flex items-center gap-1 text-[12px] font-semibold text-marinho-600 hover:underline"
      >
        <ChevronLeft className="size-3.5" />
        Financeiro
      </Link>

      <Cabecalho
        titulo={campeonato.nome}
        descricao="Lançamento das parcelas e situação de pagamento de cada inscrito."
        acao={
          <Link href={`/campeonatos/${campeonato.id}`}>
            <Botao variante="secundario" pequeno>
              <Trophy className="size-4" />
              Abrir o torneio
            </Botao>
          </Link>
        }
      />

      <p className="-mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-2">
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="size-3.5 text-marinho-400" />
          {dataBr(campeonato.data)}
        </span>
        {campeonato.local && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5 text-marinho-400" />
            {campeonato.local}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Wallet className="size-3.5 text-marinho-400" />
          Inscrição de {dinheiro(campeonato.valorInscricao)} em 4 parcelas
        </span>
      </p>

      {/* ------------------------------------------------------ indicadores */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          rotulo="Previsto"
          valor={dinheiro(totais.previsto)}
          detalhe={`${participantes.length} inscrição(ões)`}
          icone={<Coins className="size-4" />}
        />
        <Indicador
          rotulo="Recebido"
          valor={dinheiro(totais.recebido)}
          detalhe={`${totais.parcelasPagas} de ${participantes.length * 4} parcelas pagas`}
          tom="verde"
          icone={<TrendingUp className="size-4" />}
        />
        <Indicador
          rotulo="A receber"
          valor={dinheiro(totais.aReceber)}
          detalhe={`${totais.pendentes} atleta(s) com saldo em aberto`}
          tom={totais.aReceber > 0 ? "erro" : "verde"}
          icone={<CircleAlert className="size-4" />}
        />
        <Indicador
          rotulo="Quitados"
          valor={`${totais.quitados}/${participantes.length}`}
          detalhe="4 de 4 parcelas pagas"
          tom="ouro"
          icone={<BadgeCheck className="size-4" />}
        />
      </div>

      {participantes.length === 0 ? (
        <Vazio
          titulo="Nenhum inscrito neste torneio"
          descricao="Inscreva atletas na etapa de participantes do torneio — as parcelas aparecem aqui para lançamento."
          acao={
            <Link href={`/campeonatos/${campeonato.id}`}>
              <Botao>
                <Trophy className="size-4" />
                Abrir o torneio
              </Botao>
            </Link>
          }
        />
      ) : (
        <Card padding={false}>
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-4 py-3">
            <div className="flex flex-wrap items-end gap-3">
              <Campo rotulo="Buscar atleta" className="min-w-[220px]">
                <span className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
                  <Entrada
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Digite parte do nome"
                    className="pl-9"
                  />
                </span>
              </Campo>
              <Campo rotulo="Situação">
                <Selecao
                  value={situacao}
                  onChange={(e) => setSituacao(e.target.value)}
                  className="w-44"
                >
                  <option value="todos">Todos</option>
                  <option value="pendentes">Só pendentes</option>
                  <option value="quitados">Só quitados</option>
                </Selecao>
              </Campo>
            </div>
            <button
              type="button"
              onClick={() => setDestravado((v) => !v)}
              className={`mb-0.5 inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-[12px] font-semibold transition-colors ${
                destravado
                  ? "border-[color-mix(in_oklab,var(--color-alerta)_35%,white)] bg-[color-mix(in_oklab,var(--color-alerta)_10%,white)] text-[var(--color-alerta)]"
                  : "border-line bg-surface text-ink-2 hover:bg-plane"
              }`}
              title={
                destravado
                  ? "Lançamentos destravados — clique para travar de novo"
                  : "Lançamentos travados — clique para destravar e marcar parcelas"
              }
            >
              {destravado ? <Unlock className="size-3.5" /> : <Lock className="size-3.5" />}
              {destravado ? "Destravado" : "Travado"}
            </button>
          </div>

          {abas.length > 0 && (
            <div className="border-b border-line px-4 pt-3">
              <Abas
                itens={abas}
                selecionada={categoria}
                aoSelecionar={selecionarCategoria}
              />
            </div>
          )}

          {!destravado && (
            <div className="px-4 pt-3">
              <Alerta tom="info">
                Os lançamentos estão <strong>travados</strong> para ninguém marcar parcela
                sem querer. Use o cadeado acima para liberar.
              </Alerta>
            </div>
          )}

          {lista.length === 0 ? (
            <div className="p-4">
              <Vazio
                titulo="Ninguém neste filtro"
                descricao="Ajuste a busca, a situação ou a categoria acima."
              />
            </div>
          ) : (
            <Tabela
              minimo={940}
              colunas={[
                "Atleta",
                "Categoria",
                "1ª",
                "2ª",
                "3ª",
                "4ª",
                "Valor",
                "Pago",
                "Em aberto",
                "",
              ]}
            >
              {paginacao.itensDaPagina.map((p) => {
                const parcelas = inscricao(p.id);
                const quitado = p.parcelasPagas === 4;
                return (
                  <tr key={p.id} className="hover:bg-marinho-50/40">
                    <td className="px-3 py-2">
                      <span className="font-medium text-ink">{p.nome}</span>
                      {p.telefone && (
                        <span className="block text-[11px] text-ink-3">{p.telefone}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {p.categoria ? (
                        <Selo tom="info">{p.categoria}</Selo>
                      ) : (
                        <Selo tom="alerta">sem faixa</Selo>
                      )}
                    </td>
                    {PARCELAS.map((n) => {
                      const chave = `p${n}` as ChaveParcela;
                      const data = parcelas?.[`dataP${n}` as ChaveData];
                      return (
                        <td key={chave} className="px-3 py-2">
                          <input
                            type="checkbox"
                            className="size-4 accent-[var(--color-verde-500)]"
                            checked={Boolean(parcelas?.[chave])}
                            disabled={salvando || !destravado}
                            onChange={() => alternarParcela(p.id, chave)}
                            title={data ? `Paga em ${dataBr(data)}` : `${n}ª parcela`}
                            aria-label={`Parcela ${n} de ${p.nome}`}
                          />
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-ink-2">{dinheiro(p.valorTotal)}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-2">
                        <span className="flex gap-[2px]" aria-hidden>
                          {[0, 1, 2, 3].map((i) => (
                            <span
                              key={i}
                              className="h-2 w-3.5 rounded-[2px]"
                              style={{
                                background:
                                  i < p.parcelasPagas ? COR_PAGA : "var(--color-line)",
                              }}
                            />
                          ))}
                        </span>
                        <span
                          className={
                            quitado ? "font-semibold text-verde-700" : "text-ink-2"
                          }
                        >
                          {dinheiro(p.totalPago)}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {p.saldo > 0 ? (
                        <span className="font-bold text-[var(--color-erro)]">
                          {dinheiro(p.saldo)}
                        </span>
                      ) : (
                        <Selo tom="ok">quitado</Selo>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Botao
                        variante={quitado ? "secundario" : "verde"}
                        pequeno
                        disabled={salvando || !destravado}
                        onClick={() => definirTodas(p.id, !quitado)}
                        title={
                          quitado
                            ? "Desmarcar as 4 parcelas"
                            : "Marcar as 4 parcelas como pagas"
                        }
                      >
                        {quitado ? (
                          <>
                            <Eraser className="size-3.5" />
                            Zerar
                          </>
                        ) : (
                          <>
                            <BadgeCheck className="size-3.5" />
                            Quitar
                          </>
                        )}
                      </Botao>
                    </td>
                  </tr>
                );
              })}
            </Tabela>
          )}
          <Paginacao {...paginacao} />
        </Card>
      )}
    </div>
  );
}

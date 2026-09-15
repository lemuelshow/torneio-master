"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight, BadgeCheck, CircleAlert, Coins, Download, TrendingUp, Wallet,
} from "lucide-react";
import { dataBr, dinheiro, useDados } from "@/lib/cliente";
import { calcularFinanceiro } from "@/lib/financeiro";
import {
  Alerta, Botao, Cabecalho, Campo, Card, Indicador, Paginacao, Selecao, Selo, Tabela, Titulo,
  usePaginacao, Vazio,
} from "@/components/ui";

/* Duas séries, validadas para daltonismo e contraste sobre fundo claro:
   verde-bandeira para o que entrou, azul-marinho para o que falta entrar. */
const COR_RECEBIDO = "#009c3b";
const COR_A_RECEBER = "#2352a8";

const porcento = (v: number) =>
  `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export default function FinanceiroPage() {
  const { estado } = useDados();
  const [filtro, setFiltro] = useState("");

  const financeiro = useMemo(() => calcularFinanceiro(estado), [estado]);
  const { resumos } = financeiro;

  const visiveis = filtro ? resumos.filter((r) => r.campeonato.id === filtro) : resumos;

  const pendencias = useMemo(
    () =>
      visiveis
        .flatMap((r) =>
          r.pendentes.map((p) => ({ ...p, campeonato: r.campeonato }))
        )
        .sort((a, b) => b.saldo - a.saldo || a.nome.localeCompare(b.nome)),
    [visiveis]
  );

  const paginacaoPendencias = usePaginacao(pendencias, 25, filtro);

  const totalFiltrado = {
    previsto: visiveis.reduce((s, r) => s + r.previsto, 0),
    recebido: visiveis.reduce((s, r) => s + r.recebido, 0),
    aReceber: visiveis.reduce((s, r) => s + r.aReceber, 0),
  };

  const maiorMes = Math.max(1, ...financeiro.recebimentos.map((m) => m.valor));
  const maiorPrevisto = Math.max(1, ...resumos.map((r) => r.previsto));

  if (!resumos.length)
    return (
      <div className="space-y-5">
        <Cabecalho
          titulo="Financeiro"
          descricao="Faturamento consolidado dos torneios e controle de quem ainda deve."
        />
        <Vazio
          titulo="Nenhum torneio para somar"
          descricao="Crie um torneio e inscreva atletas — o dinheiro aparece aqui automaticamente."
          acao={
            <Link href="/">
              <Botao>
                Ir para Torneios
                <ArrowRight className="size-4" />
              </Botao>
            </Link>
          }
        />
      </div>
    );

  return (
    <div className="space-y-5">
      <Cabecalho
        titulo="Financeiro"
        descricao="Faturamento consolidado dos torneios, entrada por mês e quem está pendente em cada um."
        acao={
          <a href="/api/planilha">
            <Botao variante="secundario" pequeno>
              <Download className="size-4" />
              Baixar planilha
            </Botao>
          </a>
        }
      />

      {/* ------------------------------------------------------ indicadores */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          rotulo="Faturamento previsto"
          valor={dinheiro(financeiro.previsto)}
          detalhe={`${financeiro.inscricoes} inscrição(ões) em ${resumos.length} torneio(s)`}
          icone={<Coins className="size-4" />}
        />
        <Indicador
          rotulo="Recebido"
          valor={dinheiro(financeiro.recebido)}
          detalhe={`${porcento(financeiro.percentual)} do previsto · ${financeiro.parcelasPagas} de ${financeiro.parcelasTotais} parcelas`}
          tom="verde"
          icone={<TrendingUp className="size-4" />}
        />
        <Indicador
          rotulo="A receber"
          valor={dinheiro(financeiro.aReceber)}
          detalhe={`${financeiro.pendentes} atleta(s) com saldo em aberto`}
          tom={financeiro.aReceber > 0 ? "erro" : "verde"}
          icone={<CircleAlert className="size-4" />}
        />
        <Indicador
          rotulo="Inscrições quitadas"
          valor={`${financeiro.quitados}/${financeiro.inscricoes}`}
          detalhe="4 de 4 parcelas pagas"
          tom="ouro"
          icone={<BadgeCheck className="size-4" />}
        />
      </div>

      {/* ------------------------------------- recebido x a receber por campeonato */}
      <Card>
        <Titulo
          dica="Cada barra é a inscrição total do torneio; a parte verde já entrou no caixa."
          acao={
            <div className="flex items-center gap-4 text-[12px] text-ink-2">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-sm"
                  style={{ background: COR_RECEBIDO }}
                />
                Recebido
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-sm"
                  style={{ background: COR_A_RECEBER }}
                />
                A receber
              </span>
            </div>
          }
        >
          Faturamento por torneio
        </Titulo>

        <ul className="space-y-3">
          {resumos.map((r) => {
            const largura = (r.previsto / maiorPrevisto) * 100;
            const parte = r.previsto > 0 ? (r.recebido / r.previsto) * 100 : 0;
            return (
              <li key={r.campeonato.id} className="group">
                <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <Link
                    href={`/campeonatos/${r.campeonato.id}`}
                    className="text-[13px] font-semibold text-marinho-800 hover:underline"
                  >
                    {r.campeonato.nome}
                  </Link>
                  <span className="text-[12px] text-ink-2">
                    <strong className="text-verde-700">{dinheiro(r.recebido)}</strong>
                    {" de "}
                    {dinheiro(r.previsto)}
                    <span className="ml-2 text-ink-3">{porcento(r.percentual)}</span>
                  </span>
                </div>
                {r.previsto === 0 && (
                  <p className="text-[12px] italic text-ink-3">
                    sem inscrições lançadas
                  </p>
                )}
                <div className="flex h-4 items-stretch gap-[2px]" style={{ width: `${largura}%` }}>
                  {parte > 0 && (
                    <span
                      className="rounded-l-[4px] transition-opacity group-hover:opacity-90"
                      style={{ width: `${parte}%`, background: COR_RECEBIDO }}
                      title={`Recebido: ${dinheiro(r.recebido)}`}
                    />
                  )}
                  {parte < 100 && (
                    <span
                      className={`rounded-r-[4px] transition-opacity group-hover:opacity-90 ${
                        parte === 0 ? "rounded-l-[4px]" : ""
                      }`}
                      style={{ width: `${100 - parte}%`, background: COR_A_RECEBER }}
                      title={`A receber: ${dinheiro(r.aReceber)}`}
                    />
                  )}
                </div>
                <p className="mt-1 text-[11px] text-ink-3">
                  {dataBr(r.campeonato.data)} · {r.participantes.length} inscrito(s) ·{" "}
                  {r.quitados} quitado(s) · {r.pendentes.length} pendente(s)
                </p>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* --------------------------------------------------- entradas por mês */}
      <Card>
        <Titulo dica="Cada parcela paga entra no mês em que foi confirmada no sistema.">
          Recebimentos por mês
        </Titulo>
        {financeiro.recebimentos.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-ink-3">
            Nenhuma parcela paga ainda.
          </p>
        ) : (
          <div className="scroll-x overflow-x-auto">
            <div className="flex min-w-max items-end gap-3 px-1 pb-1 pt-6">
              {financeiro.recebimentos.map((mes) => (
                <div key={mes.chave} className="group flex w-16 flex-col items-center gap-1">
                  <span className="text-[11px] font-bold text-marinho-700">
                    {dinheiro(mes.valor).replace("R$", "").trim()}
                  </span>
                  <span
                    className="w-full rounded-t-[4px] transition-opacity group-hover:opacity-85"
                    style={{
                      height: `${Math.max(6, (mes.valor / maiorMes) * 120)}px`,
                      background: COR_RECEBIDO,
                    }}
                    title={`${mes.rotulo}: ${dinheiro(mes.valor)} em ${mes.parcelas} parcela(s)`}
                  />
                  <span className="text-[11px] text-ink-2">{mes.rotulo}</span>
                  <span className="text-[10px] text-ink-3">{mes.parcelas} parc.</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {financeiro.semData > 0 && (
          <p className="mt-2 text-[11px] text-ink-3">
            {financeiro.semData} parcela(s) paga(s) sem data registrada não entram no
            gráfico — elas contam no total recebido.
          </p>
        )}
      </Card>

      {/* -------------------------------------------------- filtro + pendências */}
      <div className="flex flex-wrap items-end gap-3">
        <Campo rotulo="Torneio" className="min-w-[260px]">
          <Selecao value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="">Todos os torneios</option>
            {resumos.map((r) => (
              <option key={r.campeonato.id} value={r.campeonato.id}>
                {r.campeonato.nome}
              </option>
            ))}
          </Selecao>
        </Campo>
        <p className="pb-2 text-[12px] text-ink-2">
          Previsto <strong>{dinheiro(totalFiltrado.previsto)}</strong> · recebido{" "}
          <strong className="text-verde-700">{dinheiro(totalFiltrado.recebido)}</strong> ·
          a receber{" "}
          <strong className="text-[var(--color-erro)]">
            {dinheiro(totalFiltrado.aReceber)}
          </strong>
        </p>
      </div>

      <Card padding={false}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="text-[15px] font-bold tracking-tight text-marinho-800">
            Pendências de pagamento ({pendencias.length})
          </h2>
          <span className="text-[12px] text-ink-3">
            Ordenado pelo maior saldo em aberto
          </span>
        </div>
        {pendencias.length === 0 ? (
          <div className="p-4">
            <Alerta tom="info">
              Nenhuma pendência {filtro ? "neste torneio" : "em nenhum torneio"} —
              todas as inscrições estão quitadas.
            </Alerta>
          </div>
        ) : (
          <Tabela
            minimo={900}
            colunas={[
              "Atleta",
              "Torneio",
              "Categoria",
              "Parcelas",
              "Valor",
              "Pago",
              "Em aberto",
              "Contato",
              "",
            ]}
          >
            {paginacaoPendencias.itensDaPagina.map((p) => (
              <tr key={`${p.campeonato.id}-${p.id}`} className="hover:bg-marinho-50/40">
                <td className="px-3 py-2 font-medium text-ink">{p.nome}</td>
                <td className="px-3 py-2 text-ink-2">{p.campeonato.nome}</td>
                <td className="px-3 py-2">
                  {p.categoria ? (
                    <Selo tom="info">{p.categoria}</Selo>
                  ) : (
                    <Selo tom="alerta">sem faixa</Selo>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="flex gap-[2px]" aria-hidden>
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className="h-2 w-4 rounded-[2px]"
                          style={{
                            background:
                              i < p.parcelasPagas ? COR_RECEBIDO : "var(--color-line)",
                          }}
                        />
                      ))}
                    </span>
                    <span className="text-[12px] text-ink-2">{p.situacaoPagamento}</span>
                  </span>
                </td>
                <td className="px-3 py-2 text-ink-2">{dinheiro(p.valorTotal)}</td>
                <td className="px-3 py-2 text-verde-700">{dinheiro(p.totalPago)}</td>
                <td className="px-3 py-2 font-bold text-[var(--color-erro)]">
                  {dinheiro(p.saldo)}
                </td>
                <td className="px-3 py-2 text-ink-2">{p.telefone || "—"}</td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/campeonatos/${p.campeonato.id}`}
                    className="inline-flex items-center gap-1 text-[12px] font-semibold text-marinho-600 hover:underline"
                  >
                    <Wallet className="size-3.5" />
                    lançar
                  </Link>
                </td>
              </tr>
            ))}
          </Tabela>
        )}
        <Paginacao {...paginacaoPendencias} />
      </Card>

      {/* --------------------------------------------- resumo por campeonato */}
      <Card padding={false}>
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-[15px] font-bold tracking-tight text-marinho-800">
            Resumo por torneio
          </h2>
        </div>
        <Tabela
          minimo={860}
          colunas={[
            "Torneio",
            "Data",
            "Inscritos",
            "Quitados",
            "Previsto",
            "Recebido",
            "A receber",
            "%",
          ]}
        >
          {resumos.map((r) => (
            <tr key={r.campeonato.id} className="hover:bg-marinho-50/40">
              <td className="px-3 py-2">
                <Link
                  href={`/campeonatos/${r.campeonato.id}`}
                  className="font-medium text-marinho-800 hover:underline"
                >
                  {r.campeonato.nome}
                </Link>
              </td>
              <td className="px-3 py-2 text-ink-2">{dataBr(r.campeonato.data)}</td>
              <td className="px-3 py-2 text-ink-2">{r.participantes.length}</td>
              <td className="px-3 py-2 text-ink-2">{r.quitados}</td>
              <td className="px-3 py-2 text-ink-2">{dinheiro(r.previsto)}</td>
              <td className="px-3 py-2 font-semibold text-verde-700">
                {dinheiro(r.recebido)}
              </td>
              <td className="px-3 py-2 text-ink-2">{dinheiro(r.aReceber)}</td>
              <td className="px-3 py-2">
                <Selo tom={r.percentual === 1 ? "ok" : r.percentual >= 0.5 ? "info" : "alerta"}>
                  {porcento(r.percentual)}
                </Selo>
              </td>
            </tr>
          ))}
          <tr className="bg-marinho-50 font-bold text-marinho-800">
            <td className="px-3 py-2">Total</td>
            <td className="px-3 py-2" />
            <td className="px-3 py-2">{financeiro.inscricoes}</td>
            <td className="px-3 py-2">{financeiro.quitados}</td>
            <td className="px-3 py-2">{dinheiro(financeiro.previsto)}</td>
            <td className="px-3 py-2 text-verde-700">{dinheiro(financeiro.recebido)}</td>
            <td className="px-3 py-2">{dinheiro(financeiro.aReceber)}</td>
            <td className="px-3 py-2">{porcento(financeiro.percentual)}</td>
          </tr>
        </Tabela>
      </Card>
    </div>
  );
}

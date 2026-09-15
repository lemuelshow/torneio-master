import type { Campeonato, Estado, ParticipanteCalculado } from "./tipos";
import { participantesDo } from "./regras";

export interface ResumoCampeonato {
  campeonato: Campeonato;
  participantes: ParticipanteCalculado[];
  pendentes: ParticipanteCalculado[];
  quitados: number;
  previsto: number;
  recebido: number;
  aReceber: number;
  percentual: number;
}

export interface Recebimento {
  chave: string; // yyyy-mm
  rotulo: string; // mai/26
  valor: number;
  parcelas: number;
}

export interface Financeiro {
  resumos: ResumoCampeonato[];
  previsto: number;
  recebido: number;
  aReceber: number;
  percentual: number;
  inscricoes: number;
  quitados: number;
  pendentes: number;
  parcelasPagas: number;
  parcelasTotais: number;
  recebimentos: Recebimento[];
  semData: number;
}

const MESES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

const arredondar = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

/**
 * Consolida o dinheiro de todos os campeonatos: quanto foi previsto, quanto
 * entrou, quem ainda deve e em que mês cada parcela caiu.
 */
export function calcularFinanceiro(estado: Estado): Financeiro {
  const resumos: ResumoCampeonato[] = [...estado.campeonatos]
    .sort((a, b) => b.data.localeCompare(a.data))
    .map((campeonato) => {
      const participantes = participantesDo(estado, campeonato.id);
      const previsto = participantes.reduce((s, p) => s + p.valorTotal, 0);
      const recebido = participantes.reduce((s, p) => s + p.totalPago, 0);
      return {
        campeonato,
        participantes,
        pendentes: participantes
          .filter((p) => p.saldo > 0)
          .sort((a, b) => b.saldo - a.saldo || a.nome.localeCompare(b.nome)),
        quitados: participantes.filter((p) => p.parcelasPagas === 4).length,
        previsto: arredondar(previsto),
        recebido: arredondar(recebido),
        aReceber: arredondar(previsto - recebido),
        percentual: previsto > 0 ? recebido / previsto : 0,
      };
    });

  const previsto = arredondar(resumos.reduce((s, r) => s + r.previsto, 0));
  const recebido = arredondar(resumos.reduce((s, r) => s + r.recebido, 0));

  // parcelas com data viram fluxo mensal; o valor de cada uma é 1/4 da inscrição
  const porMes = new Map<string, { valor: number; parcelas: number }>();
  let semData = 0;
  for (const inscricao of estado.participantes) {
    const campeonato = estado.campeonatos.find((c) => c.id === inscricao.campeonatoId);
    if (!campeonato) continue;
    const valorParcela = (inscricao.valorTotal || campeonato.valorInscricao) / 4;
    ([1, 2, 3, 4] as const).forEach((n) => {
      const paga = inscricao[`p${n}` as "p1" | "p2" | "p3" | "p4"];
      if (!paga) return;
      const data = inscricao[`dataP${n}` as "dataP1" | "dataP2" | "dataP3" | "dataP4"];
      if (!data || data.length < 7) {
        semData += 1;
        return;
      }
      const chave = data.slice(0, 7);
      const atual = porMes.get(chave) ?? { valor: 0, parcelas: 0 };
      porMes.set(chave, {
        valor: atual.valor + valorParcela,
        parcelas: atual.parcelas + 1,
      });
    });
  }

  const recebimentos: Recebimento[] = [...porMes.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([chave, dados]) => {
      const [ano, mes] = chave.split("-");
      return {
        chave,
        rotulo: `${MESES[Number(mes) - 1] ?? mes}/${ano.slice(2)}`,
        valor: arredondar(dados.valor),
        parcelas: dados.parcelas,
      };
    });

  const inscricoes = resumos.reduce((s, r) => s + r.participantes.length, 0);
  const parcelasPagas = resumos.reduce(
    (s, r) => s + r.participantes.reduce((t, p) => t + p.parcelasPagas, 0),
    0
  );

  return {
    resumos,
    previsto,
    recebido,
    aReceber: arredondar(previsto - recebido),
    percentual: previsto > 0 ? recebido / previsto : 0,
    inscricoes,
    quitados: resumos.reduce((s, r) => s + r.quitados, 0),
    pendentes: resumos.reduce((s, r) => s + r.pendentes.length, 0),
    parcelasPagas,
    parcelasTotais: inscricoes * 4,
    recebimentos,
    semData,
  };
}

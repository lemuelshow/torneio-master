import {
  ABAS, configPadrao, dataIso, num, paraCorte, paraFormato, paraLado,
  paraOrigemDupla, sim, type Coluna,
} from "./excel";
import { ORDEM_ETAPAS, classificar, participantesDo } from "./regras";
import {
  criarAbas, escreverVariasAbas, lerVariasAbas, limparVariasAbas, listarAbasExistentes,
} from "./googleSheets";
import { normalizarNome } from "./texto";
import type {
  Atleta, Campeonato, Config, Dupla, Estado, Etapa, FaixaCategoria,
  IntegranteGrupo, Jogo, JogoMataMata, Participante, Sexo,
} from "./tipos";

/**
 * Mesma planilha, só que como banco de dados de verdade (leitura e escrita)
 * via API do Google Sheets — para usar o sistema em vários computadores ao
 * mesmo tempo, todos lendo e gravando na mesma planilha na nuvem. Espelha
 * exatamente o esquema de abas do arquivo local (lib/excel.ts).
 *
 * Atenção: como cada ação relê o estado inteiro, muda o que precisa e grava
 * tudo de novo, duas gravações praticamente simultâneas de PCs diferentes
 * podem se sobrescrever (a última que chegar "ganha"). Numa operação normal,
 * com uma pessoa de cada vez mexendo em cada campeonato, o risco é baixo.
 */

const ABAS_ORDEM = [
  "config", "faixas", "campeonatos", "atletas", "participantes",
  "grupos", "jogos", "classificacao", "duplas", "mataMata",
] as const;

type ChaveAba = (typeof ABAS_ORDEM)[number];

const TITULO_DA_ABA: Record<ChaveAba, string> = {
  config: "Config",
  faixas: "Faixas",
  campeonatos: "Campeonatos",
  atletas: "Atletas",
  participantes: "Participantes",
  grupos: "Grupos",
  jogos: "Jogos",
  classificacao: "Classificação",
  duplas: "Duplas",
  mataMata: "Mata-Mata",
};

const intervaloDaAba = (chave: ChaveAba) => `'${TITULO_DA_ABA[chave]}'`;

async function garantirAbas(): Promise<void> {
  const existentes = new Set(await listarAbasExistentes());
  const faltando = ABAS_ORDEM.map((k) => TITULO_DA_ABA[k]).filter((t) => !existentes.has(t));
  if (faltando.length) await criarAbas(faltando);
}

/* ------------------------------------------------------------- gravação */

function celula(col: Coluna, bruto: unknown): string | number {
  if (col.tipo === "sim/nao") return bruto ? "SIM" : "NÃO";
  if (col.tipo === "numero")
    return bruto === null || bruto === undefined || bruto === "" ? "" : Number(bruto);
  return bruto === null || bruto === undefined ? "" : String(bruto);
}

function matrizDaAba(colunas: readonly Coluna[], linhas: readonly object[]) {
  return [
    colunas.map((c) => c.titulo),
    ...linhas.map((item) => {
      const linha = item as Record<string, unknown>;
      return colunas.map((col) => celula(col, linha[col.campo]));
    }),
  ] satisfies (string | number)[][];
}

export async function gravarEstadoGoogle(estado: Estado): Promise<void> {
  await garantirAbas();

  const nomeAtleta = new Map(estado.atletas.map((a) => [a.id, a.nome]));
  const nomeCampeonato = new Map(estado.campeonatos.map((x) => [x.id, x.nome]));
  const nome = (id: string) => nomeAtleta.get(id) ?? id;
  const camp = (id: string) => nomeCampeonato.get(id) ?? id;
  const nomeDupla = (id: string | null) => {
    if (!id) return "";
    const d = estado.duplas.find((x) => x.id === id);
    return d ? `${nome(d.atletaD)} + ${nome(d.atletaE)}` : id;
  };

  const matrizConfig: (string | number)[][] = [
    ["Parâmetro", "Valor", "Observação"],
    ["Organização", estado.config.organizacao, "Aparece nas súmulas e relatórios."],
    [
      "Valor padrão da inscrição",
      estado.config.valorInscricao,
      "Sugerido ao criar um campeonato; cada um pode ter o seu.",
    ],
    ["Atletas por grupo", estado.config.atletasPorGrupo, "Padrão 4, conforme a regra."],
  ];

  const matrizFaixas = matrizDaAba(ABAS.faixas, estado.config.faixas);

  const matrizCampeonatos = matrizDaAba(
    ABAS.campeonatos,
    [...estado.campeonatos]
      .sort((a, b) => b.data.localeCompare(a.data))
      .map((x) => ({
        ...x,
        participantes: estado.participantes.filter((p) => p.campeonatoId === x.id).length,
      }))
  );

  const matrizAtletas = matrizDaAba(
    ABAS.atletas,
    [...estado.atletas].sort((a, b) => a.nome.localeCompare(b.nome))
  );

  const participantesCalculados = estado.campeonatos.flatMap((x) =>
    participantesDo(estado, x.id).map((p) => {
      const bruto = estado.participantes.find(
        (i) => i.campeonatoId === x.id && i.atletaId === p.id
      );
      return {
        campeonatoId: x.id,
        campeonato: x.nome,
        atletaId: p.id,
        nome: p.nome,
        idadeNoEvento: p.idadeNoEvento,
        categoria: p.categoria ?? "sem faixa",
        categoriaManual: bruto?.categoriaManual ?? "",
        valorTotal: p.valorTotal,
        p1: bruto?.p1, dataP1: bruto?.dataP1,
        p2: bruto?.p2, dataP2: bruto?.dataP2,
        p3: bruto?.p3, dataP3: bruto?.dataP3,
        p4: bruto?.p4, dataP4: bruto?.dataP4,
        situacaoPagamento: p.situacaoPagamento,
        totalPago: p.totalPago,
        saldo: p.saldo,
      };
    })
  );
  const matrizParticipantes = matrizDaAba(ABAS.participantes, participantesCalculados);

  const matrizGrupos = matrizDaAba(
    ABAS.grupos,
    [...estado.grupos]
      .sort(
        (x, y) =>
          x.campeonatoId.localeCompare(y.campeonatoId) ||
          x.categoria.localeCompare(y.categoria) ||
          x.grupo - y.grupo ||
          x.vaga - y.vaga
      )
      .map((g) => ({
        ...g,
        campeonato: camp(g.campeonatoId),
        nome: nome(g.atletaId),
        dupla: nomeDupla(g.duplaId),
      }))
  );

  const matrizJogos = matrizDaAba(
    ABAS.jogos,
    [...estado.jogos]
      .sort(
        (x, y) =>
          x.campeonatoId.localeCompare(y.campeonatoId) ||
          x.categoria.localeCompare(y.categoria) ||
          x.grupo - y.grupo ||
          x.rodada - y.rodada
      )
      .map((j) => ({
        ...j,
        campeonato: camp(j.campeonatoId),
        duplaANomes: `${nome(j.duplaA[0])} + ${nome(j.duplaA[1])}`,
        duplaBNomes: `${nome(j.duplaB[0])} + ${nome(j.duplaB[1])}`,
        duplaA: j.duplaA.join(" + "),
        duplaB: j.duplaB.join(" + "),
        vencedor:
          j.pontosA === null || j.pontosB === null
            ? ""
            : j.pontosA === j.pontosB
              ? "Empate"
              : j.pontosA > j.pontosB
                ? `${nome(j.duplaA[0])} + ${nome(j.duplaA[1])}`
                : `${nome(j.duplaB[0])} + ${nome(j.duplaB[1])}`,
      }))
  );

  const matrizClassificacao = matrizDaAba(
    ABAS.classificacao,
    classificar(estado).map((l) => ({ ...l, campeonato: camp(l.campeonatoId) }))
  );

  const matrizDuplas = matrizDaAba(
    ABAS.duplas,
    [...estado.duplas]
      .sort(
        (x, y) =>
          x.campeonatoId.localeCompare(y.campeonatoId) ||
          x.categoria.localeCompare(y.categoria) ||
          x.divisao.localeCompare(y.divisao) ||
          x.numero - y.numero
      )
      .map((d) => ({
        ...d,
        campeonato: camp(d.campeonatoId),
        nomeD: nome(d.atletaD),
        nomeE: nome(d.atletaE),
      }))
  );

  const matrizMataMata = matrizDaAba(
    ABAS.mataMata,
    [...estado.mataMata]
      .sort(
        (x, y) =>
          x.campeonatoId.localeCompare(y.campeonatoId) ||
          x.categoria.localeCompare(y.categoria) ||
          x.divisao.localeCompare(y.divisao) ||
          x.ordemFase - y.ordemFase ||
          x.jogo - y.jogo
      )
      .map((m) => ({
        ...m,
        campeonato: camp(m.campeonatoId),
        duplaANome: nomeDupla(m.duplaA),
        duplaBNome: nomeDupla(m.duplaB),
        vencedorNome:
          m.pontosA === null || m.pontosB === null || m.pontosA === m.pontosB
            ? ""
            : nomeDupla(m.pontosA > m.pontosB ? m.duplaA : m.duplaB),
      }))
  );

  const porChave: Record<ChaveAba, (string | number)[][]> = {
    config: matrizConfig,
    faixas: matrizFaixas,
    campeonatos: matrizCampeonatos,
    atletas: matrizAtletas,
    participantes: matrizParticipantes,
    grupos: matrizGrupos,
    jogos: matrizJogos,
    classificacao: matrizClassificacao,
    duplas: matrizDuplas,
    mataMata: matrizMataMata,
  };

  await limparVariasAbas(ABAS_ORDEM.map(intervaloDaAba));
  await escreverVariasAbas(
    ABAS_ORDEM.map((k) => ({ intervalo: `${intervaloDaAba(k)}!A1`, valores: porChave[k] }))
  );
}

/* --------------------------------------------------------------- leitura */

/** Converte o valor bruto vindo do Sheets para o texto que os parsers de excel.ts esperam. */
function textoDeCelula(bruto: unknown, numerico: boolean): string {
  if (bruto === null || bruto === undefined || bruto === "") return "";
  // valores numéricos voltam como number (ex.: 199.99) — o parser de excel.ts
  // espera o formato brasileiro (vírgula decimal), por isso a troca aqui.
  if (numerico && typeof bruto === "number") return String(bruto).replace(".", ",");
  return String(bruto).trim();
}

function registrosDaMatriz(
  matriz: unknown[][],
  colunas: readonly Coluna[]
): Record<string, string>[] {
  if (matriz.length < 2) return [];
  const cabecalho = matriz[0].map((c) => String(c ?? ""));
  const indices = colunas.map((col) => cabecalho.indexOf(col.titulo));
  return matriz
    .slice(1)
    .map((linha) => {
      const registro: Record<string, string> = {};
      let vazio = true;
      colunas.forEach((col, i) => {
        const idx = indices[i];
        const texto = idx >= 0 ? textoDeCelula(linha[idx], col.tipo === "numero") : "";
        registro[col.campo] = texto;
        if (texto) vazio = false;
      });
      return vazio ? null : registro;
    })
    .filter((r): r is Record<string, string> => r !== null);
}

export async function lerEstadoGoogle(): Promise<Estado> {
  const matrizes = await lerVariasAbas(ABAS_ORDEM.map(intervaloDaAba));
  const porChave = Object.fromEntries(ABAS_ORDEM.map((k, i) => [k, matrizes[i]])) as Record<
    ChaveAba,
    unknown[][]
  >;

  const padrao = configPadrao();
  const valorConfig = (rotulo: string): string => {
    const linha = porChave.config
      .slice(1)
      .find((l) => String(l[0] ?? "").toLowerCase() === rotulo.toLowerCase());
    return textoDeCelula(linha?.[1], true);
  };

  const faixasLidas = registrosDaMatriz(porChave.faixas, ABAS.faixas).map(
    (f): FaixaCategoria => ({
      nome: f.nome,
      sexo: (f.sexo.toUpperCase() === "F" ? "F" : "M") as Sexo,
      idadeMin: num(f.idadeMin),
      idadeMax: num(f.idadeMax) || 120,
      ativa: sim(f.ativa),
    })
  );

  const config: Config = {
    organizacao: valorConfig("Organização") || padrao.organizacao,
    valorInscricao: num(valorConfig("Valor padrão da inscrição")) || padrao.valorInscricao,
    atletasPorGrupo: num(valorConfig("Atletas por grupo")) || padrao.atletasPorGrupo,
    faixas: faixasLidas.length ? faixasLidas : padrao.faixas,
  };

  const atletas = registrosDaMatriz(porChave.atletas, ABAS.atletas).map(
    (a): Atleta => ({
      id: a.id,
      // nome digitado direto na planilha também sobe em MAIÚSCULO
      nome: normalizarNome(a.nome),
      apelido: normalizarNome(a.apelido),
      cidade: a.cidade,
      nascimento: dataIso(a.nascimento),
      sexo: (a.sexo.toUpperCase() === "F" ? "F" : "M") as Sexo,
      lado: paraLado(a.lado),
      uniforme: a.uniforme,
      telefone: a.telefone,
      observacoes: a.observacoes,
      ativo: sim(a.ativo),
    })
  );

  const campeonatos = registrosDaMatriz(porChave.campeonatos, ABAS.campeonatos).map(
    (x): Campeonato => ({
      id: x.id,
      nome: x.nome,
      data: dataIso(x.data),
      local: x.local,
      etapa: (ORDEM_ETAPAS as readonly string[]).includes(x.etapa) ? (x.etapa as Etapa) : "participantes",
      valorInscricao: num(x.valorInscricao) || config.valorInscricao,
      atletasPorGrupo: num(x.atletasPorGrupo) || config.atletasPorGrupo,
      duplasPorGrupo: num(x.duplasPorGrupo) || 3,
      formato: paraFormato(x.formato),
      corteDeClassificacao: paraCorte(x.corteDeClassificacao),
      criadoEm: dataIso(x.criadoEm),
      observacoes: x.observacoes,
    })
  );

  const participantes = registrosDaMatriz(porChave.participantes, ABAS.participantes).map(
    (p): Participante => ({
      campeonatoId: p.campeonatoId,
      atletaId: p.atletaId,
      categoriaManual: p.categoriaManual || null,
      valorTotal: num(p.valorTotal),
      p1: sim(p.p1), p2: sim(p.p2), p3: sim(p.p3), p4: sim(p.p4),
      dataP1: dataIso(p.dataP1), dataP2: dataIso(p.dataP2),
      dataP3: dataIso(p.dataP3), dataP4: dataIso(p.dataP4),
    })
  );

  const grupos = registrosDaMatriz(porChave.grupos, ABAS.grupos).map(
    (g): IntegranteGrupo => ({
      campeonatoId: g.campeonatoId,
      categoria: g.categoria,
      grupo: num(g.grupo),
      vaga: num(g.vaga),
      atletaId: g.atletaId,
      duplaId: g.duplaId || null,
      ladoNoGrupo: paraLado(g.ladoNoGrupo),
      posicaoManual: g.posicaoManual ? num(g.posicaoManual) || null : null,
    })
  );

  const jogos = registrosDaMatriz(porChave.jogos, ABAS.jogos).map((j): Jogo => {
    const a = j.duplaA.split("+").map((s) => s.trim());
    const b = j.duplaB.split("+").map((s) => s.trim());
    return {
      id: j.id,
      campeonatoId: j.campeonatoId,
      categoria: j.categoria,
      grupo: num(j.grupo),
      rodada: num(j.rodada),
      duplaA: [a[0] ?? "", a[1] ?? ""],
      duplaB: [b[0] ?? "", b[1] ?? ""],
      pontosA: j.pontosA === "" ? null : num(j.pontosA),
      pontosB: j.pontosB === "" ? null : num(j.pontosB),
    };
  });

  const duplas = registrosDaMatriz(porChave.duplas, ABAS.duplas).map(
    (d): Dupla => ({
      id: d.id,
      campeonatoId: d.campeonatoId,
      categoria: d.categoria,
      divisao: d.divisao === "Prata" ? "Prata" : "Ouro",
      numero: num(d.numero),
      atletaD: d.atletaD,
      atletaE: d.atletaE,
      origem: paraOrigemDupla(d.origem),
      cabecaDeChave: sim(d.cabecaDeChave),
    })
  );

  const mataMata = registrosDaMatriz(porChave.mataMata, ABAS.mataMata).map(
    (m): JogoMataMata => ({
      id: m.id,
      campeonatoId: m.campeonatoId,
      categoria: m.categoria,
      divisao: m.divisao === "Prata" ? "Prata" : "Ouro",
      fase: m.fase,
      ordemFase: num(m.ordemFase),
      jogo: num(m.jogo),
      duplaA: m.duplaA || null,
      duplaB: m.duplaB || null,
      pontosA: m.pontosA === "" ? null : num(m.pontosA),
      pontosB: m.pontosB === "" ? null : num(m.pontosB),
      proximo: m.proximo || null,
    })
  );

  return { config, atletas, campeonatos, participantes, grupos, jogos, duplas, mataMata };
}

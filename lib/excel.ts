import path from "node:path";
import fs from "node:fs/promises";
import ExcelJS from "exceljs";
import type {
  Atleta, Campeonato, Config, Dupla, Estado, Etapa, FaixaCategoria,
  IntegranteGrupo, Jogo, JogoMataMata, Lado, Participante, Sexo,
} from "./tipos";
import { ORDEM_ETAPAS, classificar, participantesDo } from "./regras";

/** A planilha é o banco de dados. Caminho configurável por variável de ambiente. */
export const CAMINHO_PLANILHA =
  process.env.PLANILHA ?? path.join(process.cwd(), "dados", "torneio.xlsx");

/* ------------------------------------------------------------- esquema */

export interface Coluna {
  campo: string;
  titulo: string;
  largura: number;
  formato?: string;
  tipo?: "texto" | "numero" | "sim/nao" | "data";
}

const c = (
  campo: string,
  titulo: string,
  largura: number,
  tipo: Coluna["tipo"] = "texto",
  formato?: string
): Coluna => ({ campo, titulo, largura, tipo, formato });

const MOEDA = "R$ #,##0.00";
const DATA = "dd/mm/yyyy";

export const ABAS = {
  campeonatos: [
    c("id", "ID", 18),
    c("nome", "Campeonato", 34),
    c("data", "Data da competição", 20, "data", DATA),
    c("local", "Local", 26),
    c("etapa", "Etapa atual", 18),
    c("valorInscricao", "Valor da inscrição", 18, "numero", MOEDA),
    c("atletasPorGrupo", "Atletas por grupo", 18, "numero"),
    c("participantes", "Participantes", 15, "numero"),
    c("criadoEm", "Criado em", 16, "data", DATA),
    c("observacoes", "Observações", 40),
  ],
  atletas: [
    c("id", "ID", 16),
    c("nome", "Nome do atleta", 32),
    c("apelido", "Apelido", 20),
    c("cidade", "Cidade", 24),
    c("nascimento", "Data de nascimento", 20, "data", DATA),
    c("sexo", "Sexo", 8),
    c("lado", "Lado", 10),
    c("uniforme", "Uniforme", 12),
    c("telefone", "Telefone", 18),
    c("ativo", "Ativo", 9, "sim/nao"),
    c("observacoes", "Observações", 40),
  ],
  participantes: [
    c("campeonatoId", "ID do campeonato", 18),
    c("campeonato", "Campeonato", 28),
    c("atletaId", "ID do atleta", 16),
    c("nome", "Atleta", 30),
    c("idadeNoEvento", "Idade na competição", 20, "numero"),
    c("categoria", "Categoria", 14),
    c("categoriaManual", "Categoria manual", 16),
    c("valorTotal", "Valor total", 14, "numero", MOEDA),
    c("p1", "1/4 paga", 11, "sim/nao"),
    c("dataP1", "Data 1/4", 13, "data", DATA),
    c("p2", "2/4 paga", 11, "sim/nao"),
    c("dataP2", "Data 2/4", 13, "data", DATA),
    c("p3", "3/4 paga", 11, "sim/nao"),
    c("dataP3", "Data 3/4", 13, "data", DATA),
    c("p4", "4/4 paga", 11, "sim/nao"),
    c("dataP4", "Data 4/4", 13, "data", DATA),
    c("situacaoPagamento", "Situação", 11),
    c("totalPago", "Total pago", 14, "numero", MOEDA),
    c("saldo", "Saldo devedor", 15, "numero", MOEDA),
  ],
  grupos: [
    c("campeonatoId", "ID do campeonato", 18),
    c("campeonato", "Campeonato", 26),
    c("categoria", "Categoria", 14),
    c("grupo", "Grupo", 9, "numero"),
    c("vaga", "Vaga", 8, "numero"),
    c("atletaId", "ID do atleta", 16),
    c("nome", "Atleta", 30),
    c("ladoNoGrupo", "Lado no grupo", 15),
  ],
  jogos: [
    c("id", "ID", 26),
    c("campeonatoId", "ID do campeonato", 18),
    c("campeonato", "Campeonato", 26),
    c("categoria", "Categoria", 14),
    c("grupo", "Grupo", 9, "numero"),
    c("rodada", "Jogo", 8, "numero"),
    c("duplaANomes", "Dupla A", 34),
    c("duplaBNomes", "Dupla B", 34),
    c("pontosA", "Pontos A", 11, "numero"),
    c("pontosB", "Pontos B", 11, "numero"),
    c("vencedor", "Vencedor", 34),
    c("duplaA", "IDs dupla A", 26),
    c("duplaB", "IDs dupla B", 26),
  ],
  classificacao: [
    c("campeonato", "Campeonato", 26),
    c("categoria", "Categoria", 14),
    c("grupo", "Grupo", 9, "numero"),
    c("posicao", "Posição", 10, "numero"),
    c("nome", "Atleta", 30),
    c("vitorias", "Vitórias", 10, "numero"),
    c("pontosPro", "Pontos pró", 12, "numero"),
    c("pontosContra", "Pontos contra", 14, "numero"),
    c("saldo", "Saldo", 10, "numero"),
    c("divisao", "Divisão", 12),
    c("campeonatoId", "ID do campeonato", 18),
    c("atletaId", "ID do atleta", 16),
  ],
  duplas: [
    c("id", "ID", 28),
    c("campeonatoId", "ID do campeonato", 18),
    c("campeonato", "Campeonato", 26),
    c("categoria", "Categoria", 14),
    c("divisao", "Divisão", 12),
    c("numero", "Dupla nº", 10, "numero"),
    c("nomeD", "Atleta lado D", 28),
    c("nomeE", "Atleta lado E", 28),
    c("atletaD", "ID lado D", 16),
    c("atletaE", "ID lado E", 16),
  ],
  mataMata: [
    c("id", "ID", 30),
    c("campeonatoId", "ID do campeonato", 18),
    c("campeonato", "Campeonato", 26),
    c("categoria", "Categoria", 14),
    c("divisao", "Divisão", 12),
    c("fase", "Fase", 16),
    c("jogo", "Jogo", 8, "numero"),
    c("duplaANome", "Dupla A", 32),
    c("duplaBNome", "Dupla B", 32),
    c("pontosA", "Pontos A", 11, "numero"),
    c("pontosB", "Pontos B", 11, "numero"),
    c("vencedorNome", "Vencedor", 32),
    c("ordemFase", "Ordem", 8, "numero"),
    c("duplaA", "ID dupla A", 28),
    c("duplaB", "ID dupla B", 28),
    c("proximo", "Avança para", 30),
  ],
  faixas: [
    c("nome", "Categoria", 18),
    c("sexo", "Sexo", 8),
    c("idadeMin", "Idade mínima", 14, "numero"),
    c("idadeMax", "Idade máxima", 14, "numero"),
    c("ativa", "Ativa", 9, "sim/nao"),
  ],
} as const;

/* ------------------------------------------------------------- padrões */

export function configPadrao(): Config {
  return {
    organizacao: "Futevôlei Master Brasil",
    valorInscricao: 200,
    atletasPorGrupo: 4,
    faixas: [
      { nome: "40+", sexo: "M", idadeMin: 40, idadeMax: 49, ativa: true },
      { nome: "50+", sexo: "M", idadeMin: 50, idadeMax: 59, ativa: true },
      { nome: "60+", sexo: "M", idadeMin: 60, idadeMax: 69, ativa: true },
      { nome: "70+", sexo: "M", idadeMin: 70, idadeMax: 120, ativa: true },
      { nome: "Feminino", sexo: "F", idadeMin: 40, idadeMax: 120, ativa: true },
    ],
  };
}

const estadoVazio = (): Estado => ({
  config: configPadrao(),
  atletas: [],
  campeonatos: [],
  participantes: [],
  grupos: [],
  jogos: [],
  duplas: [],
  mataMata: [],
});

/* ------------------------------------------------------- leitura/escrita */

const MARINHO = "FF0B2350";
const CINZA = "FFF4F6FA";
const DOURADO = "FFF2C218";

export const sim = (v: unknown) => {
  const s = String(v ?? "").trim().toUpperCase();
  return s === "SIM" || s === "TRUE" || s === "1" || s === "X" || s === "VERDADEIRO";
};

const txt = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return dataIso(v);
  if (typeof v === "object") {
    const o = v as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (Array.isArray(o.richText)) return o.richText.map((r) => r.text).join("");
    if (o.text) return String(o.text);
    if (o.result !== undefined) return String(o.result);
  }
  return String(v).trim();
};

export const num = (v: unknown): number => {
  const n = Number(String(txt(v)).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export function dataIso(v: unknown): string {
  if (!v) return "";
  if (v instanceof Date) {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  const s = typeof v === "string" ? v : txt(v);
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : "";
}

const paraData = (iso: string): Date | null => {
  if (!iso) return null;
  const [a, m, d] = iso.split("-").map(Number);
  return a && m && d ? new Date(a, m - 1, d) : null;
};

function lerAba(
  ws: ExcelJS.Worksheet | undefined,
  colunas: readonly Coluna[]
): Record<string, string>[] {
  if (!ws) return [];
  const linhas: Record<string, string>[] = [];
  ws.eachRow((row, i) => {
    if (i === 1) return;
    const registro: Record<string, string> = {};
    let vazia = true;
    colunas.forEach((col, idx) => {
      const valor = row.getCell(idx + 1).value;
      const bruto = col.tipo === "data" ? dataIso(valor) : txt(valor);
      registro[col.campo] = bruto;
      if (bruto) vazia = false;
    });
    if (!vazia) linhas.push(registro);
  });
  return linhas;
}

export const paraLado = (v: string): Lado =>
  ["D", "E"].includes(v.toUpperCase()) ? (v.toUpperCase() as "D" | "E") : "Ambos";

const paraEtapa = (v: string): Etapa =>
  (ORDEM_ETAPAS as string[]).includes(v) ? (v as Etapa) : "participantes";

/** Lê o estado direto da planilha. Cria o arquivo se ainda não existir. */
export async function lerEstado(): Promise<Estado> {
  try {
    await fs.access(CAMINHO_PLANILHA);
  } catch {
    const inicial = estadoVazio();
    await gravarEstado(inicial);
    return inicial;
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(CAMINHO_PLANILHA);

  const cfg = wb.getWorksheet("Config");
  const padrao = configPadrao();
  const valorConfig = (rotulo: string) => {
    let achado = "";
    cfg?.eachRow((row) => {
      if (txt(row.getCell(1).value).toLowerCase() === rotulo.toLowerCase())
        achado = txt(row.getCell(2).value);
    });
    return achado;
  };

  const faixasLidas = lerAba(wb.getWorksheet("Faixas"), ABAS.faixas).map(
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

  const atletas = lerAba(wb.getWorksheet("Atletas"), ABAS.atletas).map(
    (a): Atleta => ({
      id: a.id,
      nome: a.nome,
      apelido: a.apelido,
      cidade: a.cidade,
      nascimento: a.nascimento,
      sexo: (a.sexo.toUpperCase() === "F" ? "F" : "M") as Sexo,
      lado: paraLado(a.lado),
      uniforme: a.uniforme,
      telefone: a.telefone,
      observacoes: a.observacoes,
      ativo: sim(a.ativo),
    })
  );

  const campeonatos = lerAba(wb.getWorksheet("Campeonatos"), ABAS.campeonatos).map(
    (x): Campeonato => ({
      id: x.id,
      nome: x.nome,
      data: x.data,
      local: x.local,
      etapa: paraEtapa(x.etapa),
      valorInscricao: num(x.valorInscricao) || config.valorInscricao,
      atletasPorGrupo: num(x.atletasPorGrupo) || config.atletasPorGrupo,
      criadoEm: x.criadoEm,
      observacoes: x.observacoes,
    })
  );

  const participantes = lerAba(wb.getWorksheet("Participantes"), ABAS.participantes).map(
    (p): Participante => ({
      campeonatoId: p.campeonatoId,
      atletaId: p.atletaId,
      categoriaManual: p.categoriaManual || null,
      valorTotal: num(p.valorTotal),
      p1: sim(p.p1),
      p2: sim(p.p2),
      p3: sim(p.p3),
      p4: sim(p.p4),
      dataP1: p.dataP1,
      dataP2: p.dataP2,
      dataP3: p.dataP3,
      dataP4: p.dataP4,
    })
  );

  const grupos = lerAba(wb.getWorksheet("Grupos"), ABAS.grupos).map(
    (g): IntegranteGrupo => ({
      campeonatoId: g.campeonatoId,
      categoria: g.categoria,
      grupo: num(g.grupo),
      vaga: num(g.vaga),
      atletaId: g.atletaId,
      ladoNoGrupo: paraLado(g.ladoNoGrupo),
    })
  );

  const jogos = lerAba(wb.getWorksheet("Jogos"), ABAS.jogos).map((j): Jogo => {
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

  const duplas = lerAba(wb.getWorksheet("Duplas"), ABAS.duplas).map(
    (d): Dupla => ({
      id: d.id,
      campeonatoId: d.campeonatoId,
      categoria: d.categoria,
      divisao: d.divisao === "Prata" ? "Prata" : "Ouro",
      numero: num(d.numero),
      atletaD: d.atletaD,
      atletaE: d.atletaE,
    })
  );

  const mataMata = lerAba(wb.getWorksheet("Mata-Mata"), ABAS.mataMata).map(
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

  return {
    config,
    atletas,
    campeonatos,
    participantes,
    grupos,
    jogos,
    duplas,
    mataMata,
  };
}

/* ------------------------------------------------------------- escrita */

function montarAba(
  wb: ExcelJS.Workbook,
  nome: string,
  colunas: readonly Coluna[],
  linhas: readonly object[]
) {
  const ws = wb.addWorksheet(nome, { views: [{ state: "frozen", ySplit: 1 }] });

  ws.columns = colunas.map((col) => ({
    header: col.titulo,
    key: col.campo,
    width: col.largura,
  }));

  const cabecalho = ws.getRow(1);
  cabecalho.height = 22;
  cabecalho.eachCell((cel) => {
    cel.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MARINHO } };
    cel.alignment = { vertical: "middle", horizontal: "left" };
    cel.border = { bottom: { style: "thin", color: { argb: DOURADO } } };
  });

  linhas.forEach((item, i) => {
    const linha = item as Record<string, unknown>;
    const valores: Record<string, unknown> = {};
    for (const col of colunas) {
      const bruto = linha[col.campo];
      if (col.tipo === "sim/nao") valores[col.campo] = bruto ? "SIM" : "NÃO";
      else if (col.tipo === "data")
        valores[col.campo] = paraData(String(bruto ?? "")) ?? "";
      else if (col.tipo === "numero")
        valores[col.campo] =
          bruto === null || bruto === undefined || bruto === "" ? "" : Number(bruto);
      else valores[col.campo] = bruto ?? "";
    }
    const row = ws.addRow(valores);
    row.alignment = { vertical: "middle" };
    if (i % 2 === 1)
      row.eachCell((cel) => {
        cel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CINZA } };
      });
    colunas.forEach((col, idx) => {
      if (col.formato) row.getCell(idx + 1).numFmt = col.formato;
      if (col.tipo === "numero" || col.tipo === "sim/nao")
        row.getCell(idx + 1).alignment = { horizontal: "center", vertical: "middle" };
    });
  });

  if (linhas.length)
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: colunas.length },
    };
  return ws;
}

function montarConfig(wb: ExcelJS.Workbook, config: Config) {
  const ws = wb.addWorksheet("Config");
  ws.columns = [
    { header: "Parâmetro", key: "p", width: 28 },
    { header: "Valor", key: "v", width: 40 },
    { header: "Observação", key: "o", width: 62 },
  ];
  const cab = ws.getRow(1);
  cab.height = 22;
  cab.eachCell((cel) => {
    cel.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MARINHO } };
  });

  const linhas: [string, string | number, string][] = [
    ["Organização", config.organizacao, "Aparece nas súmulas e relatórios."],
    [
      "Valor padrão da inscrição",
      config.valorInscricao,
      "Sugerido ao criar um campeonato; cada um pode ter o seu.",
    ],
    ["Atletas por grupo", config.atletasPorGrupo, "Padrão 4, conforme a regra."],
  ];
  linhas.forEach(([p, v, o], i) => {
    const row = ws.addRow({ p, v, o });
    row.getCell(1).font = { bold: true };
    if (p === "Valor padrão da inscrição") row.getCell(2).numFmt = MOEDA;
    row.getCell(3).font = { color: { argb: "FF767676" }, size: 10 };
    if (i % 2 === 1)
      row.eachCell((cel) => {
        cel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CINZA } };
      });
  });
}

function montarInstrucoes(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet("Leia-me");
  ws.columns = [{ width: 4 }, { width: 112 }];
  const titulo = ws.addRow(["", "FUTEVÔLEI MASTER BRASIL — COMO ESTA PLANILHA FUNCIONA"]);
  titulo.getCell(2).font = { bold: true, size: 14, color: { argb: MARINHO } };
  ws.addRow([]);

  const blocos: [string, string[]][] = [
    ["Esta planilha é o banco de dados", [
      "O sistema lê e grava neste arquivo a cada operação. Não existe outro banco.",
      "Você pode editar as abas à mão: na próxima ação o sistema lê o que estiver aqui.",
      "Feche o arquivo no Excel antes de usar o sistema — o Excel bloqueia a gravação.",
    ]],
    ["Vários campeonatos no mesmo arquivo", [
      "A aba Campeonatos lista todas as competições, cada uma com sua etapa atual.",
      "Atletas é a base geral, reaproveitada entre campeonatos.",
      "Participantes liga atleta e campeonato, com as 4 parcelas da inscrição.",
      "Grupos, Jogos, Duplas e Mata-Mata trazem a coluna do campeonato a que pertencem.",
    ]],
    ["Fluxo de cada campeonato", [
      "1. Participantes — monte a lista e controle as inscrições.",
      "2. Fase de grupos — grupos de 4 sorteados (2 D + 2 E) e 3 jogos por grupo.",
      "3. Classificação e súmulas — vitórias e pontos definem Ouro (1º e 2º) e Prata (3º e 4º).",
      "4. 2º sorteio — duplas fixas formadas por lado dentro de cada divisão.",
      "5. Chave final — mata-mata até a decisão.",
    ]],
    ["Regras aplicadas", [
      "A idade considera a data da competição de cada campeonato, não a data de hoje.",
      "Atletas Ambos entram como curinga e a falta de equilíbrio não bloqueia o sorteio.",
      "Fase de grupos sem dupla fixa: todos jogam com todos dentro do grupo.",
      "Classificação por soma de vitórias e, no desempate, por pontos.",
    ]],
  ];

  for (const [subtitulo, itens] of blocos) {
    const t = ws.addRow(["", subtitulo]);
    t.getCell(2).font = { bold: true, size: 11, color: { argb: MARINHO } };
    t.getCell(2).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFEEF3FC" },
    };
    for (const item of itens) {
      const r = ws.addRow(["", `•  ${item}`]);
      r.getCell(2).alignment = { wrapText: true, vertical: "middle" };
      r.getCell(2).font = { size: 10 };
    }
    ws.addRow([]);
  }
}

/** Monta o workbook inteiro a partir do estado, já formatado — sem tocar em disco. */
export async function montarWorkbook(estado: Estado): Promise<ExcelJS.Workbook> {
  const nomeAtleta = new Map(estado.atletas.map((a) => [a.id, a.nome]));
  const nomeCampeonato = new Map(estado.campeonatos.map((x) => [x.id, x.nome]));
  const nome = (id: string) => nomeAtleta.get(id) ?? id;
  const camp = (id: string) => nomeCampeonato.get(id) ?? id;
  const nomeDupla = (id: string | null) => {
    if (!id) return "";
    const d = estado.duplas.find((x) => x.id === id);
    return d ? `${nome(d.atletaD)} + ${nome(d.atletaE)}` : id;
  };

  const wb = new ExcelJS.Workbook();
  wb.creator = "Futevôlei Master Brasil — gestão de torneios";
  wb.created = new Date();

  montarInstrucoes(wb);
  montarConfig(wb, estado.config);
  montarAba(wb, "Faixas", ABAS.faixas, estado.config.faixas);

  montarAba(
    wb,
    "Campeonatos",
    ABAS.campeonatos,
    [...estado.campeonatos]
      .sort((a, b) => b.data.localeCompare(a.data))
      .map((x) => ({
        ...x,
        participantes: estado.participantes.filter((p) => p.campeonatoId === x.id).length,
      }))
  );

  montarAba(
    wb,
    "Atletas",
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
  montarAba(wb, "Participantes", ABAS.participantes, participantesCalculados);

  montarAba(
    wb,
    "Grupos",
    ABAS.grupos,
    [...estado.grupos]
      .sort(
        (x, y) =>
          x.campeonatoId.localeCompare(y.campeonatoId) ||
          x.categoria.localeCompare(y.categoria) ||
          x.grupo - y.grupo ||
          x.vaga - y.vaga
      )
      .map((g) => ({ ...g, campeonato: camp(g.campeonatoId), nome: nome(g.atletaId) }))
  );

  montarAba(
    wb,
    "Jogos",
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

  montarAba(
    wb,
    "Classificação",
    ABAS.classificacao,
    classificar(estado).map((l) => ({ ...l, campeonato: camp(l.campeonatoId) }))
  );

  montarAba(
    wb,
    "Duplas",
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

  montarAba(
    wb,
    "Mata-Mata",
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

  return wb;
}

/** Regrava a planilha local inteira a partir do estado, já formatada. */
export async function gravarEstado(estado: Estado): Promise<void> {
  const wb = await montarWorkbook(estado);
  await fs.mkdir(path.dirname(CAMINHO_PLANILHA), { recursive: true });
  await wb.xlsx.writeFile(CAMINHO_PLANILHA);
}

/** Mensagem clara quando o Excel está com o arquivo aberto. */
export function erroDeGravacao(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/EBUSY|EPERM|EACCES|resource busy|being used/i.test(msg))
    return "A planilha está aberta no Excel. Feche o arquivo e tente de novo.";
  return `Falha ao gravar a planilha: ${msg}`;
}

import { jsPDF } from "jspdf";
import autoTable, { type CellHook, type Styles } from "jspdf-autotable";
import { nomeDaFase } from "./regras";
import type { Campeonato, Divisao, Estado, LinhaClassificacao } from "./tipos";

const MARINHO: [number, number, number] = [11, 35, 80];
const MARINHO_CLARO: [number, number, number] = [238, 243, 252];
const DOURADO: [number, number, number] = [242, 194, 24];
const VERDE: [number, number, number] = [0, 156, 59];
const TINTA: [number, number, number] = [13, 21, 38];
const TINTA_2: [number, number, number] = [74, 85, 104];
const TINTA_3: [number, number, number] = [138, 147, 166];
const LINHA: [number, number, number] = [223, 229, 239];

const MARGEM = 14;
const LARGURA = 210;
const ALTURA = 297;

async function carregarEscudo(): Promise<string | null> {
  try {
    const resposta = await fetch("/logo-pequena.png");
    const blob = await resposta.blob();
    return await new Promise((resolve) => {
      const leitor = new FileReader();
      leitor.onloadend = () => resolve(String(leitor.result));
      leitor.onerror = () => resolve(null);
      leitor.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const dataBr = (iso: string) => {
  if (!iso) return "";
  const [a, m, d] = iso.split("-");
  return a && m && d ? `${d}/${m}/${a}` : iso;
};

/* --------------------------------------------- peças comuns às súmulas */

const CABECALHO_TABELA: Partial<Styles> = {
  fillColor: MARINHO,
  textColor: [255, 255, 255],
  fontSize: 8.5,
};

const corpoTabela = (fontSize: number, respiro: number): Partial<Styles> => ({
  font: "helvetica",
  fontSize,
  cellPadding: { top: respiro, bottom: respiro, left: 2.5, right: 2.5 },
  lineColor: LINHA,
  lineWidth: 0.2,
  textColor: TINTA,
});

/** Realça a coluna de divisão: Ouro em dourado escuro, Prata em cinza. */
const realcarDivisao =
  (coluna: number): CellHook =>
  (dados) => {
    if (dados.section !== "body" || dados.column.index !== coluna) return;
    if (dados.cell.raw === "Ouro") {
      dados.cell.styles.textColor = [138, 107, 2];
      dados.cell.styles.fontStyle = "bold";
    } else if (dados.cell.raw === "Prata") {
      dados.cell.styles.textColor = TINTA_2;
    }
  };

/** lastAutoTable é injetado no documento pelo plugin, fora da tipagem do jsPDF. */
const fimDaTabela = (doc: jsPDF) =>
  (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

/** Topo da folha: escudo, dados do campeonato e a faixa da bandeira. */
function cabecalho(
  doc: jsPDF,
  escudo: string | null,
  estado: Estado,
  campeonato: Campeonato,
  subtitulo: string,
  destaque: string
) {
  doc.setFillColor(...MARINHO);
  doc.rect(0, 0, LARGURA, 3, "F");

  if (escudo) doc.addImage(escudo, "PNG", MARGEM, 8, 22, 19.5, "escudo", "FAST");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...MARINHO);
  doc.text(campeonato.nome, MARGEM + 26, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...TINTA_2);
  doc.text(
    [subtitulo, dataBr(campeonato.data), campeonato.local].filter(Boolean).join("  ·  "),
    MARGEM + 26,
    19
  );
  doc.setFontSize(7.5);
  doc.setTextColor(...TINTA_3);
  doc.text(estado.config.organizacao, MARGEM + 26, 23.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...MARINHO);
  doc.text(destaque, LARGURA - MARGEM, 14, { align: "right" });

  // faixa da bandeira
  const largura = (LARGURA - MARGEM * 2) / 3;
  doc.setFillColor(...VERDE);
  doc.rect(MARGEM, 27, largura, 1.2, "F");
  doc.setFillColor(...DOURADO);
  doc.rect(MARGEM + largura, 27, largura, 1.2, "F");
  doc.setFillColor(...MARINHO);
  doc.rect(MARGEM + largura * 2, 27, largura, 1.2, "F");
}

function rodape(doc: jsPDF, campeonato: Campeonato) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LINHA);
    doc.setLineWidth(0.3);
    doc.line(MARGEM, ALTURA - 14, LARGURA - MARGEM, ALTURA - 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...TINTA_3);
    doc.text(
      `${campeonato.nome} · gerado em ${new Date().toLocaleString("pt-BR")}`,
      MARGEM,
      ALTURA - 9.5
    );
    doc.text(`Página ${i} de ${total}`, LARGURA - MARGEM, ALTURA - 9.5, {
      align: "right",
    });
  }
}

/** Faixa clara com o título de uma seção da folha. */
function faixaSecao(doc: jsPDF, y: number, titulo: string) {
  doc.setFillColor(...MARINHO_CLARO);
  doc.roundedRect(MARGEM, y - 5, LARGURA - MARGEM * 2, 7, 1.2, 1.2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...MARINHO);
  doc.text(titulo, MARGEM + 3, y - 0.2);
}

/** Linhas de assinatura no pé da folha, abaixo da última tabela. */
function assinaturas(doc: jsPDF) {
  const y = Math.max(fimDaTabela(doc) + 24, ALTURA - 40);
  doc.setDrawColor(...TINTA_3);
  doc.setLineWidth(0.3);
  doc.line(MARGEM, y, MARGEM + 75, y);
  doc.line(LARGURA - MARGEM - 75, y, LARGURA - MARGEM, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TINTA_2);
  doc.text("Assinatura do responsável", MARGEM + 37.5, y + 4, { align: "center" });
  doc.text("Assinatura dos atletas", LARGURA - MARGEM - 37.5, y + 4, { align: "center" });
}

function salvar(doc: jsPDF, campeonato: Campeonato, prefixo: string, sufixo: string) {
  const limpo = campeonato.nome
    .normalize("NFD")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  doc.save(`${prefixo}-${limpo}${sufixo}.pdf`);
}

/* ------------------------------------------- súmulas da fase de grupos */

interface Contexto {
  estado: Estado;
  campeonato: Campeonato;
  classificacao: LinhaClassificacao[];
  categoria?: string;
  /** Ignora os placares já lançados e não imprime a classificação — folha em branco para organizar os jogos. */
  emBranco?: boolean;
}

/**
 * Súmulas da fase de grupos + classificação, em PDF, com o escudo no
 * cabeçalho e a faixa da bandeira como assinatura visual.
 */
export async function gerarPdfSumulas({
  estado,
  campeonato,
  classificacao,
  categoria,
  emBranco = false,
}: Contexto): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const escudo = await carregarEscudo();
  const nome = new Map(estado.atletas.map((a) => [a.id, a.nome]));

  const grupos = estado.grupos.filter(
    (g) => g.campeonatoId === campeonato.id && (!categoria || g.categoria === categoria)
  );
  const jogos = estado.jogos.filter(
    (j) => j.campeonatoId === campeonato.id && (!categoria || j.categoria === categoria)
  );

  const chaves = [
    ...new Set(grupos.map((g) => `${g.categoria}||${g.grupo}`)),
  ].sort((a, b) => {
    const [ca, ga] = a.split("||");
    const [cb, gb] = b.split("||");
    return ca.localeCompare(cb) || Number(ga) - Number(gb);
  });

  /* ------------------------------------------------- uma súmula por grupo */
  chaves.forEach((chave, indice) => {
    const [cat, grupoTexto] = chave.split("||");
    const grupo = Number(grupoTexto);
    if (indice > 0) doc.addPage();

    cabecalho(
      doc,
      escudo,
      estado,
      campeonato,
      emBranco ? "Súmula em branco — organização dos jogos" : "Súmula da fase de grupos",
      `${cat} · Grupo ${grupo}`
    );

    const ladoDe = new Map(
      grupos
        .filter((g) => g.categoria === cat && g.grupo === grupo)
        .map((g) => [g.atletaId, g.ladoNoGrupo])
    );

    let inicio = 34;

    // a súmula em branco é só a lista de jogos; a da classificação abre com os
    // atletas do grupo e as vitórias já contabilizadas
    if (!emBranco) {
      const doGrupo = classificacao
        .filter(
          (l) =>
            l.campeonatoId === campeonato.id && l.categoria === cat && l.grupo === grupo
        )
        .sort((a, b) => a.posicao - b.posicao);

      autoTable(doc, {
        startY: inicio,
        margin: { left: MARGEM, right: MARGEM },
        head: [
          ["Pos.", "Atleta", "Lado", "Vitórias", "Pontos pró", "Saldo", "Divisão"],
        ],
        body: doGrupo.map((l) => [
          `${l.posicao}º`,
          l.nome,
          ladoDe.get(l.atletaId) ?? "",
          String(l.vitorias),
          String(l.pontosPro),
          l.saldo > 0 ? `+${l.saldo}` : String(l.saldo),
          l.jogos > 0 ? (l.divisao ?? "") : "—",
        ]),
        theme: "grid",
        headStyles: CABECALHO_TABELA,
        styles: corpoTabela(9, 3),
        columnStyles: {
          0: { cellWidth: 14, halign: "center", fontStyle: "bold" },
          1: { cellWidth: 62 },
          2: { cellWidth: 18, halign: "center" },
          3: { cellWidth: 22, halign: "center", fontStyle: "bold" },
          4: { cellWidth: 24, halign: "center" },
          5: { cellWidth: 18, halign: "center" },
          6: { cellWidth: 24, halign: "center" },
        },
        didParseCell: realcarDivisao(6),
      });

      const y = fimDaTabela(doc) + 8;
      faixaSecao(doc, y, "JOGOS DO GRUPO");
      inicio = y + 5;
    }

    autoTable(doc, {
      startY: inicio,
      margin: { left: MARGEM, right: MARGEM },
      head: [["Jogo", "Dupla A", "Pontos", "Pontos", "Dupla B"]],
      body: jogos
        .filter((j) => j.categoria === cat && j.grupo === grupo)
        .sort((a, b) => a.rodada - b.rodada)
        .map((j) => [
          String(j.rodada),
          `${nome.get(j.duplaA[0]) ?? ""} + ${nome.get(j.duplaA[1]) ?? ""}`,
          emBranco || j.pontosA === null ? "" : String(j.pontosA),
          emBranco || j.pontosB === null ? "" : String(j.pontosB),
          `${nome.get(j.duplaB[0]) ?? ""} + ${nome.get(j.duplaB[1]) ?? ""}`,
        ]),
      theme: "grid",
      headStyles: CABECALHO_TABELA,
      styles: corpoTabela(9, 4),
      columnStyles: {
        0: { cellWidth: 14, halign: "center" },
        1: { cellWidth: 62 },
        2: { cellWidth: 18, halign: "center", fontStyle: "bold" },
        3: { cellWidth: 18, halign: "center", fontStyle: "bold" },
        4: { cellWidth: 70 },
      },
    });

    assinaturas(doc);
  });

  /* --------------------------------------------- classificação por grupo */
  const linhas = classificacao.filter(
    (l) => l.campeonatoId === campeonato.id && (!categoria || l.categoria === categoria)
  );
  if (!emBranco && linhas.some((l) => l.jogos > 0)) {
    doc.addPage();
    cabecalho(
      doc,
      escudo,
      estado,
      campeonato,
      "Classificação da fase de grupos",
      categoria ?? "Todas as categorias"
    );

    autoTable(doc, {
      startY: 34,
      margin: { left: MARGEM, right: MARGEM },
      head: [
        ["Categoria", "Grupo", "Pos.", "Atleta", "V", "Pontos pró", "Saldo", "Divisão"],
      ],
      body: linhas.map((l) => [
        l.categoria,
        String(l.grupo),
        `${l.posicao}º`,
        l.nome,
        String(l.vitorias),
        String(l.pontosPro),
        l.saldo > 0 ? `+${l.saldo}` : String(l.saldo),
        l.jogos > 0 ? (l.divisao ?? "") : "—",
      ]),
      theme: "grid",
      headStyles: CABECALHO_TABELA,
      styles: corpoTabela(8.5, 2.4),
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 16, halign: "center" },
        2: { cellWidth: 14, halign: "center", fontStyle: "bold" },
        3: { cellWidth: 58 },
        4: { cellWidth: 12, halign: "center", fontStyle: "bold" },
        5: { cellWidth: 24, halign: "center" },
        6: { cellWidth: 16, halign: "center" },
        7: { cellWidth: 18, halign: "center" },
      },
      didParseCell: realcarDivisao(7),
    });
  }

  rodape(doc, campeonato);
  salvar(doc, campeonato, "sumulas", categoria ? `-${categoria}` : "");
}

/* ---------------------------------------- súmulas do 2º sorteio (duplas) */

interface ContextoDuplas {
  estado: Estado;
  campeonato: Campeonato;
  /** Sem categoria, sai uma folha por categoria que tenha duplas. */
  categoria?: string;
  /** Sem divisão, saem o Ouro e a Prata. */
  divisao?: Divisao;
}

/**
 * Linhas em branco com a estrutura da chave que aquelas duplas vão formar —
 * usada enquanto o mata-mata ainda não foi montado, para o operador conduzir
 * os confrontos no papel.
 */
function chaveEmBranco(quantidadeDeDuplas: number): string[][] {
  let tamanho = 2;
  while (tamanho < quantidadeDeDuplas) tamanho *= 2;

  const linhas: string[][] = [];
  for (let restantes = tamanho; restantes >= 2; restantes /= 2)
    for (let jogo = 1; jogo <= restantes / 2; jogo++)
      linhas.push([nomeDaFase(restantes), String(jogo), "", "", "", ""]);
  return linhas;
}

/**
 * Súmula da segunda fase: uma folha por divisão (Ouro e Prata) com as duplas
 * fixas sorteadas e os confrontos do mata-mata. Enquanto a chave não é
 * montada, os confrontos saem em branco já na estrutura certa.
 */
export async function gerarPdfSumulasDuplas({
  estado,
  campeonato,
  categoria,
  divisao,
}: ContextoDuplas): Promise<void> {
  const duplas = estado.duplas.filter(
    (d) =>
      d.campeonatoId === campeonato.id &&
      (!categoria || d.categoria === categoria) &&
      (!divisao || d.divisao === divisao)
  );
  if (!duplas.length) return;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const escudo = await carregarEscudo();
  const nome = new Map(estado.atletas.map((a) => [a.id, a.nome]));
  const grupoDe = new Map(
    estado.grupos
      .filter((g) => g.campeonatoId === campeonato.id)
      .map((g) => [g.atletaId, g.grupo])
  );
  const nomeDupla = (id: string | null) => {
    const d = id ? estado.duplas.find((x) => x.id === id) : undefined;
    return d ? `${nome.get(d.atletaD) ?? ""} + ${nome.get(d.atletaE) ?? ""}` : "";
  };

  // uma folha por categoria × divisão, com o Ouro sempre antes da Prata
  const chaves = [...new Set(duplas.map((d) => `${d.categoria}||${d.divisao}`))].sort(
    (a, b) => {
      const [ca, da] = a.split("||");
      const [cb, db] = b.split("||");
      return ca.localeCompare(cb) || (da === db ? 0 : da === "Ouro" ? -1 : 1);
    }
  );

  chaves.forEach((chave, indice) => {
    const [cat, div] = chave.split("||");
    if (indice > 0) doc.addPage();

    cabecalho(
      doc,
      escudo,
      estado,
      campeonato,
      "Súmula do 2º sorteio — duplas fixas",
      `${cat} · Divisão ${div}`
    );

    const daDivisao = duplas
      .filter((d) => d.categoria === cat && d.divisao === div)
      .sort((a, b) => a.numero - b.numero);

    autoTable(doc, {
      startY: 34,
      margin: { left: MARGEM, right: MARGEM },
      head: [["Dupla", "Atleta lado D", "Atleta lado E", "Grupos", "Colocação"]],
      body: daDivisao.map((d) => [
        String(d.numero),
        nome.get(d.atletaD) ?? d.atletaD,
        nome.get(d.atletaE) ?? d.atletaE,
        [grupoDe.get(d.atletaD), grupoDe.get(d.atletaE)]
          .filter((g): g is number => g !== undefined)
          .map((g) => `G${g}`)
          .join(" · "),
        "",
      ]),
      theme: "grid",
      headStyles: CABECALHO_TABELA,
      styles: corpoTabela(9, 3),
      columnStyles: {
        0: { cellWidth: 16, halign: "center", fontStyle: "bold" },
        1: { cellWidth: 56 },
        2: { cellWidth: 56 },
        3: { cellWidth: 24, halign: "center" },
        4: { cellWidth: 30, halign: "center" },
      },
    });

    const y = fimDaTabela(doc) + 8;
    faixaSecao(doc, y, "CONFRONTOS DA CHAVE");

    const daChave = estado.mataMata
      .filter(
        (m) =>
          m.campeonatoId === campeonato.id && m.categoria === cat && m.divisao === div
      )
      .sort((a, b) => a.ordemFase - b.ordemFase || a.jogo - b.jogo);

    autoTable(doc, {
      startY: y + 5,
      margin: { left: MARGEM, right: MARGEM },
      head: [["Fase", "Jogo", "Dupla A", "Pontos", "Pontos", "Dupla B"]],
      body: daChave.length
        ? daChave.map((m) => [
            m.fase,
            String(m.jogo),
            nomeDupla(m.duplaA),
            m.pontosA === null ? "" : String(m.pontosA),
            m.pontosB === null ? "" : String(m.pontosB),
            nomeDupla(m.duplaB),
          ])
        : chaveEmBranco(daDivisao.length),
      theme: "grid",
      headStyles: CABECALHO_TABELA,
      styles: corpoTabela(9, 4),
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 12, halign: "center" },
        2: { cellWidth: 54 },
        3: { cellWidth: 17, halign: "center", fontStyle: "bold" },
        4: { cellWidth: 17, halign: "center", fontStyle: "bold" },
        5: { cellWidth: 54 },
      },
    });

    assinaturas(doc);
  });

  rodape(doc, campeonato);
  salvar(
    doc,
    campeonato,
    "sumulas-duplas",
    `${categoria ? `-${categoria}` : ""}${divisao ? `-${divisao}` : ""}`
  );
}

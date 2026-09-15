import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Campeonato, Estado, LinhaClassificacao } from "./tipos";

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

  const cabecalho = (subtitulo: string, destaque: string) => {
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
      [subtitulo, dataBr(campeonato.data), campeonato.local]
        .filter(Boolean)
        .join("  ·  "),
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
  };

  const rodape = () => {
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
  };

  /* ------------------------------------------------- uma súmula por grupo */
  chaves.forEach((chave, indice) => {
    const [cat, grupoTexto] = chave.split("||");
    const grupo = Number(grupoTexto);
    if (indice > 0) doc.addPage();

    cabecalho(
      emBranco ? "Súmula em branco — organização dos jogos" : "Súmula da fase de grupos",
      `${cat} · Grupo ${grupo}`
    );

    const integrantes = grupos
      .filter((g) => g.categoria === cat && g.grupo === grupo)
      .sort((a, b) => a.vaga - b.vaga);

    autoTable(doc, {
      startY: 34,
      margin: { left: MARGEM, right: MARGEM },
      head: [["Vaga", "Atleta", "Lado", "Vitórias", "Pontos", "Posição"]],
      body: integrantes.map((g) => [
        String(g.vaga),
        nome.get(g.atletaId) ?? g.atletaId,
        g.ladoNoGrupo,
        "",
        "",
        "",
      ]),
      theme: "grid",
      headStyles: { fillColor: MARINHO, textColor: [255, 255, 255], fontSize: 8.5 },
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: { top: 3, bottom: 3, left: 2.5, right: 2.5 },
        lineColor: LINHA,
        lineWidth: 0.2,
        textColor: TINTA,
      },
      columnStyles: {
        0: { cellWidth: 14, halign: "center" },
        1: { cellWidth: 70 },
        2: { cellWidth: 18, halign: "center" },
        3: { cellWidth: 25, halign: "center" },
        4: { cellWidth: 25, halign: "center" },
        5: { cellWidth: 30, halign: "center" },
      },
    });

    // @ts-expect-error lastAutoTable é injetado pelo plugin
    const y = doc.lastAutoTable.finalY + 8;
    doc.setFillColor(...MARINHO_CLARO);
    doc.roundedRect(MARGEM, y - 5, LARGURA - MARGEM * 2, 7, 1.2, 1.2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...MARINHO);
    doc.text("JOGOS DO GRUPO", MARGEM + 3, y - 0.2);

    autoTable(doc, {
      startY: y + 5,
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
      headStyles: { fillColor: MARINHO, textColor: [255, 255, 255], fontSize: 8.5 },
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: { top: 4, bottom: 4, left: 2.5, right: 2.5 },
        lineColor: LINHA,
        lineWidth: 0.2,
        textColor: TINTA,
      },
      columnStyles: {
        0: { cellWidth: 14, halign: "center" },
        1: { cellWidth: 62 },
        2: { cellWidth: 18, halign: "center", fontStyle: "bold" },
        3: { cellWidth: 18, halign: "center", fontStyle: "bold" },
        4: { cellWidth: 70 },
      },
    });

    // @ts-expect-error lastAutoTable é injetado pelo plugin
    const yAss = Math.max(doc.lastAutoTable.finalY + 24, ALTURA - 40);
    doc.setDrawColor(...TINTA_3);
    doc.setLineWidth(0.3);
    doc.line(MARGEM, yAss, MARGEM + 75, yAss);
    doc.line(LARGURA - MARGEM - 75, yAss, LARGURA - MARGEM, yAss);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TINTA_2);
    doc.text("Assinatura do responsável", MARGEM + 37.5, yAss + 4, { align: "center" });
    doc.text("Assinatura dos atletas", LARGURA - MARGEM - 37.5, yAss + 4, {
      align: "center",
    });
  });

  /* --------------------------------------------- classificação por grupo */
  const linhas = classificacao.filter(
    (l) => l.campeonatoId === campeonato.id && (!categoria || l.categoria === categoria)
  );
  if (!emBranco && linhas.some((l) => l.jogos > 0)) {
    doc.addPage();
    cabecalho("Classificação da fase de grupos", categoria ?? "Todas as categorias");

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
      headStyles: { fillColor: MARINHO, textColor: [255, 255, 255], fontSize: 8.5 },
      styles: {
        font: "helvetica",
        fontSize: 8.5,
        cellPadding: { top: 2.4, bottom: 2.4, left: 2.5, right: 2.5 },
        lineColor: LINHA,
        lineWidth: 0.2,
        textColor: TINTA,
      },
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
      didParseCell: (dados) => {
        if (dados.section === "body" && dados.column.index === 7) {
          if (dados.cell.raw === "Ouro") {
            dados.cell.styles.textColor = [138, 107, 2];
            dados.cell.styles.fontStyle = "bold";
          } else if (dados.cell.raw === "Prata") {
            dados.cell.styles.textColor = TINTA_2;
          }
        }
      },
    });
  }

  rodape();

  const limpo = campeonato.nome
    .normalize("NFD")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  doc.save(`sumulas-${limpo}${categoria ? `-${categoria}` : ""}.pdf`);
}

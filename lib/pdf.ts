import { jsPDF } from "jspdf";
import autoTable, { type CellHook, type Styles } from "jspdf-autotable";
import { classificar, nomeDaFase } from "./regras";
import { maiusculo } from "./texto";
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
/** Dobra da folha: cada súmula compacta ocupa uma A5 deitada. */
const MEIA = ALTURA / 2;

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

/* ------------------------------------------------ slots: folha e metades */

/**
 * Onde a súmula é desenhada. A largura útil é sempre a mesma (182 mm), então
 * as colunas não mudam; o que muda é o topo e a altura disponível — folha
 * inteira ou meia folha.
 */
interface Slot {
  /** Topo do slot dentro da folha. */
  y0: number;
  /** Altura disponível a partir de y0. */
  altura: number;
  /** Súmula compacta (meia A4) em vez de página inteira. */
  meia: boolean;
}

const FOLHA_INTEIRA: Slot = { y0: 0, altura: ALTURA, meia: false };
const SLOT_TOPO: Slot = { y0: 0, altura: MEIA, meia: true };
const SLOT_BASE: Slot = { y0: MEIA, altura: MEIA, meia: true };

/** Acima disso a súmula não cabe na metade e vai sozinha para uma folha. */
const LIMITE_MEIA = 144;

/** Desenha uma súmula dentro do slot e devolve o y em que ela termina. */
type Sumula = (doc: jsPDF, slot: Slot) => number;

/** Folha montada, guardada para fechar rodapé e linha de corte no fim. */
interface Folha {
  pagina: number;
  meia: boolean;
  slots: Slot[];
}

/* --------------------------------------------- peças comuns às súmulas */

const CABECALHO_TABELA: Partial<Styles> = {
  fillColor: MARINHO,
  textColor: [255, 255, 255],
  fontSize: 8.5,
};

const corpoTabela = (
  fontSize: number,
  respiro: number,
  alturaMinima = 0
): Partial<Styles> => ({
  font: "helvetica",
  fontSize,
  cellPadding: { top: respiro, bottom: respiro, left: 2.5, right: 2.5 },
  lineColor: LINHA,
  lineWidth: 0.2,
  textColor: TINTA,
  minCellHeight: alturaMinima,
});

/**
 * Na meia folha a tabela não pode quebrar de página: o encaixe já foi medido
 * antes de desenhar, então as margens de topo e de pé saem do caminho.
 */
const margemTabela = (slot: Slot) =>
  slot.meia
    ? { left: MARGEM, right: MARGEM, top: 0, bottom: 0 }
    : { left: MARGEM, right: MARGEM };

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

/** Faixa verde-amarelo-azul, a assinatura visual do cabeçalho. */
function faixaTricolor(doc: jsPDF, y: number) {
  const largura = (LARGURA - MARGEM * 2) / 3;
  doc.setFillColor(...VERDE);
  doc.rect(MARGEM, y, largura, 1.2, "F");
  doc.setFillColor(...DOURADO);
  doc.rect(MARGEM + largura, y, largura, 1.2, "F");
  doc.setFillColor(...MARINHO);
  doc.rect(MARGEM + largura * 2, y, largura, 1.2, "F");
}

/**
 * Topo do slot: escudo, dados do campeonato e a faixa da bandeira. Devolve o y
 * em que o conteúdo começa — y0+34 na folha inteira, y0+23 na meia folha.
 */
function cabecalho(
  doc: jsPDF,
  slot: Slot,
  escudo: string | null,
  estado: Estado,
  campeonato: Campeonato,
  subtitulo: string,
  destaque: string
): number {
  const { y0, meia } = slot;

  doc.setFillColor(...MARINHO);
  doc.rect(0, y0, LARGURA, meia ? 2.5 : 3, "F");

  if (meia) {
    // escudo de 14 mm de altura, na proporção do original de 22 × 19,5
    if (escudo) doc.addImage(escudo, "PNG", MARGEM, y0 + 4.5, 15.8, 14, "escudo", "FAST");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...MARINHO);
    doc.text(campeonato.nome, MARGEM + 18, y0 + 10);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...TINTA_2);
    doc.text(
      [subtitulo, dataBr(campeonato.data), campeonato.local].filter(Boolean).join("  ·  "),
      MARGEM + 18,
      y0 + 15
    );

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...MARINHO);
    doc.text(destaque, LARGURA - MARGEM, y0 + 10, { align: "right" });

    faixaTricolor(doc, y0 + 19);
    return y0 + 23;
  }

  if (escudo) doc.addImage(escudo, "PNG", MARGEM, y0 + 8, 22, 19.5, "escudo", "FAST");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...MARINHO);
  doc.text(campeonato.nome, MARGEM + 26, y0 + 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...TINTA_2);
  doc.text(
    [subtitulo, dataBr(campeonato.data), campeonato.local].filter(Boolean).join("  ·  "),
    MARGEM + 26,
    y0 + 19
  );
  doc.setFontSize(7.5);
  doc.setTextColor(...TINTA_3);
  doc.text(estado.config.organizacao, MARGEM + 26, y0 + 23.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...MARINHO);
  doc.text(destaque, LARGURA - MARGEM, y0 + 14, { align: "right" });

  faixaTricolor(doc, y0 + 27);
  return y0 + 34;
}

/** Faixa clara com o título de uma seção da súmula. */
function faixaSecao(doc: jsPDF, slot: Slot, y: number, titulo: string) {
  const alto = slot.meia ? 5.5 : 7;
  doc.setFillColor(...MARINHO_CLARO);
  doc.roundedRect(MARGEM, y - alto + 2, LARGURA - MARGEM * 2, alto, 1.2, 1.2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(slot.meia ? 8 : 9);
  doc.setTextColor(...MARINHO);
  doc.text(titulo, MARGEM + 3, y - 0.2);
}

/**
 * Linhas de assinatura. Na meia folha vêm logo abaixo da última tabela, dentro
 * do slot; na folha inteira continuam presas ao pé da página. Devolve o y em
 * que a súmula termina.
 */
function assinaturas(doc: jsPDF, slot: Slot): number {
  const y = slot.meia
    ? fimDaTabela(doc) + 12
    : Math.max(fimDaTabela(doc) + 24, ALTURA - 40);
  const largura = slot.meia ? 62 : 75;
  const respiro = slot.meia ? 3.5 : 4;

  doc.setDrawColor(...TINTA_3);
  doc.setLineWidth(0.3);
  doc.line(MARGEM, y, MARGEM + largura, y);
  doc.line(LARGURA - MARGEM - largura, y, LARGURA - MARGEM, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(slot.meia ? 7 : 8);
  doc.setTextColor(...TINTA_2);
  doc.text("Assinatura do responsável", MARGEM + largura / 2, y + respiro, {
    align: "center",
  });
  doc.text("Assinatura dos atletas", LARGURA - MARGEM - largura / 2, y + respiro, {
    align: "center",
  });

  return y + respiro + 1.5;
}

/** Rodapé da folha inteira: linha e dois textos no pé da página. */
function rodapeInteiro(doc: jsPDF, campeonato: Campeonato, pagina: number, total: number) {
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
  doc.text(`Página ${pagina} de ${total}`, LARGURA - MARGEM, ALTURA - 9.5, {
    align: "right",
  });
}

/** Rodapé da meia folha: uma linha só, dentro do próprio slot. */
function rodapeDoSlot(
  doc: jsPDF,
  slot: Slot,
  estado: Estado,
  pagina: number,
  total: number
) {
  const y = slot.y0 + slot.altura - 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...TINTA_3);
  doc.text(estado.config.organizacao, MARGEM, y);
  doc.text(`Página ${pagina} de ${total}`, LARGURA - MARGEM, y, { align: "right" });
}

/** Onde a tesoura passa. Sem o caractere ✂ — a helvetica do jsPDF não tem o glifo. */
function linhaDeCorte(doc: jsPDF) {
  doc.setDrawColor(...TINTA_3);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(MARGEM, MEIA, LARGURA - MARGEM, MEIA);
  doc.setLineDashPattern([], 0);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...TINTA_3);
  doc.text("recortar", LARGURA - MARGEM, MEIA - 1.4, { align: "right" });
}

/* ------------------------------------------------- montagem das folhas */

/**
 * Mede a súmula num documento descartável: se couber em LIMITE_MEIA ela entra
 * numa metade; se estourar (grupo grande, nome comprido quebrando linha) vai
 * para a folha inteira. É o que garante que nenhuma tabela seja cortada entre
 * as duas metades nem entre páginas.
 */
function medidor() {
  let teste: jsPDF | null = null;
  return (sumula: Sumula): boolean => {
    if (teste) teste.addPage();
    else teste = new jsPDF({ unit: "mm", format: "a4" });
    const antes = teste.getNumberOfPages();
    const fim = sumula(teste, SLOT_TOPO);
    return teste.getNumberOfPages() === antes && fim <= LIMITE_MEIA;
  };
}

function abrirFolha(doc: jsPDF, folhas: Folha[], meia: boolean): Folha {
  if (folhas.length) doc.addPage();
  const folha: Folha = { pagina: doc.getNumberOfPages(), meia, slots: [] };
  folhas.push(folha);
  return folha;
}

/** Abre uma folha inteira e devolve o slot para desenhar nela. */
function folhaInteira(doc: jsPDF, folhas: Folha[]): Slot {
  abrirFolha(doc, folhas, false).slots.push(FOLHA_INTEIRA);
  return FOLHA_INTEIRA;
}

/** Uma súmula por folha inteira, sem medir — para a súmula da chave final. */
function montarEmFolhasInteiras(doc: jsPDF, folhas: Folha[], sumulas: Sumula[]) {
  for (const sumula of sumulas) sumula(doc, folhaInteira(doc, folhas));
}

/**
 * Percorre as súmulas na ordem recebida preenchendo a metade de cima, depois a
 * de baixo, depois uma folha nova. Com número ímpar, a última metade fica em
 * branco. A que não couber na metade toma uma folha inteira só para ela.
 */
function montar(doc: jsPDF, folhas: Folha[], sumulas: Sumula[]) {
  const cabe = medidor();
  let atual: Folha | null = null;

  for (const sumula of sumulas) {
    if (cabe(sumula)) {
      if (!atual || atual.slots.length >= 2) atual = abrirFolha(doc, folhas, true);
      const slot = atual.slots.length === 0 ? SLOT_TOPO : SLOT_BASE;
      sumula(doc, slot);
      atual.slots.push(slot);
    } else {
      sumula(doc, folhaInteira(doc, folhas));
      atual = null;
    }
  }
}

/** Rodapés e linhas de corte, já com o total de páginas fechado. */
function finalizar(doc: jsPDF, estado: Estado, campeonato: Campeonato, folhas: Folha[]) {
  const total = doc.getNumberOfPages();
  const porPagina = new Map(folhas.map((f) => [f.pagina, f]));

  for (let pagina = 1; pagina <= total; pagina++) {
    doc.setPage(pagina);
    const folha = porPagina.get(pagina);
    // páginas que a própria tabela criou ao transbordar também levam rodapé
    if (!folha || !folha.meia) {
      rodapeInteiro(doc, campeonato, pagina, total);
      continue;
    }
    for (const slot of folha.slots) rodapeDoSlot(doc, slot, estado, pagina, total);
    if (folha.slots.length === 2) linhaDeCorte(doc);
  }
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
 * Súmulas da fase de grupos + classificação, em PDF, duas por folha A4, com o
 * escudo no cabeçalho e a faixa da bandeira como assinatura visual.
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
  const nome = new Map(estado.atletas.map((a) => [a.id, maiusculo(a.nome)]));

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

  const subtitulo = emBranco
    ? "Súmula em branco — organização dos jogos"
    : "Súmula da fase de grupos";

  /* ------------------------------------------------- uma súmula por grupo */
  const sumulas: Sumula[] = chaves.map((chave) => {
    const [cat, grupoTexto] = chave.split("||");
    const grupo = Number(grupoTexto);

    const ladoDe = new Map(
      grupos
        .filter((g) => g.categoria === cat && g.grupo === grupo)
        .map((g) => [g.atletaId, g.ladoNoGrupo])
    );

    const doGrupo = classificacao
      .filter(
        (l) => l.campeonatoId === campeonato.id && l.categoria === cat && l.grupo === grupo
      )
      .sort((a, b) => a.posicao - b.posicao);

    const jogosDoGrupo = jogos
      .filter((j) => j.categoria === cat && j.grupo === grupo)
      .sort((a, b) => a.rodada - b.rodada);

    return (folha, slot) => {
      let inicio = cabecalho(
        folha,
        slot,
        escudo,
        estado,
        campeonato,
        subtitulo,
        `${cat} · Grupo ${grupo}`
      );

      // a súmula em branco é só a lista de jogos; a da classificação abre com
      // os atletas do grupo e as vitórias já contabilizadas
      if (!emBranco) {
        autoTable(folha, {
          startY: inicio,
          margin: margemTabela(slot),
          head: [
            ["Pos.", "Atleta", "Lado", "Vitórias", "Pontos pró", "Saldo", "Divisão"],
          ],
          body: doGrupo.map((l) => [
            `${l.posicao}º`,
            maiusculo(l.nome),
            ladoDe.get(l.atletaId) ?? "",
            String(l.vitorias),
            String(l.pontosPro),
            l.saldo > 0 ? `+${l.saldo}` : String(l.saldo),
            l.jogos > 0 ? (l.divisao ?? "") : "—",
          ]),
          theme: "grid",
          headStyles: CABECALHO_TABELA,
          styles: slot.meia ? corpoTabela(8, 1.5) : corpoTabela(9, 3),
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

        const y = fimDaTabela(folha) + (slot.meia ? 6 : 8);
        faixaSecao(folha, slot, y, "JOGOS DO GRUPO");
        inicio = y + (slot.meia ? 4 : 5);
      }

      autoTable(folha, {
        startY: inicio,
        margin: margemTabela(slot),
        head: [["Jogo", "Dupla A", "Pontos", "Pontos", "Dupla B"]],
        body: jogosDoGrupo.map((j) => [
          String(j.rodada),
          `${nome.get(j.duplaA[0]) ?? ""} + ${nome.get(j.duplaA[1]) ?? ""}`,
          emBranco || j.pontosA === null ? "" : String(j.pontosA),
          emBranco || j.pontosB === null ? "" : String(j.pontosB),
          `${nome.get(j.duplaB[0]) ?? ""} + ${nome.get(j.duplaB[1]) ?? ""}`,
        ]),
        theme: "grid",
        headStyles: CABECALHO_TABELA,
        // o placar é escrito à mão: na meia folha a linha ganha altura mínima
        styles: slot.meia ? corpoTabela(8.5, 1.5, 7) : corpoTabela(9, 4),
        columnStyles: {
          0: { cellWidth: 14, halign: "center" },
          1: { cellWidth: 62 },
          2: { cellWidth: 18, halign: "center", fontStyle: "bold" },
          3: { cellWidth: 18, halign: "center", fontStyle: "bold" },
          4: { cellWidth: 70 },
        },
      });

      return assinaturas(folha, slot);
    };
  });

  const folhas: Folha[] = [];
  montar(doc, folhas, sumulas);

  /* --------------------------------------------- classificação por grupo */
  const linhas = classificacao.filter(
    (l) => l.campeonatoId === campeonato.id && (!categoria || l.categoria === categoria)
  );
  if (!emBranco && linhas.some((l) => l.jogos > 0)) {
    // esta continua sendo uma folha inteira
    const slot = folhaInteira(doc, folhas);
    const inicio = cabecalho(
      doc,
      slot,
      escudo,
      estado,
      campeonato,
      "Classificação da fase de grupos",
      categoria ?? "Todas as categorias"
    );

    autoTable(doc, {
      startY: inicio,
      margin: margemTabela(slot),
      head: [
        ["Categoria", "Grupo", "Pos.", "Atleta", "V", "Pontos pró", "Saldo", "Divisão"],
      ],
      body: linhas.map((l) => [
        l.categoria,
        String(l.grupo),
        `${l.posicao}º`,
        maiusculo(l.nome),
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

  finalizar(doc, estado, campeonato, folhas);
  salvar(doc, campeonato, "sumulas", categoria ? `-${categoria}` : "");
}

/* -------------------------- súmulas de grupo do formato duplas fechadas */

interface ContextoGruposDuplas {
  estado: Estado;
  campeonato: Campeonato;
  categoria?: string;
  /** Folha em branco, só com os jogos, para anotar o placar na quadra. */
  emBranco?: boolean;
}

/**
 * Súmulas da fase de grupos quando o grupo é de duplas fechadas: a linha da
 * classificação é da dupla, não do atleta. Mesmo motor de duas por folha, com o
 * mesmo fallback para folha inteira.
 */
export async function gerarPdfSumulasGruposDuplas({
  estado,
  campeonato,
  categoria,
  emBranco = false,
}: ContextoGruposDuplas): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const escudo = await carregarEscudo();
  const nome = new Map(estado.atletas.map((a) => [a.id, maiusculo(a.nome)]));
  const duplaPorId = new Map(estado.duplas.map((d) => [d.id, d]));
  const nomeDoPar = (par: [string, string]) =>
    `${nome.get(par[0]) ?? ""} + ${nome.get(par[1]) ?? ""}`;

  const classificacao = classificar(estado, campeonato.id).filter(
    (l) => !categoria || l.categoria === categoria
  );
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

  const subtitulo = emBranco
    ? "Súmula em branco — duplas fechadas"
    : "Súmula da fase de grupos — duplas fechadas";

  const sumulas: Sumula[] = chaves.map((chave) => {
    const [cat, grupoTexto] = chave.split("||");
    const grupo = Number(grupoTexto);

    const doGrupo = classificacao
      .filter((l) => l.categoria === cat && l.grupo === grupo)
      .sort((a, b) => a.posicao - b.posicao);

    const jogosDoGrupo = jogos
      .filter((j) => j.categoria === cat && j.grupo === grupo)
      .sort((a, b) => a.rodada - b.rodada);

    return (folha, slot) => {
      let inicio = cabecalho(
        folha,
        slot,
        escudo,
        estado,
        campeonato,
        subtitulo,
        `${cat} · Grupo ${grupo}`
      );

      if (!emBranco) {
        autoTable(folha, {
          startY: inicio,
          margin: margemTabela(slot),
          head: [["Pos.", "Dupla", "V", "Pontos pró", "Saldo"]],
          body: doGrupo.map((l) => [
            `${l.posicao}º`,
            maiusculo(l.nome),
            String(l.vitorias),
            String(l.pontosPro),
            l.saldo > 0 ? `+${l.saldo}` : String(l.saldo),
          ]),
          theme: "grid",
          headStyles: CABECALHO_TABELA,
          styles: slot.meia ? corpoTabela(8, 1.5) : corpoTabela(9, 3),
          columnStyles: {
            0: { cellWidth: 14, halign: "center", fontStyle: "bold" },
            1: { cellWidth: 96 },
            2: { cellWidth: 18, halign: "center", fontStyle: "bold" },
            3: { cellWidth: 28, halign: "center" },
            4: { cellWidth: 26, halign: "center" },
          },
        });

        const y = fimDaTabela(folha) + (slot.meia ? 6 : 8);
        faixaSecao(folha, slot, y, "JOGOS DO GRUPO");
        inicio = y + (slot.meia ? 4 : 5);
      } else {
        // na folha em branco a lista das duplas do grupo ajuda a conferir
        faixaSecao(folha, slot, inicio + 3, `DUPLAS DO GRUPO ${grupo}`);
        inicio += 8;
        autoTable(folha, {
          startY: inicio,
          margin: margemTabela(slot),
          head: [["Nº", "Dupla"]],
          body: doGrupo.map((l) => [
            String(duplaPorId.get(l.duplaId ?? "")?.numero ?? ""),
            maiusculo(l.nome),
          ]),
          theme: "grid",
          headStyles: CABECALHO_TABELA,
          styles: slot.meia ? corpoTabela(8, 1.5) : corpoTabela(9, 3),
          columnStyles: {
            0: { cellWidth: 14, halign: "center", fontStyle: "bold" },
            1: { cellWidth: 168 },
          },
        });
        const y = fimDaTabela(folha) + (slot.meia ? 6 : 8);
        faixaSecao(folha, slot, y, "JOGOS DO GRUPO");
        inicio = y + (slot.meia ? 4 : 5);
      }

      autoTable(folha, {
        startY: inicio,
        margin: margemTabela(slot),
        head: [["Jogo", "Dupla A", "Pontos", "Pontos", "Dupla B"]],
        body: jogosDoGrupo.map((j) => [
          String(j.rodada),
          nomeDoPar(j.duplaA),
          emBranco || j.pontosA === null ? "" : String(j.pontosA),
          emBranco || j.pontosB === null ? "" : String(j.pontosB),
          nomeDoPar(j.duplaB),
        ]),
        theme: "grid",
        headStyles: CABECALHO_TABELA,
        // o placar é escrito à mão: na meia folha a linha ganha altura mínima
        styles: slot.meia ? corpoTabela(8.5, 1.5, 7) : corpoTabela(9, 4),
        columnStyles: {
          0: { cellWidth: 14, halign: "center" },
          1: { cellWidth: 68 },
          2: { cellWidth: 16, halign: "center", fontStyle: "bold" },
          3: { cellWidth: 16, halign: "center", fontStyle: "bold" },
          4: { cellWidth: 68 },
        },
      });

      return assinaturas(folha, slot);
    };
  });

  const folhas: Folha[] = [];
  montar(doc, folhas, sumulas);

  /* -------------------------------- classificação geral, folha inteira */
  if (!emBranco && classificacao.some((l) => l.jogos > 0)) {
    const slot = folhaInteira(doc, folhas);
    const inicio = cabecalho(
      doc,
      slot,
      escudo,
      estado,
      campeonato,
      "Classificação da fase de grupos",
      categoria ?? "Todas as categorias"
    );

    autoTable(doc, {
      startY: inicio,
      margin: margemTabela(slot),
      head: [["Categoria", "Grupo", "Pos.", "Dupla", "V", "Pontos pró", "Saldo"]],
      body: classificacao.map((l) => [
        l.categoria,
        String(l.grupo),
        `${l.posicao}º`,
        maiusculo(l.nome),
        String(l.vitorias),
        String(l.pontosPro),
        l.saldo > 0 ? `+${l.saldo}` : String(l.saldo),
      ]),
      theme: "grid",
      headStyles: CABECALHO_TABELA,
      styles: corpoTabela(8.5, 2.4),
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 16, halign: "center" },
        2: { cellWidth: 14, halign: "center", fontStyle: "bold" },
        3: { cellWidth: 74 },
        4: { cellWidth: 12, halign: "center", fontStyle: "bold" },
        5: { cellWidth: 24, halign: "center" },
        6: { cellWidth: 18, halign: "center" },
      },
    });
  }

  finalizar(doc, estado, campeonato, folhas);
  salvar(
    doc,
    campeonato,
    emBranco ? "sumulas-duplas-branco" : "sumulas-duplas-grupos",
    categoria ? `-${categoria}` : ""
  );
}

/* ---------------------------------------- súmulas do 2º sorteio (duplas) */

interface ContextoDuplas {
  estado: Estado;
  campeonato: Campeonato;
  /** Sem categoria, sai uma súmula por categoria que tenha duplas. */
  categoria?: string;
  /** Sem divisão, saem o Ouro e a Prata. */
  divisao?: Divisao;
  /** Chave única por categoria (duplas fechadas): sem rótulo de divisão e sempre em folha inteira. */
  chaveUnica?: boolean;
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
 * Súmula da segunda fase: uma por divisão (Ouro e Prata) com as duplas fixas
 * sorteadas e os confrontos do mata-mata, no mesmo motor de duas por folha —
 * cabendo na metade, saem duas por folha; senão, cada uma toma a sua. Enquanto
 * a chave não é montada, os confrontos saem em branco já na estrutura certa.
 */
export async function gerarPdfSumulasDuplas({
  estado,
  campeonato,
  categoria,
  divisao,
  chaveUnica = false,
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
  const nome = new Map(estado.atletas.map((a) => [a.id, maiusculo(a.nome)]));
  const grupoDe = new Map(
    estado.grupos
      .filter((g) => g.campeonatoId === campeonato.id)
      .map((g) => [g.atletaId, g.grupo])
  );
  const nomeDupla = (id: string | null) => {
    const d = id ? estado.duplas.find((x) => x.id === id) : undefined;
    return d ? `${nome.get(d.atletaD) ?? ""} + ${nome.get(d.atletaE) ?? ""}` : "";
  };

  // uma súmula por categoria × divisão, com o Ouro sempre antes da Prata
  const chaves = [...new Set(duplas.map((d) => `${d.categoria}||${d.divisao}`))].sort(
    (a, b) => {
      const [ca, da] = a.split("||");
      const [cb, db] = b.split("||");
      return ca.localeCompare(cb) || (da === db ? 0 : da === "Ouro" ? -1 : 1);
    }
  );

  const sumulas: Sumula[] = chaves.map((chave) => {
    const [cat, div] = chave.split("||");

    const daDivisao = duplas
      .filter((d) => d.categoria === cat && d.divisao === div)
      .sort((a, b) => a.numero - b.numero);

    const daChave = estado.mataMata
      .filter(
        (m) => m.campeonatoId === campeonato.id && m.categoria === cat && m.divisao === div
      )
      .sort((a, b) => a.ordemFase - b.ordemFase || a.jogo - b.jogo);

    return (folha, slot) => {
      const inicio = cabecalho(
        folha,
        slot,
        escudo,
        estado,
        campeonato,
        chaveUnica
          ? "Súmula da chave final — duplas fechadas"
          : "Súmula do 2º sorteio — duplas fixas",
        chaveUnica ? cat : `${cat} · Divisão ${div}`
      );

      autoTable(folha, {
        startY: inicio,
        margin: margemTabela(slot),
        head: chaveUnica
          ? [["Dupla", "Atleta 1", "Atleta 2", "Grupo", "Colocação"]]
          : [["Dupla", "Atleta lado D", "Atleta lado E", "Grupos", "Colocação"]],
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
        styles: slot.meia ? corpoTabela(8, 1.5) : corpoTabela(9, 3),
        columnStyles: {
          0: { cellWidth: 16, halign: "center", fontStyle: "bold" },
          1: { cellWidth: 56 },
          2: { cellWidth: 56 },
          3: { cellWidth: 24, halign: "center" },
          4: { cellWidth: 30, halign: "center" },
        },
      });

      const y = fimDaTabela(folha) + (slot.meia ? 6 : 8);
      faixaSecao(folha, slot, y, "CONFRONTOS DA CHAVE");

      autoTable(folha, {
        startY: y + (slot.meia ? 4 : 5),
        margin: margemTabela(slot),
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
        styles: slot.meia ? corpoTabela(8.5, 1.5, 7) : corpoTabela(9, 4),
        columnStyles: {
          0: { cellWidth: 28 },
          1: { cellWidth: 12, halign: "center" },
          2: { cellWidth: 54 },
          3: { cellWidth: 17, halign: "center", fontStyle: "bold" },
          4: { cellWidth: 17, halign: "center", fontStyle: "bold" },
          5: { cellWidth: 54 },
        },
      });

      return assinaturas(folha, slot);
    };
  });

  const folhas: Folha[] = [];
  // a súmula da chave sai sempre em folha inteira: é ela que vai para a mesa
  if (chaveUnica) montarEmFolhasInteiras(doc, folhas, sumulas);
  else montar(doc, folhas, sumulas);

  finalizar(doc, estado, campeonato, folhas);
  salvar(
    doc,
    campeonato,
    chaveUnica ? "sumula-chave" : "sumulas-duplas",
    `${categoria ? `-${categoria}` : ""}${divisao ? `-${divisao}` : ""}`
  );
}

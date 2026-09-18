import type {
  Atleta, Campeonato, Config, CorteDeClassificacao, Divisao, Dupla, Estado, Etapa,
  Formato, IntegranteGrupo, Jogo, JogoMataMata, Lado, LinhaClassificacao,
  ParticipanteCalculado,
} from "./tipos";

/* ------------------------------------------------------------ utilidades */

export function embaralhar<T>(lista: T[]): T[] {
  const out = [...lista];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const novoId = (prefixo: string) =>
  `${prefixo}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * Regra crítica: a idade que vale é a da data da competição, não a de hoje.
 * Quem tem 49 no cadastro e completa 50 até o evento entra na faixa de 50.
 */
export function idadeNaData(nascimento: string, dataReferencia: string): number {
  if (!nascimento || !dataReferencia) return 0;
  const [an, mn, dn] = nascimento.split("-").map(Number);
  const [ar, mr, dr] = dataReferencia.split("-").map(Number);
  if (!an || !ar) return 0;
  let idade = ar - an;
  if (mr < mn || (mr === mn && dr < dn)) idade -= 1;
  return Math.max(0, idade);
}

export function categoriaDoAtleta(
  atleta: Atleta,
  config: Config,
  idade: number
): string | null {
  const faixa = config.faixas.find(
    (f) =>
      f.ativa && f.sexo === atleta.sexo && idade >= f.idadeMin && idade <= f.idadeMax
  );
  return faixa?.nome ?? null;
}

export const categoriasAtivas = (config: Config) =>
  config.faixas.filter((f) => f.ativa).map((f) => f.nome);

/* ------------------------------------------------ derivados do campeonato */

/** Participantes de um campeonato, já com idade, categoria e situação de pagamento. */
export function participantesDo(
  estado: Estado,
  campeonatoId: string
): ParticipanteCalculado[] {
  const campeonato = estado.campeonatos.find((c) => c.id === campeonatoId);
  if (!campeonato) return [];
  const porId = new Map(estado.atletas.map((a) => [a.id, a]));

  return estado.participantes
    .filter((p) => p.campeonatoId === campeonatoId)
    .map((p) => {
      const atleta = porId.get(p.atletaId);
      if (!atleta) return null;
      const idade = idadeNaData(atleta.nascimento, campeonato.data);
      const pagas = [p.p1, p.p2, p.p3, p.p4].filter(Boolean).length;
      const valorTotal = p.valorTotal || campeonato.valorInscricao;
      const totalPago = Math.round(((valorTotal / 4) * pagas + Number.EPSILON) * 100) / 100;
      return {
        ...atleta,
        campeonatoId,
        idadeNoEvento: idade,
        categoria: p.categoriaManual || categoriaDoAtleta(atleta, estado.config, idade),
        valorTotal,
        parcelasPagas: pagas,
        situacaoPagamento: `${pagas}/4`,
        totalPago,
        saldo: Math.round((valorTotal - totalPago + Number.EPSILON) * 100) / 100,
      };
    })
    .filter((p): p is ParticipanteCalculado => p !== null)
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

/**
 * Categorias que realmente têm gente neste campeonato. No formato de duplas
 * fechadas quem conta é a dupla inscrita, não o atleta solto.
 */
export function categoriasDoCampeonato(estado: Estado, campeonatoId: string) {
  const campeonato = estado.campeonatos.find((c) => c.id === campeonatoId);
  if (campeonato && ehDuplasFechadas(campeonato)) {
    const duplas = duplasInscritas(estado, campeonatoId);
    return [...new Set(duplas.map((d) => d.categoria))].filter(Boolean).sort();
  }
  const participantes = participantesDo(estado, campeonatoId);
  return categoriasAtivas(estado.config).filter((cat) =>
    participantes.some((p) => p.categoria === cat && p.ativo)
  );
}

/* --------------------------------------------- Fase 1: sorteio de grupos */

export interface ResultadoSorteioGrupos {
  grupos: IntegranteGrupo[];
  jogos: Jogo[];
  avisos: string[];
}

/**
 * Monta grupos de 4 buscando 2 D + 2 E. Atletas "Ambos" entram como curinga
 * para fechar as vagas. O desequilíbrio nunca bloqueia o sorteio — o
 * balanceamento é diretriz, e o operador pode ajustar depois.
 */
export function sortearGrupos(
  estado: Estado,
  campeonatoId: string,
  categoria: string
): ResultadoSorteioGrupos {
  const campeonato = estado.campeonatos.find((c) => c.id === campeonatoId);
  const tamanho = campeonato?.atletasPorGrupo || 4;
  const aptos = participantesDo(estado, campeonatoId).filter(
    (a) => a.ativo && a.categoria === categoria
  );
  const avisos: string[] = [];

  if (aptos.length < tamanho)
    return {
      grupos: [],
      jogos: [],
      avisos: [
        `${categoria}: ${aptos.length} participante(s) — mínimo de ${tamanho} para formar um grupo.`,
      ],
    };

  const filaD = embaralhar(aptos.filter((a) => a.lado === "D"));
  const filaE = embaralhar(aptos.filter((a) => a.lado === "E"));
  const filaAmbos = embaralhar(aptos.filter((a) => a.lado === "Ambos"));

  const qtdGrupos = Math.ceil(aptos.length / tamanho);
  const metade = Math.floor(tamanho / 2);
  const caixas: { id: string; lado: Lado }[][] = Array.from(
    { length: qtdGrupos },
    () => []
  );

  const puxar = (lado: "D" | "E") => {
    const fila = lado === "D" ? filaD : filaE;
    if (fila.length) return { id: fila.shift()!.id, lado };
    if (filaAmbos.length) return { id: filaAmbos.shift()!.id, lado };
    return null;
  };

  for (const caixa of caixas) {
    for (let k = 0; k < metade; k++) {
      const d = puxar("D");
      if (d) caixa.push(d);
    }
    for (let k = 0; k < metade; k++) {
      const e = puxar("E");
      if (e) caixa.push(e);
    }
  }

  const sobras = [
    ...filaD.map((a) => ({ id: a.id, lado: "D" as Lado })),
    ...filaE.map((a) => ({ id: a.id, lado: "E" as Lado })),
    ...filaAmbos.map((a) => ({ id: a.id, lado: "Ambos" as Lado })),
  ];
  for (const sobra of embaralhar(sobras)) {
    const caixa = caixas.find((x) => x.length < tamanho);
    if (caixa) caixa.push(sobra);
  }

  const grupos: IntegranteGrupo[] = [];
  const jogos: Jogo[] = [];

  caixas.forEach((caixa, idx) => {
    const numero = idx + 1;
    caixa.forEach((item, vaga) => {
      grupos.push({
        campeonatoId,
        categoria,
        grupo: numero,
        vaga: vaga + 1,
        atletaId: item.id,
        duplaId: null,
        ladoNoGrupo: item.lado,
        posicaoManual: null,
      });
    });

    const d = caixa.filter((x) => x.lado === "D").length;
    const e = caixa.filter((x) => x.lado === "E").length;
    if (caixa.length < tamanho)
      avisos.push(
        `${categoria} · grupo ${numero} ficou com ${caixa.length} atleta(s) — ajuste manualmente antes de lançar jogos.`
      );
    else if (d !== metade || e !== metade)
      avisos.push(
        `${categoria} · grupo ${numero}: ${d} D e ${e} E (o ideal é ${metade} e ${metade}). Não impede o torneio.`
      );

    if (caixa.length === 4)
      jogos.push(
        ...jogosDoGrupo(campeonatoId, categoria, numero, caixa.map((x) => x.id))
      );
  });

  return { grupos, jogos, avisos };
}

/**
 * Fase de grupos sem dupla fixa: 3 jogos e cada atleta joga uma vez com cada
 * um dos outros três como parceiro.
 */
export function jogosDoGrupo(
  campeonatoId: string,
  categoria: string,
  grupo: number,
  ids: string[]
): Jogo[] {
  const [a, b, cc, d] = ids;
  const combinacoes: [[string, string], [string, string]][] = [
    [[a, b], [cc, d]],
    [[a, cc], [b, d]],
    [[a, d], [b, cc]],
  ];
  return combinacoes.map((par, i) => ({
    id: `J-${campeonatoId}-${categoria}-G${grupo}-R${i + 1}`,
    campeonatoId,
    categoria,
    grupo,
    rodada: i + 1,
    duplaA: par[0],
    duplaB: par[1],
    pontosA: null,
    pontosB: null,
  }));
}

/* ------------------------------------------------------- classificação */

/** Identidade da vaga no grupo: a dupla (duplas fechadas) ou o atleta (sorteio). */
export const chaveDoIntegrante = (g: IntegranteGrupo) => g.duplaId || g.atletaId;

/** A mesma identidade, do lado da linha de classificação. */
export const chaveDaLinha = (l: LinhaClassificacao) => l.duplaId || l.atletaId;

/** Ordem do formato sorteio: vitórias, pontos pró e saldo — como sempre foi. */
const compararNoSorteio = (x: LinhaClassificacao, y: LinhaClassificacao) =>
  y.vitorias - x.vitorias ||
  y.pontosPro - x.pontosPro ||
  y.saldo - x.saldo ||
  x.nome.localeCompare(y.nome);

/**
 * Classificação de cada grupo. No formato sorteio a linha é de um atleta; no de
 * duplas fechadas é da dupla inteira, e o placar do jogo vale para os dois.
 */
export function classificar(estado: Estado, campeonatoId?: string): LinhaClassificacao[] {
  const nome = new Map(estado.atletas.map((a) => [a.id, a.nome]));
  const duplaPorId = new Map(estado.duplas.map((d) => [d.id, d]));
  const saida: LinhaClassificacao[] = [];

  const grupos = campeonatoId
    ? estado.grupos.filter((g) => g.campeonatoId === campeonatoId)
    : estado.grupos;

  const chaves = new Map<string, IntegranteGrupo[]>();
  for (const g of grupos) {
    const chave = `${g.campeonatoId}||${g.categoria}||${g.grupo}`;
    chaves.set(chave, [...(chaves.get(chave) ?? []), g]);
  }

  for (const [chave, integrantes] of chaves) {
    const [camp, categoria, grupoTexto] = chave.split("||");
    const grupo = Number(grupoTexto);
    const jogos = estado.jogos.filter(
      (j) => j.campeonatoId === camp && j.categoria === categoria && j.grupo === grupo
    );

    const porDupla = integrantes.some((i) => i.duplaId);

    // ordem fixada à mão na etapa de classificação, quando o operador ajustou
    const fixas = new Map(
      integrantes
        .filter((i) => i.posicaoManual !== null)
        .map((i) => [chaveDoIntegrante(i), i.posicaoManual as number])
    );
    const ajustadoAMao = fixas.size > 0;

    const linhas = integrantes.map((i) => {
      const dupla = i.duplaId ? duplaPorId.get(i.duplaId) : undefined;
      const daVaga = dupla ? [dupla.atletaD, dupla.atletaE] : [i.atletaId];
      let vitorias = 0;
      let pro = 0;
      let contra = 0;
      let disputados = 0;

      for (const j of jogos) {
        if (j.pontosA === null || j.pontosB === null) continue;
        const naA = daVaga.some((id) => j.duplaA.includes(id));
        const naB = daVaga.some((id) => j.duplaB.includes(id));
        if (!naA && !naB) continue;
        disputados += 1;
        const meus = naA ? j.pontosA : j.pontosB;
        const deles = naA ? j.pontosB : j.pontosA;
        pro += meus;
        contra += deles;
        if (meus > deles) vitorias += 1;
      }

      return {
        campeonatoId: camp,
        categoria,
        grupo,
        posicao: 0,
        atletaId: dupla ? "" : i.atletaId,
        duplaId: i.duplaId ?? null,
        nome: dupla
          ? `${nome.get(dupla.atletaD) ?? dupla.atletaD} + ${nome.get(dupla.atletaE) ?? dupla.atletaE}`
          : (nome.get(i.atletaId) ?? i.atletaId),
        vitorias,
        pontosPro: pro,
        pontosContra: contra,
        saldo: pro - contra,
        jogos: disputados,
        divisao: null as Divisao | null,
        manual: ajustadoAMao,
      };
    });

    const ordenadas = porDupla
      ? ordenarDuplasNoGrupo(linhas, jogos, duplaPorId)
      : [...linhas].sort(compararNoSorteio);

    // a posição fixada à mão manda por cima do critério automático; o sort do
    // JavaScript é estável, então quem não foi fixado mantém a ordem calculada
    const posicaoFixa = (l: LinhaClassificacao) =>
      fixas.get(chaveDaLinha(l)) ?? Number.MAX_SAFE_INTEGER;
    ordenadas.sort((x, y) => posicaoFixa(x) - posicaoFixa(y));

    ordenadas.forEach((l, i) => {
      l.posicao = i + 1;
      // Ouro e Prata só existem no sorteio: 1º e 2º sobem, 3º e 4º descem
      l.divisao = porDupla ? null : i < 2 ? "Ouro" : "Prata";
    });

    saida.push(...ordenadas);
  }

  return saida.sort(
    (x, y) =>
      x.categoria.localeCompare(y.categoria) || x.grupo - y.grupo || x.posicao - y.posicao
  );
}

/** Todos os jogos de grupo do campeonato têm placar? */
export function gruposEncerrados(estado: Estado, campeonatoId: string): boolean {
  const jogos = estado.jogos.filter((j) => j.campeonatoId === campeonatoId);
  return jogos.length > 0 && jogos.every((j) => j.pontosA !== null && j.pontosB !== null);
}

/* ------------------------------------------- Fase 2: sorteio das duplas */

export interface ResultadoSorteioDuplas {
  duplas: Dupla[];
  avisos: string[];
}

/**
 * A partir da 2ª fase as duplas são fixas. Os classificados são separados por
 * lado dentro da divisão e sorteados de novo — os dois de um mesmo grupo não
 * formam dupla automaticamente, então o pareamento evita a mesma origem.
 */
export function sortearDuplas(
  estado: Estado,
  campeonatoId: string,
  categoria: string,
  divisao: Divisao
): ResultadoSorteioDuplas {
  const classificacao = classificar(estado, campeonatoId).filter(
    (l) => l.categoria === categoria && l.divisao === divisao && l.jogos > 0
  );
  const avisos: string[] = [];

  if (classificacao.length < 2)
    return {
      duplas: [],
      avisos: [
        `${categoria} / ${divisao}: não há classificados suficientes. Lance os placares da fase de grupos primeiro.`,
      ],
    };

  const porId = new Map(estado.atletas.map((a) => [a.id, a]));
  const grupoDe = new Map(
    estado.grupos
      .filter((g) => g.campeonatoId === campeonatoId)
      .map((g) => [g.atletaId, g.grupo])
  );

  const candidatos = classificacao.map((l) => ({
    id: l.atletaId,
    lado: porId.get(l.atletaId)?.lado ?? "Ambos",
    grupo: grupoDe.get(l.atletaId) ?? 0,
  }));

  const direitos = embaralhar(candidatos.filter((x) => x.lado === "D"));
  const esquerdos = embaralhar(candidatos.filter((x) => x.lado === "E"));
  const ambos = embaralhar(candidatos.filter((x) => x.lado === "Ambos"));

  while (ambos.length) {
    const alvo = direitos.length <= esquerdos.length ? direitos : esquerdos;
    alvo.push(ambos.shift()!);
  }

  const duplas: Dupla[] = [];
  let numero = 1;
  const registrar = (idA: string, idB: string) => {
    duplas.push({
      id: `DP-${campeonatoId}-${categoria}-${divisao}-${numero}`,
      campeonatoId,
      categoria,
      divisao,
      numero,
      atletaD: idA,
      atletaE: idB,
      origem: "sorteio",
      cabecaDeChave: false,
    });
    numero += 1;
  };

  while (direitos.length && esquerdos.length) {
    const d = direitos.shift()!;
    let indice = esquerdos.findIndex((e) => e.grupo !== d.grupo);
    if (indice === -1) indice = 0;
    const e = esquerdos.splice(indice, 1)[0];
    if (e.grupo === d.grupo)
      avisos.push(
        `${categoria} / ${divisao} · dupla ${numero}: os dois vieram do grupo ${d.grupo} — não havia outra combinação.`
      );
    registrar(d.id, e.id);
  }

  // Sobra de um lado só: em vez de deixar classificados fora, formam-se duplas
  // do mesmo lado — alguém joga fora da posição, e o sistema avisa.
  const sobrando = [...direitos, ...esquerdos];
  while (sobrando.length >= 2) {
    const primeiro = sobrando.shift()!;
    let indice = sobrando.findIndex((x) => x.grupo !== primeiro.grupo);
    if (indice === -1) indice = 0;
    const segundo = sobrando.splice(indice, 1)[0];
    avisos.push(
      `${categoria} / ${divisao} · dupla ${numero}: dois atletas do lado ${
        primeiro.lado === "E" ? "esquerdo" : "direito"
      } (${porId.get(primeiro.id)?.nome} e ${porId.get(segundo.id)?.nome}) — faltaram lados entre os classificados.`
    );
    registrar(primeiro.id, segundo.id);
  }

  if (sobrando.length === 1)
    avisos.push(
      `${categoria} / ${divisao}: ${porId.get(sobrando[0].id)?.nome} ficou sem dupla (número ímpar de classificados).`
    );

  return { duplas, avisos };
}

/* ------------------------------------------------ Fase 2: chaveamento */

/** Nome da fase pelo número de duplas que entram nela — usado na chave e na súmula. */
export const nomeDaFase = (duplasNaFase: number) =>
  duplasNaFase === 2
    ? "Final"
    : duplasNaFase === 4
      ? "Semifinal"
      : duplasNaFase === 8
        ? "Quartas de final"
        : duplasNaFase === 16
          ? "Oitavas de final"
          : `Fase de ${duplasNaFase}`;

/** Cruzamentos eliminatórios até a final, com bye quando não fecha potência de 2. */
export function gerarMataMata(
  estado: Estado,
  campeonatoId: string,
  categoria: string,
  divisao: Divisao
): { jogos: JogoMataMata[]; avisos: string[] } {
  const duplas = embaralhar(
    estado.duplas.filter(
      (d) =>
        d.campeonatoId === campeonatoId &&
        d.categoria === categoria &&
        d.divisao === divisao
    )
  );
  if (duplas.length < 2)
    return {
      jogos: [],
      avisos: [`${categoria} / ${divisao}: sorteie as duplas antes de montar a chave.`],
    };

  let tamanho = 2;
  while (tamanho < duplas.length) tamanho *= 2;

  const fases = montarFases(campeonatoId, categoria, divisao, tamanho);

  const vagas: { jogo: JogoMataMata; lado: "A" | "B" }[] = [];
  fases[0].forEach((jogo) => {
    vagas.push({ jogo, lado: "A" });
    vagas.push({ jogo, lado: "B" });
  });
  duplas.forEach((dupla, i) => {
    const vaga = vagas[i];
    if (vaga.lado === "A") vaga.jogo.duplaA = dupla.id;
    else vaga.jogo.duplaB = dupla.id;
  });

  const avisos: string[] = [];
  const byes = tamanho - duplas.length;
  if (byes > 0)
    avisos.push(
      `${categoria} / ${divisao}: ${duplas.length} duplas em chave de ${tamanho} — ${byes} avança(m) direto na primeira fase.`
    );

  return { jogos: propagarMataMata(fases.flat()), avisos };
}

/** Leva vencedores (e byes) para a fase seguinte. */
export function propagarMataMata(jogos: JogoMataMata[]): JogoMataMata[] {
  const porId = new Map(jogos.map((j) => [j.id, { ...j }]));
  const ordenados = [...porId.values()].sort(
    (a, b) => a.ordemFase - b.ordemFase || a.jogo - b.jogo
  );

  for (const jogo of ordenados) {
    const vencedor = vencedorDoJogo(jogo);
    if (!vencedor || !jogo.proximo) continue;
    const proximo = porId.get(jogo.proximo);
    if (!proximo) continue;
    if (jogo.jogo % 2 === 1) proximo.duplaA = vencedor;
    else proximo.duplaB = vencedor;
  }

  return [...porId.values()];
}

export function vencedorDoJogo(jogo: JogoMataMata): string | null {
  if (jogo.duplaA && !jogo.duplaB) return jogo.duplaA;
  if (jogo.duplaB && !jogo.duplaA) return jogo.duplaB;
  if (jogo.pontosA === null || jogo.pontosB === null) return null;
  if (jogo.pontosA === jogo.pontosB) return null;
  return jogo.pontosA > jogo.pontosB ? jogo.duplaA : jogo.duplaB;
}

/* --------------------------------------------------- fluxo do campeonato */

export const ORDEM_ETAPAS: Etapa[] = [
  "participantes",
  "grupos",
  "classificacao",
  "duplas",
  "final",
  "encerrado",
];

/** No formato de duplas fechadas não existe 2º sorteio: a dupla já entra pronta. */
export const ORDEM_ETAPAS_DUPLAS_FECHADAS: Etapa[] = [
  "participantes",
  "grupos",
  "classificacao",
  "final",
  "encerrado",
];

export const ordemEtapas = (formato: Formato): Etapa[] =>
  formato === "duplas_fechadas" ? ORDEM_ETAPAS_DUPLAS_FECHADAS : ORDEM_ETAPAS;

export const indiceEtapa = (etapa: Etapa, formato: Formato = "sorteio") =>
  ordemEtapas(formato).indexOf(etapa);

/** Diz se o campeonato pode avançar e, se não, por quê. */
export function podeAvancar(
  estado: Estado,
  campeonato: Campeonato
): { ok: boolean; motivo?: string } {
  const categorias = categoriasDoCampeonato(estado, campeonato.id);
  const duplasFechadas = ehDuplasFechadas(campeonato);

  switch (campeonato.etapa) {
    case "participantes": {
      if (duplasFechadas) {
        const duplas = duplasInscritas(estado, campeonato.id);
        if (duplas.length < 3)
          return {
            ok: false,
            motivo:
              "Inscreva ao menos 3 duplas antes de sortear a fase de grupos.",
          };
        const comGrupo = categorias.some(
          (cat) => duplas.filter((d) => d.categoria === cat).length >= 3
        );
        if (!comGrupo)
          return {
            ok: false,
            motivo:
              "Nenhuma categoria tem 3 duplas. Ajuste as categorias das duplas antes de sortear.",
          };
        return { ok: true };
      }
      if (!categorias.length)
        return {
          ok: false,
          motivo:
            "Nenhuma categoria tem participantes suficientes. Adicione atletas antes de sortear os grupos.",
        };
      return { ok: true };
    }
    case "grupos": {
      const jogos = estado.jogos.filter((j) => j.campeonatoId === campeonato.id);
      if (!jogos.length)
        return { ok: false, motivo: "Nenhum jogo gerado — verifique a composição dos grupos." };
      const faltando = jogos.filter((j) => j.pontosA === null || j.pontosB === null);
      if (faltando.length)
        return {
          ok: false,
          motivo: `Faltam ${faltando.length} placar(es) da fase de grupos.`,
        };
      return { ok: true };
    }
    case "classificacao": {
      // nas duplas fechadas o passo seguinte já é a chave: precisa de gente nela
      if (duplasFechadas) {
        const temClassificado = classificar(estado, campeonato.id).some(
          (l) => l.jogos > 0
        );
        if (!temClassificado)
          return {
            ok: false,
            motivo: "Lance os placares da fase de grupos antes de montar a chave.",
          };
      }
      return { ok: true };
    }
    case "duplas": {
      const duplas = estado.duplas.filter((d) => d.campeonatoId === campeonato.id);
      if (!duplas.length)
        return { ok: false, motivo: "Sorteie as duplas antes de montar a chave final." };
      return { ok: true };
    }
    case "final": {
      const chave = estado.mataMata.filter((m) => m.campeonatoId === campeonato.id);
      if (!chave.length) return { ok: false, motivo: "A chave final ainda não foi montada." };
      const finais = chave.filter((m) => m.fase === "Final");
      const abertas = finais.filter((f) => !vencedorDoJogo(f));
      if (abertas.length)
        return { ok: false, motivo: "Ainda há final sem resultado lançado." };
      return { ok: true };
    }
    default:
      return { ok: false, motivo: "O campeonato já está encerrado." };
  }
}

/* ======================================================================
 * Formato "duplas fechadas": a dupla se inscreve junta, disputa a fase de
 * grupos como uma unidade e continua a mesma até a final. Tudo daqui para
 * baixo é aditivo — o formato sorteio não passa por nenhuma destas funções.
 * ==================================================================== */

/** Campeonato antigo, sem a coluna na planilha, conta como sorteio. */
export const formatoDo = (campeonato: Campeonato): Formato =>
  campeonato.formato === "duplas_fechadas" ? "duplas_fechadas" : "sorteio";

export const ehDuplasFechadas = (campeonato: Campeonato) =>
  formatoDo(campeonato) === "duplas_fechadas";

/** Quantos ocupantes cabem num grupo: atletas no sorteio, duplas no outro. */
export const tamanhoDoGrupo = (campeonato: Campeonato) =>
  ehDuplasFechadas(campeonato)
    ? campeonato.duplasPorGrupo || 3
    : campeonato.atletasPorGrupo || 4;

/**
 * REGRA A CONFIRMAR COM O CLIENTE — a dupla joga na categoria do atleta MAIS
 * NOVO (o de menor idade na data da competição). Fica isolada aqui para trocar
 * num lugar só, caso o cliente prefira o mais velho ou a média das idades.
 */
export function categoriaDaDupla(
  atleta1: Atleta,
  atleta2: Atleta,
  config: Config,
  dataDoEvento: string
): string | null {
  const idade1 = idadeNaData(atleta1.nascimento, dataDoEvento);
  const idade2 = idadeNaData(atleta2.nascimento, dataDoEvento);
  const maisNovo = idade1 <= idade2 ? atleta1 : atleta2;
  return categoriaDoAtleta(maisNovo, config, Math.min(idade1, idade2));
}

/** Duplas inscritas num campeonato, por categoria e número. */
export const duplasInscritas = (estado: Estado, campeonatoId: string) =>
  estado.duplas
    .filter((d) => d.campeonatoId === campeonatoId && d.origem === "inscricao")
    .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.numero - b.numero);

/**
 * Como repartir N duplas em grupos de aproximadamente `alvo`. Nunca sai grupo
 * de 1 ou 2: o número de grupos é o piso da divisão e o resto engorda os
 * últimos. 10 em grupos de 3 → 3, 3 e 4; 8 → 4 e 4; 12 → 3, 3, 3 e 3.
 */
export function tamanhosDosGrupos(total: number, alvo: number): number[] {
  if (total < 3) return [];
  const quantidade = Math.max(1, Math.floor(total / Math.max(2, alvo)));
  const base = Math.floor(total / quantidade);
  const sobra = total % quantidade;
  return Array.from(
    { length: quantidade },
    (_, i) => base + (i >= quantidade - sobra ? 1 : 0)
  );
}

/**
 * Sorteia os grupos de uma categoria no formato de duplas fechadas. As duplas
 * marcadas como cabeça de chave são distribuídas primeiro, uma por grupo; o
 * resto entra embaralhado.
 */
export function sortearGruposDeDuplas(
  estado: Estado,
  campeonatoId: string,
  categoria: string
): ResultadoSorteioGrupos {
  const campeonato = estado.campeonatos.find((c) => c.id === campeonatoId);
  if (!campeonato)
    return { grupos: [], jogos: [], avisos: ["Campeonato não encontrado."] };

  const daCategoria = duplasInscritas(estado, campeonatoId).filter(
    (d) => d.categoria === categoria
  );
  const tamanhos = tamanhosDosGrupos(daCategoria.length, tamanhoDoGrupo(campeonato));

  if (!tamanhos.length)
    return {
      grupos: [],
      jogos: [],
      avisos: [
        `${categoria}: ${daCategoria.length} dupla(s) — são necessárias ao menos 3 para formar um grupo.`,
      ],
    };

  const caixas: Dupla[][] = tamanhos.map(() => []);
  const cabecas = embaralhar(daCategoria.filter((d) => d.cabecaDeChave));
  const demais = embaralhar(daCategoria.filter((d) => !d.cabecaDeChave));

  // uma cabeça por grupo; havendo mais cabeças que grupos, as que sobram
  // voltam para o bolo comum
  cabecas.forEach((dupla, i) => {
    if (i < caixas.length) caixas[i].push(dupla);
    else demais.push(dupla);
  });
  for (const dupla of demais) {
    const indice = caixas.findIndex((caixa, i) => caixa.length < tamanhos[i]);
    caixas[indice >= 0 ? indice : 0].push(dupla);
  }

  const grupos: IntegranteGrupo[] = [];
  const jogos: Jogo[] = [];

  caixas.forEach((caixa, indice) => {
    const numero = indice + 1;
    caixa.forEach((dupla, vaga) => {
      grupos.push({
        campeonatoId,
        categoria,
        grupo: numero,
        vaga: vaga + 1,
        atletaId: "",
        duplaId: dupla.id,
        ladoNoGrupo: "Ambos",
        posicaoManual: null,
      });
    });
    jogos.push(...jogosDoGrupoDeDuplas(campeonatoId, categoria, numero, caixa));
  });

  return {
    grupos,
    jogos,
    avisos: [
      `${categoria}: ${daCategoria.length} duplas em ${caixas.length} grupo(s) de ${tamanhos.join(", ")}.`,
    ],
  };
}

/**
 * Todos contra todos dentro do grupo, pelo rodízio em círculo: 3 duplas dão 3
 * jogos; 4 duplas dão 6 jogos em 3 rodadas, e ninguém joga duas vezes seguidas.
 * O campo `rodada` guarda o número do jogo dentro do grupo — é o que as telas e
 * a súmula mostram na coluna "Jogo".
 */
export function jogosDoGrupoDeDuplas(
  campeonatoId: string,
  categoria: string,
  grupo: number,
  duplas: Dupla[]
): Jogo[] {
  if (duplas.length < 2) return [];

  const roda: (Dupla | null)[] = [...duplas];
  if (roda.length % 2) roda.push(null); // folga: quem cair com ela descansa
  const fixo = roda[0];
  const giro = roda.slice(1);
  const total = roda.length;

  const jogos: Jogo[] = [];
  let numero = 1;

  for (let rodada = 0; rodada < total - 1; rodada++) {
    const atual = [fixo, ...giro];
    for (let i = 0; i < total / 2; i++) {
      const a = atual[i];
      const b = atual[total - 1 - i];
      if (!a || !b) continue;
      jogos.push({
        id: `J-${campeonatoId}-${categoria}-G${grupo}-D${numero}`,
        campeonatoId,
        categoria,
        grupo,
        rodada: numero,
        duplaA: [a.atletaD, a.atletaE],
        duplaB: [b.atletaD, b.atletaE],
        pontosA: null,
        pontosB: null,
      });
      numero += 1;
    }
    giro.unshift(giro.pop() as Dupla | null);
  }

  return jogos;
}

/* ---------------------------- desempate da fase de grupos (duplas) */

/** Índice técnico, usado para comparar duplas de grupos diferentes. */
export const indiceTecnico = (x: LinhaClassificacao, y: LinhaClassificacao) =>
  y.vitorias - x.vitorias || y.saldo - x.saldo || y.pontosPro - x.pontosPro;

/**
 * "Sorteio" do desempate. Precisa ser estável: `classificar` roda a cada render
 * da tela, e um Math.random aqui faria a classificação dançar na frente do
 * operador. O número sai do id da dupla, que já nasce aleatório.
 */
function sorteioEstavel(chave: string): number {
  let hash = 0;
  for (let i = 0; i < chave.length; i++) hash = (hash * 31 + chave.charCodeAt(i)) | 0;
  return hash;
}

/** Quem ganhou o confronto direto entre duas duplas, se elas se enfrentaram. */
function vencedorDoConfronto(
  a: LinhaClassificacao,
  b: LinhaClassificacao,
  jogos: Jogo[],
  duplaPorId: Map<string, Dupla>
): LinhaClassificacao | null {
  const daA = duplaPorId.get(a.duplaId ?? "");
  const daB = duplaPorId.get(b.duplaId ?? "");
  if (!daA || !daB) return null;

  for (const j of jogos) {
    if (j.pontosA === null || j.pontosB === null || j.pontosA === j.pontosB) continue;
    if (j.duplaA.includes(daA.atletaD) && j.duplaB.includes(daB.atletaD))
      return j.pontosA > j.pontosB ? a : b;
    if (j.duplaB.includes(daA.atletaD) && j.duplaA.includes(daB.atletaD))
      return j.pontosB > j.pontosA ? a : b;
  }
  return null;
}

/**
 * REGRA A CONFIRMAR COM O CLIENTE — desempate dentro do grupo, nesta ordem:
 * 1) vitórias, 2) saldo de pontos, 3) pontos pró, 4) confronto direto e
 * 5) sorteio. O confronto direto só entra quando o empate é entre DUAS duplas:
 * com três ou mais empatadas ele costuma dar ciclo (A ganha de B, B de C e C de
 * A), e aí quem decide é o sorteio.
 */
export function ordenarDuplasNoGrupo(
  linhas: LinhaClassificacao[],
  jogos: Jogo[],
  duplaPorId: Map<string, Dupla>
): LinhaClassificacao[] {
  const ordenadas = [...linhas].sort(
    (x, y) =>
      indiceTecnico(x, y) ||
      sorteioEstavel(chaveDaLinha(x)) - sorteioEstavel(chaveDaLinha(y))
  );

  for (let i = 0; i < ordenadas.length - 1; i++) {
    const a = ordenadas[i];
    const b = ordenadas[i + 1];
    if (indiceTecnico(a, b) !== 0) continue;
    const empateMaior =
      (i > 0 && indiceTecnico(ordenadas[i - 1], a) === 0) ||
      (i + 2 < ordenadas.length && indiceTecnico(b, ordenadas[i + 2]) === 0);
    if (empateMaior) continue;
    if (vencedorDoConfronto(a, b, jogos, duplaPorId) === b) {
      ordenadas[i] = b;
      ordenadas[i + 1] = a;
    }
  }

  return ordenadas;
}

/* ----------------------------------- chave final por cruzamento */

/**
 * Vagas da primeira fase na ordem clássica de cabeças: a 1 e a 2 só se
 * encontram na final, a 1 e a 3 só na semi, e assim por diante. Devolve, para
 * cada vaga da chave, qual número de cabeça a ocupa.
 */
export function ordemDeChaveamento(tamanho: number): number[] {
  let ordem = [1, 2];
  while (ordem.length < tamanho) {
    const n = ordem.length * 2;
    const proxima: number[] = [];
    for (const cabeca of ordem) {
      proxima.push(cabeca);
      proxima.push(n + 1 - cabeca);
    }
    ordem = proxima;
  }
  return ordem;
}

export interface Classificado {
  duplaId: string;
  grupo: number;
  posicaoNoGrupo: number;
  vitorias: number;
  saldo: number;
  pontosPro: number;
}

/**
 * Quem passa da fase de grupos, conforme o corte do campeonato: 1 por grupo,
 * 2 por grupo, ou 2 por grupo mais os melhores 3ºs — estes últimos só até
 * completar a potência de 2 seguinte, para não inflar a chave à toa. A ordem
 * dentro de cada camada é a do índice técnico entre grupos.
 */
export function classificadosParaChave(
  linhas: LinhaClassificacao[],
  corte: CorteDeClassificacao
): Classificado[][] {
  const daPosicao = (posicao: number): Classificado[] =>
    linhas
      .filter((l) => l.posicao === posicao && l.jogos > 0 && l.duplaId)
      .sort(indiceTecnico)
      .map((l) => ({
        duplaId: l.duplaId as string,
        grupo: l.grupo,
        posicaoNoGrupo: l.posicao,
        vitorias: l.vitorias,
        saldo: l.saldo,
        pontosPro: l.pontosPro,
      }));

  const primeiros = daPosicao(1);
  if (corte === "1") return [primeiros];

  const segundos = daPosicao(2);
  if (corte === "2") return [primeiros, segundos];

  const terceiros = daPosicao(3);
  const base = primeiros.length + segundos.length;
  let tamanho = 2;
  while (tamanho < base + terceiros.length) tamanho *= 2;
  const vagas = Math.max(0, Math.min(terceiros.length, tamanho - base));
  return [primeiros, segundos, terceiros.slice(0, vagas)];
}

/**
 * Chave final do formato de duplas fechadas: cruzamento olímpico. O 1º de um
 * grupo entra numa metade da chave e o 2º do mesmo grupo na outra, então eles
 * só podem se reencontrar na final. Quando o número de classificados não fecha
 * uma potência de 2, os byes ficam com os melhores 1ºs, pelo índice técnico
 * entre grupos.
 */
export function gerarChaveCruzamento(
  estado: Estado,
  campeonatoId: string,
  categoria: string
): { jogos: JogoMataMata[]; avisos: string[] } {
  const campeonato = estado.campeonatos.find((c) => c.id === campeonatoId);
  if (!campeonato) return { jogos: [], avisos: ["Campeonato não encontrado."] };

  const linhas = classificar(estado, campeonatoId).filter(
    (l) => l.categoria === categoria
  );
  const camadas = classificadosParaChave(
    linhas,
    campeonato.corteDeClassificacao || "2"
  );
  const todos = camadas.flat();

  if (todos.length < 2)
    return {
      jogos: [],
      avisos: [
        `${categoria}: não há classificados suficientes. Lance os placares da fase de grupos primeiro.`,
      ],
    };

  let tamanho = 2;
  while (tamanho < todos.length) tamanho *= 2;

  const ordem = ordemDeChaveamento(tamanho);
  const vagaDaCabeca = new Map<number, number>();
  ordem.forEach((cabeca, vaga) => vagaDaCabeca.set(cabeca, vaga));
  const metadeDaCabeca = (cabeca: number) =>
    (vagaDaCabeca.get(cabeca) ?? 0) < tamanho / 2 ? 0 : 1;

  const cabecaDaDupla = new Map<string, number>();
  const metadeDoGrupo = new Map<number, number>();
  const grupoDaCabeca = new Map<number, number>();

  // os 1ºs pelo índice técnico: o melhor vira a cabeça 1 e leva o primeiro bye
  const primeiros = camadas[0] ?? [];
  primeiros.forEach((c, i) => {
    const cabeca = i + 1;
    cabecaDaDupla.set(c.duplaId, cabeca);
    metadeDoGrupo.set(c.grupo, metadeDaCabeca(cabeca));
    grupoDaCabeca.set(cabeca, c.grupo);
  });

  // cada 2º vai para a metade oposta à do 1º do seu grupo, pegando a melhor
  // cabeça livre daquele lado — é isso que garante o reencontro só na final
  const segundos = camadas[1] ?? [];
  let proxima = primeiros.length + 1;
  const livres = segundos.map((_, i) => proxima + i);
  for (const c of segundos) {
    const desejada = 1 - (metadeDoGrupo.get(c.grupo) ?? 0);
    let indice = livres.findIndex((cabeca) => metadeDaCabeca(cabeca) === desejada);
    if (indice < 0) indice = 0; // sem vaga do lado certo: fica a melhor livre
    const cabeca = livres.splice(indice, 1)[0];
    cabecaDaDupla.set(c.duplaId, cabeca);
    grupoDaCabeca.set(cabeca, c.grupo);
  }
  proxima += segundos.length;

  // os 3ºs repescados só evitam cair contra o próprio grupo na primeira fase
  const terceiros = camadas[2] ?? [];
  const restantes = terceiros.map((_, i) => proxima + i);
  for (const c of terceiros) {
    let indice = restantes.findIndex(
      (cabeca) => grupoDaCabeca.get(tamanho + 1 - cabeca) !== c.grupo
    );
    if (indice < 0) indice = 0;
    const cabeca = restantes.splice(indice, 1)[0];
    cabecaDaDupla.set(c.duplaId, cabeca);
    grupoDaCabeca.set(cabeca, c.grupo);
  }

  // a divisão fica em "Ouro": é a chave única da categoria neste formato
  const fases = montarFases(campeonatoId, categoria, "Ouro", tamanho);
  for (const [duplaId, cabeca] of cabecaDaDupla) {
    const vaga = vagaDaCabeca.get(cabeca);
    if (vaga === undefined) continue;
    const jogo = fases[0][Math.floor(vaga / 2)];
    if (vaga % 2 === 0) jogo.duplaA = duplaId;
    else jogo.duplaB = duplaId;
  }

  const byes = tamanho - todos.length;
  return {
    jogos: propagarMataMata(fases.flat()),
    avisos: [
      `${categoria}: ${todos.length} classificado(s) em chave de ${tamanho}${
        byes > 0 ? ` — ${byes} bye(s) para os melhores 1ºs` : " — sem bye"
      }.`,
    ],
  };
}

/** Esqueleto de fases vazias, já ligadas pelo campo `proximo`. */
function montarFases(
  campeonatoId: string,
  categoria: string,
  divisao: Divisao,
  tamanho: number
): JogoMataMata[][] {
  const fases: JogoMataMata[][] = [];
  let restantes = tamanho;
  let ordem = 1;

  while (restantes >= 2) {
    const jogosDaFase = restantes / 2;
    const fase: JogoMataMata[] = [];
    for (let j = 1; j <= jogosDaFase; j++) {
      fase.push({
        id: `MM-${campeonatoId}-${categoria}-${divisao}-F${ordem}-J${j}`,
        campeonatoId,
        categoria,
        divisao,
        fase: nomeDaFase(restantes),
        ordemFase: ordem,
        jogo: j,
        duplaA: null,
        duplaB: null,
        pontosA: null,
        pontosB: null,
        proximo: null,
      });
    }
    fases.push(fase);
    restantes = jogosDaFase;
    ordem += 1;
  }

  fases.forEach((fase, i) => {
    const proxima = fases[i + 1];
    if (!proxima) return;
    fase.forEach((jogo, j) => {
      jogo.proximo = proxima[Math.floor(j / 2)].id;
    });
  });

  return fases;
}

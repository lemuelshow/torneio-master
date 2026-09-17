import type {
  Atleta, Campeonato, Config, Divisao, Dupla, Estado, Etapa, IntegranteGrupo,
  Jogo, JogoMataMata, Lado, LinhaClassificacao, ParticipanteCalculado,
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

/** Categorias que realmente têm participantes neste campeonato. */
export function categoriasDoCampeonato(estado: Estado, campeonatoId: string) {
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

/** Soma de vitórias e, no desempate, número de pontos. */
export function classificar(estado: Estado, campeonatoId?: string): LinhaClassificacao[] {
  const nome = new Map(estado.atletas.map((a) => [a.id, a.nome]));
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

    // ordem fixada à mão na etapa de classificação, quando o operador ajustou
    const fixas = new Map(
      integrantes
        .filter((i) => i.posicaoManual !== null)
        .map((i) => [i.atletaId, i.posicaoManual as number])
    );
    const ajustadoAMao = fixas.size > 0;
    const posicaoFixa = (atletaId: string) =>
      fixas.get(atletaId) ?? Number.MAX_SAFE_INTEGER;

    const linhas = integrantes.map((i) => {
      let vitorias = 0;
      let pro = 0;
      let contra = 0;
      let disputados = 0;

      for (const j of jogos) {
        if (j.pontosA === null || j.pontosB === null) continue;
        const naA = j.duplaA.includes(i.atletaId);
        const naB = j.duplaB.includes(i.atletaId);
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
        atletaId: i.atletaId,
        nome: nome.get(i.atletaId) ?? i.atletaId,
        vitorias,
        pontosPro: pro,
        pontosContra: contra,
        saldo: pro - contra,
        jogos: disputados,
        divisao: null as Divisao | null,
        manual: ajustadoAMao,
      };
    });

    // a posição fixada à mão manda; sem ela, vitórias e depois pontos
    linhas.sort(
      (x, y) =>
        posicaoFixa(x.atletaId) - posicaoFixa(y.atletaId) ||
        y.vitorias - x.vitorias ||
        y.pontosPro - x.pontosPro ||
        y.saldo - x.saldo ||
        x.nome.localeCompare(y.nome)
    );

    linhas.forEach((l, i) => {
      l.posicao = i + 1;
      // 1º e 2º de cada grupo vão para o Ouro; 3º e 4º para a Prata.
      l.divisao = i < 2 ? "Ouro" : "Prata";
    });

    saida.push(...linhas);
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

export const indiceEtapa = (etapa: Etapa) => ORDEM_ETAPAS.indexOf(etapa);

/** Diz se o campeonato pode avançar e, se não, por quê. */
export function podeAvancar(
  estado: Estado,
  campeonato: Campeonato
): { ok: boolean; motivo?: string } {
  const categorias = categoriasDoCampeonato(estado, campeonato.id);

  switch (campeonato.etapa) {
    case "participantes": {
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
    case "classificacao":
      return { ok: true };
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

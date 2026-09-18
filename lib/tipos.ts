export type Lado = "D" | "E" | "Ambos";
export type Sexo = "M" | "F";
export type Divisao = "Ouro" | "Prata";

/**
 * Formato do torneio. "sorteio" é o do 1º dia: inscrição individual, grupos
 * sorteados com parceiro em rodízio e 2º sorteio de duplas. "duplas_fechadas"
 * é o do 2º dia: a dupla se inscreve junta e continua a mesma até a final.
 * Campeonato sem formato gravado conta como "sorteio".
 */
export type Formato = "sorteio" | "duplas_fechadas";

/** De onde veio a dupla: do 2º sorteio ou da inscrição feita pelo operador. */
export type OrigemDupla = "sorteio" | "inscricao";

/** Quantos de cada grupo passam para a chave, no formato de duplas fechadas. */
export type CorteDeClassificacao = "1" | "2" | "2+3";

/**
 * Etapas do fluxo de um campeonato, na ordem. O formato de duplas fechadas usa
 * as mesmas chaves, só que pula "duplas" — nele a dupla já nasce inscrita.
 */
export type Etapa =
  | "participantes"
  | "grupos"
  | "classificacao"
  | "duplas"
  | "final"
  | "encerrado";

export interface PassoDaEtapa {
  chave: Etapa;
  titulo: string;
  descricao: string;
}

export const ETAPAS: PassoDaEtapa[] = [
  {
    chave: "participantes",
    titulo: "Participantes",
    descricao: "Monte a lista de atletas e controle as inscrições.",
  },
  {
    chave: "grupos",
    titulo: "Fase de grupos",
    descricao: "Grupos sorteados, jogos e lançamento dos placares.",
  },
  {
    chave: "classificacao",
    titulo: "Classificação e súmulas",
    descricao: "Ordenação por vitórias e pontos, com súmulas em PDF.",
  },
  {
    chave: "duplas",
    titulo: "2º sorteio — duplas",
    descricao: "Duplas fixas do Ouro e da Prata.",
  },
  {
    chave: "final",
    titulo: "Chave final",
    descricao: "Mata-mata até a decisão.",
  },
  {
    chave: "encerrado",
    titulo: "Encerrado",
    descricao: "Campeonato concluído.",
  },
];

/** Mesmo fluxo, sem o 2º sorteio: a dupla entra fechada e continua a mesma. */
export const ETAPAS_DUPLAS_FECHADAS: PassoDaEtapa[] = [
  {
    chave: "participantes",
    titulo: "Inscrição das duplas",
    descricao: "Monte as duplas e controle as inscrições.",
  },
  {
    chave: "grupos",
    titulo: "Fase de grupos",
    descricao: "Grupos sorteados de duplas, todos contra todos.",
  },
  {
    chave: "classificacao",
    titulo: "Classificação e súmulas",
    descricao: "Ordenação das duplas por grupo, com súmulas em PDF.",
  },
  {
    chave: "final",
    titulo: "Chave final",
    descricao: "Cruzamento olímpico até a decisão.",
  },
  {
    chave: "encerrado",
    titulo: "Encerrado",
    descricao: "Campeonato concluído.",
  },
];

export const etapasDoFormato = (formato: Formato): PassoDaEtapa[] =>
  formato === "duplas_fechadas" ? ETAPAS_DUPLAS_FECHADAS : ETAPAS;

/** Base global de atletas — reaproveitada entre campeonatos. */
export interface Atleta {
  id: string;
  nome: string;
  apelido: string;
  cidade: string;
  nascimento: string; // yyyy-mm-dd
  sexo: Sexo;
  lado: Lado;
  uniforme: string;
  telefone: string;
  observacoes: string;
  ativo: boolean;
}

export interface Campeonato {
  id: string;
  nome: string;
  data: string; // yyyy-mm-dd — base do cálculo de idade
  local: string;
  valorInscricao: number;
  /** Tamanho do grupo no formato sorteio. */
  atletasPorGrupo: number;
  /** Tamanho do grupo no formato de duplas fechadas. */
  duplasPorGrupo: number;
  formato: Formato;
  /** Quantos de cada grupo vão para a chave (só no formato de duplas fechadas). */
  corteDeClassificacao: CorteDeClassificacao;
  etapa: Etapa;
  criadoEm: string;
  observacoes: string;
}

/** Inscrição de um atleta em um campeonato, com as 4 parcelas. */
export interface Participante {
  campeonatoId: string;
  atletaId: string;
  /** Categoria escolhida na hora de inscrever, por fora do cálculo automático de sexo/idade. */
  categoriaManual: string | null;
  valorTotal: number;
  p1: boolean;
  p2: boolean;
  p3: boolean;
  p4: boolean;
  dataP1: string;
  dataP2: string;
  dataP3: string;
  dataP4: string;
}

/**
 * Uma vaga dentro de um grupo. No formato sorteio a vaga é de um atleta
 * (`atletaId`); no de duplas fechadas é de uma dupla inteira (`duplaId`, com
 * `atletaId` vazio). Use `chaveDoIntegrante` para ler a identidade da vaga sem
 * se importar com o formato.
 */
export interface IntegranteGrupo {
  campeonatoId: string;
  categoria: string;
  grupo: number;
  vaga: number;
  atletaId: string;
  duplaId: string | null;
  ladoNoGrupo: Lado;
  /** Posição fixada à mão na classificação do grupo; null = ordem automática. */
  posicaoManual: number | null;
}

export interface Jogo {
  id: string;
  campeonatoId: string;
  categoria: string;
  grupo: number;
  rodada: number;
  duplaA: [string, string];
  duplaB: [string, string];
  pontosA: number | null;
  pontosB: number | null;
}

/**
 * Dupla fixa. No formato sorteio ela nasce do 2º sorteio (origem "sorteio") e
 * `divisao` separa Ouro e Prata; no de duplas fechadas ela nasce da inscrição
 * (origem "inscricao") e a divisão fica sempre em "Ouro", que é a chave única
 * da categoria — o campo continua aí para o dia em que o cliente pedir Ouro e
 * Prata também nesse formato.
 */
export interface Dupla {
  id: string;
  campeonatoId: string;
  categoria: string;
  divisao: Divisao;
  numero: number;
  atletaD: string;
  atletaE: string;
  origem: OrigemDupla;
  cabecaDeChave: boolean;
}

export interface JogoMataMata {
  id: string;
  campeonatoId: string;
  categoria: string;
  divisao: Divisao;
  fase: string;
  ordemFase: number;
  jogo: number;
  duplaA: string | null;
  duplaB: string | null;
  pontosA: number | null;
  pontosB: number | null;
  proximo: string | null;
}

export interface FaixaCategoria {
  nome: string;
  sexo: Sexo;
  idadeMin: number;
  idadeMax: number;
  ativa: boolean;
}

/** Padrões usados ao criar um campeonato novo. */
export interface Config {
  organizacao: string;
  valorInscricao: number;
  atletasPorGrupo: number;
  faixas: FaixaCategoria[];
}

export interface Estado {
  config: Config;
  atletas: Atleta[];
  campeonatos: Campeonato[];
  participantes: Participante[];
  grupos: IntegranteGrupo[];
  jogos: Jogo[];
  duplas: Dupla[];
  mataMata: JogoMataMata[];
}

/* ---------------------------------------------------- valores derivados */

export interface ParticipanteCalculado extends Atleta {
  campeonatoId: string;
  idadeNoEvento: number;
  categoria: string | null;
  valorTotal: number;
  parcelasPagas: number;
  situacaoPagamento: string;
  totalPago: number;
  saldo: number;
}

export interface LinhaClassificacao {
  campeonatoId: string;
  categoria: string;
  grupo: number;
  posicao: number;
  /** Preenchido no formato sorteio; vazio quando a linha é de uma dupla. */
  atletaId: string;
  /** Preenchido no formato de duplas fechadas. */
  duplaId: string | null;
  nome: string;
  vitorias: number;
  pontosPro: number;
  pontosContra: number;
  saldo: number;
  jogos: number;
  divisao: Divisao | null;
  /** A ordem deste grupo foi ajustada à mão pelo operador. */
  manual: boolean;
}

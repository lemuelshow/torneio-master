export type Lado = "D" | "E" | "Ambos";
export type Sexo = "M" | "F";
export type Divisao = "Ouro" | "Prata";

/** Etapas do fluxo de um campeonato, na ordem. */
export type Etapa =
  | "participantes"
  | "grupos"
  | "classificacao"
  | "duplas"
  | "final"
  | "encerrado";

export const ETAPAS: { chave: Etapa; titulo: string; descricao: string }[] = [
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
  atletasPorGrupo: number;
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

export interface IntegranteGrupo {
  campeonatoId: string;
  categoria: string;
  grupo: number;
  vaga: number;
  atletaId: string;
  ladoNoGrupo: Lado;
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

export interface Dupla {
  id: string;
  campeonatoId: string;
  categoria: string;
  divisao: Divisao;
  numero: number;
  atletaD: string;
  atletaE: string;
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
  atletaId: string;
  nome: string;
  vitorias: number;
  pontosPro: number;
  pontosContra: number;
  saldo: number;
  jogos: number;
  divisao: Divisao | null;
}

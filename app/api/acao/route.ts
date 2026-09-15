import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { erroDeArmazenamento, gravarEstado, lerEstado } from "@/lib/armazenamento";
import { COOKIE_OFFLINE } from "@/lib/constantes";
import {
  ORDEM_ETAPAS, categoriasAtivas, categoriasDoCampeonato, gerarMataMata, jogosDoGrupo,
  novoId, podeAvancar, propagarMataMata, sortearDuplas, sortearGrupos,
} from "@/lib/regras";
import type {
  Atleta, Campeonato, Divisao, Estado, Etapa, IntegranteGrupo, Participante,
} from "@/lib/tipos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Corpo = Record<string, unknown>;

const texto = (v: unknown) => String(v ?? "").trim();
const numero = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const booleano = (v: unknown) => v === true || v === "true" || v === 1;
const hoje = () => new Date().toISOString().slice(0, 10);

/** Remove tudo que pertence a um campeonato a partir de uma etapa. */
function limparDaEtapa(estado: Estado, campeonatoId: string, etapa: Etapa) {
  const indice = ORDEM_ETAPAS.indexOf(etapa);
  if (indice <= ORDEM_ETAPAS.indexOf("grupos")) {
    estado.grupos = estado.grupos.filter((g) => g.campeonatoId !== campeonatoId);
    estado.jogos = estado.jogos.filter((j) => j.campeonatoId !== campeonatoId);
  }
  if (indice <= ORDEM_ETAPAS.indexOf("duplas"))
    estado.duplas = estado.duplas.filter((d) => d.campeonatoId !== campeonatoId);
  if (indice <= ORDEM_ETAPAS.indexOf("final"))
    estado.mataMata = estado.mataMata.filter((m) => m.campeonatoId !== campeonatoId);
}

export async function POST(request: Request) {
  let corpo: Corpo;
  try {
    corpo = (await request.json()) as Corpo;
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  const offline = (await cookies()).get(COOKIE_OFFLINE)?.value === "1";
  const acao = texto(corpo.acao);
  let estado: Estado;
  try {
    estado = await lerEstado(offline);
  } catch (e) {
    return NextResponse.json({ erro: erroDeArmazenamento(e, offline) }, { status: 500 });
  }

  const avisos: string[] = [];
  const erro = (mensagem: string, status = 400) =>
    NextResponse.json({ erro: mensagem }, { status });

  const acharCampeonato = (id: string) => estado.campeonatos.find((x) => x.id === id);

  switch (acao) {
    /* ------------------------------------------------------ configuração */
    case "salvarConfig": {
      const cfg = (corpo.config ?? {}) as Corpo;
      estado.config = {
        ...estado.config,
        organizacao: texto(cfg.organizacao) || estado.config.organizacao,
        valorInscricao: numero(cfg.valorInscricao) ?? estado.config.valorInscricao,
        atletasPorGrupo: numero(cfg.atletasPorGrupo) ?? estado.config.atletasPorGrupo,
      };
      if (Array.isArray(cfg.faixas))
        estado.config.faixas = (cfg.faixas as Corpo[]).map((f) => ({
          nome: texto(f.nome),
          sexo: texto(f.sexo).toUpperCase() === "F" ? "F" : "M",
          idadeMin: numero(f.idadeMin) ?? 0,
          idadeMax: numero(f.idadeMax) ?? 120,
          ativa: booleano(f.ativa),
        }));
      break;
    }

    /* ---------------------------------------------------- base de atletas */
    case "salvarAtleta": {
      const a = (corpo.atleta ?? {}) as Corpo;
      const nome = texto(a.nome);
      if (nome.length < 3) return erro("Informe o nome do atleta.");
      if (!texto(a.nascimento))
        return erro("Informe a data de nascimento — ela define a categoria.");

      const id = texto(a.id) || novoId("AT");
      const registro: Atleta = {
        id,
        nome,
        apelido: texto(a.apelido),
        cidade: texto(a.cidade),
        nascimento: texto(a.nascimento),
        sexo: texto(a.sexo).toUpperCase() === "F" ? "F" : "M",
        lado: ["D", "E"].includes(texto(a.lado).toUpperCase())
          ? (texto(a.lado).toUpperCase() as "D" | "E")
          : "Ambos",
        uniforme: texto(a.uniforme),
        telefone: texto(a.telefone),
        observacoes: texto(a.observacoes),
        ativo: a.ativo === undefined ? true : booleano(a.ativo),
      };

      const indice = estado.atletas.findIndex((x) => x.id === id);
      if (indice >= 0) estado.atletas[indice] = registro;
      else estado.atletas.push(registro);

      // cadastro feito de dentro de um campeonato já inscreve o atleta
      const campeonatoId = texto(corpo.campeonatoId);
      if (campeonatoId && acharCampeonato(campeonatoId)) {
        const jaInscrito = estado.participantes.some(
          (p) => p.campeonatoId === campeonatoId && p.atletaId === id
        );
        if (!jaInscrito)
          estado.participantes.push({
            campeonatoId,
            atletaId: id,
            categoriaManual: null,
            valorTotal: acharCampeonato(campeonatoId)!.valorInscricao,
            p1: false, p2: false, p3: false, p4: false,
            dataP1: "", dataP2: "", dataP3: "", dataP4: "",
          });
      }
      break;
    }

    case "excluirAtleta": {
      const id = texto(corpo.id);
      const emCampeonato = estado.participantes.some((p) => p.atletaId === id);
      if (emCampeonato)
        return erro(
          "Este atleta participa de algum campeonato. Remova-o dos campeonatos antes de excluir da base."
        );
      estado.atletas = estado.atletas.filter((a) => a.id !== id);
      break;
    }

    /* --------------------------------------------------------- campeonatos */
    case "criarCampeonato": {
      const x = (corpo.campeonato ?? {}) as Corpo;
      const nome = texto(x.nome);
      if (nome.length < 3) return erro("Dê um nome ao campeonato.");
      if (!texto(x.data)) return erro("Informe a data da competição.");

      const campeonato: Campeonato = {
        id: novoId("CP"),
        nome,
        data: texto(x.data),
        local: texto(x.local),
        valorInscricao: numero(x.valorInscricao) ?? estado.config.valorInscricao,
        atletasPorGrupo: numero(x.atletasPorGrupo) ?? estado.config.atletasPorGrupo,
        etapa: "participantes",
        criadoEm: hoje(),
        observacoes: texto(x.observacoes),
      };
      estado.campeonatos.push(campeonato);
      break;
    }

    case "salvarCampeonato": {
      const x = (corpo.campeonato ?? {}) as Corpo;
      const id = texto(x.id);
      const indice = estado.campeonatos.findIndex((c) => c.id === id);
      if (indice < 0) return erro("Campeonato não encontrado.", 404);
      estado.campeonatos[indice] = {
        ...estado.campeonatos[indice],
        nome: texto(x.nome) || estado.campeonatos[indice].nome,
        data: texto(x.data) || estado.campeonatos[indice].data,
        local: texto(x.local),
        valorInscricao:
          numero(x.valorInscricao) ?? estado.campeonatos[indice].valorInscricao,
        atletasPorGrupo:
          numero(x.atletasPorGrupo) ?? estado.campeonatos[indice].atletasPorGrupo,
        observacoes: texto(x.observacoes),
      };
      break;
    }

    case "excluirCampeonato": {
      const id = texto(corpo.id);
      estado.campeonatos = estado.campeonatos.filter((c) => c.id !== id);
      estado.participantes = estado.participantes.filter((p) => p.campeonatoId !== id);
      limparDaEtapa(estado, id, "grupos");
      break;
    }

    /* -------------------------------------------------------- participantes */
    case "adicionarParticipantes": {
      const campeonatoId = texto(corpo.campeonatoId);
      const campeonato = acharCampeonato(campeonatoId);
      if (!campeonato) return erro("Campeonato não encontrado.", 404);

      const ids = (Array.isArray(corpo.atletaIds) ? corpo.atletaIds : []).map(texto);
      const categoriaPedida = texto(corpo.categoria);
      const categoriaManual = categoriasAtivas(estado.config).includes(categoriaPedida)
        ? categoriaPedida
        : null;
      let adicionados = 0;
      for (const atletaId of ids) {
        if (!estado.atletas.some((a) => a.id === atletaId)) continue;
        if (
          estado.participantes.some(
            (p) => p.campeonatoId === campeonatoId && p.atletaId === atletaId
          )
        )
          continue;
        estado.participantes.push({
          campeonatoId,
          atletaId,
          categoriaManual,
          valorTotal: campeonato.valorInscricao,
          p1: false, p2: false, p3: false, p4: false,
          dataP1: "", dataP2: "", dataP3: "", dataP4: "",
        });
        adicionados += 1;
      }
      if (!adicionados) avisos.push("Nenhum atleta novo foi adicionado.");
      break;
    }

    case "removerParticipante": {
      const campeonatoId = texto(corpo.campeonatoId);
      const atletaId = texto(corpo.atletaId);
      estado.participantes = estado.participantes.filter(
        (p) => !(p.campeonatoId === campeonatoId && p.atletaId === atletaId)
      );
      if (estado.grupos.some((g) => g.campeonatoId === campeonatoId && g.atletaId === atletaId)) {
        estado.grupos = estado.grupos.filter(
          (g) => !(g.campeonatoId === campeonatoId && g.atletaId === atletaId)
        );
        avisos.push(
          "O atleta já estava em um grupo sorteado. Revise a composição dessa categoria."
        );
      }
      break;
    }

    case "salvarParcelas": {
      const campeonatoId = texto(corpo.campeonatoId);
      const atletaId = texto(corpo.atletaId);
      const indice = estado.participantes.findIndex(
        (p) => p.campeonatoId === campeonatoId && p.atletaId === atletaId
      );
      if (indice < 0) return erro("Participante não encontrado.", 404);

      const base = estado.participantes[indice];
      const parcelas = (corpo.parcelas ?? {}) as Corpo;
      const atualizada: Participante = {
        ...base,
        valorTotal: numero(corpo.valorTotal) ?? base.valorTotal,
      };
      ([1, 2, 3, 4] as const).forEach((n) => {
        const chave = `p${n}` as "p1" | "p2" | "p3" | "p4";
        const chaveData = `dataP${n}` as "dataP1" | "dataP2" | "dataP3" | "dataP4";
        if (parcelas[chave] !== undefined) {
          const paga = booleano(parcelas[chave]);
          atualizada[chave] = paga;
          atualizada[chaveData] = paga ? base[chaveData] || hoje() : "";
        }
      });
      estado.participantes[indice] = atualizada;
      break;
    }

    /* -------------------------------------------------------- fase de grupos */
    case "salvarGrupos": {
      const campeonatoId = texto(corpo.campeonatoId);
      const categoria = texto(corpo.categoria);
      const entrada = (Array.isArray(corpo.grupos) ? corpo.grupos : []) as Corpo[];
      const novos: IntegranteGrupo[] = entrada.map((g) => ({
        campeonatoId,
        categoria,
        grupo: numero(g.grupo) ?? 1,
        vaga: numero(g.vaga) ?? 1,
        atletaId: texto(g.atletaId),
        ladoNoGrupo: ["D", "E"].includes(texto(g.ladoNoGrupo).toUpperCase())
          ? (texto(g.ladoNoGrupo).toUpperCase() as "D" | "E")
          : "Ambos",
      }));

      const antes = estado.grupos.filter(
        (g) => g.campeonatoId === campeonatoId && g.categoria === categoria
      );
      const assinatura = (lista: IntegranteGrupo[], grupo: number) =>
        lista.filter((g) => g.grupo === grupo).map((g) => g.atletaId).sort().join("|");

      const numeros = [...new Set(novos.map((g) => g.grupo))].sort((a, b) => a - b);
      let jogos = estado.jogos.filter(
        (j) => !(j.campeonatoId === campeonatoId && j.categoria === categoria)
      );

      for (const numeroGrupo of numeros) {
        const mudou = assinatura(antes, numeroGrupo) !== assinatura(novos, numeroGrupo);
        const doGrupo = novos
          .filter((g) => g.grupo === numeroGrupo)
          .sort((a, b) => a.vaga - b.vaga);

        if (!mudou) {
          jogos = [
            ...jogos,
            ...estado.jogos.filter(
              (j) =>
                j.campeonatoId === campeonatoId &&
                j.categoria === categoria &&
                j.grupo === numeroGrupo
            ),
          ];
          continue;
        }
        if (doGrupo.length === 4) {
          jogos = [
            ...jogos,
            ...jogosDoGrupo(
              campeonatoId,
              categoria,
              numeroGrupo,
              doGrupo.map((g) => g.atletaId)
            ),
          ];
          avisos.push(
            `Grupo ${numeroGrupo} mudou de composição: jogos refeitos e placares zerados.`
          );
        } else {
          avisos.push(
            `Grupo ${numeroGrupo} está com ${doGrupo.length} atleta(s) — sem jogos até completar 4.`
          );
        }
      }

      estado.grupos = [
        ...estado.grupos.filter(
          (g) => !(g.campeonatoId === campeonatoId && g.categoria === categoria)
        ),
        ...novos,
      ];
      estado.jogos = jogos;
      break;
    }

    case "adicionarAoGrupo": {
      const campeonatoId = texto(corpo.campeonatoId);
      const categoria = texto(corpo.categoria);
      const grupoNumero = numero(corpo.grupo);
      const campeonato = acharCampeonato(campeonatoId);
      if (!campeonato) return erro("Campeonato não encontrado.", 404);
      if (!categoria || !grupoNumero) return erro("Grupo inválido.");

      let atletaId = texto(corpo.atletaId);

      const novoAtleta = corpo.atleta as Corpo | undefined;
      if (!atletaId && novoAtleta) {
        const nome = texto(novoAtleta.nome);
        if (nome.length < 3) return erro("Informe o nome do atleta.");
        if (!texto(novoAtleta.nascimento))
          return erro("Informe a data de nascimento — ela define a categoria.");
        atletaId = novoId("AT");
        estado.atletas.push({
          id: atletaId,
          nome,
          apelido: texto(novoAtleta.apelido),
          cidade: texto(novoAtleta.cidade),
          nascimento: texto(novoAtleta.nascimento),
          sexo: texto(novoAtleta.sexo).toUpperCase() === "F" ? "F" : "M",
          lado: ["D", "E"].includes(texto(novoAtleta.lado).toUpperCase())
            ? (texto(novoAtleta.lado).toUpperCase() as "D" | "E")
            : "Ambos",
          uniforme: texto(novoAtleta.uniforme),
          telefone: texto(novoAtleta.telefone),
          observacoes: texto(novoAtleta.observacoes),
          ativo: true,
        });
      }

      if (!atletaId) return erro("Selecione um atleta da base ou cadastre um novo.");
      const atleta = estado.atletas.find((a) => a.id === atletaId);
      if (!atleta) return erro("Atleta não encontrado.", 404);

      if (
        estado.grupos.some(
          (g) =>
            g.campeonatoId === campeonatoId &&
            g.categoria === categoria &&
            g.atletaId === atletaId
        )
      )
        return erro("Este atleta já está em um grupo desta categoria.");

      const indiceParticipante = estado.participantes.findIndex(
        (p) => p.campeonatoId === campeonatoId && p.atletaId === atletaId
      );
      if (indiceParticipante < 0) {
        estado.participantes.push({
          campeonatoId,
          atletaId,
          categoriaManual: categoria,
          valorTotal: campeonato.valorInscricao,
          p1: false, p2: false, p3: false, p4: false,
          dataP1: "", dataP2: "", dataP3: "", dataP4: "",
        });
      } else if (!estado.participantes[indiceParticipante].categoriaManual) {
        estado.participantes[indiceParticipante] = {
          ...estado.participantes[indiceParticipante],
          categoriaManual: categoria,
        };
      }

      const doGrupo = estado.grupos.filter(
        (g) =>
          g.campeonatoId === campeonatoId &&
          g.categoria === categoria &&
          g.grupo === grupoNumero
      );
      const proximaVaga = doGrupo.length ? Math.max(...doGrupo.map((g) => g.vaga)) + 1 : 1;
      const novaEntrada: IntegranteGrupo = {
        campeonatoId,
        categoria,
        grupo: grupoNumero,
        vaga: proximaVaga,
        atletaId,
        ladoNoGrupo: atleta.lado,
      };
      estado.grupos.push(novaEntrada);

      const atualizado = [...doGrupo, novaEntrada].sort((a, b) => a.vaga - b.vaga);
      estado.jogos = estado.jogos.filter(
        (j) =>
          !(
            j.campeonatoId === campeonatoId &&
            j.categoria === categoria &&
            j.grupo === grupoNumero
          )
      );
      if (atualizado.length === 4) {
        estado.jogos.push(
          ...jogosDoGrupo(
            campeonatoId,
            categoria,
            grupoNumero,
            atualizado.map((g) => g.atletaId)
          )
        );
        avisos.push(`${atleta.nome} entrou no grupo ${grupoNumero} — jogos gerados.`);
      } else {
        avisos.push(
          `${atleta.nome} entrou no grupo ${grupoNumero} (${atualizado.length} atleta(s) agora) — faltam para completar 4 e gerar os jogos.`
        );
      }
      break;
    }

    case "sortearGrupos": {
      const campeonatoId = texto(corpo.campeonatoId);
      const categoria = texto(corpo.categoria);
      const resultado = sortearGrupos(estado, campeonatoId, categoria);
      if (!resultado.grupos.length) return erro(resultado.avisos.join(" "));

      estado.grupos = [
        ...estado.grupos.filter(
          (g) => !(g.campeonatoId === campeonatoId && g.categoria === categoria)
        ),
        ...resultado.grupos,
      ];
      estado.jogos = [
        ...estado.jogos.filter(
          (j) => !(j.campeonatoId === campeonatoId && j.categoria === categoria)
        ),
        ...resultado.jogos,
      ];
      estado.duplas = estado.duplas.filter(
        (d) => !(d.campeonatoId === campeonatoId && d.categoria === categoria)
      );
      estado.mataMata = estado.mataMata.filter(
        (m) => !(m.campeonatoId === campeonatoId && m.categoria === categoria)
      );
      avisos.push(...resultado.avisos);
      break;
    }

    case "salvarResultado": {
      const indice = estado.jogos.findIndex((j) => j.id === texto(corpo.jogoId));
      if (indice < 0) return erro("Jogo não encontrado.", 404);
      estado.jogos[indice] = {
        ...estado.jogos[indice],
        pontosA: numero(corpo.pontosA),
        pontosB: numero(corpo.pontosB),
      };
      break;
    }

    /* ------------------------------------------------------ duplas e chave */
    case "sortearDuplas": {
      const campeonatoId = texto(corpo.campeonatoId);
      const categoria = texto(corpo.categoria);
      const divisao = (texto(corpo.divisao) === "Prata" ? "Prata" : "Ouro") as Divisao;
      const resultado = sortearDuplas(estado, campeonatoId, categoria, divisao);
      if (!resultado.duplas.length) return erro(resultado.avisos.join(" "));

      estado.duplas = [
        ...estado.duplas.filter(
          (d) =>
            !(
              d.campeonatoId === campeonatoId &&
              d.categoria === categoria &&
              d.divisao === divisao
            )
        ),
        ...resultado.duplas,
      ];
      estado.mataMata = estado.mataMata.filter(
        (m) =>
          !(
            m.campeonatoId === campeonatoId &&
            m.categoria === categoria &&
            m.divisao === divisao
          )
      );
      avisos.push(...resultado.avisos);
      break;
    }

    case "gerarMataMata": {
      const campeonatoId = texto(corpo.campeonatoId);
      const categoria = texto(corpo.categoria);
      const divisao = (texto(corpo.divisao) === "Prata" ? "Prata" : "Ouro") as Divisao;
      const resultado = gerarMataMata(estado, campeonatoId, categoria, divisao);
      if (!resultado.jogos.length) return erro(resultado.avisos.join(" "));

      estado.mataMata = [
        ...estado.mataMata.filter(
          (m) =>
            !(
              m.campeonatoId === campeonatoId &&
              m.categoria === categoria &&
              m.divisao === divisao
            )
        ),
        ...resultado.jogos,
      ];
      avisos.push(...resultado.avisos);
      break;
    }

    case "salvarResultadoMataMata": {
      const indice = estado.mataMata.findIndex((m) => m.id === texto(corpo.jogoId));
      if (indice < 0) return erro("Jogo não encontrado.", 404);

      const jogo = estado.mataMata[indice];
      if (!jogo.duplaA || !jogo.duplaB)
        return erro(
          "Este confronto ainda não tem as duas duplas definidas — se for um bye, a dupla avança sem jogo."
        );

      estado.mataMata[indice] = {
        ...jogo,
        pontosA: numero(corpo.pontosA),
        pontosB: numero(corpo.pontosB),
      };
      const alvo = estado.mataMata[indice];
      const daChave = (m: typeof alvo) =>
        m.campeonatoId === alvo.campeonatoId &&
        m.categoria === alvo.categoria &&
        m.divisao === alvo.divisao;
      estado.mataMata = [
        ...propagarMataMata(estado.mataMata.filter(daChave)),
        ...estado.mataMata.filter((m) => !daChave(m)),
      ];
      break;
    }

    /* ------------------------------------------------------------- fluxo */
    case "avancarEtapa": {
      const campeonatoId = texto(corpo.campeonatoId);
      const indice = estado.campeonatos.findIndex((c) => c.id === campeonatoId);
      if (indice < 0) return erro("Campeonato não encontrado.", 404);
      const campeonato = estado.campeonatos[indice];

      const permitido = podeAvancar(estado, campeonato);
      if (!permitido.ok) return erro(permitido.motivo ?? "Não é possível avançar agora.");

      const categorias = categoriasDoCampeonato(estado, campeonatoId);

      if (campeonato.etapa === "participantes") {
        for (const categoria of categorias) {
          const resultado = sortearGrupos(estado, campeonatoId, categoria);
          if (!resultado.grupos.length) {
            avisos.push(...resultado.avisos);
            continue;
          }
          estado.grupos = [
            ...estado.grupos.filter(
              (g) => !(g.campeonatoId === campeonatoId && g.categoria === categoria)
            ),
            ...resultado.grupos,
          ];
          estado.jogos = [
            ...estado.jogos.filter(
              (j) => !(j.campeonatoId === campeonatoId && j.categoria === categoria)
            ),
            ...resultado.jogos,
          ];
          avisos.push(...resultado.avisos);
        }
        if (!estado.grupos.some((g) => g.campeonatoId === campeonatoId))
          return erro("Nenhum grupo pôde ser formado. Verifique os participantes.");
        estado.campeonatos[indice] = { ...campeonato, etapa: "grupos" };
      } else if (campeonato.etapa === "grupos") {
        estado.campeonatos[indice] = { ...campeonato, etapa: "classificacao" };
      } else if (campeonato.etapa === "classificacao") {
        for (const categoria of categorias) {
          for (const divisao of ["Ouro", "Prata"] as Divisao[]) {
            const resultado = sortearDuplas(estado, campeonatoId, categoria, divisao);
            avisos.push(...resultado.avisos);
            if (!resultado.duplas.length) continue;
            estado.duplas = [
              ...estado.duplas.filter(
                (d) =>
                  !(
                    d.campeonatoId === campeonatoId &&
                    d.categoria === categoria &&
                    d.divisao === divisao
                  )
              ),
              ...resultado.duplas,
            ];
          }
        }
        if (!estado.duplas.some((d) => d.campeonatoId === campeonatoId))
          return erro("Não foi possível formar duplas. Confira a classificação.");
        estado.campeonatos[indice] = { ...campeonato, etapa: "duplas" };
      } else if (campeonato.etapa === "duplas") {
        for (const categoria of categorias) {
          for (const divisao of ["Ouro", "Prata"] as Divisao[]) {
            const resultado = gerarMataMata(estado, campeonatoId, categoria, divisao);
            if (!resultado.jogos.length) {
              avisos.push(...resultado.avisos);
              continue;
            }
            estado.mataMata = [
              ...estado.mataMata.filter(
                (m) =>
                  !(
                    m.campeonatoId === campeonatoId &&
                    m.categoria === categoria &&
                    m.divisao === divisao
                  )
              ),
              ...resultado.jogos,
            ];
            avisos.push(...resultado.avisos);
          }
        }
        if (!estado.mataMata.some((m) => m.campeonatoId === campeonatoId))
          return erro("Nenhuma chave pôde ser montada.");
        estado.campeonatos[indice] = { ...campeonato, etapa: "final" };
      } else if (campeonato.etapa === "final") {
        estado.campeonatos[indice] = { ...campeonato, etapa: "encerrado" };
      }
      break;
    }

    case "voltarEtapa": {
      const campeonatoId = texto(corpo.campeonatoId);
      const indice = estado.campeonatos.findIndex((c) => c.id === campeonatoId);
      if (indice < 0) return erro("Campeonato não encontrado.", 404);
      const campeonato = estado.campeonatos[indice];
      const posicao = ORDEM_ETAPAS.indexOf(campeonato.etapa);
      if (posicao <= 0) return erro("O campeonato já está na primeira etapa.");

      const anterior = ORDEM_ETAPAS[posicao - 1];
      // volta preservando o que a etapa anterior produz
      if (anterior === "participantes") limparDaEtapa(estado, campeonatoId, "grupos");
      if (anterior === "classificacao") limparDaEtapa(estado, campeonatoId, "duplas");
      if (anterior === "duplas") limparDaEtapa(estado, campeonatoId, "final");
      estado.campeonatos[indice] = { ...campeonato, etapa: anterior };
      avisos.push(`Campeonato voltou para a etapa "${anterior}".`);
      break;
    }

    default:
      return erro(`Ação desconhecida: ${acao}`);
  }

  try {
    await gravarEstado(estado, offline);
  } catch (e) {
    return NextResponse.json({ erro: erroDeArmazenamento(e, offline) }, { status: 409 });
  }

  return NextResponse.json({ ok: true, avisos, estado });
}

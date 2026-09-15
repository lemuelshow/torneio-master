"use client";

import { useState } from "react";
import { Check, FileDown, Save, Shuffle, UserPlus, X } from "lucide-react";
import { ROTULO_LADO, useDados } from "@/lib/cliente";
import { categoriasDoCampeonato } from "@/lib/regras";
import type { Campeonato, IntegranteGrupo, Jogo } from "@/lib/tipos";
import {
  Abas, Alerta, Botao, Campo, Card, Entrada, IndicadorCategoria, Selecao, Selo, Tabela,
  Titulo, useAbaSelecionada, Vazio,
} from "@/components/ui";

const txt = (v: number | null) => (v === null ? "" : String(v));

const ATLETA_VAZIO = {
  nome: "",
  apelido: "",
  cidade: "",
  nascimento: "",
  sexo: "M",
  lado: "D",
  uniforme: "",
  telefone: "",
  observacoes: "",
};

/* ------------------------------------------------------------- placar */

function Placar({ jogo, nomeDe }: { jogo: Jogo; nomeDe: (id: string) => string }) {
  const { executar, salvando } = useDados();
  const assinatura = `${jogo.pontosA}|${jogo.pontosB}`;
  const [rascunho, setRascunho] = useState(() => ({
    assinatura,
    a: txt(jogo.pontosA),
    b: txt(jogo.pontosB),
  }));

  // o banco mudou por fora (sorteio, outra edição): o rascunho acompanha
  if (rascunho.assinatura !== assinatura)
    setRascunho({ assinatura, a: txt(jogo.pontosA), b: txt(jogo.pontosB) });

  const sujo = rascunho.a !== txt(jogo.pontosA) || rascunho.b !== txt(jogo.pontosB);

  const salvar = () => {
    if (!sujo) return;
    executar("salvarResultado", {
      jogoId: jogo.id,
      pontosA: rascunho.a === "" ? null : Number(rascunho.a),
      pontosB: rascunho.b === "" ? null : Number(rascunho.b),
    });
  };

  const campo = (lado: "a" | "b") => (
    <input
      type="number"
      min={0}
      inputMode="numeric"
      value={rascunho[lado]}
      onChange={(e) => setRascunho({ ...rascunho, [lado]: e.target.value })}
      onBlur={salvar}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      disabled={salvando}
      className="h-9 w-14 rounded-lg border border-line bg-surface text-center text-sm font-bold text-marinho-800 focus:border-marinho-400 focus:outline-none focus:ring-4 focus:ring-marinho-500/12"
      aria-label={`Pontos da dupla ${lado.toUpperCase()}`}
    />
  );

  const venceA = jogo.pontosA !== null && jogo.pontosB !== null && jogo.pontosA > jogo.pontosB;
  const venceB = jogo.pontosA !== null && jogo.pontosB !== null && jogo.pontosB > jogo.pontosA;

  return (
    <tr className="hover:bg-marinho-50/40">
      <td className="px-3 py-2 text-ink-3">{jogo.rodada}</td>
      <td className={`px-3 py-2 ${venceA ? "font-semibold text-verde-700" : "text-ink"}`}>
        {nomeDe(jogo.duplaA[0])} + {nomeDe(jogo.duplaA[1])}
      </td>
      <td className="px-2 py-2">{campo("a")}</td>
      <td className="px-2 py-2">{campo("b")}</td>
      <td className={`px-3 py-2 ${venceB ? "font-semibold text-verde-700" : "text-ink"}`}>
        {nomeDe(jogo.duplaB[0])} + {nomeDe(jogo.duplaB[1])}
      </td>
      <td className="px-3 py-2 text-right">
        {sujo ? (
          <Botao pequeno variante="verde" onClick={salvar} disabled={salvando}>
            <Save className="size-3.5" />
            Salvar
          </Botao>
        ) : jogo.pontosA !== null && jogo.pontosB !== null ? (
          <Check className="ml-auto size-4 text-verde-600" />
        ) : null}
      </td>
    </tr>
  );
}

/* ------------------------------------------------- composição do grupo */

function CartaoGrupo({
  campeonato,
  categoria,
  numero,
  integrantes,
  opcoes,
  bloqueado,
}: {
  campeonato: Campeonato;
  categoria: string;
  numero: number;
  integrantes: IntegranteGrupo[];
  opcoes: { id: string; nome: string }[];
  bloqueado: boolean;
}) {
  const { estado, executar, salvando, nomeDe, participantesDe } = useDados();
  const assinatura = integrantes.map((g) => g.atletaId).join("|");
  const [rascunho, setRascunho] = useState(() => ({
    assinatura,
    ids: integrantes.map((g) => g.atletaId),
  }));

  const [adicionando, setAdicionando] = useState(false);
  const [modoNovo, setModoNovo] = useState(false);
  const [atletaEscolhido, setAtletaEscolhido] = useState("");
  const [novoAtleta, setNovoAtleta] = useState(ATLETA_VAZIO);

  const jaNaCategoria = new Set(
    estado.grupos
      .filter((g) => g.campeonatoId === campeonato.id && g.categoria === categoria)
      .map((g) => g.atletaId)
  );
  const disponiveisBase = estado.atletas
    .filter((a) => a.ativo && !jaNaCategoria.has(a.id))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  const categoriaAtualDoAtleta = new Map(
    participantesDe(campeonato.id).map((p) => [p.id, p.categoria])
  );

  const fecharPainel = () => {
    setAdicionando(false);
    setModoNovo(false);
    setAtletaEscolhido("");
    setNovoAtleta(ATLETA_VAZIO);
  };

  const adicionarExistente = async () => {
    if (!atletaEscolhido) return;

    const categoriaAtual = categoriaAtualDoAtleta.get(atletaEscolhido);
    if (categoriaAtual && categoriaAtual !== categoria) {
      const confirmar = window.confirm(
        `Esse atleta já está vinculado à categoria "${categoriaAtual}" neste torneio. Adicionar mesmo assim ao grupo de "${categoria}"?`
      );
      if (!confirmar) return;
    }

    const ok = await executar("adicionarAoGrupo", {
      campeonatoId: campeonato.id,
      categoria,
      grupo: numero,
      atletaId: atletaEscolhido,
    });
    if (ok) fecharPainel();
  };

  const cadastrarEAdicionar = async () => {
    const ok = await executar("adicionarAoGrupo", {
      campeonatoId: campeonato.id,
      categoria,
      grupo: numero,
      atleta: novoAtleta,
    });
    if (ok) fecharPainel();
  };

  if (rascunho.assinatura !== assinatura)
    setRascunho({ assinatura, ids: integrantes.map((g) => g.atletaId) });

  const sujo = rascunho.ids.join("|") !== assinatura;

  const salvar = () => {
    // a ação grava a categoria inteira: mistura este grupo alterado com os demais
    const todos = estado.grupos.filter(
      (g) => g.campeonatoId === campeonato.id && g.categoria === categoria
    );
    const lado = new Map(estado.atletas.map((a) => [a.id, a.lado]));
    const atualizados = todos.map((g) => {
      if (g.grupo !== numero) return g;
      const indice = integrantes.findIndex((i) => i.vaga === g.vaga);
      const novoId = rascunho.ids[indice] ?? g.atletaId;
      return { ...g, atletaId: novoId, ladoNoGrupo: lado.get(novoId) ?? g.ladoNoGrupo };
    });
    executar("salvarGrupos", {
      campeonatoId: campeonato.id,
      categoria,
      grupos: atualizados.map((g) => ({
        grupo: g.grupo,
        vaga: g.vaga,
        atletaId: g.atletaId,
        ladoNoGrupo: g.ladoNoGrupo,
      })),
    });
  };

  return (
    <div className="rounded-xl border border-line bg-surface">
      <div className="flex items-center justify-between gap-2 rounded-t-xl bg-marinho-50 px-3 py-2">
        <span className="text-[13px] font-bold text-marinho-800">Grupo {numero}</span>
        <div className="flex items-center gap-2">
          <Selo tom="neutro">{integrantes.length} atletas</Selo>
          {!bloqueado && !adicionando && (
            <button
              type="button"
              onClick={() => setAdicionando(true)}
              className="grid size-6 place-items-center rounded-md bg-marinho-100 text-marinho-700 hover:bg-marinho-200"
              aria-label={`Adicionar jogador ao grupo ${numero}`}
              title="Adicionar jogador"
            >
              <UserPlus className="size-3.5" />
            </button>
          )}
        </div>
      </div>
      <ul className="divide-y divide-line">
        {integrantes.map((g, i) => (
          <li key={`${g.vaga}-${g.atletaId}`} className="flex items-center gap-2 px-3 py-2">
            <span className="grid size-6 shrink-0 place-items-center rounded-md bg-plane text-[11px] font-bold text-ink-2">
              {g.vaga}
            </span>
            {bloqueado ? (
              <span className="flex-1 truncate text-[13px] text-ink">
                {nomeDe(g.atletaId)}
              </span>
            ) : (
              <Selecao
                value={rascunho.ids[i] ?? g.atletaId}
                onChange={(e) => {
                  const ids = [...rascunho.ids];
                  ids[i] = e.target.value;
                  setRascunho({ ...rascunho, ids });
                }}
                className="h-9 w-full text-[13px]"
              >
                {opcoes.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nome}
                  </option>
                ))}
              </Selecao>
            )}
            <Selo tom={g.ladoNoGrupo === "E" ? "ouro" : "neutro"}>
              {ROTULO_LADO[g.ladoNoGrupo]}
            </Selo>
          </li>
        ))}
      </ul>
      {adicionando && !bloqueado && (
        <div className="surge border-t border-line bg-marinho-50/40 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setModoNovo(false)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  !modoNovo
                    ? "border-marinho-600 bg-marinho-600 text-white"
                    : "border-line bg-surface text-ink-2 hover:border-marinho-300"
                }`}
              >
                Já cadastrado
              </button>
              <button
                type="button"
                onClick={() => setModoNovo(true)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  modoNovo
                    ? "border-marinho-600 bg-marinho-600 text-white"
                    : "border-line bg-surface text-ink-2 hover:border-marinho-300"
                }`}
              >
                Cadastrar novo
              </button>
            </div>
            <button
              type="button"
              onClick={fecharPainel}
              className="text-ink-3 hover:text-ink"
              aria-label="Fechar"
            >
              <X className="size-4" />
            </button>
          </div>

          {!modoNovo ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Campo rotulo="Atleta da base" className="flex-1">
                <Selecao
                  value={atletaEscolhido}
                  onChange={(e) => setAtletaEscolhido(e.target.value)}
                  className="h-9 text-[13px]"
                >
                  <option value="">Selecione…</option>
                  {disponiveisBase.map((a) => {
                    const categoriaAtual = categoriaAtualDoAtleta.get(a.id);
                    const outraCategoria = categoriaAtual && categoriaAtual !== categoria;
                    return (
                      <option key={a.id} value={a.id}>
                        {a.nome}
                        {outraCategoria ? ` (já em ${categoriaAtual})` : ""}
                      </option>
                    );
                  })}
                </Selecao>
              </Campo>
              <Botao
                pequeno
                variante="verde"
                onClick={adicionarExistente}
                disabled={salvando || !atletaEscolhido}
              >
                <UserPlus className="size-3.5" />
                Adicionar
              </Botao>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <Campo rotulo="Nome">
                  <Entrada
                    value={novoAtleta.nome}
                    onChange={(e) => setNovoAtleta({ ...novoAtleta, nome: e.target.value })}
                    placeholder="Nome completo"
                    className="h-9"
                  />
                </Campo>
                <Campo rotulo="Nascimento" dica="Define a categoria na data do evento">
                  <Entrada
                    type="date"
                    value={novoAtleta.nascimento}
                    onChange={(e) =>
                      setNovoAtleta({ ...novoAtleta, nascimento: e.target.value })
                    }
                    className="h-9"
                  />
                </Campo>
                <Campo rotulo="Sexo">
                  <Selecao
                    value={novoAtleta.sexo}
                    onChange={(e) => setNovoAtleta({ ...novoAtleta, sexo: e.target.value })}
                    className="h-9 text-[13px]"
                  >
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                  </Selecao>
                </Campo>
                <Campo rotulo="Lado">
                  <Selecao
                    value={novoAtleta.lado}
                    onChange={(e) => setNovoAtleta({ ...novoAtleta, lado: e.target.value })}
                    className="h-9 text-[13px]"
                  >
                    <option value="D">Destro</option>
                    <option value="E">Esquerdo</option>
                    <option value="Ambos">Ambos</option>
                  </Selecao>
                </Campo>
              </div>
              <Botao
                pequeno
                variante="verde"
                onClick={cadastrarEAdicionar}
                disabled={salvando}
                bloco
              >
                <UserPlus className="size-3.5" />
                Cadastrar e adicionar ao grupo
              </Botao>
            </div>
          )}
        </div>
      )}

      {sujo && !bloqueado && (
        <div className="border-t border-line px-3 py-2">
          <Botao pequeno variante="verde" onClick={salvar} disabled={salvando} bloco>
            <Save className="size-3.5" />
            Salvar composição (zera os placares deste grupo)
          </Botao>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- etapa */

export function EtapaGrupos({
  campeonato,
  bloqueado,
}: {
  campeonato: Campeonato;
  bloqueado: boolean;
}) {
  const { estado, executar, salvando, nomeDe, participantesDe, classificacaoDe } = useDados();

  const grupos = estado.grupos.filter((g) => g.campeonatoId === campeonato.id);
  const jogos = estado.jogos.filter((j) => j.campeonatoId === campeonato.id);
  const categorias = [...new Set(grupos.map((g) => g.categoria))].sort();
  const disponiveis = categoriasDoCampeonato(estado, campeonato.id);
  const participantes = participantesDe(campeonato.id);
  const [categoriaSelecionada, selecionarCategoria] = useAbaSelecionada(categorias);
  const [gerandoSumula, setGerandoSumula] = useState("");

  const baixarSumulaEmBranco = async (categoriaAlvo: string) => {
    setGerandoSumula(categoriaAlvo);
    try {
      const { gerarPdfSumulas } = await import("@/lib/pdf");
      await gerarPdfSumulas({
        estado,
        campeonato,
        classificacao: classificacaoDe(campeonato.id),
        categoria: categoriaAlvo,
        emBranco: true,
      });
    } finally {
      setGerandoSumula("");
    }
  };

  if (!grupos.length)
    return (
      <Vazio
        titulo="Fase de grupos ainda não sorteada"
        descricao="Volte para a etapa de participantes e use “Próxima etapa” para sortear os grupos automaticamente."
      />
    );

  const pendentes = jogos.filter((j) => j.pontosA === null || j.pontosB === null).length;

  return (
    <div className="space-y-5">
      <Alerta tom={pendentes ? "alerta" : "info"}>
        {pendentes === 0 ? (
          <>Todos os {jogos.length} jogos têm placar. Pode processar a classificação.</>
        ) : (
          <>
            {jogos.length - pendentes} de {jogos.length} jogos lançados —{" "}
            <strong>{pendentes} pendente(s)</strong>. Cada atleta joga 3 vezes no grupo,
            trocando de parceiro a cada rodada.
          </>
        )}
      </Alerta>

      <Abas
        itens={categorias.map((c) => ({ chave: c, rotulo: c }))}
        selecionada={categoriaSelecionada}
        aoSelecionar={selecionarCategoria}
      />
      {categoriaSelecionada && <IndicadorCategoria categoria={categoriaSelecionada} />}

      {categorias
        .filter((categoria) => categoria === categoriaSelecionada)
        .map((categoria) => {
        const daCategoria = grupos.filter((g) => g.categoria === categoria);
        const numeros = [...new Set(daCategoria.map((g) => g.grupo))].sort((a, b) => a - b);
        const opcoes = participantes
          .filter((p) => p.categoria === categoria)
          .map((p) => ({ id: p.id, nome: p.nome }));

        return (
          <Card key={categoria}>
            <Titulo
              dica={`${daCategoria.length} atletas em ${numeros.length} grupo(s)`}
              acao={
                <div className="flex flex-wrap gap-2">
                  <Botao
                    variante="secundario"
                    pequeno
                    disabled={gerandoSumula !== ""}
                    onClick={() => baixarSumulaEmBranco(categoria)}
                  >
                    <FileDown className="size-4" />
                    {gerandoSumula === categoria ? "Gerando…" : "Súmula em branco (PDF)"}
                  </Botao>
                  {!bloqueado && (
                    <Botao
                      variante="secundario"
                      pequeno
                      disabled={salvando}
                      onClick={() =>
                        executar("sortearGrupos", {
                          campeonatoId: campeonato.id,
                          categoria,
                        })
                      }
                    >
                      <Shuffle className="size-4" />
                      Sortear novamente
                    </Botao>
                  )}
                </div>
              }
            >
              {categoria}
            </Titulo>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {numeros.map((numero) => (
                <CartaoGrupo
                  key={numero}
                  campeonato={campeonato}
                  categoria={categoria}
                  numero={numero}
                  integrantes={daCategoria
                    .filter((g) => g.grupo === numero)
                    .sort((a, b) => a.vaga - b.vaga)}
                  opcoes={opcoes}
                  bloqueado={bloqueado}
                />
              ))}
            </div>

            {numeros.map((numero) => {
              const doGrupo = jogos
                .filter((j) => j.categoria === categoria && j.grupo === numero)
                .sort((a, b) => a.rodada - b.rodada);
              if (!doGrupo.length) return null;
              return (
                <div key={`jogos-${numero}`} className="mt-4">
                  <p className="mb-1 text-[12px] font-bold uppercase tracking-wide text-marinho-600">
                    Jogos do grupo {numero}
                  </p>
                  <div className="rounded-xl border border-line">
                    <Tabela
                      minimo={720}
                      colunas={["#", "Dupla A", "Pts", "Pts", "Dupla B", ""]}
                    >
                      {doGrupo.map((jogo) => (
                        <Placar key={jogo.id} jogo={jogo} nomeDe={nomeDe} />
                      ))}
                    </Tabela>
                  </div>
                </div>
              );
            })}
          </Card>
        );
      })}

      {disponiveis
        .filter((c) => !categorias.includes(c))
        .map((c) => (
          <Alerta key={c} tom="alerta">
            A categoria <strong>{c}</strong> tem participantes mas nenhum grupo foi
            formado — provavelmente faltam atletas para fechar um grupo.
          </Alerta>
        ))}
    </div>
  );
}

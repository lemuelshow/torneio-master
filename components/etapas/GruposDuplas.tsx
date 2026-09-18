"use client";

import { useState } from "react";
import { Check, Crown, FileDown, Save, Shuffle } from "lucide-react";
import { useDados } from "@/lib/cliente";
import { categoriasDoCampeonato } from "@/lib/regras";
import type { Campeonato, Jogo } from "@/lib/tipos";
import {
  Abas, Alerta, Botao, Card, IndicadorCategoria, Selo, Tabela, Titulo,
  useAbaSelecionada, Vazio,
} from "@/components/ui";

const txt = (v: number | null) => (v === null ? "" : String(v));

/** Uma linha de jogo do grupo, com os dois placares editáveis. */
function Placar({
  jogo,
  rotulo,
}: {
  jogo: Jogo;
  rotulo: (atletas: [string, string]) => string;
}) {
  const { executar, salvando } = useDados();
  const assinatura = `${jogo.pontosA}|${jogo.pontosB}`;
  const [rascunho, setRascunho] = useState(() => ({
    assinatura,
    a: txt(jogo.pontosA),
    b: txt(jogo.pontosB),
  }));

  // o banco mudou por fora (novo sorteio, outra edição): o rascunho acompanha
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

  const venceA =
    jogo.pontosA !== null && jogo.pontosB !== null && jogo.pontosA > jogo.pontosB;
  const venceB =
    jogo.pontosA !== null && jogo.pontosB !== null && jogo.pontosB > jogo.pontosA;

  return (
    <tr className="hover:bg-marinho-50/40">
      <td className="px-3 py-2 text-ink-3">{jogo.rodada}</td>
      <td className={`px-3 py-2 ${venceA ? "font-semibold text-verde-700" : "text-ink"}`}>
        {rotulo(jogo.duplaA)}
      </td>
      <td className="px-2 py-2">{campo("a")}</td>
      <td className="px-2 py-2">{campo("b")}</td>
      <td className={`px-3 py-2 ${venceB ? "font-semibold text-verde-700" : "text-ink"}`}>
        {rotulo(jogo.duplaB)}
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

export function EtapaGruposDuplas({
  campeonato,
  bloqueado,
}: {
  campeonato: Campeonato;
  bloqueado: boolean;
}) {
  const { estado, executar, salvando, nomeDe } = useDados();
  const [gerandoSumula, setGerandoSumula] = useState("");

  const grupos = estado.grupos.filter((g) => g.campeonatoId === campeonato.id);
  const jogos = estado.jogos.filter((j) => j.campeonatoId === campeonato.id);
  const duplas = estado.duplas.filter((d) => d.campeonatoId === campeonato.id);
  const categorias = [...new Set(grupos.map((g) => g.categoria))].sort();
  const disponiveis = categoriasDoCampeonato(estado, campeonato.id);
  const [categoriaSelecionada, selecionarCategoria] = useAbaSelecionada(categorias);

  const duplaPorId = new Map(duplas.map((d) => [d.id, d]));
  const nomeDaDupla = (duplaId: string | null) => {
    const d = duplaId ? duplaPorId.get(duplaId) : undefined;
    return d ? `${nomeDe(d.atletaD)} + ${nomeDe(d.atletaE)}` : "—";
  };
  const rotuloDoPar = (atletas: [string, string]) =>
    `${nomeDe(atletas[0])} + ${nomeDe(atletas[1])}`;

  const baixarSumulaEmBranco = async (categoriaAlvo: string) => {
    setGerandoSumula(categoriaAlvo);
    try {
      const { gerarPdfSumulasGruposDuplas } = await import("@/lib/pdf");
      await gerarPdfSumulasGruposDuplas({
        estado,
        campeonato,
        categoria: categoriaAlvo,
        emBranco: true,
      });
    } finally {
      setGerandoSumula("");
    }
  };

  const sortearDeNovo = async (categoria: string) => {
    const comPlacar = jogos.some(
      (j) => j.categoria === categoria && (j.pontosA !== null || j.pontosB !== null)
    );
    if (comPlacar) {
      const confirmar = window.confirm(
        `Já existem placares lançados em ${categoria}. Sortear de novo refaz os grupos e apaga todos eles. Continuar?`
      );
      if (!confirmar) return;
    }
    await executar("sortearGrupos", { campeonatoId: campeonato.id, categoria });
  };

  if (!grupos.length)
    return (
      <Vazio
        titulo="Fase de grupos ainda não sorteada"
        descricao="Volte para a inscrição das duplas e use “Próxima etapa” para sortear os grupos automaticamente."
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
            <strong>{pendentes} pendente(s)</strong>. Dentro do grupo é todos contra
            todos, com a dupla fixa em todos os jogos.
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
          const numeros = [...new Set(daCategoria.map((g) => g.grupo))].sort(
            (a, b) => a - b
          );

          return (
            <Card key={categoria}>
              <Titulo
                dica={`${daCategoria.length} duplas em ${numeros.length} grupo(s)`}
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
                        onClick={() => sortearDeNovo(categoria)}
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
                {numeros.map((numero) => {
                  const integrantes = daCategoria
                    .filter((g) => g.grupo === numero)
                    .sort((a, b) => a.vaga - b.vaga);
                  return (
                    <div key={numero} className="rounded-xl border border-line bg-surface">
                      <div className="flex items-center justify-between gap-2 rounded-t-xl bg-marinho-50 px-3 py-2">
                        <span className="text-[13px] font-bold text-marinho-800">
                          Grupo {numero}
                        </span>
                        <Selo tom="neutro">{integrantes.length} duplas</Selo>
                      </div>
                      <ul className="divide-y divide-line">
                        {integrantes.map((g) => {
                          const dupla = g.duplaId ? duplaPorId.get(g.duplaId) : undefined;
                          return (
                            <li
                              key={`${g.vaga}-${g.duplaId}`}
                              className="flex items-center gap-2 px-3 py-2"
                            >
                              <span className="grid size-6 shrink-0 place-items-center rounded-md bg-plane text-[11px] font-bold text-ink-2">
                                {dupla?.numero ?? g.vaga}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                                {nomeDaDupla(g.duplaId)}
                              </span>
                              {dupla?.cabecaDeChave && (
                                <Crown
                                  className="size-3.5 shrink-0 text-ouro-600"
                                  aria-label="Cabeça de chave"
                                />
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
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
                          <Placar key={jogo.id} jogo={jogo} rotulo={rotuloDoPar} />
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
            A categoria <strong>{c}</strong> tem duplas inscritas mas nenhum grupo foi
            formado — são necessárias ao menos 3 duplas.
          </Alerta>
        ))}
    </div>
  );
}

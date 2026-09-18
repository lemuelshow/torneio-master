"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, Trash2, UserPlus, Users, Wallet } from "lucide-react";
import { ROTULO_LADO, useDados } from "@/lib/cliente";
import { idadeNaData } from "@/lib/regras";
import { maiusculo } from "@/lib/texto";
import type { Campeonato } from "@/lib/tipos";
import {
  Abas, Alerta, Botao, Campo, Card, Entrada, Paginacao, Selecao, Selo, Tabela, Titulo,
  useAbaSelecionada, usePaginacao, Vazio,
} from "@/components/ui";

const VAZIO = {
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

export function EtapaParticipantes({
  campeonato,
  bloqueado,
}: {
  campeonato: Campeonato;
  bloqueado: boolean;
}) {
  const { estado, executar, salvando, participantesDe, categorias } = useDados();
  const [busca, setBusca] = useState("");
  const [marcados, setMarcados] = useState<string[]>([]);
  const [categoriaLote, setCategoriaLote] = useState("");
  const [novo, setNovo] = useState(VAZIO);
  const [criando, setCriando] = useState(false);

  const participantes = participantesDe(campeonato.id);
  const inscritos = useMemo(
    () => new Set(participantes.map((p) => p.id)),
    [participantes]
  );

  const disponiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return estado.atletas
      .filter((a) => !inscritos.has(a.id))
      .filter((a) => !termo || a.nome.toLowerCase().includes(termo))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [estado.atletas, inscritos, busca]);

  const paginacaoDisponiveis = usePaginacao(disponiveis, 20, busca);

  const categoriasInscritos = [
    ...new Set(
      participantes
        .map((p) => p.categoria)
        .filter((c): c is string => Boolean(c))
    ),
  ].sort();
  const temSemCategoria = participantes.some((p) => !p.categoria);
  const abasInscritos =
    categoriasInscritos.length + (temSemCategoria ? 1 : 0) > 1
      ? [
          { chave: "todas", rotulo: "Todas", contagem: participantes.length },
          ...categoriasInscritos.map((c) => ({
            chave: c,
            rotulo: c,
            contagem: participantes.filter((p) => p.categoria === c).length,
          })),
          ...(temSemCategoria
            ? [
                {
                  chave: "sem",
                  rotulo: "Sem categoria",
                  contagem: participantes.filter((p) => !p.categoria).length,
                },
              ]
            : []),
        ]
      : [];
  const [categoriaInscritos, selecionarCategoriaInscritos] = useAbaSelecionada(
    abasInscritos.map((a) => a.chave),
    "todas"
  );
  const participantesFiltrados = participantes.filter((p) => {
    if (categoriaInscritos === "todas") return true;
    if (categoriaInscritos === "sem") return !p.categoria;
    return p.categoria === categoriaInscritos;
  });
  const paginacaoInscritos = usePaginacao(participantesFiltrados, 25, categoriaInscritos);

  const adicionar = async () => {
    if (!marcados.length) return;
    const ok = await executar("adicionarParticipantes", {
      campeonatoId: campeonato.id,
      atletaIds: marcados,
      categoria: categoriaLote,
    });
    if (ok) {
      setMarcados([]);
      setCategoriaLote("");
    }
  };

  const criar = async () => {
    const ok = await executar("salvarAtleta", {
      atleta: novo,
      campeonatoId: campeonato.id,
    });
    if (ok) {
      setNovo(VAZIO);
      setCriando(false);
    }
  };

  const semCategoria = participantes.filter((p) => !p.categoria);

  return (
    <div className="space-y-4">
      {!bloqueado && (
        <Card>
          <Titulo
            dica="Selecione atletas já cadastrados na base ou cadastre um novo direto aqui."
            acao={
              <Botao
                variante={criando ? "secundario" : "verde"}
                pequeno
                onClick={() => setCriando((v) => !v)}
              >
                <UserPlus className="size-4" />
                {criando ? "Fechar cadastro" : "Cadastrar novo atleta"}
              </Botao>
            }
          >
            Adicionar participantes
          </Titulo>

          {criando && (
            <div className="surge mb-4 rounded-xl border border-marinho-200 bg-marinho-50/50 p-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Campo rotulo="Nome" className="lg:col-span-2">
                  <Entrada
                    value={novo.nome}
                    onChange={(e) => setNovo({ ...novo, nome: maiusculo(e.target.value) })}
                    placeholder="Nome completo"
                    className="uppercase"
                  />
                </Campo>
                <Campo rotulo="Apelido">
                  <Entrada
                    value={novo.apelido}
                    onChange={(e) =>
                      setNovo({ ...novo, apelido: maiusculo(e.target.value) })
                    }
                    placeholder="Como é conhecido"
                    className="uppercase"
                  />
                </Campo>
                <Campo rotulo="Cidade">
                  <Entrada
                    value={novo.cidade}
                    onChange={(e) => setNovo({ ...novo, cidade: e.target.value })}
                    placeholder="Cidade-UF"
                  />
                </Campo>
                <Campo rotulo="Nascimento" dica="Define a categoria na data do evento">
                  <Entrada
                    type="date"
                    value={novo.nascimento}
                    onChange={(e) => setNovo({ ...novo, nascimento: e.target.value })}
                  />
                </Campo>
                <Campo rotulo="Sexo">
                  <Selecao
                    value={novo.sexo}
                    onChange={(e) => setNovo({ ...novo, sexo: e.target.value })}
                  >
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                  </Selecao>
                </Campo>
                <Campo rotulo="Lado">
                  <Selecao
                    value={novo.lado}
                    onChange={(e) => setNovo({ ...novo, lado: e.target.value })}
                  >
                    <option value="D">Direito</option>
                    <option value="E">Esquerdo</option>
                    <option value="Ambos">Ambos</option>
                  </Selecao>
                </Campo>
                <Campo rotulo="Telefone">
                  <Entrada
                    value={novo.telefone}
                    onChange={(e) => setNovo({ ...novo, telefone: e.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                </Campo>
                <Campo rotulo="Uniforme">
                  <Entrada
                    value={novo.uniforme}
                    onChange={(e) => setNovo({ ...novo, uniforme: e.target.value })}
                    placeholder="Tamanho / cor"
                  />
                </Campo>
              </div>
              <div className="mt-3">
                <Botao onClick={criar} disabled={salvando} pequeno>
                  <UserPlus className="size-4" />
                  Cadastrar e inscrever
                </Botao>
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <Campo rotulo="Buscar na base de atletas">
              <span className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
                <Entrada
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Digite parte do nome"
                  className="pl-9"
                />
              </span>
            </Campo>
            <Campo
              rotulo="Categoria"
              dica={marcados.length ? `Aplica aos ${marcados.length} marcado(s)` : "Deixe em Automática pra calcular por sexo/idade"}
            >
              <Selecao
                value={categoriaLote}
                onChange={(e) => setCategoriaLote(e.target.value)}
                className="w-44"
              >
                <option value="">Automática</option>
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Selecao>
            </Campo>
            <Botao onClick={adicionar} disabled={salvando || !marcados.length}>
              <Users className="size-4" />
              Adicionar {marcados.length ? `(${marcados.length})` : ""}
            </Botao>
          </div>

          <div className="mt-3 rounded-lg border border-line">
            {disponiveis.length === 0 ? (
              <p className="px-3 py-4 text-[13px] text-ink-3">
                {estado.atletas.length === 0
                  ? "A base de atletas está vazia — cadastre o primeiro acima."
                  : "Todos os atletas encontrados já estão inscritos."}
              </p>
            ) : (
              <>
                <ul className="scroll-x max-h-56 divide-y divide-line overflow-y-auto">
                  {paginacaoDisponiveis.itensDaPagina.map((a) => {
                    const idade = idadeNaData(a.nascimento, campeonato.data);
                    return (
                      <li key={a.id}>
                        <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-marinho-50/50">
                          <input
                            type="checkbox"
                            className="size-4 accent-[var(--color-marinho-600)]"
                            checked={marcados.includes(a.id)}
                            onChange={(e) =>
                              setMarcados((atual) =>
                                e.target.checked
                                  ? [...atual, a.id]
                                  : atual.filter((x) => x !== a.id)
                              )
                            }
                          />
                          <span className="flex-1 text-[13px] font-medium text-ink">
                            {a.nome}
                          </span>
                          <span className="text-[12px] text-ink-3">
                            {idade} anos · {a.sexo === "F" ? "Fem" : "Masc"} ·{" "}
                            {ROTULO_LADO[a.lado]}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <Paginacao {...paginacaoDisponiveis} />
              </>
            )}
          </div>
        </Card>
      )}

      {semCategoria.length > 0 && (
        <Alerta tom="alerta">
          {semCategoria.length} participante(s) não se encaixam em nenhuma faixa ativa
          para a data do evento: {semCategoria.map((p) => p.nome).join(", ")}. Eles não
          entram no sorteio de grupos.
        </Alerta>
      )}

      <Card padding={false}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="text-[15px] font-bold tracking-tight text-marinho-800">
            Inscritos ({participantes.length})
          </h2>
          <Link
            href={`/financeiro/${campeonato.id}`}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-marinho-600 hover:underline"
            title="Inscrições e parcelas ficam no Financeiro"
          >
            <Wallet className="size-3.5" />
            Pagamentos no Financeiro
          </Link>
        </div>

        {abasInscritos.length > 0 && (
          <div className="border-b border-line px-4 pt-3">
            <Abas
              itens={abasInscritos}
              selecionada={categoriaInscritos}
              aoSelecionar={selecionarCategoriaInscritos}
            />
          </div>
        )}

        {participantes.length === 0 ? (
          <div className="p-4">
            <Vazio
              titulo="Nenhum participante inscrito"
              descricao="Adicione atletas para que o sistema calcule as categorias e possa sortear os grupos."
            />
          </div>
        ) : participantesFiltrados.length === 0 ? (
          <div className="p-4">
            <Vazio
              titulo="Ninguém nesta categoria"
              descricao="Escolha outra aba acima ou volte para “Todas”."
            />
          </div>
        ) : (
          <Tabela minimo={640} colunas={["Atleta", "Idade", "Categoria", "Lado", ""]}>
            {paginacaoInscritos.itensDaPagina.map((p) => (
              <tr key={p.id} className="hover:bg-marinho-50/40">
                <td className="px-3 py-2">
                  <span className="font-medium text-ink">{p.nome}</span>
                  {p.telefone && (
                    <span className="block text-[11px] text-ink-3">{p.telefone}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-ink-2">{p.idadeNoEvento}</td>
                <td className="px-3 py-2">
                  {p.categoria ? (
                    <Selo tom="info">{p.categoria}</Selo>
                  ) : (
                    <Selo tom="alerta">sem faixa</Selo>
                  )}
                </td>
                <td className="px-3 py-2 text-ink-2">{ROTULO_LADO[p.lado]}</td>
                <td className="px-3 py-2 text-right">
                  {!bloqueado && (
                    <button
                      onClick={() =>
                        executar("removerParticipante", {
                          campeonatoId: campeonato.id,
                          atletaId: p.id,
                        })
                      }
                      disabled={salvando}
                      className="text-[var(--color-erro)] hover:opacity-70 disabled:opacity-40"
                      aria-label={`Remover ${p.nome}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </Tabela>
        )}
        <Paginacao {...paginacaoInscritos} />
      </Card>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Crown, Pencil, Search, Trash2, UserPlus, Users2, Wallet, X,
} from "lucide-react";
import { ROTULO_LADO, useDados } from "@/lib/cliente";
import { categoriaDaDupla, idadeNaData } from "@/lib/regras";
import { maiusculo } from "@/lib/texto";
import type { Campeonato, Dupla } from "@/lib/tipos";
import {
  Abas, Alerta, Botao, Campo, Card, Entrada, Selecao, Selo, Titulo,
  useAbaSelecionada, Vazio,
} from "@/components/ui";

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

const DUPLA_VAZIA = {
  duplaId: "",
  atleta1: "",
  atleta2: "",
  categoria: "",
  cabecaDeChave: false,
};

export function EtapaInscricaoDuplas({
  campeonato,
  bloqueado,
}: {
  campeonato: Campeonato;
  bloqueado: boolean;
}) {
  const { estado, executar, salvando, nomeDe, categorias } = useDados();
  const [form, setForm] = useState(DUPLA_VAZIA);
  const [busca, setBusca] = useState("");
  const [criandoAtleta, setCriandoAtleta] = useState(false);
  const [novoAtleta, setNovoAtleta] = useState(ATLETA_VAZIO);
  const [excluindo, setExcluindo] = useState<Dupla | null>(null);

  const duplas = useMemo(
    () =>
      estado.duplas
        .filter((d) => d.campeonatoId === campeonato.id && d.origem === "inscricao")
        .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.numero - b.numero),
    [estado.duplas, campeonato.id]
  );

  /** Atleta já comprometido com outra dupla não pode aparecer no seletor. */
  const comprometidos = useMemo(() => {
    const mapa = new Map<string, Dupla>();
    for (const d of duplas) {
      if (d.id === form.duplaId) continue;
      mapa.set(d.atletaD, d);
      mapa.set(d.atletaE, d);
    }
    return mapa;
  }, [duplas, form.duplaId]);

  const disponiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return estado.atletas
      .filter((a) => a.ativo && !comprometidos.has(a.id))
      .filter((a) => !termo || a.nome.toLowerCase().includes(termo))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [estado.atletas, comprometidos, busca]);

  const atleta1 = estado.atletas.find((a) => a.id === form.atleta1);
  const atleta2 = estado.atletas.find((a) => a.id === form.atleta2);

  // prévia da categoria automática: a do atleta mais novo na data do evento
  const categoriaAutomatica =
    atleta1 && atleta2
      ? categoriaDaDupla(atleta1, atleta2, estado.config, campeonato.data)
      : null;

  const editando = Boolean(form.duplaId);
  const completo = Boolean(form.atleta1 && form.atleta2 && form.atleta1 !== form.atleta2);

  const limpar = () => {
    setForm(DUPLA_VAZIA);
    setBusca("");
  };

  const salvar = async () => {
    const ok = await executar("salvarDuplaInscrita", {
      campeonatoId: campeonato.id,
      duplaId: form.duplaId,
      atleta1: form.atleta1,
      atleta2: form.atleta2,
      categoria: form.categoria,
      cabecaDeChave: form.cabecaDeChave,
    });
    if (ok) limpar();
  };

  const editar = (d: Dupla) => {
    setForm({
      duplaId: d.id,
      atleta1: d.atletaD,
      atleta2: d.atletaE,
      categoria: d.categoria,
      cabecaDeChave: d.cabecaDeChave,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cadastrarAtleta = async () => {
    const ok = await executar("salvarAtleta", { atleta: novoAtleta });
    if (ok) {
      setNovoAtleta(ATLETA_VAZIO);
      setCriandoAtleta(false);
    }
  };

  const categoriasComDupla = [...new Set(duplas.map((d) => d.categoria))].sort();
  const [categoriaAba, selecionarCategoriaAba] = useAbaSelecionada(categoriasComDupla);

  const opcoes = (excluir: string) =>
    disponiveis
      .filter((a) => a.id !== excluir)
      .map((a) => (
        <option key={a.id} value={a.id}>
          {a.nome} · {idadeNaData(a.nascimento, campeonato.data)} anos ·{" "}
          {ROTULO_LADO[a.lado]}
        </option>
      ));

  return (
    <div className="space-y-4">
      <Alerta tom="info">
        Neste formato a dupla entra fechada: os dois atletas jogam juntos da fase de
        grupos até a final. A <strong>cobrança continua por atleta</strong> — os dois
        entram no Financeiro com o valor e as parcelas do torneio.
      </Alerta>

      {!bloqueado && (
        <Card>
          <Titulo
            dica="A categoria sai da idade do atleta mais novo na data da competição, e pode ser trocada à mão."
            acao={
              <div className="flex flex-wrap gap-2">
                {editando && (
                  <Botao variante="fantasma" pequeno onClick={limpar}>
                    <X className="size-4" />
                    Cancelar edição
                  </Botao>
                )}
                <Botao
                  variante={criandoAtleta ? "secundario" : "verde"}
                  pequeno
                  onClick={() => setCriandoAtleta((v) => !v)}
                >
                  <UserPlus className="size-4" />
                  {criandoAtleta ? "Fechar cadastro" : "Cadastrar novo atleta"}
                </Botao>
              </div>
            }
          >
            {editando ? `Editar dupla ${form.categoria}` : "Nova dupla"}
          </Titulo>

          {criandoAtleta && (
            <div className="surge mb-4 rounded-xl border border-marinho-200 bg-marinho-50/50 p-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Campo rotulo="Nome" className="lg:col-span-2">
                  <Entrada
                    value={novoAtleta.nome}
                    onChange={(e) =>
                      setNovoAtleta({ ...novoAtleta, nome: maiusculo(e.target.value) })
                    }
                    placeholder="Nome completo"
                    className="uppercase"
                  />
                </Campo>
                <Campo rotulo="Nascimento" dica="Define a categoria na data do evento">
                  <Entrada
                    type="date"
                    value={novoAtleta.nascimento}
                    onChange={(e) =>
                      setNovoAtleta({ ...novoAtleta, nascimento: e.target.value })
                    }
                  />
                </Campo>
                <Campo rotulo="Sexo">
                  <Selecao
                    value={novoAtleta.sexo}
                    onChange={(e) => setNovoAtleta({ ...novoAtleta, sexo: e.target.value })}
                  >
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                  </Selecao>
                </Campo>
                <Campo rotulo="Lado" dica="Informativo: aqui o sistema não sorteia">
                  <Selecao
                    value={novoAtleta.lado}
                    onChange={(e) => setNovoAtleta({ ...novoAtleta, lado: e.target.value })}
                  >
                    <option value="D">Direito</option>
                    <option value="E">Esquerdo</option>
                    <option value="Ambos">Ambos</option>
                  </Selecao>
                </Campo>
                <Campo rotulo="Telefone">
                  <Entrada
                    value={novoAtleta.telefone}
                    onChange={(e) =>
                      setNovoAtleta({ ...novoAtleta, telefone: e.target.value })
                    }
                    placeholder="(00) 00000-0000"
                  />
                </Campo>
              </div>
              <div className="mt-3">
                <Botao onClick={cadastrarAtleta} disabled={salvando} pequeno>
                  <UserPlus className="size-4" />
                  Cadastrar na base
                </Botao>
              </div>
            </div>
          )}

          <Campo rotulo="Filtrar a base" className="mb-3">
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

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Campo rotulo="Atleta 1">
              <Selecao
                value={form.atleta1}
                onChange={(e) => setForm({ ...form, atleta1: e.target.value })}
              >
                <option value="">Selecione…</option>
                {opcoes(form.atleta2)}
              </Selecao>
            </Campo>
            <Campo rotulo="Atleta 2">
              <Selecao
                value={form.atleta2}
                onChange={(e) => setForm({ ...form, atleta2: e.target.value })}
              >
                <option value="">Selecione…</option>
                {opcoes(form.atleta1)}
              </Selecao>
            </Campo>
            <Campo
              rotulo="Categoria"
              dica={
                categoriaAutomatica
                  ? `Automática: ${categoriaAutomatica}`
                  : "Escolha os dois atletas para calcular"
              }
            >
              <Selecao
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              >
                <option value="">
                  {categoriaAutomatica
                    ? `Automática (${categoriaAutomatica})`
                    : "Automática"}
                </option>
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Selecao>
            </Campo>
            <Campo rotulo="Cabeça de chave" dica="Espalha as marcadas, uma por grupo">
              <Selecao
                value={form.cabecaDeChave ? "1" : "0"}
                onChange={(e) =>
                  setForm({ ...form, cabecaDeChave: e.target.value === "1" })
                }
              >
                <option value="0">Não</option>
                <option value="1">Sim</option>
              </Selecao>
            </Campo>
          </div>

          {form.atleta1 && form.atleta1 === form.atleta2 && (
            <p className="mt-2 text-[12px] text-[var(--color-erro)]">
              A dupla precisa de dois atletas diferentes.
            </p>
          )}
          {completo && !categoriaAutomatica && !form.categoria && (
            <p className="mt-2 text-[12px] text-[var(--color-alerta)]">
              Nenhuma faixa ativa serve para esta dupla na data do torneio — escolha a
              categoria à mão.
            </p>
          )}

          <div className="mt-4">
            <Botao onClick={salvar} disabled={salvando || !completo}>
              <Users2 className="size-4" />
              {editando ? "Salvar dupla" : "Inscrever dupla"}
            </Botao>
          </div>
        </Card>
      )}

      <Card padding={false}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="text-[15px] font-bold tracking-tight text-marinho-800">
            Duplas inscritas ({duplas.length})
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

        {duplas.length === 0 ? (
          <div className="p-4">
            <Vazio
              titulo="Nenhuma dupla inscrita"
              descricao="Monte a primeira dupla acima. São necessárias ao menos 3 duplas numa categoria para formar um grupo."
            />
          </div>
        ) : (
          <>
            {categoriasComDupla.length > 1 && (
              <div className="border-b border-line px-4 pt-3">
                <Abas
                  itens={categoriasComDupla.map((c) => ({
                    chave: c,
                    rotulo: c,
                    contagem: duplas.filter((d) => d.categoria === c).length,
                  }))}
                  selecionada={categoriaAba}
                  aoSelecionar={selecionarCategoriaAba}
                />
              </div>
            )}

            {categoriasComDupla
              .filter((c) => categoriasComDupla.length === 1 || c === categoriaAba)
              .map((categoria) => {
                const daCategoria = duplas.filter((d) => d.categoria === categoria);
                return (
                  <div key={categoria} className="border-b border-line last:border-b-0">
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-plane px-4 py-1.5">
                      <p className="text-[12px] font-bold uppercase tracking-wide text-marinho-600">
                        {categoria} · {daCategoria.length} dupla(s)
                      </p>
                      {daCategoria.length < 3 && (
                        <Selo tom="alerta">mínimo de 3 para formar grupo</Selo>
                      )}
                    </div>
                    <ul className="divide-y divide-line">
                      {daCategoria.map((d) => (
                        <li
                          key={d.id}
                          className="flex flex-wrap items-center gap-3 px-4 py-2"
                        >
                          <Selo tom="info">Dupla {d.numero}</Selo>
                          <span className="min-w-0 flex-1 text-[13px] text-ink">
                            <strong className="font-semibold">{nomeDe(d.atletaD)}</strong>
                            <span className="mx-1.5 text-ink-3">+</span>
                            <strong className="font-semibold">{nomeDe(d.atletaE)}</strong>
                          </span>
                          {!bloqueado ? (
                            <button
                              type="button"
                              onClick={() =>
                                executar("definirCabecaDeChave", {
                                  campeonatoId: campeonato.id,
                                  duplaId: d.id,
                                  cabecaDeChave: !d.cabecaDeChave,
                                })
                              }
                              disabled={salvando}
                              title={
                                d.cabecaDeChave
                                  ? "Tirar de cabeça de chave"
                                  : "Marcar como cabeça de chave"
                              }
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors disabled:opacity-40 ${
                                d.cabecaDeChave
                                  ? "border-ouro-500 bg-ouro-100 text-ouro-700"
                                  : "border-line bg-surface text-ink-3 hover:border-ouro-300"
                              }`}
                            >
                              <Crown className="size-3" />
                              cabeça
                            </button>
                          ) : (
                            d.cabecaDeChave && (
                              <Selo tom="ouro">
                                <Crown className="size-3" />
                                cabeça
                              </Selo>
                            )
                          )}
                          {!bloqueado && (
                            <div className="flex gap-1.5">
                              <Botao
                                variante="secundario"
                                pequeno
                                onClick={() => editar(d)}
                                aria-label={`Editar dupla ${d.numero}`}
                              >
                                <Pencil className="size-3.5" />
                              </Botao>
                              <Botao
                                variante="perigo"
                                pequeno
                                onClick={() => setExcluindo(d)}
                                aria-label={`Excluir dupla ${d.numero}`}
                              >
                                <Trash2 className="size-3.5" />
                              </Botao>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
          </>
        )}
      </Card>

      {excluindo && (
        <Card className="surge border-[color-mix(in_oklab,var(--color-erro)_30%,white)]">
          <Alerta tom="erro">
            Excluir a dupla{" "}
            <strong>
              {nomeDe(excluindo.atletaD)} + {nomeDe(excluindo.atletaE)}
            </strong>
            ? Se os grupos de {excluindo.categoria} já estiverem sorteados, eles são
            desfeitos e você precisa sortear de novo. Quem já pagou alguma parcela
            continua no Financeiro.
          </Alerta>
          <div className="mt-3 flex gap-2">
            <Botao
              variante="perigo"
              disabled={salvando}
              onClick={async () => {
                await executar("excluirDuplaInscrita", {
                  campeonatoId: campeonato.id,
                  duplaId: excluindo.id,
                });
                setExcluindo(null);
              }}
            >
              Excluir dupla
            </Botao>
            <Botao variante="secundario" onClick={() => setExcluindo(null)}>
              Cancelar
            </Botao>
          </div>
        </Card>
      )}
    </div>
  );
}

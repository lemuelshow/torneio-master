"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight, CalendarDays, MapPin, Plus, Trash2, Trophy, Users, X,
} from "lucide-react";
import { useDados, dataBr, dinheiro } from "@/lib/cliente";
import { etapasDoFormato, type Etapa, type Formato } from "@/lib/tipos";
import { formatoDo } from "@/lib/regras";
import { Escudo, FaixaBandeira } from "@/components/Marca";
import {
  Alerta, Botao, Campo, Card, Entrada, Paginacao, Selo, Titulo, usePaginacao, Vazio,
} from "@/components/ui";

const TOM_ETAPA: Record<Etapa, "neutro" | "info" | "ouro" | "ok"> = {
  participantes: "neutro",
  grupos: "info",
  classificacao: "info",
  duplas: "info",
  final: "ouro",
  encerrado: "ok",
};

const rotuloEtapa = (etapa: Etapa, formato: Formato) =>
  etapasDoFormato(formato).find((e) => e.chave === etapa)?.titulo ?? etapa;

const FORMATOS: { valor: Formato; titulo: string; descricao: string }[] = [
  {
    valor: "sorteio",
    titulo: "Sorteio",
    descricao:
      "Inscrição individual. Nos grupos o atleta troca de parceiro a cada rodada e, depois da classificação, um 2º sorteio forma as duplas do Ouro e da Prata.",
  },
  {
    valor: "duplas_fechadas",
    titulo: "Duplas fechadas",
    descricao:
      "A dupla se inscreve junta e continua a mesma até a final. Os grupos são de duplas, todos contra todos, e a chave sai por cruzamento olímpico.",
  },
];

export default function Campeonatos() {
  const { estado, executar, salvando, participantesDe } = useDados();
  const [criando, setCriando] = useState(false);
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome: "",
    data: "",
    local: "",
    valorInscricao: estado.config.valorInscricao,
    atletasPorGrupo: estado.config.atletasPorGrupo,
    duplasPorGrupo: 3,
    formato: "sorteio" as Formato,
  });
  const duplasFechadas = form.formato === "duplas_fechadas";

  const lista = useMemo(
    () =>
      [...estado.campeonatos]
        .sort((a, b) => b.data.localeCompare(a.data))
        .map((c) => {
          const participantes = participantesDe(c.id);
          return {
            ...c,
            participantes: participantes.length,
            quitados: participantes.filter((p) => p.parcelasPagas === 4).length,
            arrecadado: participantes.reduce((s, p) => s + p.totalPago, 0),
          };
        }),
    [estado.campeonatos, participantesDe]
  );

  const paginacao = usePaginacao(lista, 12);

  const criar = async () => {
    const ok = await executar("criarCampeonato", { campeonato: form });
    if (ok) {
      setCriando(false);
      setForm({
        nome: "",
        data: "",
        local: "",
        valorInscricao: estado.config.valorInscricao,
        atletasPorGrupo: estado.config.atletasPorGrupo,
        duplasPorGrupo: 3,
        formato: "sorteio",
      });
    }
  };

  return (
    <div className="space-y-5">
      <section className="painel-marinho overflow-hidden rounded-2xl text-white shadow-lg">
        <div className="flex flex-wrap items-center gap-5 px-5 py-5 sm:px-7">
          <Escudo tamanho={84} prioridade className="drop-shadow-lg" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ouro-500">
              {estado.config.organizacao}
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
              Torneios
            </h1>
            <p className="mt-1 text-[13px] text-marinho-100">
              {lista.length === 0
                ? "Crie o primeiro torneio para começar."
                : `${lista.length} torneio(s) · ${estado.atletas.length} atletas na base`}
            </p>
          </div>
          <Botao variante="ouro" onClick={() => setCriando((v) => !v)}>
            {criando ? <X className="size-4" /> : <Plus className="size-4" />}
            {criando ? "Cancelar" : "Novo torneio"}
          </Botao>
        </div>
        <FaixaBandeira />
      </section>

      {criando && (
        <Card className="surge">
          <Titulo dica="A data da competição é a base do cálculo de idade dos atletas.">
            Novo torneio
          </Titulo>
          <fieldset className="mb-4">
            <legend className="mb-2 text-[12px] font-bold uppercase tracking-wide text-marinho-600">
              Formato
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {FORMATOS.map((f) => (
                <label
                  key={f.valor}
                  className={`cursor-pointer rounded-xl border p-3 transition-colors ${
                    form.formato === f.valor
                      ? "border-marinho-600 bg-marinho-50"
                      : "border-line bg-surface hover:border-marinho-300"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="formato"
                      className="size-4 accent-[var(--color-marinho-600)]"
                      checked={form.formato === f.valor}
                      onChange={() => setForm({ ...form, formato: f.valor })}
                    />
                    <span className="text-[13px] font-bold text-marinho-800">
                      {f.titulo}
                    </span>
                  </span>
                  <span className="mt-1 block text-[12px] leading-snug text-ink-2">
                    {f.descricao}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Campo rotulo="Nome" className="lg:col-span-2">
              <Entrada
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex.: 3ª Etapa Master 2026"
              />
            </Campo>
            <Campo rotulo="Data da competição">
              <Entrada
                type="date"
                value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })}
              />
            </Campo>
            <Campo rotulo="Local">
              <Entrada
                value={form.local}
                onChange={(e) => setForm({ ...form, local: e.target.value })}
                placeholder="Arena, cidade"
              />
            </Campo>
            <Campo rotulo="Valor da inscrição (R$)" dica="Dividido em 4 parcelas">
              <Entrada
                type="number"
                min={0}
                step="10"
                value={form.valorInscricao}
                onChange={(e) =>
                  setForm({ ...form, valorInscricao: Number(e.target.value) })
                }
              />
            </Campo>
            {duplasFechadas ? (
              <Campo
                rotulo="Duplas por grupo"
                dica="Grupo nunca fica com menos de 3: o resto engorda os últimos"
              >
                <Entrada
                  type="number"
                  min={3}
                  max={8}
                  value={form.duplasPorGrupo}
                  onChange={(e) =>
                    setForm({ ...form, duplasPorGrupo: Number(e.target.value) })
                  }
                />
              </Campo>
            ) : (
              <Campo rotulo="Atletas por grupo">
                <Entrada
                  type="number"
                  min={2}
                  max={8}
                  value={form.atletasPorGrupo}
                  onChange={(e) =>
                    setForm({ ...form, atletasPorGrupo: Number(e.target.value) })
                  }
                />
              </Campo>
            )}
          </div>
          <div className="mt-4">
            <Botao onClick={criar} disabled={salvando}>
              <Trophy className="size-4" />
              Criar torneio
            </Botao>
          </div>
        </Card>
      )}

      {lista.length === 0 && !criando ? (
        <Vazio
          titulo="Nenhum torneio ainda"
          descricao="Cada torneio tem seus próprios participantes, grupos, classificação e chave final. A base de atletas é compartilhada entre todos."
          acao={
            <Botao onClick={() => setCriando(true)}>
              <Plus className="size-4" />
              Criar o primeiro
            </Botao>
          }
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {paginacao.itensDaPagina.map((c) => {
            const formato = formatoDo(c);
            const etapas = etapasDoFormato(formato);
            const passo = etapas.findIndex((e) => e.chave === c.etapa);
            return (
              <Card key={c.id} padding={false} className="overflow-hidden">
                <Link href={`/campeonatos/${c.id}`} className="block p-4 hover:bg-marinho-50/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-[15px] font-bold text-marinho-800">
                        {c.nome}
                      </h2>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-2">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="size-3.5 text-marinho-400" />
                          {dataBr(c.data)}
                        </span>
                        {c.local && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="size-3.5 text-marinho-400" />
                            {c.local}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-3.5 text-marinho-400" />
                          {c.participantes} participante(s)
                        </span>
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Selo tom={TOM_ETAPA[c.etapa]}>{rotuloEtapa(c.etapa, formato)}</Selo>
                      <Selo tom={formato === "duplas_fechadas" ? "info" : "neutro"}>
                        {formato === "duplas_fechadas" ? "Duplas fechadas" : "Sorteio"}
                      </Selo>
                    </div>
                  </div>

                  {/* trilha das etapas */}
                  <div className="mt-3 flex items-center gap-1">
                    {etapas.slice(0, etapas.length - 1).map((e, i) => (
                      <span
                        key={e.chave}
                        title={e.titulo}
                        className={`h-1.5 flex-1 rounded-full ${
                          i < passo
                            ? "bg-verde-500"
                            : i === passo
                              ? "bg-ouro-500"
                              : "bg-line"
                        }`}
                      />
                    ))}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 text-[12px]">
                    <span className="text-ink-2">
                      {c.quitados}/{c.participantes} inscrições quitadas ·{" "}
                      {dinheiro(c.arrecadado)}
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-marinho-600">
                      abrir <ArrowRight className="size-3" />
                    </span>
                  </div>
                </Link>

                <div className="flex justify-end border-t border-line px-3 py-2">
                  <Botao
                    variante="perigo"
                    pequeno
                    onClick={() => setExcluindo(c.id)}
                    aria-label={`Excluir ${c.nome}`}
                  >
                    <Trash2 className="size-3.5" />
                    Excluir
                  </Botao>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {lista.length > 0 && (
        <Card padding={false}>
          <Paginacao {...paginacao} />
        </Card>
      )}

      {excluindo && (
        <Card className="surge border-[color-mix(in_oklab,var(--color-erro)_30%,white)]">
          <Alerta tom="erro">
            Excluir{" "}
            <strong>{estado.campeonatos.find((c) => c.id === excluindo)?.nome}</strong>?
            Some tudo dele: participantes, grupos, jogos, duplas e chave. Os atletas
            continuam na base.
          </Alerta>
          <div className="mt-3 flex gap-2">
            <Botao
              variante="perigo"
              disabled={salvando}
              onClick={async () => {
                await executar("excluirCampeonato", { id: excluindo });
                setExcluindo(null);
              }}
            >
              Excluir torneio
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

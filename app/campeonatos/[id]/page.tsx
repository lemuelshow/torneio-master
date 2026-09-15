"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft, ArrowRight, CalendarDays, ChevronLeft, Flag, MapPin, Pencil, Save,
} from "lucide-react";
import { useDados, dataBr } from "@/lib/cliente";
import { indiceEtapa, podeAvancar } from "@/lib/regras";
import { ETAPAS, type Etapa } from "@/lib/tipos";
import { Escudo, FaixaBandeira } from "@/components/Marca";
import { Alerta, Botao, Campo, Card, Entrada, Selo, Titulo, Vazio } from "@/components/ui";
import { EtapaParticipantes } from "@/components/etapas/Participantes";
import { EtapaGrupos } from "@/components/etapas/Grupos";
import { EtapaClassificacao } from "@/components/etapas/Classificacao";
import { EtapaDuplas } from "@/components/etapas/Duplas";
import { EtapaFinal } from "@/components/etapas/Final";

const ACAO: Record<Etapa, string> = {
  participantes: "Próxima etapa · sortear a fase de grupos",
  grupos: "Processar e gerar Classificação",
  classificacao: "Ir para a segunda etapa (sorteio de duplas)",
  duplas: "Gerar a chave final",
  final: "Encerrar torneio",
  encerrado: "Torneio encerrado",
};

const PASSOS = ETAPAS.filter((e) => e.chave !== "encerrado");

export default function PaginaCampeonato() {
  const parametros = useParams<{ id: string }>();
  const id = String(parametros?.id ?? "");
  const { estado, executar, salvando } = useDados();

  const campeonato = estado.campeonatos.find((c) => c.id === id);

  const etapaAtual: Etapa = campeonato?.etapa ?? "participantes";
  const [visao, setVisao] = useState<{ ancora: Etapa; escolhida: Etapa }>(() => ({
    ancora: etapaAtual,
    escolhida: etapaAtual === "encerrado" ? "final" : etapaAtual,
  }));
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState(() => ({
    nome: campeonato?.nome ?? "",
    data: campeonato?.data ?? "",
    local: campeonato?.local ?? "",
  }));

  // o campeonato avançou de etapa: a visão acompanha
  if (visao.ancora !== etapaAtual)
    setVisao({
      ancora: etapaAtual,
      escolhida: etapaAtual === "encerrado" ? "final" : etapaAtual,
    });

  if (!campeonato)
    return (
      <Vazio
        titulo="Torneio não encontrado"
        descricao="Ele pode ter sido excluído da planilha."
        acao={
          <Link href="/">
            <Botao variante="secundario">
              <ChevronLeft className="size-4" />
              Voltar para a lista
            </Botao>
          </Link>
        }
      />
    );

  const encerrado = campeonato.etapa === "encerrado";
  const posicaoAtual = indiceEtapa(campeonato.etapa);
  const permitido = podeAvancar(estado, campeonato);
  const escolhida = visao.escolhida;

  const avancar = () => executar("avancarEtapa", { campeonatoId: campeonato.id });
  const voltar = () => executar("voltarEtapa", { campeonatoId: campeonato.id });

  const salvarDados = async () => {
    const ok = await executar("salvarCampeonato", {
      campeonato: { id: campeonato.id, ...form },
    });
    if (ok) setEditando(false);
  };

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------------- cabeçalho */}
      <section className="painel-marinho overflow-hidden rounded-2xl text-white shadow-lg">
        <div className="flex flex-wrap items-center gap-4 px-5 py-4 sm:px-6">
          <Escudo tamanho={64} prioridade className="drop-shadow-lg" />
          <div className="min-w-0 flex-1">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-marinho-200 hover:text-white"
            >
              <ChevronLeft className="size-3" />
              Torneios
            </Link>
            <h1 className="mt-0.5 truncate text-xl font-bold tracking-tight sm:text-2xl">
              {campeonato.nome}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-marinho-100">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5 text-ouro-500" />
                {dataBr(campeonato.data)}
              </span>
              {campeonato.local && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5 text-ouro-500" />
                  {campeonato.local}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Flag className="size-3.5 text-ouro-500" />
                {ETAPAS.find((e) => e.chave === campeonato.etapa)?.titulo}
              </span>
            </p>
          </div>
          {!encerrado && (
            <Botao
              variante="secundario"
              pequeno
              onClick={() => {
                setForm({
                  nome: campeonato.nome,
                  data: campeonato.data,
                  local: campeonato.local,
                });
                setEditando((v) => !v);
              }}
            >
              <Pencil className="size-3.5" />
              {editando ? "Fechar" : "Editar"}
            </Botao>
          )}
        </div>
        <FaixaBandeira />
      </section>

      {editando && (
        <Card className="surge">
          <Titulo dica="Mudar a data recalcula a idade — e a categoria — de todos os participantes.">
            Dados do torneio
          </Titulo>
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo rotulo="Nome">
              <Entrada
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
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
              />
            </Campo>
          </div>
          <div className="mt-3">
            <Botao onClick={salvarDados} disabled={salvando}>
              <Save className="size-4" />
              Salvar
            </Botao>
          </div>
        </Card>
      )}

      {/* ----------------------------------------------------------- passos */}
      <nav className="scroll-x overflow-x-auto">
        <ol className="flex min-w-max items-stretch gap-2">
          {PASSOS.map((passo, i) => {
            const alcancado = i <= posicaoAtual;
            const ativo = passo.chave === escolhida;
            const concluido = i < posicaoAtual;
            return (
              <li key={passo.chave} className="flex-1">
                <button
                  disabled={!alcancado}
                  onClick={() =>
                    setVisao((v) => ({ ...v, escolhida: passo.chave }))
                  }
                  className={`h-full w-56 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    ativo
                      ? "border-marinho-600 bg-marinho-600 text-white shadow-sm"
                      : alcancado
                        ? "border-line bg-surface text-ink hover:border-marinho-300"
                        : "cursor-not-allowed border-dashed border-line bg-plane text-ink-3"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                        ativo
                          ? "bg-ouro-500 text-marinho-900"
                          : concluido
                            ? "bg-verde-500 text-white"
                            : "bg-plane text-ink-3"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="truncate text-[13px] font-bold">{passo.titulo}</span>
                  </span>
                  <span
                    className={`mt-1 block truncate text-[11px] ${
                      ativo ? "text-marinho-100" : "text-ink-3"
                    }`}
                  >
                    {passo.descricao}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {encerrado && (
        <Alerta tom="info">
          Torneio <strong>encerrado</strong>. Os dados ficam disponíveis para consulta
          e continuam na planilha. Use “Voltar etapa” se precisar reabrir a chave final.
        </Alerta>
      )}

      {/* ---------------------------------------------------------- painel */}
      <div>
        {escolhida === "participantes" && (
          <EtapaParticipantes campeonato={campeonato} bloqueado={encerrado} />
        )}
        {escolhida === "grupos" && (
          <EtapaGrupos campeonato={campeonato} bloqueado={encerrado} />
        )}
        {escolhida === "classificacao" && <EtapaClassificacao campeonato={campeonato} />}
        {escolhida === "duplas" && (
          <EtapaDuplas campeonato={campeonato} bloqueado={encerrado} />
        )}
        {escolhida === "final" && (
          <EtapaFinal campeonato={campeonato} bloqueado={encerrado} />
        )}
      </div>

      {/* ------------------------------------------------------- navegação */}
      <Card className="sticky bottom-3 nao-imprime">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] font-bold uppercase tracking-wide text-marinho-600">
              Etapa atual
            </p>
            <p className="flex items-center gap-2 text-[14px] font-bold text-marinho-800">
              {ETAPAS.find((e) => e.chave === campeonato.etapa)?.titulo}
              {escolhida !== campeonato.etapa && (
                <Selo tom="neutro">visualizando “{ETAPAS.find((e) => e.chave === escolhida)?.titulo}”</Selo>
              )}
            </p>
            {!permitido.ok && !encerrado && (
              <p className="mt-0.5 text-[12px] text-[var(--color-alerta)]">
                {permitido.motivo}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {posicaoAtual > 0 && (
              <Botao variante="secundario" onClick={voltar} disabled={salvando}>
                <ArrowLeft className="size-4" />
                Voltar etapa
              </Botao>
            )}
            <Botao
              variante={campeonato.etapa === "final" ? "verde" : "primario"}
              onClick={avancar}
              disabled={salvando || encerrado || !permitido.ok}
            >
              {ACAO[campeonato.etapa]}
              <ArrowRight className="size-4" />
            </Botao>
          </div>
        </div>
      </Card>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { ROTULO_LADO, dataBr, useDados } from "@/lib/cliente";
import type { Atleta, Lado, Sexo } from "@/lib/tipos";
import {
  Alerta, Botao, Cabecalho, Campo, Card, Entrada, Paginacao, Selecao, Selo, Tabela, Titulo,
  usePaginacao, Vazio,
} from "@/components/ui";

const VAZIO = {
  id: "",
  nome: "",
  apelido: "",
  cidade: "",
  nascimento: "",
  sexo: "M" as Sexo,
  lado: "Ambos" as Lado,
  uniforme: "",
  telefone: "",
  observacoes: "",
  ativo: true,
};

export default function AtletasPage() {
  const { estado, executar, salvando } = useDados();
  const [form, setForm] = useState<typeof VAZIO>(VAZIO);
  const [editando, setEditando] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroSexo, setFiltroSexo] = useState("");
  const [filtroLado, setFiltroLado] = useState("");
  const [excluindo, setExcluindo] = useState<string | null>(null);

  const set = <K extends keyof typeof VAZIO>(k: K, v: (typeof VAZIO)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const inscricoes = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const p of estado.participantes)
      mapa.set(p.atletaId, (mapa.get(p.atletaId) ?? 0) + 1);
    return mapa;
  }, [estado.participantes]);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return estado.atletas
      .filter((a) => {
        if (filtroSexo && a.sexo !== filtroSexo) return false;
        if (filtroLado && a.lado !== filtroLado) return false;
        if (
          termo &&
          !a.nome.toLowerCase().includes(termo) &&
          !a.apelido.toLowerCase().includes(termo)
        )
          return false;
        return true;
      })
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [estado.atletas, busca, filtroSexo, filtroLado]);

  const paginacao = usePaginacao(lista, 25, `${busca}|${filtroSexo}|${filtroLado}`);

  const salvar = async () => {
    const ok = await executar("salvarAtleta", { atleta: form });
    if (ok) {
      setForm(VAZIO);
      setEditando(false);
    }
  };

  const editar = (a: Atleta) => {
    setForm({
      id: a.id,
      nome: a.nome,
      apelido: a.apelido,
      cidade: a.cidade,
      nascimento: a.nascimento,
      sexo: a.sexo,
      lado: a.lado,
      uniforme: a.uniforme,
      telefone: a.telefone,
      observacoes: a.observacoes,
      ativo: a.ativo,
    });
    setEditando(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-5">
      <Cabecalho
        titulo="Base de atletas"
        descricao="Cadastro único, reaproveitado por todos os campeonatos. A idade e a categoria são calculadas na data de cada competição."
      />

      <Card>
        <Titulo
          dica={
            editando
              ? "Alterando um atleta já cadastrado."
              : "O lado de jogo alimenta os dois sorteios; a data de nascimento define a categoria em cada evento."
          }
          acao={
            editando ? (
              <Botao
                variante="fantasma"
                pequeno
                onClick={() => {
                  setForm(VAZIO);
                  setEditando(false);
                }}
              >
                <X className="size-4" />
                Cancelar edição
              </Botao>
            ) : undefined
          }
        >
          {editando ? "Editar atleta" : "Novo atleta"}
        </Titulo>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Campo rotulo="Nome" className="lg:col-span-2">
            <Entrada
              value={form.nome}
              onChange={(e) => set("nome", e.target.value)}
              placeholder="Nome completo"
            />
          </Campo>
          <Campo rotulo="Apelido">
            <Entrada
              value={form.apelido}
              onChange={(e) => set("apelido", e.target.value)}
              placeholder="Como é conhecido"
            />
          </Campo>
          <Campo rotulo="Cidade">
            <Entrada
              value={form.cidade}
              onChange={(e) => set("cidade", e.target.value)}
              placeholder="Cidade-UF"
            />
          </Campo>
          <Campo rotulo="Data de nascimento">
            <Entrada
              type="date"
              value={form.nascimento}
              onChange={(e) => set("nascimento", e.target.value)}
            />
          </Campo>
          <Campo rotulo="Sexo">
            <Selecao value={form.sexo} onChange={(e) => set("sexo", e.target.value as Sexo)}>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
            </Selecao>
          </Campo>
          <Campo rotulo="Lado de jogo" dica="D, E ou Ambos (curinga no sorteio)">
            <Selecao value={form.lado} onChange={(e) => set("lado", e.target.value as Lado)}>
              <option value="D">Direito (D)</option>
              <option value="E">Esquerdo (E)</option>
              <option value="Ambos">Ambos</option>
            </Selecao>
          </Campo>
          <Campo rotulo="Telefone">
            <Entrada
              value={form.telefone}
              onChange={(e) => set("telefone", e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </Campo>
          <Campo rotulo="Uniforme">
            <Entrada
              value={form.uniforme}
              onChange={(e) => set("uniforme", e.target.value)}
              placeholder="P, M, G, GG…"
            />
          </Campo>
          <Campo rotulo="Situação">
            <Selecao
              value={form.ativo ? "1" : "0"}
              onChange={(e) => set("ativo", e.target.value === "1")}
            >
              <option value="1">Ativo</option>
              <option value="0">Inativo</option>
            </Selecao>
          </Campo>
          <Campo rotulo="Observações">
            <Entrada
              value={form.observacoes}
              onChange={(e) => set("observacoes", e.target.value)}
              placeholder="Anotações internas"
            />
          </Campo>
        </div>

        <div className="mt-4">
          <Botao onClick={salvar} disabled={salvando}>
            <Plus className="size-4" />
            {editando ? "Salvar alterações" : "Cadastrar atleta"}
          </Botao>
        </div>
      </Card>

      <div className="flex flex-wrap items-end gap-3">
        <Campo rotulo="Buscar" className="min-w-[220px] flex-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <Entrada
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome do atleta"
              className="pl-9"
            />
          </div>
        </Campo>
        <Campo rotulo="Sexo">
          <Selecao value={filtroSexo} onChange={(e) => setFiltroSexo(e.target.value)}>
            <option value="">Todos</option>
            <option value="M">Masculino</option>
            <option value="F">Feminino</option>
          </Selecao>
        </Campo>
        <Campo rotulo="Lado">
          <Selecao value={filtroLado} onChange={(e) => setFiltroLado(e.target.value)}>
            <option value="">Todos</option>
            <option value="D">Direito</option>
            <option value="E">Esquerdo</option>
            <option value="Ambos">Ambos</option>
          </Selecao>
        </Campo>
      </div>

      {lista.length === 0 ? (
        <Vazio
          titulo="Nenhum atleta encontrado"
          descricao="Cadastre o primeiro atleta ou limpe os filtros."
        />
      ) : (
        <Card padding={false}>
          <div className="border-b border-line px-4 py-3">
            <Titulo dica={`${lista.length} de ${estado.atletas.length} atletas`}>
              Cadastro
            </Titulo>
          </div>
          <Tabela
            colunas={[
              "Nome",
              "Apelido",
              "Cidade",
              "Nascimento",
              "Sexo",
              "Lado",
              "Telefone",
              "Uniforme",
              "Campeonatos",
              "",
            ]}
            minimo={1020}
          >
            {paginacao.itensDaPagina.map((a) => {
              const usos = inscricoes.get(a.id) ?? 0;
              return (
                <tr key={a.id} className={a.ativo ? "" : "opacity-55"}>
                  <td className="px-3 py-2 font-medium text-ink">
                    {a.nome}
                    {!a.ativo && (
                      <span className="ml-2 text-[11px] text-ink-3">inativo</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-ink-2">{a.apelido || "—"}</td>
                  <td className="px-3 py-2 text-ink-2">{a.cidade || "—"}</td>
                  <td className="px-3 py-2 tabular-nums text-ink-2">
                    {dataBr(a.nascimento)}
                  </td>
                  <td className="px-3 py-2 text-ink-2">
                    {a.sexo === "F" ? "Feminino" : "Masculino"}
                  </td>
                  <td className="px-3 py-2 text-ink-2">{ROTULO_LADO[a.lado]}</td>
                  <td className="px-3 py-2 text-ink-2">{a.telefone || "—"}</td>
                  <td className="px-3 py-2 text-ink-2">{a.uniforme || "—"}</td>
                  <td className="px-3 py-2 text-center">
                    <Selo tom={usos ? "info" : "neutro"}>{usos}</Selo>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1.5">
                      <Botao
                        variante="secundario"
                        pequeno
                        onClick={() => editar(a)}
                        aria-label={`Editar ${a.nome}`}
                      >
                        <Pencil className="size-3.5" />
                      </Botao>
                      <Botao
                        variante="perigo"
                        pequeno
                        onClick={() => setExcluindo(a.id)}
                        aria-label={`Excluir ${a.nome}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Botao>
                    </div>
                  </td>
                </tr>
              );
            })}
          </Tabela>
          <Paginacao {...paginacao} />
        </Card>
      )}

      {excluindo && (
        <Card className="surge border-[color-mix(in_oklab,var(--color-erro)_30%,white)]">
          <Alerta tom="erro">
            Excluir{" "}
            <strong>{estado.atletas.find((a) => a.id === excluindo)?.nome}</strong> da
            base? Atletas inscritos em algum campeonato não podem ser excluídos — remova
            das inscrições primeiro.
          </Alerta>
          <div className="mt-3 flex gap-2">
            <Botao
              variante="perigo"
              onClick={async () => {
                await executar("excluirAtleta", { id: excluindo });
                setExcluindo(null);
              }}
              disabled={salvando}
            >
              Excluir da base
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

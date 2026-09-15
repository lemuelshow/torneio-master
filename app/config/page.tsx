"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { useDados } from "@/lib/cliente";
import type { FaixaCategoria, Sexo } from "@/lib/tipos";
import {
  Alerta, Area, Botao, Cabecalho, Campo, Card, Entrada, Selecao, Selo, Tabela, Titulo,
} from "@/components/ui";

interface StatusOnline {
  planilhaId: string;
  clientEmail: string;
  configurado: boolean;
}

function SecaoPlanilhaGoogle() {
  const [status, setStatus] = useState<StatusOnline | null>(null);
  const [planilhaId, setPlanilhaId] = useState("");
  const [credenciaisJson, setCredenciaisJson] = useState("");
  const [testando, setTestando] = useState(false);
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);

  const carregarStatus = async () => {
    const r = await fetch("/api/config-online");
    const json = (await r.json()) as StatusOnline;
    setStatus(json);
    setPlanilhaId(json.planilhaId ?? "");
  };

  useEffect(() => {
    let cancelado = false;
    fetch("/api/config-online")
      .then((r) => r.json())
      .then((json: StatusOnline) => {
        if (cancelado) return;
        setStatus(json);
        setPlanilhaId(json.planilhaId ?? "");
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const salvar = async () => {
    setTestando(true);
    setMensagem(null);
    try {
      const r = await fetch("/api/config-online", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planilhaId, credenciaisJson }),
      });
      const json = (await r.json()) as { ok?: boolean; erro?: string; mensagem?: string };
      if (!r.ok || json.erro) {
        setMensagem({ ok: false, texto: json.erro ?? "Não foi possível salvar." });
      } else {
        setMensagem({ ok: Boolean(json.ok), texto: json.mensagem ?? "Salvo." });
        setCredenciaisJson("");
        await carregarStatus();
      }
    } catch {
      setMensagem({ ok: false, texto: "Não foi possível falar com o servidor." });
    } finally {
      setTestando(false);
    }
  };

  return (
    <Card>
      <Titulo
        dica='Usado no modo online (quando "Utilizar offline" está desligado, no topo da tela) — o sistema lê e grava direto nessa planilha, de qualquer PC.'
        acao={
          status?.configurado ? (
            <Selo tom="ok">
              <CheckCircle2 className="size-3.5" />
              Configurado
            </Selo>
          ) : (
            <Selo tom="alerta">Não configurado</Selo>
          )
        }
      >
        Planilha do Google
      </Titulo>

      {status?.configurado && (
        <p className="mb-3 text-[12px] text-ink-2">
          Conta de serviço em uso:{" "}
          <span className="font-mono text-[11px]">{status.clientEmail}</span> — compartilhada
          como Editor na planilha.
        </p>
      )}

      <div className="grid gap-3">
        <Campo rotulo="ID da planilha" dica="O trecho entre /d/ e /edit na URL da planilha do Google">
          <Entrada
            value={planilhaId}
            onChange={(e) => setPlanilhaId(e.target.value)}
            placeholder="1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890"
            className="font-mono text-[13px]"
          />
        </Campo>
        <Campo
          rotulo={status?.configurado ? "Trocar credencial (opcional)" : "Credencial da conta de serviço (.json)"}
          dica="Abra o arquivo .json baixado no Google Cloud e cole o conteúdo inteiro aqui"
        >
          <Area
            value={credenciaisJson}
            onChange={(e) => setCredenciaisJson(e.target.value)}
            placeholder='{"type": "service_account", "client_email": "...", "private_key": "...", ...}'
            className="min-h-24 font-mono text-[11px]"
          />
        </Campo>
      </div>

      {mensagem && (
        <div className="mt-3">
          <Alerta tom={mensagem.ok ? "info" : "erro"}>{mensagem.texto}</Alerta>
        </div>
      )}

      <div className="mt-3">
        <Botao onClick={salvar} disabled={testando || !planilhaId.trim()}>
          <RefreshCw className={testando ? "size-4 animate-spin" : "size-4"} />
          {testando ? "Testando…" : "Salvar e testar conexão"}
        </Botao>
      </div>
    </Card>
  );
}

export default function ConfigPage() {
  const { estado, executar, salvando, planilha } = useDados();
  const [form, setForm] = useState({
    organizacao: estado.config.organizacao,
    valorInscricao: estado.config.valorInscricao,
    atletasPorGrupo: estado.config.atletasPorGrupo,
  });
  const [faixas, setFaixas] = useState<FaixaCategoria[]>(estado.config.faixas);

  // recarrega o formulário quando a configuração da planilha muda
  const assinatura = JSON.stringify(estado.config);
  const [assinaturaAnterior, setAssinaturaAnterior] = useState(assinatura);
  if (assinatura !== assinaturaAnterior) {
    setAssinaturaAnterior(assinatura);
    setForm({
      organizacao: estado.config.organizacao,
      valorInscricao: estado.config.valorInscricao,
      atletasPorGrupo: estado.config.atletasPorGrupo,
    });
    setFaixas(estado.config.faixas);
  }

  const salvar = () => executar("salvarConfig", { config: { ...form, faixas } });

  const mudarFaixa = <K extends keyof FaixaCategoria>(
    indice: number,
    campo: K,
    valor: FaixaCategoria[K]
  ) =>
    setFaixas((atual) =>
      atual.map((f, i) => (i === indice ? { ...f, [campo]: valor } : f))
    );

  return (
    <div className="space-y-5">
      <Cabecalho
        titulo="Configurações"
        descricao="Identidade da organização, padrões de novos campeonatos e faixas de categoria. Tudo é gravado na planilha."
        acao={
          <a href="/api/planilha">
            <Botao variante="secundario" pequeno>
              <Download className="size-4" />
              Baixar planilha
            </Botao>
          </a>
        }
      />

      <SecaoPlanilhaGoogle />

      <Card>
        <Titulo dica="O valor e o tamanho de grupo aqui são apenas os padrões sugeridos ao criar um campeonato novo — cada campeonato guarda os seus.">
          Parâmetros gerais
        </Titulo>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Campo rotulo="Organização / evento" className="lg:col-span-2">
            <Entrada
              value={form.organizacao}
              onChange={(e) => setForm({ ...form, organizacao: e.target.value })}
              placeholder="Nome que aparece no topo e nas súmulas"
            />
          </Campo>
          <Campo rotulo="Valor padrão da inscrição (R$)" dica="Dividido em 4 parcelas">
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
          <Campo rotulo="Atletas por grupo (padrão)" dica="4, conforme a regra do torneio">
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
        </div>
      </Card>

      <Card padding={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <Titulo dica="O atleta cai na primeira faixa ativa que combina sexo e idade na data de cada competição.">
            Faixas de categoria
          </Titulo>
          <Botao
            variante="secundario"
            pequeno
            onClick={() =>
              setFaixas((a) => [
                ...a,
                { nome: "Nova", sexo: "M", idadeMin: 40, idadeMax: 49, ativa: true },
              ])
            }
          >
            <Plus className="size-4" />
            Nova faixa
          </Botao>
        </div>

        <Tabela
          colunas={["Categoria", "Sexo", "Idade mínima", "Idade máxima", "Ativa", ""]}
          minimo={640}
        >
          {faixas.map((f, i) => (
            <tr key={i}>
              <td className="px-3 py-2">
                <Entrada
                  value={f.nome}
                  onChange={(e) => mudarFaixa(i, "nome", e.target.value)}
                  className="h-9 w-36 text-[13px]"
                />
              </td>
              <td className="px-3 py-2">
                <Selecao
                  value={f.sexo}
                  onChange={(e) => mudarFaixa(i, "sexo", e.target.value as Sexo)}
                  className="h-9 w-32 text-[13px]"
                >
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                </Selecao>
              </td>
              <td className="px-3 py-2">
                <Entrada
                  type="number"
                  min={0}
                  value={f.idadeMin}
                  onChange={(e) => mudarFaixa(i, "idadeMin", Number(e.target.value))}
                  className="h-9 w-24 text-center text-[13px]"
                />
              </td>
              <td className="px-3 py-2">
                <Entrada
                  type="number"
                  min={0}
                  value={f.idadeMax}
                  onChange={(e) => mudarFaixa(i, "idadeMax", Number(e.target.value))}
                  className="h-9 w-24 text-center text-[13px]"
                />
              </td>
              <td className="px-3 py-2 text-center">
                <Selecao
                  value={f.ativa ? "1" : "0"}
                  onChange={(e) => mudarFaixa(i, "ativa", e.target.value === "1")}
                  className="h-9 w-24 text-[13px]"
                >
                  <option value="1">Sim</option>
                  <option value="0">Não</option>
                </Selecao>
              </td>
              <td className="px-3 py-2 text-right">
                <Botao
                  variante="perigo"
                  pequeno
                  onClick={() => setFaixas((a) => a.filter((_, j) => j !== i))}
                  aria-label={`Remover faixa ${f.nome}`}
                >
                  <Trash2 className="size-3.5" />
                </Botao>
              </td>
            </tr>
          ))}
        </Tabela>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Botao onClick={salvar} disabled={salvando}>
          <Save className="size-4" />
          Salvar configurações
        </Botao>
        <span className="text-[12px] text-ink-3">
          A gravação sobrescreve as abas Config e Faixas da planilha.
        </span>
      </div>

      <Alerta tom="info">
        <p className="font-semibold">Onde ficam os dados</p>
        <p className="mt-1 break-all font-mono text-[12px]">{planilha}</p>
        <p className="mt-2">
          Você pode abrir esse arquivo no Excel e editar as abas de entrada à mão. Feche
          o arquivo antes de voltar a operar pelo sistema — com ele aberto, o Windows
          bloqueia a gravação e o sistema avisa.
        </p>
      </Alerta>
    </div>
  );
}

# Torneio de Futevôlei — Categoria Master

Sistema de gestão de torneios conforme o documento de regras de negócio da
TC Tecnologia (v1.1): base única de atletas, **vários campeonatos**, inscrições,
categorias, dois sorteios, classificação, súmulas em PDF, mata-mata e um
dashboard financeiro consolidado.

Cada campeonato tem o seu próprio fluxo guiado, em cinco etapas:

`Participantes → Fase de grupos → Classificação e súmulas → 2º sorteio (duplas) → Chave final`

O botão de avanço faz o trabalho da etapa atual para todas as categorias:
sorteia os grupos, fecha a classificação, sorteia as duplas e monta a chave.
Também dá para voltar uma etapa — o que a etapa anterior produziu é preservado.

**O banco de dados é uma planilha — em dois modos possíveis:**

- **Online (padrão):** lê e grava direto numa planilha do Google Sheets, via
  API. Vários PCs rodando o sistema ao mesmo tempo enxergam os mesmos dados —
  é o jeito de usar em mais de um computador. Exige configurar uma vez (veja
  [Modo online](#modo-online--usar-em-vários-pcs) abaixo).
- **Offline:** lê e grava `dados/torneio.xlsx`, um arquivo local que pode ser
  aberto e editado à mão entre uma operação e outra. Não depende de internet,
  mas só existe nessa máquina.

O botão **"Utilizar offline"**, no canto superior direito, troca entre os
dois. O botão **"Sincronizar"**, ao lado, busca de novo os dados mais
recentes da fonte atual — útil para ver o que outro PC acabou de gravar.

> Duas gravações praticamente ao mesmo tempo, de PCs diferentes, podem se
> sobrescrever (a última que chegar prevalece). Numa operação normal, com uma
> pessoa de cada vez mexendo em cada campeonato, isso raramente acontece.

## Rodar (localhost)

**Jeito simples:** dê dois cliques em **INICIAR.bat**. Ele confere o Node, instala
as dependências na primeira vez, gera o build, escolhe uma porta livre a partir
da 3000, abre o navegador e avisa se o Excel estiver aberto. Para parar, feche a
janela preta ou aperte Ctrl+C.

**Pela linha de comando:**

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
npm run lint
```

O arquivo local é criado no primeiro acesso, já formatado. Para apontar para
outro arquivo, defina `PLANILHA` com o caminho completo.

> No modo offline, feche o arquivo no Excel antes de operar pelo sistema. Com
> o arquivo aberto o Windows bloqueia a gravação — nesse caso o sistema mostra
> *"A planilha está aberta no Excel. Feche o arquivo e tente de novo."* e não
> perde a operação.

## Modo online — usar em vários PCs

O modo online lê e grava direto numa planilha do Google Sheets, usando uma
**conta de serviço** (não a sua conta pessoal do Google) — feito uma vez,
funciona em quantos PCs você quiser, todos apontando para a mesma planilha.
São uns 10-15 minutos, só no primeiro PC:

1. **Criar a planilha.** No Google Sheets, crie uma planilha nova (pode ficar
   em branco — o sistema cria as abas sozinho na primeira gravação). Copie o
   ID dela pela URL: `https://docs.google.com/spreadsheets/d/`**`ESTE-TRECHO`**`/edit`.

2. **Criar a conta de serviço**, no [Google Cloud Console](https://console.cloud.google.com/):
   - Crie um projeto (ou use um existente).
   - Em **"APIs e serviços" → "Biblioteca"**, ative a **Google Sheets API**.
   - Em **"APIs e serviços" → "Credenciais" → "Criar credenciais" → "Conta de
     serviço"**, dê um nome qualquer e conclua (não precisa conceder papéis).
   - Abra a conta de serviço criada → aba **"Chaves"** → **"Adicionar chave"
     → "Criar nova chave" → JSON**. Um arquivo `.json` é baixado — é a
     credencial, guarde com cuidado (dá acesso de escrita à planilha).

3. **Compartilhar a planilha com a conta de serviço.** Abra o arquivo `.json`
   baixado, copie o valor de `"client_email"` (algo como
   `nome@projeto.iam.gserviceaccount.com`) e compartilhe a planilha do passo 1
   com esse e-mail, como **Editor** (botão "Compartilhar" no Google Sheets).

4. **Cadastrar na tela de Configurações.** Abra o sistema → **Configurações**
   → seção **"Planilha do Google"**. Cole o **ID** copiado no passo 1 e o
   **conteúdo inteiro do arquivo `.json`** baixado no passo 2 (abra o arquivo
   num bloco de notas, selecione tudo, copie e cole) → **"Salvar e testar
   conexão"**. O sistema confirma na hora se conseguiu conectar.

5. Repita o passo 4 em cada PC adicional, com o mesmo ID e o mesmo arquivo de
   credencial — todos apontam para a mesma planilha.

Não precisa editar nenhum arquivo nem variável de ambiente — fica tudo
gravado localmente em `dados/conexao-google.json` (nunca é enviado para a
planilha do Google, só usado para autenticar). Com **"Utilizar offline"
desligado** (padrão), o sistema já lê e grava na planilha do Google assim que
a conexão for salva. Se faltar a credencial, o ID, ou a internet, o sistema
mostra o erro explicando o que falta — sem perder o que já estava gravado
localmente, se houver.

## Telas

| Rota | Função |
|---|---|
| `/` | Campeonatos: lista, criação e progresso de cada um no fluxo |
| `/campeonatos/[id]` | Fluxo completo do campeonato, etapa por etapa |
| `/financeiro` | Dashboard: faturamento por campeonato, entrada por mês e pendências |
| `/atletas` | Base de atletas: nome, nascimento, sexo, lado (D/E/Ambos), telefone, uniforme |
| `/config` | Organização, padrões de novos campeonatos, faixas de categoria e a conexão com a planilha do Google |

Dentro de `/campeonatos/[id]`, cada etapa tem o seu painel:

| Etapa | O que dá para fazer |
|---|---|
| Participantes | Selecionar atletas da base ou cadastrar um novo já inscrevendo; baixar as 4 parcelas |
| Fase de grupos | Ver os grupos, trocar atletas de vaga, **excluir um atleta do grupo** (ícone de lixeira), lançar os placares dos 3 jogos |
| Classificação e súmulas | Conferir a ordenação, **ajustar a classificação à mão** e **baixar as súmulas em PDF** (geral ou por categoria) |
| 2º sorteio — duplas | Duplas fixas do Ouro e da Prata, com opção de sortear de novo e **súmulas em PDF por divisão** |
| Chave final | Mata-mata com bye, lançamento de placar e campeão de cada divisão |

## Identidade visual

O escudo **Futevôlei Master Brasil** (`LOGOPNG.png`, na raiz do projeto) define a
paleta: azul-marinho profundo do escudo, dourado das estrelas e verde-bandeira.
O fundo escuro da arte foi removido, então a logo aparece limpa tanto no menu
escuro quanto no papel da súmula.

- `public/logo.png` — escudo recortado, usado no menu, no painel e nas súmulas
- `app/icon.png` — favicon gerado do mesmo escudo
- A faixa verde/dourado/azul aparece no topo e no menu como assinatura da marca

## Estrutura da planilha

| Aba | Tipo | Conteúdo |
|---|---|---|
| **Leia-me** | referência | Como a planilha funciona e as regras aplicadas |
| **Config** | entrada | Organização e padrões de novos campeonatos (valor, atletas por grupo) |
| **Faixas** | entrada | Categorias por sexo e faixa de idade |
| **Campeonatos** | entrada | Um por linha: nome, data, local, valor, etapa atual |
| **Atletas** | entrada | Base única, reaproveitada por todos os campeonatos |
| **Participantes** | entrada | Inscrição por campeonato: 4 parcelas com SIM/NÃO e data |
| **Grupos** | entrada | Composição dos grupos e a posição manual da classificação, editáveis à mão |
| **Jogos** | entrada | Confrontos da fase de grupos e placares |
| **Classificação** | calculada | Reescrita pelo sistema a cada gravação |
| **Duplas** | entrada | Duplas fixas do 2º sorteio |
| **Mata-Mata** | entrada | Chave, placares e vencedores |

Cabeçalho congelado, filtro automático, datas como data de verdade e valores em
R$ — a planilha é para ser usada, não só lida por máquina.

## Regras implementadas

**Idade e categoria.** A idade vale **na data da competição**, não hoje: quem
tem 49 no cadastro e completa 50 até o evento é enquadrado no 50+. As faixas
saem da aba Faixas (padrão 40–49, 50–59, 60–69, 70+ e Feminino 40+).

**Inscrição.** Sempre 4 parcelas, com situação individual (`2/4`), total pago e
saldo por atleta — **por campeonato**. O mesmo atleta pode estar em vários
campeonatos com pagamentos independentes, e um atleta inscrito em algum
campeonato não pode ser excluído da base.

**Financeiro.** O dashboard soma tudo: previsto, recebido e a receber por
campeonato, entrada mês a mês (pela data de cada parcela) e a lista de quem
está pendente, ordenada pelo maior saldo em aberto, com telefone de contato.

**1º sorteio — grupos.** Grupos de 4 buscando **2 D + 2 E**. Atletas marcados
como **Ambos** entram como curinga para fechar as vagas. Falta de equilíbrio
**não bloqueia** o sorteio: o sistema forma os grupos, avisa o desvio e deixa o
operador ajustar. A composição é editável vaga por vaga, e grupos que mudam têm
os jogos refeitos (com aviso de que os placares zeram).

**Fase de grupos.** Sem dupla fixa: **3 jogos por grupo**, cada atleta joga uma
vez com cada um dos outros três como parceiro (AB×CD, AC×BD, AD×BC).

**Classificação.** Soma de vitórias e, no desempate, número de pontos (depois
saldo e nome). Saída de 1º a 4º. **1º e 2º → Ouro; 3º e 4º → Prata.**
O botão **"Editar classificação"** abre as setas de subir/descer em cada grupo:
a ordem salva à mão passa a valer por cima do cálculo — inclusive para definir
quem vai ao Ouro e à Prata — e fica gravada na coluna *Posição manual* da aba
Grupos, até o operador voltar o grupo ao automático. Mexer na composição do
grupo (trocar, adicionar ou excluir um atleta) derruba o ajuste daquele grupo,
porque os jogos são refeitos.

**2º sorteio — duplas fixas.** Os classificados são separados por lado dentro da
divisão e sorteados de novo. O pareamento evita repetir a dupla do mesmo grupo.
Se faltar D ou E entre os classificados, formam-se duplas do mesmo lado com
aviso — ninguém que classificou fica fora.

**Mata-mata.** Cruzamentos até a final; quando o número de duplas não fecha
potência de 2, as sobrantes avançam direto (bye) e o sistema recusa placar em
confronto sem as duas duplas. O vencedor de cada jogo é levado à fase seguinte
automaticamente.

**Súmulas.** Uma folha por grupo, com escudo no cabeçalho, faixa da bandeira e
linhas de assinatura. Na **fase de grupos** a folha é só a lista de jogos, para
o operador conduzir a rodada no papel. Na **classificação** a mesma folha abre
com os atletas do grupo já com vitórias, pontos, saldo e divisão apurados, e o
PDF termina com uma página de classificação geral. No **2º sorteio** sai a
súmula da segunda fase: uma folha por divisão (Ouro e Prata) com as duplas
fixas, os grupos de origem e os confrontos da chave — em branco, já na
estrutura certa, enquanto o mata-mata não foi montado.

## Pendências do documento

- **60+**: o documento pede validar o limite superior. Aqui está 60–69 com uma
  faixa 70+ separada — ajustável na aba Faixas sem tocar no código.
- **Feminino**: idade mínima 40 e sem subdivisão, também configurável.
- **3º e 4º lugares**: o PDF marca como pendente; implementado como **Prata**,
  conforme o áudio original do cliente.

## Estrutura do código

```
lib/
  tipos.ts             modelo de dados
  excel.ts             esquema das abas + leitura/escrita do arquivo local (.xlsx)
  googleSheets.ts       cliente baixo nível da API do Google Sheets (autenticação, batchGet/Update)
  configOnline.ts       ID da planilha + credencial, cadastrados pela tela de Configurações
  armazenamentoGoogle.ts leitura/escrita do Estado inteiro na planilha do Google
  armazenamento.ts      escolhe a fonte (Google ou arquivo local) por um booleano "offline"
  regras.ts            idade, categoria, sorteios, jogos, classificação, chave, etapas
  financeiro.ts        consolidação do dinheiro (previsto, recebido, pendências, meses)
  pdf.ts               súmulas da fase de grupos, do 2º sorteio e classificação em PDF
  cliente.tsx          estado no navegador, chamadas à API e a preferência online/offline
  constantes.ts        nome do cookie da preferência online/offline (compartilhado client/server)
components/
  etapas/      um painel por etapa do campeonato
app/
  api/estado    GET  — lê o estado (Google ou local, conforme o cookie)
  api/acao      POST — todas as operações, cada uma regravando o estado inteiro
  api/planilha  GET  — gera e baixa um .xlsx com os dados atuais
  api/config-online GET/POST — status e cadastro do ID + credencial da planilha do Google
```

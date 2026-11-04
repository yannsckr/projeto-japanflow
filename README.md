<div align="center">

# JapanFlow

Sistema web desenvolvido para centralizar tarefas, acompanhar atividades e facilitar a rotina de diferentes setores da Japan Imports.

[**Acessar o JapanFlow**](https://japanflow.com.br)

</div>

---

## Sobre o projeto

O **JapanFlow** é um sistema de gestão empresarial (ERP) voltado à organização do trabalho diário. Ele conecta colaboradores e gestores em um único ambiente, reunindo ferramentas que antes poderiam ficar espalhadas entre planilhas, mensagens e controles separados.

A proposta é simples: **dar mais visibilidade ao que precisa ser feito, facilitar a comunicação e manter um histórico organizado das operações.**

O sistema possui áreas e permissões diferentes conforme o perfil e as responsabilidades de cada usuário.

## Principais funcionalidades

### 📋 Tarefas e acompanhamento

- Quadros de tarefas no estilo **Kanban**, para acompanhar atividades e seus status.
- Visão de tarefas por funcionário e acompanhamento pela gestão.
- Histórico e arquivamento de tarefas concluídas.
- Área de acompanhamento das atividades e registros de tempo.

### 💬 Comunicação interna

- Chat entre colaboradores, com conversas individuais e em grupo.
- Envio de mensagens e anexos.
- Reações com emojis, respostas e informações de leitura das mensagens.
- Indicadores de mensagens não lidas e consulta ao histórico de conversas.

### 📢 Avisos e reportes

- Comunicados internos para manter a equipe informada.
- Avisos com título, descrição e anexos de imagem ou vídeo.
- Apresentação sequencial dos avisos, com confirmação de leitura.
- Registro de problemas e solicitações por meio do **Backlog**.
- Organização de reportes por status, atualizações e arquivamento de itens resolvidos.

### 📦 Operações e setores

- **Painel de retiradas** para apoiar a rotina da Expedição.
- Ferramentas específicas para departamentos e operações internas.
- Áreas de pedidos de compras, encomendas de balcão e inventário.
- Acompanhamento de corridas e outras atividades operacionais.

### 📊 Gestão e administração

- Painel administrativo e monitoramento operacional.
- Consulta a informações financeiras e relatórios.
- Gestão de perfis e acessos.
- Documentos compartilhados e políticas internas.
- Recursos de acompanhamento e reconhecimento da equipe.

> **Observação:** a disponibilidade de cada recurso depende das permissões do usuário e da configuração do ambiente.

## Tecnologias utilizadas

| Camada                    | Tecnologias                                      |
| ------------------------- | ------------------------------------------------ |
| Interface                 | React, TypeScript, Vite                          |
| Estilização e componentes | Tailwind CSS, shadcn/ui, Radix UI                |
| Autenticação e dados      | Firebase Authentication, Cloud Firestore         |
| Arquivos                  | Firebase Cloud Storage                           |
| Backend                   | Firebase Cloud Functions                         |
| Publicação                | Firebase Hosting                                 |
| Testes e qualidade        | Vitest, Playwright, ESLint, Prettier, TypeScript |

## Como executar localmente

**Pré-requisitos:** Node.js, npm e um projeto Firebase configurado para desenvolvimento.

```bash
git clone https://github.com/yannsckr/japanflow.git
cd japanflow
npm install
npm run dev
```

O Vite exibirá no terminal o endereço local da aplicação.

**Importante:** para utilizar autenticação, banco de dados e armazenamento, é necessário configurar as variáveis de ambiente e as credenciais apropriadas. **Não inclua segredos, contas de serviço ou arquivos `.env` no repositório público.**

## Validação e testes

O projeto inclui rotinas para verificar formatação, tipagem, qualidade do código e compilação:

```bash
npm run validar
```

Para executar os testes automatizados:

```bash
npm test
```

Os testes de regras de segurança dependem dos emuladores do Firebase. Com os emuladores necessários em execução:

```bash
npm run test:security
```

Há também testes de interface e fluxos de uso com Playwright:

```bash
npm run qa
```

## Estrutura geral

```text
japanflow/
├── src/                 # Interface, páginas, componentes e funcionalidades
├── functions/           # Funções de backend no Firebase
├── tests/               # Testes automatizados de segurança e lógica
├── qa/                  # Testes de interface e fluxos de uso
├── scripts/             # Utilitários de manutenção e desenvolvimento
├── firestore.rules      # Regras de segurança do banco de dados
├── storage.rules        # Regras de segurança dos arquivos
├── firebase.json        # Configuração dos serviços Firebase
└── package.json         # Dependências e comandos do projeto
```

## Publicação

A aplicação utiliza **Firebase Hosting**. Após a validação, o frontend pode ser publicado com:

```bash
npx firebase deploy --only hosting --project japanflow-erp
```

Alterações em **regras de segurança, funções ou índices** exigem revisão e testes específicos antes de qualquer deploy de produção.

## Objetivo e evolução

O JapanFlow nasceu para atender necessidades reais de organização, comunicação e acompanhamento operacional. O desenvolvimento é contínuo, com melhorias de usabilidade, desempenho e segurança, além de novas funcionalidades conforme as necessidades da equipe.

---

<div align="center">

**JapanFlow — um fluxo de trabalho mais simples, conectado e organizado.**

</div>

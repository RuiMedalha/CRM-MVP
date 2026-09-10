# HotelEquip CRM — Estado Atual do Projeto e Roadmap de Evolução

**Data de Atualização:** 10 de Setembro de 2026  
**Versão em Produção:** `v0.9.0-pre-prod` (Commit: `bec3f75`)  
**Ambiente Local:** `http://localhost:5180`  
**Ambiente Produção:** `https://crm.hotelequip.pt`  
**Repositórios:** `RuiMedalha/CRM-MVP` e `RuiMedalha/crm-lab-directus`  

---

## 1. O Que Está Concluído e em Produção

### A. Mecânica de Vendas e Pipeline (Estilo Pipedrive)
- **Funil Visual no Topo do Kanban:** Blocos horizontais com largura proporcional ao valor em euros por etapa e percentagens de conversão calculadas.
- **Painel de Indicadores de Pipeline:** Resumo de valor aberto, valor ganho nos últimos 30 dias, taxa de fecho global e tempo médio de ciclo.
- **Deteção Visual de Negócios Estagnados:** Destaque com borda superior vermelha pulsante e aviso de inatividade em negócios sem contacto há mais de 7 dias.
- **Controlo de Atividades:** Interceção ao arrastar negócios entre etapas para agendamento de próxima ação comercial.

### B. Agenda e Gestão de Tarefas (Estilo Google Calendar / FullCalendar)
- **Vista de Calendário Integrada:** FullCalendar configurado como vista padrão com navegação mensal, semanal e diária.
- **Cores por Tipo de Compromisso:** Diferenciação visual entre chamadas, reuniões, visitas técnicas e follow-ups.
- **Reagendamento Interativo:** Suporte a arrastar e soltar eventos diretamente na grelha para atualização de data e hora.

### C. Caixa de Entrada Unificada (Estilo GoHighLevel)
- **Layout de Três Colunas em `/inbox`:** Lista de conversas à esquerda, histórico central e contexto do cliente à direita.
- **Atalhos de Navegação por Teclado:** Teclas `J` e `K` para percorrer mensagens rapidamente e botões anterior/seguinte no cabeçalho.
- **Seletor de Canais de Resposta:** Alternância rápida entre números de WhatsApp e endereço de correio eletrónico corporativo.
- **Assistente IA de Respostas:** Caixa de sugestão de respostas comerciais rápidas e técnicas com base no catálogo.

### D. Propostas Comerciais e Orçamentos Unificados
- **Consolidação de Módulos:** Fusão de `/orcamentos` em `/propostas` com redirecionamento automático e histórico centralizado.
- **Criador Híbrido:** Botão único que permite gerar propostas interativas completas ou cotações rápidas de folha única.
- **Rastreio de Abertura em Tempo Real:** Alertas em tempo real quando o cliente visualiza a proposta pública online.

### E. Processamento Inteligente de Emails e Ficha de Cliente
- **Resolução de Imagens Inline:** Conversão de referências `cid:` de emails do Outlook para endereços de ficheiros do Directus.
- **Miniaturas de Anexos:** Apresentação visual de imagens anexadas com abertura em alta resolução.
- **Extrator Heurístico Local Especializado:** Leitura de assinaturas para capturar nome, empresa, morada, localidade e NIF.
- **Regra Telefónica Nacional:** Classificação automática de números começados por 9 como telemóvel e começados por 2 ou 3 como fixo.
- **Eliminação de Alarmes Falsos:** Atribuição do estado `new` a leads de email para evitar disparos do som de chamada do Telecof.
- **Ficha de Enriquecimento de Lead:** O botão de abertura da lead direciona para o espaço de trabalho completo com histórico, notas e follow-ups.
- **Cache de Extração:** Armazenamento local da análise da assinatura para evitar chamadas redundantes à API de inteligência artificial.
- **Correlação por Domínio:** Associação automática de múltiplos remetentes da mesma empresa à mesma ficha de cliente.

### F. Manutenção e Base de Dados
- **Limpeza de Notas Legadas:** Remoção de 1.801 notas com a menção `Importado de bravo` na base de dados com backup de segurança.
- **Organização do Repositório:** Fecho de pull requests obsoletos e consolidação das branches principais.

---

## 2. O Que Falta Implementar (Roadmap Prioritário)

### Prioridade Alta (Segurança e Operação Imediata)
1. **Permissões Granulares no Backend (Directus RLS):**
   - Aplicar regras de controlo de acesso no servidor para que utilizadores sem perfil de gestão vejam apenas os seus próprios negócios e contactos.
2. **Endpoint Público de Aprovação de Propostas:**
   - Criar endpoint dedicado para permitir ao cliente final aprovar propostas online sem necessidade de permissões de escrita abertas na coleção.
3. **Organização da Página Inicial (`/hoje`):**
   - Implementar filtros para chamadas perdidas antigas e destacar os cinco negócios de maior valor com ações pendentes.

### Prioridade Média (Escalabilidade e Produtividade Comercial)
4. **Sincronização em Tempo Real na Caixa de Entrada:**
   - Unificar streams de eventos do WhatsApp e email via WebSockets para atualização instantânea da coluna de conversas.
5. **Trilho de Auditoria e Conformidade (RGPD):**
   - Registo em base de dados de visualizações, alterações e exportações de dados pessoais com identificação de utilizador, data e endereço IP.
6. **Templates Avançados de Email com Tags Dinâmicas:**
   - Construtor visual de modelos de correio eletrónico com preenchimento de variáveis de cliente e produtos.

### Prioridade de Médio/Longo Prazo (Mobilidade e Governação)
7. **Otimização da Interface Móvel:**
   - Simplificação do ecrã do pipeline em smartphones através de navegação por deslizamento entre colunas.
8. **Suporte Multilingue:**
   - Tradução da interface para inglês e espanhol com vista à expansão internacional.
9. **Bateria de Testes Automatizados:**
   - Criação de testes de ponta a ponta com Playwright para os fluxos críticos de entrada de lead, emissão de proposta e fecho de venda.

---

## 3. Prompt para Análise Externa por Outra IA

Pode copiar o texto abaixo e submetê-lo a outro modelo de inteligência artificial para obter uma avaliação técnica e estratégica do sistema:

```markdown
Atua como arquiteto de software principal e especialista em produto com mais de 20 anos de experiência na construção de plataformas CRM como Pipedrive, HubSpot, GoHighLevel e Attio.

Analisa a arquitetura, o estado atual e os requisitos técnicos do HotelEquip CRM, um sistema especializado no setor de equipamentos hoteleiros e restauração (B2B).

### Contexto Tecnológico do Projeto:
- Frontend: React 18, TypeScript, Vite, Tailwind CSS, componentes Radix UI e shadcn/ui, TanStack Query, FullCalendar.
- Backend & Dados: Directus 12 (PostgreSQL auto-hospedado na União Europeia), autenticação JWT e endpoints REST customizados.
- Integrações Omnicanal: Evolution API (WhatsApp multi-instância), Microsoft Graph API (Email bidirecional), PBX Telecof (Telefonia VoIP CTI).
- Motor de Pesquisa e IA: Meilisearch para pesquisa instantânea de produtos, router com fallback para Fable 5.1, Fable 5.1 e OpenAI.
- Infraestrutura: Servidor dedicado Nginx com Cloudflare e pipelines de deploy automatizados via SSH/SCP.

### Funcionalidades Já Implementadas no Sistema:
1. Pipeline de vendas com física do Pipedrive: funil visual horizontal com conversão por etapa, alertas de estagnação e exigência de agendamento de atividade.
2. Agenda com FullCalendar mensal, semanal e diário com suporte a arrastar compromissos.
3. Caixa de entrada omnicanal unificada estilo GoHighLevel (WhatsApp, email e chamadas em 3 colunas com atalhos de teclado J/K).
4. Módulo de propostas comerciais com visualização interativa, contagem de urgência, termos, MBWay e rastreio de abertura em tempo real.
5. Processamento de emails com extração de dados fiscais (NIF, morada, empresa), separação de telefones fixos (2xx/3xx) de móveis (9xx), renderização de imagens inline (cid:) e correlação por domínio corporativo.
6. Ficha de cliente com dossiê de notas contínuas, histórico de emails trocados e catálogo de equipamentos solicitados.

### Objetivos da Tua Análise:
1. Auditoria de Arquitetura e Escalabilidade: Identifica potenciais fragilidades de acoplamento entre o frontend e o Directus, riscos de performance no carregamento de grandes volumes de contactos e sugestões de otimização de estado.
2. Ergonomia Comercial e Fricção de Utilização: Compara o fluxo atual (Lead -> Contacto -> Proposta -> Negócio) com as melhores práticas mundiais e aponta onde um vendedor ainda pode perder tempo desnecessário.
3. Segurança e Conformidade: Avalia os pontos críticos na transição de uma base de dados auto-hospedada para ambiente de produção, com foco em controlo de acesso (Directus RLS), proteção de tokens públicos e auditoria RGPD.
4. Plano de Evolução Tecnológica: Sugere as 3 principais funcionalidades ou refatorações técnicas que trariam o maior retorno sobre o investimento (ROI) nos próximos 60 dias.

Sê rigoroso, factual e foca-te em recomendações práticas de engenharia de software e estratégia de produto.
```

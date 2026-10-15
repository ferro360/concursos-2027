# Atualização contínua da base com concursos novos

## Objetivo
Facilitar a entrada de questões de concursos novos assim que as provas acontecem, sem trabalho manual repetitivo.

## O que será feito

### 1. Campo "Concurso/Prova" nas questões
- Nova coluna `prova` (texto livre, ex.: "INSS 2026 — Técnico do Seguro Social") nas questões.
- Aparece no formulário de questão, na importação por planilha (nova coluna) e no gerador com IA.
- Novo filtro "Prova" na lista de questões, para o aluno treinar uma prova específica.
- O cartão da questão passa a mostrar a prova quando preenchida.

### 2. Fluxo "Nova prova" no Admin
- Atalho no Admin: "Importar prova" — abre a importação de planilha já com o campo prova, e "Gerar prova com IA" — abre o gerador.
- O gerador passa a aceitar o texto do edital/conteúdo cobrado como "Conteúdo base" (já existe) e preenche o campo prova automaticamente.

### 3. Documentação da rotina
- Pequeno guia dentro da página Admin explicando o passo a passo: cadastrar banca/órgão → importar ou gerar → revisar → publicar.

## Observação
Provas de concursos públicos são atos oficiais de divulgação pública, então a plataforma aceitará tanto questões de provas reais (importadas por planilha ou digitadas) quanto questões inéditas geradas por IA no estilo da banca. A coleta continua manual (colar/digitar/planilha) — sem robô de coleta automática de sites de terceiros.

## Detalhes técnicos
- Migração: `ALTER TABLE questions ADD COLUMN prova text NOT NULL DEFAULT ''`.
- Atualizar: `question-form.tsx`, `spreadsheet-import.tsx` (COLS + modelo), `gerar-questoes.tsx`, `index.tsx` (filtro + cartão), `admin.tsx`.
- Sem mudanças em RLS (a coluna segue as policies existentes de `questions`).
- Tipos regenerados após a migração.

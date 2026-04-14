# Lineage Mainframe

Documento gerado a partir dos artefatos em `mainframe/`: JCLs, programas COBOL,
copybooks e DCLGEN. Nao foram usados CSVs gerados.

## Resumo Executivo

| Job | Status | Steps processados | Saidas principais | Observacoes |
|---|---|---|---|---|
| JCLDB001 | Processado | STEP010 ICEGENER; STEP020 SORT; STEP030 CBLDB001 via IKJEFT01; STEP040 SORT | APP.ARQ.SAIDA.CBLDB001 | Recebe INPUT1 e INPUT2, consulta DB2 APPDB.CLIENTE_MOVTO, calcula saida operacional e carimba OUT-HARD-JCL no SORT final. |
| JCLDB002 | Processado | STEP010 CBLDB002A; STEP020 CBLDB002B | APP.ARQ.SAIDA.CBLDB002 | Consome APP.ARQ.SAIDA.CBLDB001 produzido por JCLDB001, cria layout analitico intermediario e cruza com APP.INPUT3.COMPLEMENTO. |

## Indice de Arquivos

| Dataset / Tabela | Tipo | Layout / Fonte | Produzido por | Consumido por |
|---|---|---|---|---|
| APP.INPUT1.ORIGINAL | Dataset entrada | CPYIN001.cpy | Externo | JCLDB001 STEP010 |
| &&TMPIN001 | Temporario | CPYIN001.cpy | JCLDB001 STEP010 | JCLDB001 STEP030 INPUT1 |
| APP.INPUT2.ORIGINAL | Dataset entrada | CPYIN002.cpy | Externo | JCLDB001 STEP020 |
| &&TMPIN002 | Temporario | CPYIN002.cpy | JCLDB001 STEP020 | JCLDB001 STEP030 INPUT2 |
| APPDB.CLIENTE_MOVTO | Tabela DB2 | DCLTB001.dcl | DB2 | JCLDB001 STEP030 |
| &&TMPOUT03 | Temporario | CPYOUT01.cpy | JCLDB001 STEP030 | JCLDB001 STEP040 |
| APP.ARQ.SAIDA.CBLDB001 | Dataset saida | CPYOUT01.cpy | JCLDB001 STEP040 | JCLDB002 STEP010 |
| &&TMPDB201 | Temporario | CPYDB201.cpy | JCLDB002 STEP010 | JCLDB002 STEP020 INPUTA |
| APP.INPUT3.COMPLEMENTO | Dataset entrada | CPYIN003.cpy | Externo | JCLDB002 STEP020 INPUTB |
| APP.ARQ.SAIDA.CBLDB002 | Dataset saida | CPYDB202.cpy | JCLDB002 STEP020 | Downstream |

## [JOB: JCLDB001 / STEP: STEP010 / PGM: ICEGENER]

**Entrada:** DD SYSUT1 -> DSN=APP.INPUT1.ORIGINAL (copybook: CPYIN001.cpy)
**Saida:** DD SYSUT2 -> DSN=&&TMPIN001 (copybook: CPYIN001.cpy)

### Copia de Layout

| Campo de Saida | Campo de Origem | Tipo de Linhagem | Transformacao |
|---|---|---|---|
| IN1-CHAVE | IN1-CHAVE | DIRETO | ICEGENER copia registro sem alteracao. |
| IN1-TIPO-REG | IN1-TIPO-REG | DIRETO | ICEGENER copia registro sem alteracao. |
| IN1-AGENCIA | IN1-AGENCIA | DIRETO | ICEGENER copia registro sem alteracao. |
| IN1-CONTA | IN1-CONTA | DIRETO | ICEGENER copia registro sem alteracao. |
| IN1-QTDE | IN1-QTDE | DIRETO | ICEGENER copia registro sem alteracao. |
| IN1-FATOR | IN1-FATOR | DIRETO | ICEGENER copia registro sem alteracao. |
| IN1-COD-OPER | IN1-COD-OPER | DIRETO | ICEGENER copia registro sem alteracao. |
| IN1-DATA-MOV | IN1-DATA-MOV | DIRETO | ICEGENER copia registro sem alteracao. |
| IN1-CANAL | IN1-CANAL | DIRETO | ICEGENER copia registro sem alteracao. |
| IN1-FILLER | IN1-FILLER | DIRETO | ICEGENER copia registro sem alteracao. |

**Resumo do step:** materializa `APP.INPUT1.ORIGINAL` em `&&TMPIN001` para uso posterior pelo COBOL, preservando todos os campos de CPYIN001.

## [JOB: JCLDB001 / STEP: STEP020 / PGM: SORT]

**Entrada:** DD SORTIN -> DSN=APP.INPUT2.ORIGINAL (copybook: CPYIN002.cpy)
**Saida:** DD SORTOUT -> DSN=&&TMPIN002 (copybook: CPYIN002.cpy)

### Ordenacao

| Campo Resolvido | Posicao | Tamanho | Formato | Direcao |
|---|---:|---:|---|---|
| IN2-CHAVE | 1 | 10 | CH | ASC |
| IN2-DATA-REF | 53 | 8 | CH | ASC |

### Remapeamento de Layout

| Pos. Saida | Tam. | Campo de Origem | Pos. Origem | Tipo de Linhagem |
|---:|---:|---|---:|---|
| 1 | 100 | Registro CPYIN002 completo | 1 | DIRETO |

**Resumo do step:** ordena `APP.INPUT2.ORIGINAL` por chave e data de referencia, mantendo o layout CPYIN002 sem alteracao de campos.

## [JOB: JCLDB001 / STEP: STEP030 / PGM: CBLDB001]

**Execucao JCL:** IKJEFT01 com `RUN PROGRAM(CBLDB001) PLAN(PLNDB001)`.
**Entradas:** INPUT1=`&&TMPIN001`; INPUT2=`&&TMPIN002`; DB2=`APPDB.CLIENTE_MOVTO`.
**Saida:** SAIDA=`&&TMPOUT03` (copybook: CPYOUT01.cpy).
**Job de origem:** `&&TMPIN001` vem de JCLDB001 STEP010; `&&TMPIN002` vem de JCLDB001 STEP020.

### Campos Gravados em REG-OUT

| Campo de Saida | Tipo de Linhagem | Campo de Origem | Arquivo de Origem | Job de Origem | Transformacao / Condicao | Paragrafo COBOL |
|---|---|---|---|---|---|---|
| OUT-ORIGEM | HARD-CODE | Literal '1' ou '2' | - | - | Identifica ramo INPUT1 ou INPUT2. | 2100-TRATA-IN1 / 3100-TRATA-IN2 |
| OUT-CHAVE | DIRETO | IN1-CHAVE ou IN2-CHAVE | INPUT1 / INPUT2 | STEP010 / STEP020 | MOVE da chave de entrada; tambem usada como chave da consulta DB2. | 2100-TRATA-IN1 / 3100-TRATA-IN2 / 5000-BUSCA-DB2 |
| OUT-NOME | REGRA CONDICIONAL | HV-NOME-CLIENTE ou literal de erro | APPDB.CLIENTE_MOVTO ou - | - | Se SQLCODE=0 vem do DB2; se SQLCODE=100 recebe "NAO ENCONTRADO"; demais erros recebem "ERRO DB2". | 2100-TRATA-IN1 / 3100-TRATA-IN2 / 7000-TRATA-DB2-NAO-OK |
| OUT-STATUS | REGRA CONDICIONAL | HV-STATUS-CLIENTE ou literal | APPDB.CLIENTE_MOVTO ou - | - | Se SQLCODE=0 vem do DB2; caso contrario recebe N ou E conforme tratamento de erro. | 2100-TRATA-IN1 / 3100-TRATA-IN2 / 7000-TRATA-DB2-NAO-OK |
| OUT-CODIGO-DB2 | REGRA CONDICIONAL | HV-CODIGO-DB2 ou literal | APPDB.CLIENTE_MOVTO ou - | - | Se SQLCODE=0 vem do DB2; caso contrario recebe 00000 ou 99999. | 2100-TRATA-IN1 / 3100-TRATA-IN2 / 7000-TRATA-DB2-NAO-OK |
| OUT-DATA-CAD | REGRA CONDICIONAL | HV-DATA-CADASTRO ou literal | APPDB.CLIENTE_MOVTO ou - | - | Se SQLCODE=0 vem do DB2; caso contrario recebe 0000-00-00. | 2100-TRATA-IN1 / 3100-TRATA-IN2 / 7000-TRATA-DB2-NAO-OK |
| OUT-TIPO-SAIDA | REGRA CONDICIONAL | IN1-TIPO-REG / IN2-INDICADOR / SQLCODE | INPUT1 / INPUT2 / DB2 | STEP010 / STEP020 | INPUT1: A=>A1, senao A2; INPUT2: S=>B1, senao B2; erro DB2: ND ou ER. | 2100-TRATA-IN1 / 3100-TRATA-IN2 / 7000-TRATA-DB2-NAO-OK |
| OUT-CANAL-SAIDA | REGRA CONDICIONAL | IN1-CANAL, literal B2 ou HV-CANAL-PREFERENC | INPUT1 / DB2 | STEP010 | INPUT1 copia IN1-CANAL; INPUT2 inicia B2 e, se SQLCODE=0, substitui por canal preferencial DB2. | 2100-TRATA-IN1 / 3100-TRATA-IN2 |
| OUT-OCORRENCIA | REGRA CONDICIONAL | IN1-TIPO-REG / IN2-INDICADOR / SQLCODE | INPUT1 / INPUT2 / DB2 | STEP010 / STEP020 | INPUT1: A=>000 senao 010; INPUT2: S=>000 senao 020; erro DB2: 404 ou 999. | 2100-TRATA-IN1 / 3100-TRATA-IN2 / 7000-TRATA-DB2-NAO-OK |
| OUT-AGENCIA | DIRETO | IN1-AGENCIA | INPUT1 | STEP010 | MOVE IN1-AGENCIA TO OUT-AGENCIA. | 2100-TRATA-IN1 |
| OUT-CONTA | DIRETO | IN1-CONTA | INPUT1 | STEP010 | MOVE IN1-CONTA TO OUT-CONTA. | 2100-TRATA-IN1 |
| OUT-DOCUMENTO | DIRETO | IN2-DOCUMENTO | INPUT2 | STEP020 | MOVE IN2-DOCUMENTO TO OUT-DOCUMENTO. | 3100-TRATA-IN2 |
| OUT-QTDE | DIRETO | IN1-QTDE ou IN2-QUANTIDADE | INPUT1 / INPUT2 | STEP010 / STEP020 | Quantidade copiada do ramo processado. | 2100-TRATA-IN1 / 3100-TRATA-IN2 |
| OUT-FATOR | REGRA CONDICIONAL | IN1-FATOR ou literal '00150' | INPUT1 ou - | STEP010 | INPUT1 copia fator; INPUT2 recebe constante 00150. | 2100-TRATA-IN1 / 3100-TRATA-IN2 |
| OUT-VALOR-BASE | REGRA CONDICIONAL | HV-VALOR-BASE ou ZEROES | APPDB.CLIENTE_MOVTO ou - | - | Valor base DB2 quando encontrado; zero em nao encontrado/erro DB2. | 2100-TRATA-IN1 / 3100-TRATA-IN2 / 7000-TRATA-DB2-NAO-OK |
| OUT-PRECO-DB2 | REGRA CONDICIONAL | HV-PRECO-UNITARIO ou ZEROES | APPDB.CLIENTE_MOVTO ou - | - | Preco unitario DB2 quando encontrado; zero em nao encontrado/erro DB2. | 2100-TRATA-IN1 / 3100-TRATA-IN2 / 7000-TRATA-DB2-NAO-OK |
| OUT-VALOR-CALC | REGRA | HV-VALOR-BASE + IN1-FATOR ou IN2-VALOR-UNIT + HV-FATOR-DB2 | DB2 + INPUT1/INPUT2 | STEP010 / STEP020 | INPUT1 calcula HV-VALOR-BASE * IN1-FATOR; INPUT2 calcula IN2-VALOR-UNIT * HV-FATOR-DB2; zero no tratamento de erro. | 2100-TRATA-IN1 / 3100-TRATA-IN2 / 7000-TRATA-DB2-NAO-OK |
| OUT-TOTAL-GERAL | REGRA | IN1-QTDE/IN2-QUANTIDADE + HV-PRECO-UNITARIO | INPUT1/INPUT2 + DB2 | STEP010 / STEP020 | Calcula quantidade do ramo * preco unitario DB2; zero no tratamento de erro. | 2100-TRATA-IN1 / 3100-TRATA-IN2 / 7000-TRATA-DB2-NAO-OK |
| OUT-HARD1 | HARD-CODE | Literais ORIGEMIN1 / ORIGEMIN2 | - | - | Carimbo tecnico do ramo de origem. | 2100-TRATA-IN1 / 3100-TRATA-IN2 |
| OUT-HARD2 | HARD-CODE | Literais PROCESSA01 / PROCESSA02 | - | - | Carimbo tecnico do processo COBOL. | 2100-TRATA-IN1 / 3100-TRATA-IN2 |
| OUT-HARD3 | HARD-CODE | Literais LE-DB2-I1 / LE-DB2-I2 | - | - | Carimbo tecnico indicando leitura DB2 por ramo. | 2100-TRATA-IN1 / 3100-TRATA-IN2 |
| OUT-MSG | REGRA CONDICIONAL | HV-STATUS-CLIENTE / SQLCODE | DB2 | - | Mensagem depende de status ativo/inativo ou do tratamento de erro DB2. | 2100-TRATA-IN1 / 3100-TRATA-IN2 / 7000-TRATA-DB2-NAO-OK |
| OUT-FILLER | HARD-CODE | INITIALIZE REG-OUT | - | - | Campo fica inicializado sem alimentacao explicita. | 6000-INICIALIZA-SAIDA |
| OUT-HARD-JCL | HARD-CODE | Espacos neste step | - | - | Nao preenchido pelo COBOL; sera carimbado no STEP040. | 6000-INICIALIZA-SAIDA |

**Resumo do step:** CBLDB001 le dois arquivos temporarios, processa cada ramo separadamente, busca dados cadastrais no DB2 por chave de entrada e grava uma saida comum de 300 bytes. Campos de negocio combinam copias diretas, calculos, constantes e regras condicionais baseadas em SQLCODE, status DB2, tipo de registro e indicador.

## [JOB: JCLDB001 / STEP: STEP040 / PGM: SORT]

**Entrada:** DD SORTIN -> DSN=&&TMPOUT03 (copybook: CPYOUT01.cpy)
**Saida:** DD SORTOUT -> DSN=APP.ARQ.SAIDA.CBLDB001 (copybook: CPYOUT01.cpy)
**Job de origem:** JCLDB001 STEP030.

### Ordenacao

| Campo Resolvido | Posicao | Tamanho | Formato | Direcao |
|---|---:|---:|---|---|
| Registro completo | 1 | 300 | COPY | - |

### Remapeamento e Overlay

| Pos. Saida | Tam. | Campo de Origem | Pos. Origem | Tipo de Linhagem |
|---:|---:|---|---:|---|
| 1 | 290 | OUT-ORIGEM ate OUT-FILLER | 1 | DIRETO |
| 291 | 10 | C'JCLBATCH01' | - | HARD-CODE |

**Resumo do step:** preserva o registro produzido pelo COBOL e injeta o literal `JCLBATCH01` em `OUT-HARD-JCL`, posicoes 291-300 do CPYOUT01. Este dataset passa a ser entrada do JCLDB002.

## [JOB: JCLDB002 / STEP: STEP010 / PGM: CBLDB002A]

**Entrada:** DD ENTRADA -> DSN=APP.ARQ.SAIDA.CBLDB001 (copybook: CPYOUT01.cpy)
**Saida:** DD SAIDA1 -> DSN=&&TMPDB201 (copybook: CPYDB201.cpy)
**Job de origem:** JCLDB001 STEP040.

### Campos Gravados em REG-DB201

| Campo de Saida | Tipo de Linhagem | Campo de Origem | Arquivo de Origem | Job de Origem | Transformacao / Condicao | Paragrafo COBOL |
|---|---|---|---|---|---|---|
| P1-CHAVE | DIRETO | OUT-CHAVE | ENTRADA | JCLDB001 STEP040 | MOVE OUT-CHAVE TO P1-CHAVE. | 2100-TRATA-REGISTRO |
| P1-ORIGEM | DIRETO | OUT-ORIGEM | ENTRADA | JCLDB001 STEP040 | MOVE OUT-ORIGEM TO P1-ORIGEM. | 2100-TRATA-REGISTRO |
| P1-NOME | DIRETO | OUT-NOME | ENTRADA | JCLDB001 STEP040 | MOVE OUT-NOME TO P1-NOME. | 2100-TRATA-REGISTRO |
| P1-STATUS | DIRETO | OUT-STATUS | ENTRADA | JCLDB001 STEP040 | MOVE OUT-STATUS TO P1-STATUS. | 2100-TRATA-REGISTRO |
| P1-CATEGORIA | REGRA CONDICIONAL | OUT-STATUS + OUT-TOTAL-GERAL | ENTRADA | JCLDB001 STEP040 | Status A e total > 5000000 => VIP; status A => ATV; senao BLQ. | 2100-TRATA-REGISTRO |
| P1-CANAL-GRUPO | REGRA CONDICIONAL | OUT-CANAL-SAIDA + OUT-ORIGEM | ENTRADA | JCLDB001 STEP040 | Canal WE/AP ou origem 2 => DIGITAL; senao AGENCIA. | 2100-TRATA-REGISTRO |
| P1-FAIXA-TOTAL | REGRA CONDICIONAL | OUT-TOTAL-GERAL | ENTRADA | JCLDB001 STEP040 | Total > 7000000 => A1; > 2000000 => B1; senao C1. | 2100-TRATA-REGISTRO |
| P1-ALERTA | REGRA CONDICIONAL | OUT-OCORRENCIA + OUT-STATUS | ENTRADA | JCLDB001 STEP040 | Ocorrencia 000 e status A => N; senao S. | 2100-TRATA-REGISTRO |
| P1-SCORE | REGRA | OUT-VALOR-CALC + OUT-QTDE | ENTRADA | JCLDB001 STEP040 | COMPUTE WS-SCORE-AUX=(OUT-VALOR-CALC / 100) + OUT-QTDE; MOVE para P1-SCORE. | 2100-TRATA-REGISTRO |
| P1-TOTAL-GERAL | DIRETO | OUT-TOTAL-GERAL | ENTRADA | JCLDB001 STEP040 | MOVE OUT-TOTAL-GERAL TO P1-TOTAL-GERAL. | 2100-TRATA-REGISTRO |
| P1-VALOR-CALC | DIRETO | OUT-VALOR-CALC | ENTRADA | JCLDB001 STEP040 | MOVE OUT-VALOR-CALC TO P1-VALOR-CALC. | 2100-TRATA-REGISTRO |
| P1-OCORRENCIA | DIRETO | OUT-OCORRENCIA | ENTRADA | JCLDB001 STEP040 | MOVE OUT-OCORRENCIA TO P1-OCORRENCIA. | 2100-TRATA-REGISTRO |
| P1-TIPO-SAIDA | DIRETO | OUT-TIPO-SAIDA | ENTRADA | JCLDB001 STEP040 | MOVE OUT-TIPO-SAIDA TO P1-TIPO-SAIDA. | 2100-TRATA-REGISTRO |
| P1-CODIGO-DB2 | DIRETO | OUT-CODIGO-DB2 | ENTRADA | JCLDB001 STEP040 | MOVE OUT-CODIGO-DB2 TO P1-CODIGO-DB2. | 2100-TRATA-REGISTRO |
| P1-DATA-CAD | DIRETO | OUT-DATA-CAD | ENTRADA | JCLDB001 STEP040 | MOVE OUT-DATA-CAD TO P1-DATA-CAD. | 2100-TRATA-REGISTRO |
| P1-MSG-ANALISE | REGRA CONDICIONAL | P1-ALERTA + P1-CATEGORIA | REG-DB201 | JCLDB002 STEP010 | Alerta S => mensagem de revisao; categoria VIP => prioritario; senao padrao. | 2100-TRATA-REGISTRO |
| P1-COD-PROCESSO | HARD-CODE | Literal 'P1-JCLDB2A' | - | - | MOVE 'P1-JCLDB2A' TO P1-COD-PROCESSO. | 2100-TRATA-REGISTRO |
| P1-FILLER | HARD-CODE | INITIALIZE REG-DB201 | - | - | Campo fica inicializado sem alimentacao explicita. | 2100-TRATA-REGISTRO |

**Resumo do step:** transforma a saida operacional de JCLDB001 em um layout analitico P1, carregando campos principais por copia e criando categoria, grupo de canal, faixa, alerta, score e mensagem analitica.

## [JOB: JCLDB002 / STEP: STEP020 / PGM: CBLDB002B]

**Entradas:** INPUTA=`&&TMPDB201` (copybook: CPYDB201.cpy); INPUTB=`APP.INPUT3.COMPLEMENTO` (copybook: CPYIN003.cpy)
**Saida:** SAIDAF=`APP.ARQ.SAIDA.CBLDB002` (copybook: CPYDB202.cpy)
**Job de origem:** INPUTA vem de JCLDB002 STEP010; INPUTB e externo.

### Campos Gravados em REG-DB202

| Campo de Saida | Tipo de Linhagem | Campo de Origem | Arquivo de Origem | Job de Origem | Transformacao / Condicao | Paragrafo COBOL |
|---|---|---|---|---|---|---|
| P2-CHAVE | DIRETO | P1-CHAVE | INPUTA | JCLDB002 STEP010 | MOVE P1-CHAVE TO P2-CHAVE. | 2100-TRATA-REGISTRO |
| P2-ORIGEM | DIRETO | P1-ORIGEM | INPUTA | JCLDB002 STEP010 | MOVE P1-ORIGEM TO P2-ORIGEM. | 2100-TRATA-REGISTRO |
| P2-CATEGORIA-FINAL | REGRA CONDICIONAL | P1-CATEGORIA + IN3-TIPO-CLIENTE + P1-ALERTA + IN3-FLAG-BLOQUEIO | INPUTA + INPUTB | STEP010 + Externo | Match premium sem alerta/bloqueio => PRM; bloqueio => BLK; match comum ou default usa P1-CATEGORIA. | 2200-APLICA-MATCH / 2300-APLICA-DEFAULT |
| P2-SEGMENTO | REGRA CONDICIONAL | IN3-COD-SEGMENTO ou literal '000' | INPUTB ou - | Externo | Se IN3-CHAVE=P1-CHAVE, copia segmento; senao default 000. | 2200-APLICA-MATCH / 2300-APLICA-DEFAULT |
| P2-PRIORIDADE | REGRA CONDICIONAL | IN3-TIPO-CLIENTE + P1-ALERTA + IN3-FLAG-BLOQUEIO | INPUTA + INPUTB | STEP010 + Externo | Premium sem alerta/bloqueio => A; bloqueado => C; match comum => B; sem match => D. | 2200-APLICA-MATCH / 2300-APLICA-DEFAULT |
| P2-DECISAO | REGRA CONDICIONAL | IN3-TIPO-CLIENTE + P1-ALERTA + IN3-FLAG-BLOQUEIO | INPUTA + INPUTB | STEP010 + Externo | Premium sem alerta/bloqueio => APROVAR; bloqueado => BLOQUEAR; match comum => ANALISAR; sem match => MANUAL. | 2200-APLICA-MATCH / 2300-APLICA-DEFAULT |
| P2-CANAL-DESTINO | REGRA CONDICIONAL | P1-CANAL-GRUPO + IN3-CANAL-REF | INPUTA + INPUTB | STEP010 + Externo | DIGITAL => WB; match nao digital usa IN3-CANAL-REF; default nao digital usa AG. | 2200-APLICA-MATCH / 2300-APLICA-DEFAULT |
| P2-FLAG-CROSS | REGRA CONDICIONAL | P1-TOTAL-GERAL + IN3-LIMITE-CRED | INPUTA + INPUTB | STEP010 + Externo | S se total geral excede limite; N caso contrario ou sem match. | 2200-APLICA-MATCH / 2300-APLICA-DEFAULT |
| P2-FLAG-BLOQUEIO | REGRA CONDICIONAL | IN3-FLAG-BLOQUEIO ou literal 'N' | INPUTB ou - | Externo | Copia flag no match; default N sem match. | 2200-APLICA-MATCH / 2300-APLICA-DEFAULT |
| P2-SCORE | DIRETO | P1-SCORE | INPUTA | JCLDB002 STEP010 | MOVE P1-SCORE TO P2-SCORE. | 2100-TRATA-REGISTRO |
| P2-LIMITE-CRED | REGRA CONDICIONAL | IN3-LIMITE-CRED ou ZEROES | INPUTB ou - | Externo | Copia limite no match; zero sem match. | 2200-APLICA-MATCH / 2300-APLICA-DEFAULT |
| P2-VALOR-AJUSTADO | REGRA | P1-VALOR-CALC + IN3-FATOR-AJUSTE | INPUTA + INPUTB | STEP010 + Externo | COMPUTE P2-VALOR-AJUSTADO = P1-VALOR-CALC * IN3-FATOR-AJUSTE; zero sem match. | 2200-APLICA-MATCH / 2300-APLICA-DEFAULT |
| P2-PERC-LIMITE | REGRA CONDICIONAL | P1-TOTAL-GERAL + IN3-LIMITE-CRED | INPUTA + INPUTB | STEP010 + Externo | Se limite > zero, calcula percentual do limite; senao zero. | 2200-APLICA-MATCH / 2300-APLICA-DEFAULT |
| P2-STATUS | DIRETO | P1-STATUS | INPUTA | JCLDB002 STEP010 | MOVE P1-STATUS TO P2-STATUS. | 2100-TRATA-REGISTRO |
| P2-TIPO-SAIDA | DIRETO | P1-TIPO-SAIDA | INPUTA | JCLDB002 STEP010 | MOVE P1-TIPO-SAIDA TO P2-TIPO-SAIDA. | 2100-TRATA-REGISTRO |
| P2-OCORRENCIA | DIRETO | P1-OCORRENCIA | INPUTA | JCLDB002 STEP010 | MOVE P1-OCORRENCIA TO P2-OCORRENCIA. | 2100-TRATA-REGISTRO |
| P2-MSG-FINAL | REGRA CONDICIONAL | Condicao de match | INPUTA + INPUTB | STEP010 + Externo | Match => REGISTRO CRUZADO; sem match => SEM CORRESPONDENCIA. | 2200-APLICA-MATCH / 2300-APLICA-DEFAULT |
| P2-NOME | DIRETO | P1-NOME | INPUTA | JCLDB002 STEP010 | MOVE P1-NOME TO P2-NOME. | 2100-TRATA-REGISTRO |
| P2-CODIGO-DB2 | DIRETO | P1-CODIGO-DB2 | INPUTA | JCLDB002 STEP010 | MOVE P1-CODIGO-DB2 TO P2-CODIGO-DB2. | 2100-TRATA-REGISTRO |
| P2-DATA-REF | REGRA CONDICIONAL | IN3-DATA-REF ou ZEROES | INPUTB ou - | Externo | Copia data de referencia no match; zero sem match. | 2200-APLICA-MATCH / 2300-APLICA-DEFAULT |
| P2-COD-PROCESSO | DIRETO | P1-COD-PROCESSO | INPUTA | JCLDB002 STEP010 | MOVE P1-COD-PROCESSO TO P2-COD-PROCESSO. | 2100-TRATA-REGISTRO |
| P2-FILLER | HARD-CODE | INITIALIZE REG-DB202 | - | - | Campo fica inicializado sem alimentacao explicita. | 2100-TRATA-REGISTRO |

**Resumo do step:** CBLDB002B usa o arquivo P1 como fluxo principal e compara a chave com o registro corrente de INPUT3. Quando ha match, incorpora segmento, limite, fator, canal, tipo e bloqueio do complemento; quando nao ha match, aplica defaults. A saida final publica decisao, prioridade, categoria final, canal de destino, score e indicadores de cruzamento.

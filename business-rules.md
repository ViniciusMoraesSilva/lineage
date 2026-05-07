# Regras de Negocio - Migracao Mainframe para AWS

> Documento gerado pelo Business Rules Agent a partir do codigo-fonte COBOL/JCL.
> Cada secao representa um processo de negocio extraido de um job mainframe.
> Fonte de verdade: o codigo. Este documento e a interpretacao funcional dele.

---

## Resumo Executivo

| Job | Processo | Status | Regras | Pendencias |
|---|---|---|---|---|
| JCLDB001 | Padronizacao e enriquecimento operacional de movimentos | Confirmado | 8 regras | 0 |
| JCLDB002 | Pos-processamento analitico e decisao com complemento cadastral | Confirmado | 10 regras | 0 |

---

## Mapa de Dependencias

JCLDB001 (Padronizacao e enriquecimento operacional de movimentos)
  -> produz: APP.ARQ.SAIDA.CBLDB001
        -> consumido por: JCLDB002 STEP010 (Pos-processamento analitico)
              -> produz: &&TMPDB201
                    -> consumido por: JCLDB002 STEP020 (Cruzamento com complemento)
                          -> produz: APP.ARQ.SAIDA.CBLDB002

---

## Pendencias para o Negocio

| # | Job | Regra | Duvida |
|---|---|---|---|
| *(nenhuma identificada)* | - | - | - |

---

<!-- PROCESSOS DOCUMENTADOS ABAIXO - GERADOS PELO AGENTE -->

---

## Processo: Padronizacao e enriquecimento operacional de movimentos
**Job:** JCLDB001  
**Descricao:** recebe dois arquivos operacionais, prepara os dados, consulta cadastro DB2 por chave de cliente, calcula valores e publica uma saida unica enriquecida.  
**Recebe:** `APP.INPUT1.ORIGINAL`, `APP.INPUT2.ORIGINAL`, tabela `APPDB.CLIENTE_MOVTO`  
**Produz:** `APP.ARQ.SAIDA.CBLDB001`  
**Depende de:** -  
**Consumido por:** JCLDB002  

> **Contexto:** este processo consolida dois tipos de entrada em um layout operacional comum. O primeiro ramo representa movimentos com agencia, conta, quantidade e fator. O segundo ramo representa documentos ou itens com valor unitario, quantidade e indicador. O job consulta dados cadastrais do cliente no DB2, calcula valores financeiros e marca a origem do processamento para rastreabilidade downstream.

### Regra 001 - Preservar INPUT1 para processamento interno

**Categoria:** TRANSFORMACAO  
**Processo:** JCLDB001 / STEP010 / ICEGENER  

**O que faz:**  
Copia o arquivo de movimentos `APP.INPUT1.ORIGINAL` para o temporario `&&TMPIN001` sem alterar campos ou significado. A regra prepara a entrada para o programa principal sem aplicar filtro, calculo ou enriquecimento.

**Condicao:**  
- Para todos os registros de `APP.INPUT1.ORIGINAL`: copiar o registro completo para `&&TMPIN001`.
- Caso o step falhe: o fluxo posterior nao recebe o ramo INPUT1.

**Campos envolvidos:**  
- Entrada: `IN1-CHAVE`, `IN1-TIPO-REG`, `IN1-AGENCIA`, `IN1-CONTA`, `IN1-QTDE`, `IN1-FATOR`, `IN1-COD-OPER`, `IN1-DATA-MOV`, `IN1-CANAL`
- Saida: mesmos campos em `&&TMPIN001`

**Valores de referencia:**  
| Codigo | Significado |
|---|---|
| `ICEGENER` | Copia fisica sem regra funcional adicional |

**Rastreabilidade tecnica:**  
`JCLDB001 / STEP010 / PGM=ICEGENER`, `SYSUT1=APP.INPUT1.ORIGINAL`, `SYSUT2=&&TMPIN001`, `SYSIN DD DUMMY`

**Status:** Confirmado

### Regra 002 - Ordenar INPUT2 por chave e data de referencia

**Categoria:** ORDENACAO  
**Processo:** JCLDB001 / STEP020 / SORT  

**O que faz:**  
Ordena o arquivo de documentos ou itens para estabilizar a sequencia de processamento antes do COBOL principal. A ordenacao usa a chave do cliente e a data de referencia.

**Condicao:**  
- Ordenar todos os registros de `APP.INPUT2.ORIGINAL` por `IN2-CHAVE` ascendente.
- Dentro da mesma chave, ordenar por `IN2-DATA-REF` ascendente.
- Manter o layout original sem alterar campos.

**Campos envolvidos:**  
- Entrada: `IN2-CHAVE`, `IN2-DATA-REF`, registro completo de `CPYIN002`
- Saida: registro completo de `CPYIN002` em `&&TMPIN002`

**Valores de referencia:**  
| Codigo | Significado |
|---|---|
| `SORT FIELDS=(1,10,CH,A,53,8,CH,A)` | Ordena por `IN2-CHAVE` e `IN2-DATA-REF` |

**Rastreabilidade tecnica:**  
`JCLDB001 / STEP020 / SORT FIELDS=(1,10,CH,A,53,8,CH,A)`; campos resolvidos em `CPYIN002.cpy`

**Status:** Confirmado

### Regra 003 - Enriquecer registros com cadastro DB2 por chave do cliente

**Categoria:** ENRIQUECIMENTO  
**Processo:** JCLDB001 / STEP030 / CBLDB001  

**O que faz:**  
Para cada registro dos dois ramos, consulta a tabela `APPDB.CLIENTE_MOVTO` usando a chave recebida na entrada. Quando encontra o cliente, adiciona nome, status, codigo interno, data cadastral, valor base, preco unitario, fator DB2 e canal preferencial ao contexto de processamento.

**Condicao:**  
- Quando `SQLCODE = 0`: usar os valores retornados do DB2 na composicao da saida.
- Quando `SQLCODE = 100`: tratar como cliente nao localizado.
- Quando `SQLCODE` for diferente de `0` e `100`: tratar como erro de acesso DB2.

**Campos envolvidos:**  
- Entrada: `IN1-CHAVE` ou `IN2-CHAVE`
- Lookup: `CHAVE_CLIENTE`, `NOME_CLIENTE`, `STATUS_CLIENTE`, `CODIGO_DB2`, `DATA_CADASTRO`, `VALOR_BASE`, `PRECO_UNITARIO`, `FATOR_DB2`, `CANAL_PREFERENC`
- Saida: `OUT-NOME`, `OUT-STATUS`, `OUT-CODIGO-DB2`, `OUT-DATA-CAD`, `OUT-VALOR-BASE`, `OUT-PRECO-DB2`, `OUT-CANAL-SAIDA`

**Valores de referencia:**  
| Codigo | Significado |
|---|---|
| `SQLCODE = 0` | Cliente encontrado |
| `SQLCODE = 100` | Cliente nao localizado |
| outro `SQLCODE` | Erro DB2 |

**Rastreabilidade tecnica:**  
`CBLDB001 / 5000-BUSCA-DB2`, `SELECT ... FROM APPDB.CLIENTE_MOVTO WHERE CHAVE_CLIENTE = :HV-CHAVE-CLIENTE WITH UR`

**Status:** Confirmado

### Regra 004 - Processar ramo INPUT1 como movimento de cliente

**Categoria:** CALCULO  
**Processo:** JCLDB001 / STEP030 / CBLDB001 / 2100-TRATA-IN1  

**O que faz:**  
Transforma cada movimento do INPUT1 em um registro de saida com origem `1`, preservando agencia, conta, quantidade, fator e canal. Quando o cadastro DB2 e encontrado, calcula o valor ajustado e o total geral com dados cadastrais.

**Condicao:**  
- Quando `SQLCODE = 0`: calcular `OUT-VALOR-CALC = HV-VALOR-BASE * IN1-FATOR`.
- Quando `SQLCODE = 0`: calcular `OUT-TOTAL-GERAL = IN1-QTDE * HV-PRECO-UNITARIO`.
- Quando houver falha de lookup: aplicar a regra de tratamento DB2.

**Campos envolvidos:**  
- Entrada: `IN1-CHAVE`, `IN1-AGENCIA`, `IN1-CONTA`, `IN1-QTDE`, `IN1-FATOR`, `IN1-CANAL`
- Lookup: `HV-VALOR-BASE`, `HV-PRECO-UNITARIO`
- Saida: `OUT-ORIGEM`, `OUT-CHAVE`, `OUT-AGENCIA`, `OUT-CONTA`, `OUT-QTDE`, `OUT-FATOR`, `OUT-CANAL-SAIDA`, `OUT-VALOR-CALC`, `OUT-TOTAL-GERAL`

**Valores de referencia:**  
| Codigo | Significado |
|---|---|
| `OUT-ORIGEM = '1'` | Registro originado do INPUT1 |
| `ORIGEMIN1` | Marcador tecnico do ramo INPUT1 |
| `PROCESSA01` | Marcador tecnico do processamento do ramo INPUT1 |

**Rastreabilidade tecnica:**  
`CBLDB001 / 2100-TRATA-IN1`

**Status:** Confirmado

### Regra 005 - Classificar tipo, ocorrencia e mensagem no ramo INPUT1

**Categoria:** CLASSIFICACAO  
**Processo:** JCLDB001 / STEP030 / CBLDB001 / 2100-TRATA-IN1  

**O que faz:**  
Classifica o registro do INPUT1 conforme o tipo de registro e o status cadastral do cliente. Essa classificacao direciona o codigo de saida, a ocorrencia e a mensagem operacional.

**Condicao:**  
- Quando `IN1-TIPO-REG = 'A'`: `OUT-TIPO-SAIDA = 'A1'` e `OUT-OCORRENCIA = '000'`.
- Caso contrario: `OUT-TIPO-SAIDA = 'A2'` e `OUT-OCORRENCIA = '010'`.
- Quando `HV-STATUS-CLIENTE = 'A'`: mensagem de cliente ativo processado no INPUT1.
- Caso contrario: mensagem de cliente inativo processado no INPUT1.

**Campos envolvidos:**  
- Entrada: `IN1-TIPO-REG`, `HV-STATUS-CLIENTE`
- Saida: `OUT-TIPO-SAIDA`, `OUT-OCORRENCIA`, `OUT-MSG`

**Valores de referencia:**  
| Codigo | Significado |
|---|---|
| `A1` | Tipo de saida do INPUT1 para tipo `A` |
| `A2` | Tipo de saida do INPUT1 para demais tipos |
| `000` | Ocorrencia sem alerta funcional |
| `010` | Ocorrencia alternativa do INPUT1 |

**Rastreabilidade tecnica:**  
`CBLDB001 / 2100-TRATA-IN1`

**Status:** Confirmado

### Regra 006 - Processar ramo INPUT2 como documento ou item operacional

**Categoria:** CALCULO  
**Processo:** JCLDB001 / STEP030 / CBLDB001 / 3100-TRATA-IN2  

**O que faz:**  
Transforma cada registro do INPUT2 em um registro de saida com origem `2`, preservando documento e quantidade. O ramo inicia com canal padrao `B2`, mas quando o cliente e encontrado no DB2 o canal preferencial cadastral substitui o padrao.

**Condicao:**  
- Sempre marcar `OUT-ORIGEM = '2'`.
- Sempre mover `IN2-DOCUMENTO` para `OUT-DOCUMENTO` e `IN2-QUANTIDADE` para `OUT-QTDE`.
- Sempre atribuir `OUT-FATOR = '00150'`.
- Quando `SQLCODE = 0`: substituir `OUT-CANAL-SAIDA` por `HV-CANAL-PREFERENC`.
- Quando `SQLCODE = 0`: calcular `OUT-VALOR-CALC = IN2-VALOR-UNIT * HV-FATOR-DB2`.
- Quando `SQLCODE = 0`: calcular `OUT-TOTAL-GERAL = IN2-QUANTIDADE * HV-PRECO-UNITARIO`.

**Campos envolvidos:**  
- Entrada: `IN2-CHAVE`, `IN2-DOCUMENTO`, `IN2-VALOR-UNIT`, `IN2-QUANTIDADE`, `IN2-INDICADOR`
- Lookup: `HV-FATOR-DB2`, `HV-PRECO-UNITARIO`, `HV-CANAL-PREFERENC`
- Saida: `OUT-ORIGEM`, `OUT-CHAVE`, `OUT-DOCUMENTO`, `OUT-QTDE`, `OUT-FATOR`, `OUT-CANAL-SAIDA`, `OUT-VALOR-CALC`, `OUT-TOTAL-GERAL`

**Valores de referencia:**  
| Codigo | Significado |
|---|---|
| `OUT-ORIGEM = '2'` | Registro originado do INPUT2 |
| `OUT-FATOR = '00150'` | Fator fixo do ramo INPUT2 |
| `ORIGEMIN2` | Marcador tecnico do ramo INPUT2 |
| `PROCESSA02` | Marcador tecnico do processamento do ramo INPUT2 |

**Rastreabilidade tecnica:**  
`CBLDB001 / 3100-TRATA-IN2`

**Status:** Confirmado

### Regra 007 - Classificar tipo, ocorrencia e tratamento DB2 do ramo INPUT2

**Categoria:** CLASSIFICACAO  
**Processo:** JCLDB001 / STEP030 / CBLDB001 / 3100-TRATA-IN2 e 7000-TRATA-DB2-NAO-OK  

**O que faz:**  
Classifica o registro do INPUT2 pelo indicador de entrada e aplica tratamento padronizado para cliente nao localizado ou erro DB2. A regra evita descarte silencioso: registros com falha de lookup continuam na saida com codigos explicitos.

**Condicao:**  
- Quando `IN2-INDICADOR = 'S'`: `OUT-TIPO-SAIDA = 'B1'` e `OUT-OCORRENCIA = '000'`.
- Caso contrario: `OUT-TIPO-SAIDA = 'B2'` e `OUT-OCORRENCIA = '020'`.
- Quando `SQLCODE = 100`: `OUT-TIPO-SAIDA = 'ND'`, `OUT-OCORRENCIA = '404'`, `OUT-STATUS = 'N'`, valores numericos zerados e mensagem de nao localizado.
- Quando outro erro DB2 ocorre: `OUT-TIPO-SAIDA = 'ER'`, `OUT-OCORRENCIA = '999'`, `OUT-STATUS = 'E'`, codigo `99999`, valores numericos zerados e mensagem de erro DB2.

**Campos envolvidos:**  
- Entrada: `IN2-INDICADOR`, `SQLCODE`
- Saida: `OUT-TIPO-SAIDA`, `OUT-OCORRENCIA`, `OUT-STATUS`, `OUT-CODIGO-DB2`, `OUT-MSG`, `OUT-VALOR-BASE`, `OUT-PRECO-DB2`, `OUT-VALOR-CALC`, `OUT-TOTAL-GERAL`

**Valores de referencia:**  
| Codigo | Significado |
|---|---|
| `B1` | Tipo de saida do INPUT2 para indicador `S` |
| `B2` | Tipo de saida do INPUT2 para demais indicadores |
| `ND` / `404` | Cliente nao localizado |
| `ER` / `999` | Erro de acesso DB2 |

**Rastreabilidade tecnica:**  
`CBLDB001 / 3100-TRATA-IN2`; `CBLDB001 / 7000-TRATA-DB2-NAO-OK`

**Status:** Confirmado

### Regra 008 - Carimbar a saida final do JCLDB001

**Categoria:** ENRIQUECIMENTO  
**Processo:** JCLDB001 / STEP040 / SORT  

**O que faz:**  
Preserva a saida produzida pelo COBOL e injeta um marcador tecnico de batch nas posicoes finais do registro. Esse carimbo identifica a geracao final do arquivo que sera consumido pelo proximo job.

**Condicao:**  
- Copiar todos os registros de `&&TMPOUT03`.
- Manter o registro completo com `INREC BUILD=(1,300)`.
- Sobrepor a posicao 291 com `JCLBATCH01`.

**Campos envolvidos:**  
- Entrada: registro `REG-OUT`
- Saida: `OUT-HARD-JCL`

**Valores de referencia:**  
| Codigo | Significado |
|---|---|
| `JCLBATCH01` | Identificador tecnico da finalizacao do batch |

**Rastreabilidade tecnica:**  
`JCLDB001 / STEP040 / SORT FIELDS=COPY / OUTREC OVERLAY=(291:C'JCLBATCH01')`

**Status:** Confirmado

### Divergencias com Documentacao Existente

Nao foram identificadas divergencias materiais em relacao a `docs/JCLDB001-documentacao.md`. A documentacao existente esta mais detalhada em lineage e exemplos; este arquivo consolida as regras em formato funcional para migracao.

---

## Processo: Pos-processamento analitico e decisao com complemento cadastral
**Job:** JCLDB002  
**Descricao:** consome a saida do JCLDB001, cria classificacoes analiticas intermediarias e cruza o resultado com um arquivo complementar para gerar decisao, prioridade, canal destino e indicadores finais.  
**Recebe:** `APP.ARQ.SAIDA.CBLDB001`, `APP.INPUT3.COMPLEMENTO`  
**Produz:** `APP.ARQ.SAIDA.CBLDB002`  
**Depende de:** JCLDB001  
**Consumido por:** Downstream  

> **Contexto:** este processo representa o pos-processamento da saida operacional enriquecida. Primeiro ele transforma os dados do JCLDB001 em um layout analitico P1. Depois cruza esse P1 com informacoes complementares por chave, produzindo um arquivo final com categoria, prioridade, decisao, canal de destino, indicadores de bloqueio e metricas ajustadas.

### Regra 009 - Criar layout analitico P1 a partir da saida operacional

**Categoria:** TRANSFORMACAO  
**Processo:** JCLDB002 / STEP010 / CBLDB002A  

**O que faz:**  
Le `APP.ARQ.SAIDA.CBLDB001` e cria o temporario `&&TMPDB201`, preservando campos essenciais da saida operacional e preparando campos analiticos para decisao posterior.

**Condicao:**  
- Para cada registro de entrada: copiar chave, origem, nome, status, total geral, valor calculado, ocorrencia, tipo de saida, codigo DB2 e data cadastral para o layout P1.
- Sempre atribuir `P1-COD-PROCESSO = 'P1-JCLDB2A'`.

**Campos envolvidos:**  
- Entrada: `OUT-CHAVE`, `OUT-ORIGEM`, `OUT-NOME`, `OUT-STATUS`, `OUT-TOTAL-GERAL`, `OUT-VALOR-CALC`, `OUT-OCORRENCIA`, `OUT-TIPO-SAIDA`, `OUT-CODIGO-DB2`, `OUT-DATA-CAD`
- Saida: `P1-CHAVE`, `P1-ORIGEM`, `P1-NOME`, `P1-STATUS`, `P1-TOTAL-GERAL`, `P1-VALOR-CALC`, `P1-OCORRENCIA`, `P1-TIPO-SAIDA`, `P1-CODIGO-DB2`, `P1-DATA-CAD`, `P1-COD-PROCESSO`

**Valores de referencia:**  
| Codigo | Significado |
|---|---|
| `P1-JCLDB2A` | Identificador tecnico do primeiro pos-processamento |

**Rastreabilidade tecnica:**  
`CBLDB002A / 2100-TRATA-REGISTRO`

**Status:** Confirmado

### Regra 010 - Classificar categoria analitica do cliente

**Categoria:** CLASSIFICACAO  
**Processo:** JCLDB002 / STEP010 / CBLDB002A  

**O que faz:**  
Classifica o cliente como prioritario, ativo comum ou bloqueado conforme status e total financeiro. Essa categoria alimenta a decisao final no STEP020.

**Condicao:**  
- Quando `OUT-STATUS = 'A'` e `OUT-TOTAL-GERAL > 0000005000000`: `P1-CATEGORIA = 'VIP'`.
- Quando `OUT-STATUS = 'A'` e o total nao ultrapassa o limite VIP: `P1-CATEGORIA = 'ATV'`.
- Quando `OUT-STATUS` nao e ativo: `P1-CATEGORIA = 'BLQ'`.

**Campos envolvidos:**  
- Entrada: `OUT-STATUS`, `OUT-TOTAL-GERAL`
- Saida: `P1-CATEGORIA`

**Valores de referencia:**  
| Codigo | Significado |
|---|---|
| `VIP` | Cliente ativo com total acima do limite prioritario |
| `ATV` | Cliente ativo comum |
| `BLQ` | Cliente nao ativo ou bloqueado para analise |

**Rastreabilidade tecnica:**  
`CBLDB002A / 2100-TRATA-REGISTRO`

**Status:** Confirmado

### Regra 011 - Definir grupo de canal, faixa de total e alerta

**Categoria:** CLASSIFICACAO  
**Processo:** JCLDB002 / STEP010 / CBLDB002A  

**O que faz:**  
Agrupa o canal, classifica o valor total em faixas e indica se o registro precisa de revisao. Essas classificacoes simplificam a decisao do proximo step.

**Condicao:**  
- Quando `OUT-CANAL-SAIDA = 'WE'` ou `OUT-CANAL-SAIDA = 'AP'` ou `OUT-ORIGEM = '2'`: `P1-CANAL-GRUPO = 'DIGITAL '`.
- Caso contrario: `P1-CANAL-GRUPO = 'AGENCIA '`.
- Quando `OUT-TOTAL-GERAL > 0000007000000`: `P1-FAIXA-TOTAL = 'A1'`.
- Quando `OUT-TOTAL-GERAL > 0000002000000` e nao ultrapassa o limite A1: `P1-FAIXA-TOTAL = 'B1'`.
- Caso contrario: `P1-FAIXA-TOTAL = 'C1'`.
- Quando `OUT-OCORRENCIA = '000'` e `OUT-STATUS = 'A'`: `P1-ALERTA = 'N'`.
- Caso contrario: `P1-ALERTA = 'S'`.

**Campos envolvidos:**  
- Entrada: `OUT-CANAL-SAIDA`, `OUT-ORIGEM`, `OUT-TOTAL-GERAL`, `OUT-OCORRENCIA`, `OUT-STATUS`
- Saida: `P1-CANAL-GRUPO`, `P1-FAIXA-TOTAL`, `P1-ALERTA`

**Valores de referencia:**  
| Codigo | Significado |
|---|---|
| `DIGITAL` | Canal web/app ou ramo de origem 2 |
| `AGENCIA` | Atendimento nao digital |
| `A1`, `B1`, `C1` | Faixas decrescentes de total financeiro |
| `P1-ALERTA = 'S'` | Registro exige revisao |

**Rastreabilidade tecnica:**  
`CBLDB002A / 2100-TRATA-REGISTRO`

**Status:** Confirmado

### Regra 012 - Calcular score e mensagem analitica P1

**Categoria:** CALCULO  
**Processo:** JCLDB002 / STEP010 / CBLDB002A  

**O que faz:**  
Calcula um score simples combinando valor calculado e quantidade, e gera uma mensagem de analise conforme alerta e categoria. A mensagem torna o resultado intermediario mais legivel para operacao ou consumo downstream.

**Condicao:**  
- Sempre calcular `P1-SCORE = (OUT-VALOR-CALC / 100) + OUT-QTDE`.
- Quando `P1-ALERTA = 'S'`: mensagem de revisao.
- Quando nao ha alerta e `P1-CATEGORIA = 'VIP'`: mensagem de cliente prioritario liberado.
- Caso contrario: mensagem de cliente padrao pos-processado.

**Campos envolvidos:**  
- Entrada: `OUT-VALOR-CALC`, `OUT-QTDE`, `P1-ALERTA`, `P1-CATEGORIA`
- Saida: `P1-SCORE`, `P1-MSG-ANALISE`

**Valores de referencia:**  
| Codigo | Significado |
|---|---|
| `REGRA COM ALERTA PARA REVISAO` | Registro nao liberado automaticamente |
| `CLIENTE PRIORITARIO LIBERADO` | Registro VIP sem alerta |
| `CLIENTE PADRAO POS PROCESSADO` | Registro padrao sem alerta |

**Rastreabilidade tecnica:**  
`CBLDB002A / 2100-TRATA-REGISTRO`

**Status:** Confirmado

### Regra 013 - Cruzar P1 com arquivo complementar por chave

**Categoria:** ENRIQUECIMENTO  
**Processo:** JCLDB002 / STEP020 / CBLDB002B  

**O que faz:**  
Compara a chave do registro P1 com a chave corrente do arquivo complementar. Quando ha correspondencia, incorpora segmento, bloqueio, limite, data de referencia, fator de ajuste e canal de referencia ao registro final.

**Condicao:**  
- Quando `NOT FIM-B` e `IN3-CHAVE = P1-CHAVE`: aplicar regra de match e ler o proximo registro do complemento.
- Caso contrario: aplicar defaults de sem correspondencia.

**Campos envolvidos:**  
- Entrada: `P1-CHAVE`, `IN3-CHAVE`, `IN3-COD-SEGMENTO`, `IN3-FLAG-BLOQUEIO`, `IN3-LIMITE-CRED`, `IN3-DATA-REF`, `IN3-FATOR-AJUSTE`, `IN3-CANAL-REF`
- Saida: `P2-SEGMENTO`, `P2-FLAG-BLOQUEIO`, `P2-LIMITE-CRED`, `P2-DATA-REF`, `P2-VALOR-AJUSTADO`, `P2-CANAL-DESTINO`

**Valores de referencia:**  
| Codigo | Significado |
|---|---|
| `IN3-CHAVE = P1-CHAVE` | Complemento encontrado para o registro P1 |
| `REGISTRO CRUZADO COM INPUT3 COMPLEMENTAR` | Mensagem final de match |

**Rastreabilidade tecnica:**  
`CBLDB002B / 2100-TRATA-REGISTRO`; `CBLDB002B / 2200-APLICA-MATCH`

**Status:** Confirmado

### Regra 014 - Calcular valor ajustado, percentual de limite e flag de cross

**Categoria:** CALCULO  
**Processo:** JCLDB002 / STEP020 / CBLDB002B / 2200-APLICA-MATCH  

**O que faz:**  
Quando ha match com complemento, calcula o valor ajustado pelo fator externo, mede quanto o total consome do limite e sinaliza se o total ultrapassa o limite de credito.

**Condicao:**  
- Sempre calcular `P2-VALOR-AJUSTADO = P1-VALOR-CALC * IN3-FATOR-AJUSTE`.
- Quando `IN3-LIMITE-CRED > ZEROES`: calcular `P2-PERC-LIMITE = (P1-TOTAL-GERAL / IN3-LIMITE-CRED) * 100`.
- Quando `IN3-LIMITE-CRED` nao for maior que zero: `P2-PERC-LIMITE = 0`.
- Quando `P1-TOTAL-GERAL > IN3-LIMITE-CRED`: `P2-FLAG-CROSS = 'S'`.
- Caso contrario: `P2-FLAG-CROSS = 'N'`.

**Campos envolvidos:**  
- Entrada: `P1-VALOR-CALC`, `IN3-FATOR-AJUSTE`, `P1-TOTAL-GERAL`, `IN3-LIMITE-CRED`
- Saida: `P2-VALOR-AJUSTADO`, `P2-PERC-LIMITE`, `P2-FLAG-CROSS`

**Valores de referencia:**  
| Codigo | Significado |
|---|---|
| `P2-FLAG-CROSS = 'S'` | Total acima do limite complementar |
| `P2-FLAG-CROSS = 'N'` | Total dentro do limite ou sem excesso |

**Rastreabilidade tecnica:**  
`CBLDB002B / 2200-APLICA-MATCH`

**Status:** Confirmado

### Regra 015 - Definir canal destino final

**Categoria:** CLASSIFICACAO  
**Processo:** JCLDB002 / STEP020 / CBLDB002B  

**O que faz:**  
Define o canal de destino final a partir do grupo de canal P1 e, quando aplicavel, do canal de referencia do complemento. Canais digitais sao direcionados para web, enquanto registros nao digitais usam referencia externa ou agencia.

**Condicao:**  
- No match, quando `P1-CANAL-GRUPO = 'DIGITAL '`: `P2-CANAL-DESTINO = 'WB'`.
- No match, quando nao e digital: `P2-CANAL-DESTINO = IN3-CANAL-REF`.
- Sem match, quando `P1-CANAL-GRUPO = 'DIGITAL '`: `P2-CANAL-DESTINO = 'WB'`.
- Sem match, quando nao e digital: `P2-CANAL-DESTINO = 'AG'`.

**Campos envolvidos:**  
- Entrada: `P1-CANAL-GRUPO`, `IN3-CANAL-REF`
- Saida: `P2-CANAL-DESTINO`

**Valores de referencia:**  
| Codigo | Significado |
|---|---|
| `WB` | Canal web/digital final |
| `AG` | Canal agencia default sem complemento |

**Rastreabilidade tecnica:**  
`CBLDB002B / 2200-APLICA-MATCH`; `CBLDB002B / 2300-APLICA-DEFAULT`

**Status:** Confirmado

### Regra 016 - Decidir prioridade, aprovacao e categoria final

**Categoria:** CLASSIFICACAO  
**Processo:** JCLDB002 / STEP020 / CBLDB002B / 2200-APLICA-MATCH  

**O que faz:**  
Define a prioridade operacional e a decisao final quando ha complemento. Clientes premium sem alerta e sem bloqueio sao aprovados com prioridade alta; bloqueados sao direcionados para bloqueio; os demais seguem para analise.

**Condicao:**  
- Quando `IN3-TIPO-CLIENTE = 'P'`, `P1-ALERTA = 'N'` e `IN3-FLAG-BLOQUEIO NOT = 'S'`: `P2-PRIORIDADE = 'A'`, `P2-DECISAO = 'APROVAR'`, `P2-CATEGORIA-FINAL = 'PRM'`.
- Quando `IN3-FLAG-BLOQUEIO = 'S'`: `P2-PRIORIDADE = 'C'`, `P2-DECISAO = 'BLOQUEAR'`, `P2-CATEGORIA-FINAL = 'BLK'`.
- Caso contrario: `P2-PRIORIDADE = 'B'`, `P2-DECISAO = 'ANALISAR'`, `P2-CATEGORIA-FINAL = P1-CATEGORIA`.

**Campos envolvidos:**  
- Entrada: `IN3-TIPO-CLIENTE`, `P1-ALERTA`, `IN3-FLAG-BLOQUEIO`, `P1-CATEGORIA`
- Saida: `P2-PRIORIDADE`, `P2-DECISAO`, `P2-CATEGORIA-FINAL`

**Valores de referencia:**  
| Codigo | Significado |
|---|---|
| `A` / `APROVAR` / `PRM` | Premium sem alerta e sem bloqueio |
| `C` / `BLOQUEAR` / `BLK` | Registro bloqueado no complemento |
| `B` / `ANALISAR` | Match comum que exige analise |

**Rastreabilidade tecnica:**  
`CBLDB002B / 2200-APLICA-MATCH`

**Status:** Confirmado

### Regra 017 - Aplicar defaults quando nao ha complemento

**Categoria:** ENRIQUECIMENTO  
**Processo:** JCLDB002 / STEP020 / CBLDB002B / 2300-APLICA-DEFAULT  

**O que faz:**  
Quando nao existe correspondencia no arquivo complementar, o processo nao descarta o registro P1. Ele gera uma saida final com defaults controlados e decisao manual.

**Condicao:**  
- Quando nao ha match com `INPUT3`: incrementar contador de sem match.
- Atribuir `P2-SEGMENTO = '000'`, `P2-FLAG-BLOQUEIO = 'N'`, `P2-FLAG-CROSS = 'N'`.
- Zerar `P2-LIMITE-CRED`, `P2-VALOR-AJUSTADO`, `P2-PERC-LIMITE` e `P2-DATA-REF`.
- Atribuir `P2-PRIORIDADE = 'D'`, `P2-DECISAO = 'MANUAL'`, `P2-CATEGORIA-FINAL = P1-CATEGORIA`.
- Gravar mensagem de sem correspondencia.

**Campos envolvidos:**  
- Entrada: `P1-CATEGORIA`, `P1-CANAL-GRUPO`
- Saida: `P2-SEGMENTO`, `P2-FLAG-BLOQUEIO`, `P2-LIMITE-CRED`, `P2-VALOR-AJUSTADO`, `P2-PERC-LIMITE`, `P2-DATA-REF`, `P2-FLAG-CROSS`, `P2-PRIORIDADE`, `P2-DECISAO`, `P2-CATEGORIA-FINAL`, `P2-MSG-FINAL`

**Valores de referencia:**  
| Codigo | Significado |
|---|---|
| `D` / `MANUAL` | Sem complemento; exige tratamento manual |
| `000` | Segmento default sem match |
| `SEM CORRESPONDENCIA NO INPUT3 COMPLEMENTAR` | Mensagem final de sem match |

**Rastreabilidade tecnica:**  
`CBLDB002B / 2300-APLICA-DEFAULT`

**Status:** Confirmado

### Regra 018 - Propagar identificadores e atributos principais para saida final

**Categoria:** TRANSFORMACAO  
**Processo:** JCLDB002 / STEP020 / CBLDB002B / 2100-TRATA-REGISTRO  

**O que faz:**  
Antes de aplicar match ou default, o programa preserva na saida final os principais identificadores e atributos analiticos gerados no P1. Isso garante que a decisao final continue rastreavel ate a saida do JCLDB001.

**Condicao:**  
- Para cada registro P1 lido: copiar chave, origem, nome, status, tipo de saida, ocorrencia, codigo DB2, score e codigo de processo para o registro P2.
- Depois aplicar regra de match ou default para completar os campos finais.

**Campos envolvidos:**  
- Entrada: `P1-CHAVE`, `P1-ORIGEM`, `P1-NOME`, `P1-STATUS`, `P1-TIPO-SAIDA`, `P1-OCORRENCIA`, `P1-CODIGO-DB2`, `P1-SCORE`, `P1-COD-PROCESSO`
- Saida: `P2-CHAVE`, `P2-ORIGEM`, `P2-NOME`, `P2-STATUS`, `P2-TIPO-SAIDA`, `P2-OCORRENCIA`, `P2-CODIGO-DB2`, `P2-SCORE`, `P2-COD-PROCESSO`

**Valores de referencia:**  
| Codigo | Significado |
|---|---|
| `P2-*` | Layout final de saida do JCLDB002 |

**Rastreabilidade tecnica:**  
`CBLDB002B / 2100-TRATA-REGISTRO`

**Status:** Confirmado

### Divergencias com Documentacao Existente

Nao foram identificadas divergencias materiais em relacao a `docs/JCLDB002-documentacao.md`. Este arquivo organiza as mesmas evidencias em formato de regras funcionais para migracao.

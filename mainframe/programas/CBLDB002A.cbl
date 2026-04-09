       IDENTIFICATION DIVISION.
       PROGRAM-ID. CBLDB002A.

       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT ENTRADA ASSIGN TO ENTRADA
               ORGANIZATION IS SEQUENTIAL
               ACCESS MODE IS SEQUENTIAL
               FILE STATUS IS WS-FS-IN.
           SELECT SAIDA1 ASSIGN TO SAIDA1
               ORGANIZATION IS SEQUENTIAL
               ACCESS MODE IS SEQUENTIAL
               FILE STATUS IS WS-FS-OUT.

       DATA DIVISION.
       FILE SECTION.
       FD  ENTRADA
           RECORDING MODE IS F
           RECORD CONTAINS 300 CHARACTERS.
       COPY CPYOUT01.

       FD  SAIDA1
           RECORDING MODE IS F
           RECORD CONTAINS 320 CHARACTERS.
       COPY CPYDB201.

       WORKING-STORAGE SECTION.
       01  WS-FS-IN                 PIC X(02) VALUE SPACES.
       01  WS-FS-OUT                PIC X(02) VALUE SPACES.
       01  WS-EOF                   PIC X(01) VALUE 'N'.
           88 FIM-ENTRADA                      VALUE 'S'.

       01  WS-CONTROLE.
           05 WS-LIDOS              PIC 9(07) VALUE ZERO.
           05 WS-GRAVADOS           PIC 9(07) VALUE ZERO.

       01  WS-SCORE-AUX             PIC 9(07)V99 VALUE ZERO.

       PROCEDURE DIVISION.
       0000-PRINCIPAL.
           PERFORM 1000-INICIALIZA
           PERFORM 2000-PROCESSA
           PERFORM 9000-FINALIZA
           GOBACK.

       1000-INICIALIZA.
           OPEN INPUT ENTRADA
                OUTPUT SAIDA1

           IF WS-FS-IN NOT = '00'
               DISPLAY 'ERRO OPEN ENTRADA. FILE STATUS=' WS-FS-IN
               GOBACK
           END-IF

           IF WS-FS-OUT NOT = '00'
               DISPLAY 'ERRO OPEN SAIDA1. FILE STATUS=' WS-FS-OUT
               GOBACK
           END-IF.

       2000-PROCESSA.
           PERFORM UNTIL FIM-ENTRADA
               READ ENTRADA
                   AT END
                       SET FIM-ENTRADA TO TRUE
                   NOT AT END
                       ADD 1 TO WS-LIDOS
                       PERFORM 2100-TRATA-REGISTRO
               END-READ
           END-PERFORM.

       2100-TRATA-REGISTRO.
           INITIALIZE REG-DB201

           MOVE OUT-CHAVE        TO P1-CHAVE
           MOVE OUT-ORIGEM       TO P1-ORIGEM
           MOVE OUT-NOME         TO P1-NOME
           MOVE OUT-STATUS       TO P1-STATUS
           MOVE OUT-TOTAL-GERAL  TO P1-TOTAL-GERAL
           MOVE OUT-VALOR-CALC   TO P1-VALOR-CALC
           MOVE OUT-OCORRENCIA   TO P1-OCORRENCIA
           MOVE OUT-TIPO-SAIDA   TO P1-TIPO-SAIDA
           MOVE OUT-CODIGO-DB2   TO P1-CODIGO-DB2
           MOVE OUT-DATA-CAD     TO P1-DATA-CAD
           MOVE 'P1-JCLDB2A'     TO P1-COD-PROCESSO

           IF OUT-STATUS = 'A'
               IF OUT-TOTAL-GERAL > 0000005000000
                   MOVE 'VIP' TO P1-CATEGORIA
               ELSE
                   MOVE 'ATV' TO P1-CATEGORIA
               END-IF
           ELSE
               MOVE 'BLQ' TO P1-CATEGORIA
           END-IF

           IF OUT-CANAL-SAIDA = 'WE' OR
              OUT-CANAL-SAIDA = 'AP' OR
              OUT-ORIGEM = '2'
               MOVE 'DIGITAL ' TO P1-CANAL-GRUPO
           ELSE
               MOVE 'AGENCIA ' TO P1-CANAL-GRUPO
           END-IF

           IF OUT-TOTAL-GERAL > 0000007000000
               MOVE 'A1' TO P1-FAIXA-TOTAL
           ELSE
               IF OUT-TOTAL-GERAL > 0000002000000
                   MOVE 'B1' TO P1-FAIXA-TOTAL
               ELSE
                   MOVE 'C1' TO P1-FAIXA-TOTAL
               END-IF
           END-IF

           IF OUT-OCORRENCIA = '000' AND OUT-STATUS = 'A'
               MOVE 'N' TO P1-ALERTA
           ELSE
               MOVE 'S' TO P1-ALERTA
           END-IF

           COMPUTE WS-SCORE-AUX = (OUT-VALOR-CALC / 100) + OUT-QTDE
           MOVE WS-SCORE-AUX TO P1-SCORE

           IF P1-ALERTA = 'S'
               MOVE 'REGRA COM ALERTA PARA REVISAO          '
                 TO P1-MSG-ANALISE
           ELSE
               IF P1-CATEGORIA = 'VIP'
                   MOVE 'CLIENTE PRIORITARIO LIBERADO        '
                     TO P1-MSG-ANALISE
               ELSE
                   MOVE 'CLIENTE PADRAO POS PROCESSADO       '
                     TO P1-MSG-ANALISE
               END-IF
           END-IF

           WRITE REG-DB201
           ADD 1 TO WS-GRAVADOS.

       9000-FINALIZA.
           CLOSE ENTRADA
                 SAIDA1

           DISPLAY 'CBLDB002A REGISTROS LIDOS     = ' WS-LIDOS
           DISPLAY 'CBLDB002A REGISTROS GRAVADOS  = ' WS-GRAVADOS.


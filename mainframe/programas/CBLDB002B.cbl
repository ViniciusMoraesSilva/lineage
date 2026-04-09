       IDENTIFICATION DIVISION.
       PROGRAM-ID. CBLDB002B.

       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT INPUTA ASSIGN TO INPUTA
               ORGANIZATION IS SEQUENTIAL
               ACCESS MODE IS SEQUENTIAL
               FILE STATUS IS WS-FS-A.
           SELECT INPUTB ASSIGN TO INPUTB
               ORGANIZATION IS SEQUENTIAL
               ACCESS MODE IS SEQUENTIAL
               FILE STATUS IS WS-FS-B.
           SELECT SAIDAF ASSIGN TO SAIDAF
               ORGANIZATION IS SEQUENTIAL
               ACCESS MODE IS SEQUENTIAL
               FILE STATUS IS WS-FS-OUT.

       DATA DIVISION.
       FILE SECTION.
       FD  INPUTA
           RECORDING MODE IS F
           RECORD CONTAINS 320 CHARACTERS.
       COPY CPYDB201.

       FD  INPUTB
           RECORDING MODE IS F
           RECORD CONTAINS 80 CHARACTERS.
       COPY CPYIN003.

       FD  SAIDAF
           RECORDING MODE IS F
           RECORD CONTAINS 360 CHARACTERS.
       COPY CPYDB202.

       WORKING-STORAGE SECTION.
       01  WS-FS-A                  PIC X(02) VALUE SPACES.
       01  WS-FS-B                  PIC X(02) VALUE SPACES.
       01  WS-FS-OUT                PIC X(02) VALUE SPACES.

       01  WS-FLAGS.
           05 WS-EOF-A              PIC X(01) VALUE 'N'.
              88 FIM-A                         VALUE 'S'.
           05 WS-EOF-B              PIC X(01) VALUE 'N'.
              88 FIM-B                         VALUE 'S'.

       01  WS-CONTROLE.
           05 WS-LIDOS-A            PIC 9(07) VALUE ZERO.
           05 WS-LIDOS-B            PIC 9(07) VALUE ZERO.
           05 WS-GRAVADOS           PIC 9(07) VALUE ZERO.
           05 WS-SEM-MATCH          PIC 9(07) VALUE ZERO.

       01  WS-PERC-AUX              PIC 9(03)V99 VALUE ZERO.

       PROCEDURE DIVISION.
       0000-PRINCIPAL.
           PERFORM 1000-INICIALIZA
           PERFORM 2000-PROCESSA
           PERFORM 9000-FINALIZA
           GOBACK.

       1000-INICIALIZA.
           OPEN INPUT INPUTA
                INPUT INPUTB
                OUTPUT SAIDAF

           IF WS-FS-A NOT = '00'
               DISPLAY 'ERRO OPEN INPUTA. FILE STATUS=' WS-FS-A
               GOBACK
           END-IF

           IF WS-FS-B NOT = '00'
               DISPLAY 'ERRO OPEN INPUTB. FILE STATUS=' WS-FS-B
               GOBACK
           END-IF

           IF WS-FS-OUT NOT = '00'
               DISPLAY 'ERRO OPEN SAIDAF. FILE STATUS=' WS-FS-OUT
               GOBACK
           END-IF

           PERFORM 1100-LE-INPUTB.

       1100-LE-INPUTB.
           READ INPUTB
               AT END
                   SET FIM-B TO TRUE
               NOT AT END
                   ADD 1 TO WS-LIDOS-B
           END-READ.

       2000-PROCESSA.
           PERFORM UNTIL FIM-A
               READ INPUTA
                   AT END
                       SET FIM-A TO TRUE
                   NOT AT END
                       ADD 1 TO WS-LIDOS-A
                       PERFORM 2100-TRATA-REGISTRO
               END-READ
           END-PERFORM.

       2100-TRATA-REGISTRO.
           INITIALIZE REG-DB202

           MOVE P1-CHAVE        TO P2-CHAVE
           MOVE P1-ORIGEM       TO P2-ORIGEM
           MOVE P1-NOME         TO P2-NOME
           MOVE P1-STATUS       TO P2-STATUS
           MOVE P1-TIPO-SAIDA   TO P2-TIPO-SAIDA
           MOVE P1-OCORRENCIA   TO P2-OCORRENCIA
           MOVE P1-CODIGO-DB2   TO P2-CODIGO-DB2
           MOVE P1-SCORE        TO P2-SCORE
           MOVE P1-COD-PROCESSO TO P2-COD-PROCESSO

           IF NOT FIM-B AND IN3-CHAVE = P1-CHAVE
               PERFORM 2200-APLICA-MATCH
               PERFORM 1100-LE-INPUTB
           ELSE
               PERFORM 2300-APLICA-DEFAULT
           END-IF

           WRITE REG-DB202
           ADD 1 TO WS-GRAVADOS.

       2200-APLICA-MATCH.
           MOVE IN3-COD-SEGMENTO TO P2-SEGMENTO
           MOVE IN3-FLAG-BLOQUEIO TO P2-FLAG-BLOQUEIO
           MOVE IN3-LIMITE-CRED TO P2-LIMITE-CRED
           MOVE IN3-DATA-REF TO P2-DATA-REF

           COMPUTE P2-VALOR-AJUSTADO =
                   P1-VALOR-CALC * IN3-FATOR-AJUSTE

           IF IN3-LIMITE-CRED > ZEROES
               COMPUTE WS-PERC-AUX =
                       (P1-TOTAL-GERAL / IN3-LIMITE-CRED) * 100
               MOVE WS-PERC-AUX TO P2-PERC-LIMITE
           ELSE
               MOVE ZERO TO P2-PERC-LIMITE
           END-IF

           IF P1-CANAL-GRUPO = 'DIGITAL '
               MOVE 'WB' TO P2-CANAL-DESTINO
           ELSE
               MOVE IN3-CANAL-REF TO P2-CANAL-DESTINO
           END-IF

           IF P1-TOTAL-GERAL > IN3-LIMITE-CRED
               MOVE 'S' TO P2-FLAG-CROSS
           ELSE
               MOVE 'N' TO P2-FLAG-CROSS
           END-IF

           IF IN3-TIPO-CLIENTE = 'P' AND
              P1-ALERTA = 'N' AND
              IN3-FLAG-BLOQUEIO NOT = 'S'
               MOVE 'A' TO P2-PRIORIDADE
               MOVE 'APROVAR' TO P2-DECISAO
               MOVE 'PRM' TO P2-CATEGORIA-FINAL
           ELSE
               IF IN3-FLAG-BLOQUEIO = 'S'
                   MOVE 'C' TO P2-PRIORIDADE
                   MOVE 'BLOQUEAR' TO P2-DECISAO
                   MOVE 'BLK' TO P2-CATEGORIA-FINAL
               ELSE
                   MOVE 'B' TO P2-PRIORIDADE
                   MOVE 'ANALISAR' TO P2-DECISAO
                   MOVE P1-CATEGORIA TO P2-CATEGORIA-FINAL
               END-IF
           END-IF

           MOVE 'REGISTRO CRUZADO COM INPUT3 COMPLEMENTAR      '
             TO P2-MSG-FINAL.

       2300-APLICA-DEFAULT.
           ADD 1 TO WS-SEM-MATCH
           MOVE '000' TO P2-SEGMENTO
           MOVE 'N' TO P2-FLAG-BLOQUEIO
           MOVE ZEROES TO P2-LIMITE-CRED
                         P2-VALOR-AJUSTADO
                         P2-PERC-LIMITE
                         P2-DATA-REF
           MOVE 'N' TO P2-FLAG-CROSS
           MOVE 'D' TO P2-PRIORIDADE
           MOVE 'MANUAL' TO P2-DECISAO
           MOVE P1-CATEGORIA TO P2-CATEGORIA-FINAL

           IF P1-CANAL-GRUPO = 'DIGITAL '
               MOVE 'WB' TO P2-CANAL-DESTINO
           ELSE
               MOVE 'AG' TO P2-CANAL-DESTINO
           END-IF

           MOVE 'SEM CORRESPONDENCIA NO INPUT3 COMPLEMENTAR    '
             TO P2-MSG-FINAL.

       9000-FINALIZA.
           CLOSE INPUTA
                 INPUTB
                 SAIDAF

           DISPLAY 'CBLDB002B REGISTROS LIDOS A   = ' WS-LIDOS-A
           DISPLAY 'CBLDB002B REGISTROS LIDOS B   = ' WS-LIDOS-B
           DISPLAY 'CBLDB002B REGISTROS GRAVADOS  = ' WS-GRAVADOS
           DISPLAY 'CBLDB002B SEM MATCH INPUT3    = ' WS-SEM-MATCH.

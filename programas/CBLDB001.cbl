       IDENTIFICATION DIVISION.
       PROGRAM-ID. CBLDB001.

       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT INPUT1 ASSIGN TO INPUT1
               ORGANIZATION IS SEQUENTIAL
               ACCESS MODE IS SEQUENTIAL
               FILE STATUS IS WS-FS-IN1.
           SELECT INPUT2 ASSIGN TO INPUT2
               ORGANIZATION IS SEQUENTIAL
               ACCESS MODE IS SEQUENTIAL
               FILE STATUS IS WS-FS-IN2.
           SELECT SAIDA ASSIGN TO SAIDA
               ORGANIZATION IS SEQUENTIAL
               ACCESS MODE IS SEQUENTIAL
               FILE STATUS IS WS-FS-OUT.

       DATA DIVISION.
       FILE SECTION.
       FD  INPUT1
           RECORDING MODE IS F
           RECORD CONTAINS 80 CHARACTERS.
       COPY CPYIN001.

       FD  INPUT2
           RECORDING MODE IS F
           RECORD CONTAINS 100 CHARACTERS.
       COPY CPYIN002.

       FD  SAIDA
           RECORDING MODE IS F
           RECORD CONTAINS 300 CHARACTERS.
       COPY CPYOUT01.

       WORKING-STORAGE SECTION.
       01  WS-FS-IN1                 PIC X(02) VALUE SPACES.
       01  WS-FS-IN2                 PIC X(02) VALUE SPACES.
       01  WS-FS-OUT                 PIC X(02) VALUE SPACES.

       01  WS-FLAGS.
           05 WS-EOF-IN1             PIC X(01) VALUE 'N'.
              88 FIM-IN1                        VALUE 'S'.
           05 WS-EOF-IN2             PIC X(01) VALUE 'N'.
              88 FIM-IN2                        VALUE 'S'.

       01  WS-CONTROLE.
           05 WS-REG-LIDOS-IN1       PIC 9(07) VALUE ZERO.
           05 WS-REG-LIDOS-IN2       PIC 9(07) VALUE ZERO.
           05 WS-REG-GRAVADOS        PIC 9(07) VALUE ZERO.
           05 WS-REG-NAO-ENCONTRADOS PIC 9(07) VALUE ZERO.
           05 WS-ERROS-DB2           PIC 9(07) VALUE ZERO.

       01  WS-CHAVE-PESQUISA         PIC X(10).

           EXEC SQL
               INCLUDE SQLCA
           END-EXEC.

           EXEC SQL
               INCLUDE DCLTB001
           END-EXEC.

       PROCEDURE DIVISION.
       0000-PRINCIPAL.
           PERFORM 1000-INICIALIZA
           PERFORM 2000-PROCESSA-IN1
           PERFORM 3000-PROCESSA-IN2
           PERFORM 9000-FINALIZA
           GOBACK.

       1000-INICIALIZA.
           OPEN INPUT  INPUT1
                INPUT  INPUT2
                OUTPUT SAIDA

           IF WS-FS-IN1 NOT = '00'
               DISPLAY 'ERRO OPEN INPUT1. FILE STATUS=' WS-FS-IN1
               GOBACK
           END-IF

           IF WS-FS-IN2 NOT = '00'
               DISPLAY 'ERRO OPEN INPUT2. FILE STATUS=' WS-FS-IN2
               GOBACK
           END-IF

           IF WS-FS-OUT NOT = '00'
               DISPLAY 'ERRO OPEN SAIDA. FILE STATUS=' WS-FS-OUT
               GOBACK
           END-IF.

       2000-PROCESSA-IN1.
           PERFORM UNTIL FIM-IN1
               READ INPUT1
                   AT END
                       SET FIM-IN1 TO TRUE
                   NOT AT END
                       ADD 1 TO WS-REG-LIDOS-IN1
                       PERFORM 2100-TRATA-IN1
               END-READ
           END-PERFORM.

       2100-TRATA-IN1.
           MOVE IN1-CHAVE TO WS-CHAVE-PESQUISA
           PERFORM 5000-BUSCA-DB2
           PERFORM 6000-INICIALIZA-SAIDA

           MOVE '1'              TO OUT-ORIGEM
           MOVE IN1-CHAVE        TO OUT-CHAVE
           MOVE IN1-AGENCIA      TO OUT-AGENCIA
           MOVE IN1-CONTA        TO OUT-CONTA
           MOVE IN1-QTDE         TO OUT-QTDE
           MOVE IN1-FATOR        TO OUT-FATOR
           MOVE IN1-CANAL        TO OUT-CANAL-SAIDA
           MOVE 'ORIGEMIN1'      TO OUT-HARD1
           MOVE 'PROCESSA01'     TO OUT-HARD2
           MOVE 'LE-DB2-I1 '     TO OUT-HARD3

           IF SQLCODE = 0
               MOVE HV-NOME-CLIENTE    TO OUT-NOME
               MOVE HV-STATUS-CLIENTE  TO OUT-STATUS
               MOVE HV-CODIGO-DB2      TO OUT-CODIGO-DB2
               MOVE HV-DATA-CADASTRO   TO OUT-DATA-CAD
               MOVE HV-VALOR-BASE      TO OUT-VALOR-BASE
               MOVE HV-PRECO-UNITARIO  TO OUT-PRECO-DB2
               COMPUTE OUT-VALOR-CALC =
                       HV-VALOR-BASE * IN1-FATOR
               COMPUTE OUT-TOTAL-GERAL =
                       IN1-QTDE * HV-PRECO-UNITARIO

               IF IN1-TIPO-REG = 'A'
                   MOVE 'A1' TO OUT-TIPO-SAIDA
                   MOVE '000' TO OUT-OCORRENCIA
               ELSE
                   MOVE 'A2' TO OUT-TIPO-SAIDA
                   MOVE '010' TO OUT-OCORRENCIA
               END-IF

               IF HV-STATUS-CLIENTE = 'A'
                   MOVE 'CLIENTE ATIVO PROCESSADO INPUT1      '
                     TO OUT-MSG
               ELSE
                   MOVE 'CLIENTE INATIVO PROCESSADO INPUT1    '
                     TO OUT-MSG
               END-IF
           ELSE
               PERFORM 7000-TRATA-DB2-NAO-OK
           END-IF

           WRITE REG-OUT
           ADD 1 TO WS-REG-GRAVADOS.

       3000-PROCESSA-IN2.
           PERFORM UNTIL FIM-IN2
               READ INPUT2
                   AT END
                       SET FIM-IN2 TO TRUE
                   NOT AT END
                       ADD 1 TO WS-REG-LIDOS-IN2
                       PERFORM 3100-TRATA-IN2
               END-READ
           END-PERFORM.

       3100-TRATA-IN2.
           MOVE IN2-CHAVE TO WS-CHAVE-PESQUISA
           PERFORM 5000-BUSCA-DB2
           PERFORM 6000-INICIALIZA-SAIDA

           MOVE '2'              TO OUT-ORIGEM
           MOVE IN2-CHAVE        TO OUT-CHAVE
           MOVE IN2-DOCUMENTO    TO OUT-DOCUMENTO
           MOVE IN2-QUANTIDADE   TO OUT-QTDE
           MOVE '00150'          TO OUT-FATOR
           MOVE 'B2'             TO OUT-CANAL-SAIDA
           MOVE 'ORIGEMIN2'      TO OUT-HARD1
           MOVE 'PROCESSA02'     TO OUT-HARD2
           MOVE 'LE-DB2-I2 '     TO OUT-HARD3

           IF SQLCODE = 0
               MOVE HV-NOME-CLIENTE    TO OUT-NOME
               MOVE HV-STATUS-CLIENTE  TO OUT-STATUS
               MOVE HV-CODIGO-DB2      TO OUT-CODIGO-DB2
               MOVE HV-DATA-CADASTRO   TO OUT-DATA-CAD
               MOVE HV-VALOR-BASE      TO OUT-VALOR-BASE
               MOVE HV-PRECO-UNITARIO  TO OUT-PRECO-DB2
               MOVE HV-CANAL-PREFERENC TO OUT-CANAL-SAIDA
               COMPUTE OUT-VALOR-CALC =
                       IN2-VALOR-UNIT * HV-FATOR-DB2
               COMPUTE OUT-TOTAL-GERAL =
                       IN2-QUANTIDADE * HV-PRECO-UNITARIO

               IF IN2-INDICADOR = 'S'
                   MOVE 'B1' TO OUT-TIPO-SAIDA
                   MOVE '000' TO OUT-OCORRENCIA
               ELSE
                   MOVE 'B2' TO OUT-TIPO-SAIDA
                   MOVE '020' TO OUT-OCORRENCIA
               END-IF

               IF HV-STATUS-CLIENTE = 'A'
                   MOVE 'CLIENTE ATIVO PROCESSADO INPUT2      '
                     TO OUT-MSG
               ELSE
                   MOVE 'CLIENTE INATIVO PROCESSADO INPUT2    '
                     TO OUT-MSG
               END-IF
           ELSE
               PERFORM 7000-TRATA-DB2-NAO-OK
           END-IF

           WRITE REG-OUT
           ADD 1 TO WS-REG-GRAVADOS.

       5000-BUSCA-DB2.
           INITIALIZE DCLTB001
           MOVE WS-CHAVE-PESQUISA TO HV-CHAVE-CLIENTE

           EXEC SQL
               SELECT NOME_CLIENTE,
                      STATUS_CLIENTE,
                      CODIGO_DB2,
                      DATA_CADASTRO,
                      VALOR_BASE,
                      PRECO_UNITARIO,
                      FATOR_DB2,
                      CANAL_PREFERENC
                 INTO :HV-NOME-CLIENTE,
                      :HV-STATUS-CLIENTE,
                      :HV-CODIGO-DB2,
                      :HV-DATA-CADASTRO,
                      :HV-VALOR-BASE,
                      :HV-PRECO-UNITARIO,
                      :HV-FATOR-DB2,
                      :HV-CANAL-PREFERENC
                 FROM APPDB.CLIENTE_MOVTO
                WHERE CHAVE_CLIENTE = :HV-CHAVE-CLIENTE
                WITH UR
           END-EXEC.

       6000-INICIALIZA-SAIDA.
           INITIALIZE REG-OUT
           MOVE SPACES TO OUT-MSG.

       7000-TRATA-DB2-NAO-OK.
           IF SQLCODE = 100
               ADD 1 TO WS-REG-NAO-ENCONTRADOS
               MOVE '404' TO OUT-OCORRENCIA
               MOVE 'ND'  TO OUT-TIPO-SAIDA
               MOVE 'NAO LOCALIZADO NO DB2                  '
                 TO OUT-MSG
               MOVE 'NAO ENCONTRADO                  ' TO OUT-NOME
               MOVE 'N' TO OUT-STATUS
               MOVE '00000' TO OUT-CODIGO-DB2
               MOVE '0000-00-00' TO OUT-DATA-CAD
               MOVE ZEROES TO OUT-VALOR-BASE
                              OUT-PRECO-DB2
                              OUT-VALOR-CALC
                              OUT-TOTAL-GERAL
           ELSE
               ADD 1 TO WS-ERROS-DB2
               MOVE '999' TO OUT-OCORRENCIA
               MOVE 'ER'  TO OUT-TIPO-SAIDA
               MOVE 'ERRO ACESSO DB2                          '
                 TO OUT-MSG
               MOVE 'ERRO DB2                       ' TO OUT-NOME
               MOVE 'E' TO OUT-STATUS
               MOVE '99999' TO OUT-CODIGO-DB2
               MOVE '0000-00-00' TO OUT-DATA-CAD
               MOVE ZEROES TO OUT-VALOR-BASE
                              OUT-PRECO-DB2
                              OUT-VALOR-CALC
                              OUT-TOTAL-GERAL
           END-IF.

       9000-FINALIZA.
           CLOSE INPUT1
                 INPUT2
                 SAIDA

           DISPLAY 'REGISTROS LIDOS INPUT1   = ' WS-REG-LIDOS-IN1
           DISPLAY 'REGISTROS LIDOS INPUT2   = ' WS-REG-LIDOS-IN2
           DISPLAY 'REGISTROS GRAVADOS       = ' WS-REG-GRAVADOS
           DISPLAY 'NAO ENCONTRADOS DB2      = ' WS-REG-NAO-ENCONTRADOS
           DISPLAY 'ERROS DB2                = ' WS-ERROS-DB2.

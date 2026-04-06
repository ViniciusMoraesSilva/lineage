      *---------------------------------------------------------------*
      * DCLGEN TABLE(APPDB.CLIENTE_MOVTO)                             *
      *        LIBRARY(DCLTB001)                                      *
      *        LANGUAGE(COBOL)                                        *
      *---------------------------------------------------------------*
           EXEC SQL DECLARE APPDB.CLIENTE_MOVTO TABLE
           ( CHAVE_CLIENTE     CHAR(10)      NOT NULL,
             NOME_CLIENTE      CHAR(30)      NOT NULL,
             STATUS_CLIENTE    CHAR(1)       NOT NULL,
             CODIGO_DB2        CHAR(5)       NOT NULL,
             DATA_CADASTRO     CHAR(10)      NOT NULL,
             VALOR_BASE        DECIMAL(9,2)  NOT NULL,
             PRECO_UNITARIO    DECIMAL(7,2)  NOT NULL,
             FATOR_DB2         DECIMAL(3,2)  NOT NULL,
             CANAL_PREFERENC   CHAR(2)       NOT NULL
           ) END-EXEC.

       01  DCLTB001.
           10 HV-CHAVE-CLIENTE       PIC X(10).
           10 HV-NOME-CLIENTE        PIC X(30).
           10 HV-STATUS-CLIENTE      PIC X(01).
           10 HV-CODIGO-DB2          PIC X(05).
           10 HV-DATA-CADASTRO       PIC X(10).
           10 HV-VALOR-BASE          PIC S9(07)V99 COMP-3.
           10 HV-PRECO-UNITARIO      PIC S9(05)V99 COMP-3.
           10 HV-FATOR-DB2           PIC S9(01)V99 COMP-3.
           10 HV-CANAL-PREFERENC     PIC X(02).

       01  DCLTB001-NULLS.
           10 NUL-CHAVE-CLIENTE      PIC S9(04) COMP VALUE +0.
           10 NUL-NOME-CLIENTE       PIC S9(04) COMP VALUE +0.
           10 NUL-STATUS-CLIENTE     PIC S9(04) COMP VALUE +0.
           10 NUL-CODIGO-DB2         PIC S9(04) COMP VALUE +0.
           10 NUL-DATA-CADASTRO      PIC S9(04) COMP VALUE +0.
           10 NUL-VALOR-BASE         PIC S9(04) COMP VALUE +0.
           10 NUL-PRECO-UNITARIO     PIC S9(04) COMP VALUE +0.
           10 NUL-FATOR-DB2          PIC S9(04) COMP VALUE +0.
           10 NUL-CANAL-PREFERENC    PIC S9(04) COMP VALUE +0.

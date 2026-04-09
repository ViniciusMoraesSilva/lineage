//JCLDB002 JOB (ACCT),'POS PROCESSAMENTO',CLASS=A,MSGCLASS=X,
//             NOTIFY=&SYSUID
//*------------------------------------------------------------------*
//*  JCLDB002                                                         *
//*  LE A SAIDA DO JCLDB001, GERA UM NOVO LAYOUT E DEPOIS            *
//*  CRUZA O RESULTADO COM UM ARQUIVO COMPLEMENTAR                   *
//*------------------------------------------------------------------*
//STEP010  EXEC PGM=CBLDB002A
//STEPLIB  DD DSN=APP.LOADLIB,DISP=SHR
//SYSOUT   DD SYSOUT=*
//SYSPRINT DD SYSOUT=*
//ENTRADA  DD DSN=APP.ARQ.SAIDA.CBLDB001,DISP=SHR
//SAIDA1   DD DSN=&&TMPDB201,DISP=(,PASS),UNIT=SYSDA,
//            SPACE=(CYL,(5,2),RLSE),
//            DCB=(RECFM=FB,LRECL=320,BLKSIZE=0)
//*------------------------------------------------------------------*
//STEP020  EXEC PGM=CBLDB002B
//STEPLIB  DD DSN=APP.LOADLIB,DISP=SHR
//SYSOUT   DD SYSOUT=*
//SYSPRINT DD SYSOUT=*
//INPUTA   DD DSN=&&TMPDB201,DISP=(OLD,DELETE)
//INPUTB   DD DSN=APP.INPUT3.COMPLEMENTO,DISP=SHR
//SAIDAF   DD DSN=APP.ARQ.SAIDA.CBLDB002,DISP=(NEW,CATLG,DELETE),
//            UNIT=SYSDA,SPACE=(CYL,(5,2),RLSE),
//            DCB=(RECFM=FB,LRECL=360,BLKSIZE=0)

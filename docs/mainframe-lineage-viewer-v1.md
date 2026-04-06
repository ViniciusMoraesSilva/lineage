# Mainframe Lineage Viewer V1

Esta V1 evita depender de DataHub, OpenMetadata ou Marquez para a validacao inicial. Em vez disso, ela usa diretamente o bundle canonico CSV que o extractor ja gera e entrega uma visualizacao local, simples e objetiva de lineage de campos.

## Direcao de produto

A V1 pega o melhor das ferramentas citadas, mas em formato enxuto:

- de `DataHub`: foco em descoberta e navegacao por campo
- de `OpenMetadata`: contexto de schema, dataset e regra associado ao campo
- de `Marquez`: leitura direta de lineage orientado a execucao e transformacao

O recorte da V1 e intencional:

- um viewer local sem backend
- upload manual dos CSVs canonicos
- filtros e acoes no topo
- mapa completo de datasets em formato de tabela
- painel inferior com regras, upstream, downstream e origem sintetica de `hard_code`

## Aplicacao criada

O viewer ficou em [`apps/mainframe-lineage-viewer-v1/index.html`](/Users/macbookpro/Documents/git/mainframelineage/apps/mainframe-lineage-viewer-v1/index.html).

Arquivos principais:

- [`apps/mainframe-lineage-viewer-v1/app.js`](/Users/macbookpro/Documents/git/mainframelineage/apps/mainframe-lineage-viewer-v1/app.js)
- [`apps/mainframe-lineage-viewer-v1/styles.css`](/Users/macbookpro/Documents/git/mainframelineage/apps/mainframe-lineage-viewer-v1/styles.css)
- [`apps/mainframe-lineage-viewer-v1/README.md`](/Users/macbookpro/Documents/git/mainframelineage/apps/mainframe-lineage-viewer-v1/README.md)

Bundle de exemplo disponivel em [`generated/mainframe-extractor/JCLDB001`](/Users/macbookpro/Documents/git/mainframelineage/generated/mainframe-extractor/JCLDB001).

## Fluxo

1. Gerar ou usar um bundle canonico com:
   - `entities.csv`
   - `entity_columns.csv`
   - `column_mappings.csv`
   - `transform_rules.csv`
2. Abrir o viewer e subir os arquivos ou usar o botao de exemplo `JCLDB001`
3. Selecionar um campo para navegar no lineage

## O que a V1 mostra

- todas as tabelas do bundle com todos os campos visiveis ao mesmo tempo
- lineage de coluna para coluna por meio de conexoes entre as linhas das tabelas
- foco por dataset, busca por coluna e filtro por tipo de regra
- navegacao upstream e downstream ao selecionar qualquer campo no mapa
- regras `move`, `compute`, `conditional`, `db_lookup`, `sort` e `constant`
- `hard_code` como origem explicita por meio de um no sintetico `HARD_CODE`
- contexto do campo: dataset, tipo, definicao e contagem de relacoes

## Como abrir

Suba um servidor HTTP simples na raiz do repositorio:

```bash
python3 -m http.server 4173
```

Depois abra:

```text
http://localhost:4173/apps/mainframe-lineage-viewer-v1/
```

## Limites desta V1

- ainda nao aceita `.zip` ou pacote unico
- nao possui persistencia
- o mapa completo pode ficar mais denso conforme o numero de datasets e campos crescer
- a visualizacao privilegia leitura analitica por tabela, nao um canvas livre com roteamento avancado
- a carga do exemplo local depende de HTTP; em `file://` o navegador pode bloquear `fetch`

## Proximos passos naturais

- aceitar um `.zip` com o bundle completo
- ler tambem `steps.csv`, `evidence.csv` e `artifacts.csv` para explicar melhor a origem
- adicionar filtros por tipo de regra, sistema e confianca
- exibir trilhas alternativas quando um mesmo target tiver multiplas regras ou branches

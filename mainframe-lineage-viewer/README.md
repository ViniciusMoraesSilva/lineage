<!-- PROJECT LOGO -->
<p align="center">
  <img src="https://artwork.lfaidata.foundation/projects/openlineage/horizontal/color/openlineage-horizontal-color.png" alt="Logo" width="30%">
  <h3 align="center">Marquito</h3>
  <p align="center">
    A static OpenLineage visualization website.
    <br />
    <br />
    ·
    <a href="https://openlineage.io/">OpenLineage Overview</a>
    ·
    <a href="https://marquito.z9.web.core.windows.net/">Marquito - demo website for OpenLineage I threw together</a>
    ·
    <a href="https://www.youtube.com/watch?v=Vmz7Ri1jfw8&t=116s">Delta Lake Webinar</a>
    ·
    <a href="https://oleander.dev/blog/simplify-data-observability-with-openlineage">Good tutorial</a>
    ·
  </p>
</p>

### Marquito

Little [Marquez](https://marquezproject.ai/).

![Marquito](.imgs/marquito.gif)

cd "/Users/macbookpro/Documents/git/mainframelineage/marquito/out"
python3 -m http.server 28081

### Validacao local T6

Para validar a rota /mainframe na mesma porta usada pelos checks browser-based, gere o export e sirva o diretorio out na 4173:

```bash
npm run build
npm run serve:t6
```

Isso evita subir um servidor manual em um diretorio diferente do export, que faz a UI abrir com HTML mas quebra os assets em /_next e resulta em tela branca.

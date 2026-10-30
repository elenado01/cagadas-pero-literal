# Cagadas, pero literal

Dashboard interactivo con el historial de mensajes `💩` del chat de WhatsApp.

## Dashboard

Cuando el workflow termine su primera publicación, estará disponible en:

https://elenado01.github.io/cagadas-pero-literal/

La página se actualiza automáticamente en cada push a `main` mediante GitHub Pages. Lee los datos de `data/staging/cagadas.csv` y ofrece filtros por año y cagadora, resumen de actividad, evolución anual y mensual, ranking y reparto por persona.

## Publicar

1. Sube los cambios a la rama `main`.
2. En GitHub, abre `Settings > Pages` y selecciona `GitHub Actions` como fuente.
3. Abre la URL del dashboard cuando el workflow `Deploy dashboard to GitHub Pages` termine correctamente.

## Datos

El notebook [01_read_poop_file.ipynb](01_read_poop_file.ipynb) genera el CSV de staging. Los mensajes originales en `data/raw/` permanecen ignorados por Git.
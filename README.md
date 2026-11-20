# Cagadas, pero literal

Dashboard interactivo con el historial de mensajes `💩` del chat de WhatsApp.

## Dashboard

Está disponible en:

https://elenado01.github.io/cagadas-pero-literal/

El dashboard carga los datos publicados en la rama `main` y ofrece filtros por año y cagadora, resumen de actividad, evolución anual y mensual, ranking y reparto por persona.

## Actualización remota

La actualización de datos se inicia desde el propio dashboard:

1. Pulsa `última cagada` para abrir la zona de administración.
2. Introduce la contraseña de administrador y selecciona el TXT exportado de WhatsApp.
3. El Worker de Cloudflare guarda temporalmente el archivo en Cloudflare R2 y dispara el workflow `Update dashboard data` de GitHub Actions.
4. GitHub Actions descarga el TXT, ejecuta el notebook, regenera `data/staging/cagadas.csv` y `data/staging/conversaciones_caca.json`, escribe `data/staging/ultima_actualizacion.json` y elimina el TXT temporal.
5. El dashboard consulta el estado de GitHub Actions y comprueba que haya cambiado el número de registros o el timestamp de la última cagada.
6. Cuando ambas condiciones se cumplen, cierra automáticamente el popup y recarga la página con una URL nueva para mostrar los datos actualizados.

Mientras el workflow está ejecutándose, el popup permanece abierto y muestra una rueda de carga. Si el workflow termina sin cambiar los datos, no se recarga la página.

## Publicar el dashboard

1. Sube los cambios a la rama `main`.
2. En GitHub, abre `Settings > Pages` y selecciona `GitHub Actions` como fuente.
3. Abre la URL del dashboard cuando el workflow `Deploy dashboard to GitHub Pages` termine correctamente.

El Worker se despliega manualmente en Cloudflare. Sus variables son la contraseña de administrador, el token de GitHub, el propietario y repositorio, y el origen permitido. El bucket R2 y las credenciales de R2 se configuran como secretos del workflow.

## Datos

El notebook [01_read_poop_file.ipynb](01_read_poop_file.ipynb) genera el CSV de staging. Los mensajes originales en `data/raw/` permanecen ignorados por Git. El CSV y los datos de conversaciones generados se consultan desde la rama `main` para evitar versiones antiguas servidas por la caché de GitHub Pages.
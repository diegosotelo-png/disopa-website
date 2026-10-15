# Formulario de la web → correo propio + hoja de solicitudes

Reemplaza a FormSubmit. Los correos llegan en español, firmados como «Web DISOPA», sin publicidad, y cada solicitud queda guardada en una Google Sheet.

## Estado actual (instalado el 2026-10-15)

- Hoja: «Solicitudes web DISOPA» en Drive de disopa.pe@gmail.com (pestaña «Solicitudes»).
- Script: proyecto independiente «Formulario web DISOPA» en script.google.com (cuenta DISOPA). Como «Extensiones → Apps Script» fallaba con varias cuentas abiertas en Chrome, el script se creó aparte y abre la hoja por su ID (`HOJA_ID`; el ID real solo está en la copia de Google, en el repo queda vacío).
- La URL `/exec` está en `FORM_ENDPOINT` de `index.html`.
- Los nombres de campo van sin tildes (`Ubicacion`) porque Apps Script no lee bien parámetros acentuados.

## Instalación (una sola vez, unos 5 minutos)

Hazlo con la sesión iniciada en **disopa.pe@gmail.com**.

1. Entra a <https://sheets.new> y ponle de nombre **Solicitudes web DISOPA**.
2. Menú **Extensiones → Apps Script**.
3. Borra lo que aparezca y pega todo el contenido de `Code.gs`. Guarda con el ícono del disquete.
4. Arriba, en el selector de funciones, elige **probar** y pulsa **▶ Ejecutar**.
   - Google pedirá permisos: **Revisar permisos → tu cuenta → Configuración avanzada → Ir a … (no seguro) → Permitir**. Aparece «no seguro» porque el script es tuyo y no está verificado por Google; es normal.
   - Te llegará un correo de prueba «🔴 URGENTE · Ate, Lima · Prueba DISOPA…» y se creará la pestaña «Solicitudes» en la hoja.
5. **Implementar → Nueva implementación**:
   - Tipo: **Aplicación web**.
   - Ejecutar como: **Yo (disopa.pe@gmail.com)**.
   - Quién tiene acceso: **Cualquier usuario**.
   - Pulsa **Implementar** y copia la **URL de la aplicación web** (termina en `/exec`).
6. Pásale esa URL a Claude. Él la pone en `FORM_ENDPOINT` dentro de `index.html` y publica la web.

## Uso diario

- En la hoja, la columna **Estado** tiene una lista: Nuevo → Llamado → Cotizado → Cerrado / Descartado.
- Las filas urgentes aparecen en rojo claro.
- Si cambias `Code.gs` más adelante: **Implementar → Gestionar implementaciones → ✏️ → Versión: Nueva → Implementar**. La URL no cambia.

## Protecciones incluidas

- Campo trampa contra bots y máximo de 30 solicitudes por hora (la cuota gratis de Gmail es de unos 100 correos al día).
- Una sola confirmación por dirección de correo cada 6 horas, para que nadie use el formulario para llenar el buzón de otra persona.
- El texto del cliente se escapa en los correos y no puede ejecutarse como fórmula en la hoja.

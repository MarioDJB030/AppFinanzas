# 📊 FinanzApp - Plataforma Integral de Finanzas Personales (PWA)

![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Google Gemini](https://img.shields.io/badge/Google%20Gemini-8E75B2?style=for-the-badge&logo=google%20gemini&logoColor=white)

> **Enlaces Rápidos:** > [🌐 Visitar Web App](https://app-finanzas-woad.vercel.app/) | [📱 Descargar APK (Android)](https://drive.google.com/file/d/1hqsWZ0VTJHU5ufwk8h91dzeMy17cBBlR/view?usp=sharing)

---

## 💡 Visión General

FinanzApp es una Aplicación Web Progresiva (PWA) de gestión financiera personal completa. Permite a los usuarios gestionar ingresos y gastos, visualizar estadísticas en tiempo real, controlar inversiones, establecer presupuestos y metas de ahorro, e incluye un **escáner de tickets procesado mediante Inteligencia Artificial (Google Gemini)**.

**Metodología de Desarrollo:**
Este proyecto ha sido desarrollado bajo el paradigma de **AI-Assisted Development**. Se utilizó la inteligencia artificial como herramienta aceleradora para la generación de componentes base, permitiéndome centrar el esfuerzo de ingeniería en el **diseño de la arquitectura del software, la gestión de estados complejos, la estructuración del modelo de datos relacional (PostgreSQL) y la resolución de cuellos de botella en integraciones de APIs de terceros.**

---

## 🛠️ Stack Tecnológico

* **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Shadcn/UI (Radix UI), Recharts.
* **Backend & Base de Datos:** Supabase (Autenticación, PostgreSQL, Storage con RLS).
* **IA & APIs Externas:** Google Gemini AI API (Asesoramiento y OCR), Alpha Vantage API (Cotizaciones).
* **Infraestructura:** Vercel (Despliegue), Arquitectura PWA (Next-PWA).

---

## 🧠 Desafíos Técnicos y Arquitectura

Durante el desarrollo de la plataforma surgieron diversos retos arquitectónicos que requirieron soluciones específicas:

### ⚠️ Reto 1: Incompatibilidad de Modelos Gemini (Error 404)
Al implementar el asesor financiero con el modelo estándar `gemini-1.5-flash`, la API devolvía un error de recurso no encontrado, bloqueando el análisis de gastos y el escáner de recibos.

* **✅ Solución:** Depuración de endpoints REST de Google para listar modelos habilitados. Se descubrió un requisito de entorno para la versión "preview" y se migró la arquitectura de IA a `gemini-2.5-flash`.

### ⚠️ Reto 2: Rate Limits en API de Inversiones (Error 429)
La API externa (Alpha Vantage) imponía un límite estricto de 25 peticiones diarias y 5 por minuto. La hidratación inicial del portafolio en tiempo real provocaba caídas del servicio y bloqueos temporales.

* **✅ Solución: Estrategia de Caché + Actualización Secuencial.** Se desacopló la vista de las peticiones en tiempo real añadiendo persistencia de precios en Supabase (`current_price`, `last_updated`). Se implementó un flujo de actualización manual y secuencial con retrasos controlados (delays) para respetar la cuota del proveedor.

```typescript
// Lógica de mitigación de Rate Limits
for (let i = 0; i < total; i++) {
    const inv = initialInvestments[i];
    // ... (Lógica de obtención de precio y actualización en DB) ...

    // Delay entre peticiones para respetar los límites de la API (12s para cuota de 5 req/min)
    if (i < total - 1) {
        await new Promise(resolve => setTimeout(resolve, 12000));
    }
}
```

### ⚠️ Reto 3: Acceso de IA a Storage Privado
Los recibos subidos se almacenan en un bucket privado por seguridad. Al enviar la URL del archivo a Gemini, la inferencia fallaba porque el servidor de Google no tenía autorización de acceso a Supabase.

* **✅ Solución: Procesamiento Server-Side con Buffers.** Mediante Server Actions de Next.js, el servidor descarga el archivo internamente usando el rol de administrador, lo transforma a `Base64` y lo inyecta directamente en el payload de la petición a la IA, asegurando los datos sin exponer URLs públicas.

### ⚠️ Reto 4: Seguridad y Gestión de Credenciales
Uso intensivo de servicios externos requiriendo múltiples API Keys con permisos de escritura.

* **✅ Solución:** Separación estricta de variables de entorno (cliente/servidor). Inyección segura mediante el gestor de secretos de Vercel en producción, evitando cualquier hardcoding o exposición de claves.

---

## 📱 Interfaz de Usuario (UI)

*Haz clic en las imágenes para ampliarlas.*

| Dashboard Principal | Transacciones | Calendario |
|:---:|:---:|:---:|
| ![Dashboard](./img/DashboardPrincipal.png) | ![Transacciones](./img/Transacciones.png) | ![Calendario](./img/Calendario.png) |
| *Dashboard con KPIs y Gráficos* | *Gestión y Filtros* | *Pagos Recurrentes* |

| Portafolio Inversiones | Presupuestos | Escáner IA |
|:---:|:---:|:---:|
| ![Inversiones](./img/Inversiones.png) | ![Presupuestos](./img/Presupuestos.png) | ![Escáner IA](./img/Tickets.png) |
| *Acciones y Criptomonedas* | *Seguimiento Mensual* | *OCR y Asesoramiento Financiero* |

---

## 📝 Registro de Desarrollo y Arquitectura AI

<details>
<summary><b>Fase 1: Configuración Inicial, Arquitectura y Dashboard</b></summary>
<br>

**Decisiones clave:** * Estructuración del modelo relacional en PostgreSQL (`profiles`, `accounts`, `categories`, `transactions`, `recurring_rules`, `investments`).
* Implementación del patrón de autenticación con Supabase.
* Diseño del importador masivo CSV y lógica base del calendario de pagos recurrentes.
* Restricciones SQL: Solución a conflictos de *constraints* (e.g., `accounts_type_check`).
</details>

<details>
<summary><b>Fase 2: Refinamiento UI, Parsing CSV y Gráficos</b></summary>
<br>

**Decisiones clave:** * Implementación de Shadcn/UI (Radix UI) para asegurar accesibilidad (ARIA tags) en los modales.
* Refactorización del parsing de CSV: Asignación automática de categorías y manejo de transacciones duales (Ingreso/Gasto) mediante evaluación de signos numéricos.
* Interactividad avanzada en gráficos (Recharts) para aislamiento de series temporales.
</details>

<details>
<summary><b>Fase 3: Inversiones, Presupuestos y AI Coach</b></summary>
<br>

**Decisiones clave:** * Integración del SDK `@google/generative-ai`.
* Diseño de Server Actions para limpieza y formateo de los datos del usuario antes de enviarlos a la IA (Garantizando privacidad: se eliminaron nombres y UUIDs, enviando solo categorías y montos agregados).
* Configuración de la *Progressive Web App* (PWA) interceptando el flujo de compilación mediante `next-pwa`.
* Resolución de dependencias circulares y errores estrictos de tipado TypeScript para un build de producción estable.
</details>

---

*Proyecto desarrollado como demostración técnica de capacidades Full-Stack y arquitecturas modernas | 2026*

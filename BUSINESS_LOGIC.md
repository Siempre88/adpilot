# AdPilot — Business Logic

> Centro de control de crecimiento para campañas de Facebook Ads.
> La IA no adivina. Analiza, diagnostica y recomienda con precisión.

---

## 1. Propuesta de Valor

**AdPilot convierte datos de Facebook Ads en decisiones claras.**

El problema no es la falta de datos — Facebook Ads Manager tiene demasiados. El problema es que un emprendedor que invierte $3,000/mes no tiene tiempo ni expertise para:
- Cruzar 15 métricas por cada ad set
- Detectar que una campaña empezó a morir hace 3 días
- Saber si un CPA de $12 es bueno o malo para SU negocio
- Decidir si escalar o matar una campaña

**AdPilot lo hace en segundos.** Conectas tu cuenta, defines tus metas, y el sistema te dice exactamente qué está pasando y qué hacer.

**Una frase:** "Deja de adivinar. AdPilot te dice qué campaña matar, cuál escalar, y por qué."

---

## 2. Casos de Uso Reales

### Diagnóstico diario
1. **Morning check automatizado** — El usuario abre AdPilot a las 9AM y ve un resumen: "2 campañas rentables, 1 quemando presupuesto, 1 en fase de aprendizaje". Sin abrir Ads Manager.

2. **Detectar campaña zombie** — Una campaña lleva 4 días gastando $50/día con 0 conversiones. Ads Manager no te alerta. AdPilot sí: "Campaña X gastó 2x tu CPA objetivo sin resultados. Recomendación: pausar."

3. **Identificar fatiga creativa** — La frecuencia subió a 3.2 y el CTR cayó 25% en 5 días. AdPilot detecta el patrón: "Creative fatigue detectada en Ad Set Y. El público ya vio tu anuncio demasiadas veces. Rota creativos."

### Decisiones de escala
4. **Saber cuándo escalar** — Una campaña lleva 5 días con ROAS 4.2x y CPA estable. AdPilot sugiere: "Campaña apta para escalar. Sube presupuesto 20-30%. No dupliques — escala vertical."

5. **Evitar escalar mal** — El usuario quiere duplicar presupuesto de golpe. AdPilot advierte: "Subir más de 30% resetea la fase de aprendizaje. Escala gradual recomendada."

### Análisis de pérdidas
6. **Diagnóstico de embudo roto** — CTR alto (2.5%) pero tasa de conversión baja (0.3%). AdPilot identifica: "El anuncio funciona. El problema está en la landing page, no en el ad."

7. **Sangrado silencioso** — 3 ad sets gastando $30/día cada uno sin resultados. Individualmente parecen poco, pero son $2,700/mes desperdiciados. AdPilot suma el costo total: "Tienes $90/día en ad sets sin retorno. Pérdida proyectada: $2,700/mes."

### Inteligencia competitiva
8. **CPM anómalo** — El CPM subió 45% en una semana sin cambios en targeting. AdPilot contextualiza: "CPM elevado posiblemente por temporada (Q4) o competencia en tu nicho. Considera ampliar audiencia."

9. **Comparativa de rendimiento** — El usuario tiene 12 ad sets activos. AdPilot rankea: "Top 3 por ROAS, Bottom 3 por CPA. El 60% de tu retorno viene de 2 ad sets."

### Chat con IA
10. **Preguntas en lenguaje natural** — "¿Cuál es mi mejor campaña este mes?" → AdPilot responde con datos reales: "Campaña Z — ROAS 5.1x, CPA $8.40, 47 conversiones. Lleva 68% de tu retorno total."

11. **Simulaciones** — "¿Qué pasa si subo el presupuesto de esta campaña a $200/día?" → AdPilot proyecta basado en data histórica: "Estimado: CPA podría subir 15-20% por expansión de audiencia. ROAS proyectado: 3.5x-4.0x."

12. **Diagnóstico guiado** — "¿Por qué mi CPA subió?" → AdPilot analiza: "Tu frecuencia pasó de 1.8 a 3.1 en 6 días. CTR cayó 30%. Diagnóstico: fatiga creativa. Acción: rota creativos."

---

## 3. Flujo del Usuario

```
ONBOARDING (una vez)
│
├─ 1. Registro (email/password)
├─ 2. Conectar cuenta de Facebook Ads (OAuth de Facebook)
├─ 3. Seleccionar ad account (puede tener varios)
├─ 4. Definir objetivos de negocio:
│     ├─ CPA objetivo (ej: $15)
│     ├─ ROAS mínimo aceptable (ej: 2.5x)
│     └─ Presupuesto mensual (ej: $3,000)
└─ 5. Primera sincronización de datos (últimos 30 días)

USO DIARIO
│
├─ Dashboard → Vista general: qué está bien, qué está mal, qué necesita atención
├─ Alertas → Notificaciones de problemas detectados por la IA
├─ Análisis → Deep dive en campañas, ad sets o ads específicos
└─ Chat IA → Preguntas en lenguaje natural sobre tus campañas

CICLO DE DECISIÓN
│
├─ Ver alerta o dato en dashboard
├─ Entender el diagnóstico (AdPilot explica el POR QUÉ)
├─ Decidir acción (AdPilot sugiere QUÉ HACER)
└─ Ejecutar en Facebook Ads Manager (MVP: no automatizamos, el usuario actúa)
```

---

## 4. Decisiones que Toma el Usuario Gracias a AdPilot

| Decisión | Sin AdPilot | Con AdPilot |
|----------|-------------|-------------|
| ¿Pauso esta campaña? | Intuición o pánico | Datos: gastó 2x CPA sin resultados → pausar |
| ¿Escalo esta campaña? | "Se ve bien, le subo" | ROAS estable 5 días + CPA bajo target → escalar 25% |
| ¿El problema es el ad o la landing? | No sabe | CTR alto + conversión baja = problema en landing |
| ¿Cambio los creativos? | Cuando se acuerda | Frecuencia 3+ y CTR cayendo = rotar ahora |
| ¿Mi presupuesto está bien distribuido? | Revisa campaign por campaign | 70% del retorno viene de 2 campañas, las otras 5 pierden dinero |
| ¿Estoy perdiendo dinero? | Se entera a fin de mes | Alerta diaria: $90/día en ad sets sin retorno |
| ¿Cuánto puedo gastar más? | Adivina | Proyección basada en rendimiento actual y tendencias |

---

## 5. Decisiones que Sugiere la IA

La IA de AdPilot opera en 3 niveles:

### Nivel 1: Observación (qué está pasando)
- "Tu CPA promedio subió 22% esta semana"
- "3 de 8 ad sets están en Learning Limited"
- "Tu mejor campaña es X con ROAS 4.8x"

### Nivel 2: Diagnóstico (por qué está pasando)
- "El CPA subió porque la frecuencia en tus top ad sets pasó de 2.0 a 3.5 — fatiga creativa"
- "Learning Limited porque tienes menos de 50 conversiones/semana en ese ad set — presupuesto o audiencia muy pequeños"
- "El CPM subió 40% — consistente con aumento estacional (Q4)"

### Nivel 3: Recomendación (qué hacer)
- "Pausa Ad Set Y — gastó $180 sin conversiones (2x tu CPA objetivo)"
- "Escala Campaña Z — ROAS 4.2x estable por 5 días. Sube presupuesto 25%"
- "Rota creativos en Ad Set W — frecuencia 3.2, CTR cayó 30% vs. lanzamiento"
- "Redistribuye: mueve $50/día de campañas C y D (ROAS <1.5x) a campaña A (ROAS 5.1x)"
- "No toques Campaña B — está en fase de aprendizaje (día 2 de 7). Espera."

### Tipos de Decisión

Toda sugerencia de la IA se clasifica en uno de estos 6 tipos:

| Tipo | Cuándo se sugiere | Ejemplo |
|------|-------------------|---------|
| **PAUSAR** | Campaña zombie, ROAS bajo breakeven 2+ días, gasto sin retorno | "Pausar Ad Set X — $180 gastados, 0 conversiones" |
| **REDUCIR PRESUPUESTO** | ROAS cayendo pero aún positivo, CPA subiendo gradualmente, audiencia saturándose | "Reducir presupuesto de $100 a $60/día en Campaña Y — ROAS cayó de 4x a 2.3x, aún rentable pero en declive" |
| **ESCALAR** | ROAS estable sobre objetivo 5+ días, CPA consistente, delivery saludable | "Escalar Campaña Z de $80 a $100/día (+25%) — ROAS 4.2x estable por 7 días" |
| **DUPLICAR ESTRUCTURA** | Campaña ganadora que ya se escaló al máximo vertical, audiencia agotándose | "Duplicar Ad Set W a nueva audiencia Lookalike 3-5% — el Lookalike 1-2% actual tiene frecuencia 3.5" |
| **CAMBIAR CREATIVO** | Fatiga creativa (frecuencia alta + CTR cayendo), hook rate bajo en video | "Rotar creativo en Ad Set V — frecuencia 3.1, CTR cayó 30%. Probar nuevo ángulo/hook" |
| **CAMBIAR SEGMENTACIÓN** | Audiencia saturada, CPM anómalo por audiencia muy pequeña, Learning Limited por falta de alcance | "Ampliar audiencia en Ad Set U — Learning Limited 10 días, audiencia de 50K muy pequeña. Probar Broad o Lookalike más amplio" |

#### Lógica de selección de decisión

```
¿Tiene conversiones?
├─ NO → ¿Gastó más de 2x CPA objetivo?
│        ├─ SÍ → PAUSAR
│        └─ NO → Esperar (en aprendizaje)
│
└─ SÍ → ¿ROAS sobre objetivo?
         ├─ SÍ → ¿Estable 5+ días?
         │        ├─ SÍ → ¿Ya escaló al máximo?
         │        │        ├─ SÍ → DUPLICAR ESTRUCTURA
         │        │        └─ NO → ESCALAR (+20-30%)
         │        └─ NO → Observar
         │
         └─ NO → ¿ROAS positivo pero bajo objetivo?
                  ├─ SÍ → ¿Frecuencia alta + CTR cayendo?
                  │        ├─ SÍ → CAMBIAR CREATIVO
                  │        └─ NO → ¿CPM alto por audiencia pequeña?
                  │                 ├─ SÍ → CAMBIAR SEGMENTACIÓN
                  │                 └─ NO → REDUCIR PRESUPUESTO
                  │
                  └─ NO (ROAS < breakeven) → ¿Lleva 2+ días?
                           ├─ SÍ → PAUSAR
                           └─ NO → Observar 1 día más
```

---

## 5.B Resumen Ejecutivo Diario

Cada día a las 9:00 AM (hora del usuario), AdPilot genera un resumen automático. Aparece como primera pantalla al abrir la app.

### Formato del resumen

```
┌─────────────────────────────────────────────────────────────┐
│  ADPILOT — Resumen del [fecha]                              │
│                                                             │
│  💰 Gasto total ayer: $342                                  │
│  📈 Revenue atribuido: $1,230                               │
│  ⚡ ROAS general: 3.6x                                      │
│                                                             │
│  ── QUÉ ESTÁ FUNCIONANDO ──                                 │
│                                                             │
│  ✅ "Webinar Funnel" — ROAS 5.1x, 12 conversiones, $108    │
│     gastados. 7 días estable. Lista para escalar.           │
│                                                             │
│  ✅ "Retargeting Cart" — ROAS 4.3x, CPA $9.20 (bajo       │
│     tu objetivo de $15). Rendimiento sólido.                │
│                                                             │
│  ── QUÉ ESTÁ FALLANDO ──                                    │
│                                                             │
│  🔴 "Launch V2" — $60 gastados, 0 conversiones.             │
│     Lleva 3 días así. Campaña zombie.                       │
│                                                             │
│  🟡 "Lookalike US" — Frecuencia 3.2, CTR cayó 25%.         │
│     Fatiga creativa detectada.                              │
│                                                             │
│  ── ACCIONES PARA HOY ──                                    │
│                                                             │
│  1. PAUSAR "Launch V2" — pérdida de $60/día sin retorno    │
│  2. CAMBIAR CREATIVO en "Lookalike US" — rotar antes de     │
│     que el CPA se dispare                                   │
│  3. ESCALAR "Webinar Funnel" — subir de $80 a $100/día     │
│                                                             │
│  Pérdida evitable hoy: $60                                  │
│  Oportunidad de revenue: +$250 si escalas "Webinar Funnel" │
└─────────────────────────────────────────────────────────────┘
```

### Reglas del resumen

1. **Máximo 3 items por sección.** Si hay más, priorizar por impacto en dinero.
2. **Las acciones se ordenan por urgencia:** primero pausar pérdidas, luego arreglar degradaciones, luego escalar oportunidades.
3. **Siempre incluir números concretos.** No "la campaña está mal", sino "$60/día de pérdida".
4. **El resumen cabe en una pantalla.** Si el usuario necesita más detalle, entra al dashboard.
5. **Tono directo.** Sin formalidades. Como un socio que te dice la verdad en 30 segundos.

### Datos del resumen

| Campo | De dónde viene |
|-------|----------------|
| Gasto total | `SUM(spend)` de todas las campañas activas, ayer |
| Revenue | `SUM(action_values[purchase])` de ayer |
| ROAS general | Revenue / Gasto |
| Qué funciona | Campañas con ROAS > objetivo, ordenadas por revenue descendente |
| Qué falla | Campañas con alertas activas (críticas y altas primero) |
| Acciones | Top 3 decisiones sugeridas por la IA, ordenadas: PAUSAR > CAMBIAR > ESCALAR |
| Pérdida evitable | Suma de gasto diario en campañas clasificadas como "perdedoras" |
| Oportunidad | Revenue proyectado adicional si se escalan las ganadoras al +25% |

---

## 6. Tipos de Alertas Inteligentes

### Alertas de Pérdida (prioridad alta — rojo)
| Alerta | Condición | Mensaje ejemplo |
|--------|-----------|-----------------|
| Campaña zombie | Gasto > 2x CPA objetivo, 0 conversiones | "Campaña X gastó $120 sin resultados. Pérdida diaria: $60" |
| ROAS bajo breakeven | ROAS < umbral mínimo por 2+ días | "Campaña Y lleva 3 días con ROAS 1.2x (tu mínimo: 2.5x). Pérdida estimada: $340" |
| Sangrado múltiple | Suma de ad sets no rentables > $50/día | "5 ad sets perdiendo un total de $150/día ($4,500/mes proyectado)" |
| Presupuesto quemado | 50%+ del presupuesto diario gastado en primeras 4 horas | "Campaña Z quemó $80 de $100 antes de las 12PM. Ritmo anormal" |

### Alertas de Degradación (prioridad media — amarillo)
| Alerta | Condición | Mensaje ejemplo |
|--------|-----------|-----------------|
| Fatiga creativa | Frecuencia > 2.5 + CTR cayó > 20% vs. promedio | "Ad Set W: frecuencia 3.1, CTR cayó de 2.1% a 1.4%. Rota creativos" |
| CPA en ascenso | CPA subiendo 3 días consecutivos | "CPA de Ad Set V subió de $12 a $18 en 3 días (+50%)" |
| CTR colapsando | CTR cayó > 30% vs. promedio 7 días | "CTR de Ad X cayó de 1.8% a 1.1%. Revisá el creative" |
| Learning Limited | Ad set en Learning Limited > 7 días | "Ad Set U lleva 10 días en Learning Limited. No es viable así" |

### Alertas Informativas (prioridad baja — azul)
| Alerta | Condición | Mensaje ejemplo |
|--------|-----------|-----------------|
| Campaña lista para escalar | ROAS > target por 5+ días, CPA estable | "Campaña A lleva 7 días con ROAS 4.5x. Lista para escalar" |
| Récord de rendimiento | Mejor día/semana en una métrica | "Campaña B tuvo su mejor día: 23 conversiones, CPA $9.20" |
| CPM anómalo | CPM > 50% sobre promedio 7 días | "CPM subió 55%. Puede ser estacional o competencia" |
| Underspend | Gasto < 50% del presupuesto a mitad del día | "Campaña C solo gastó $15 de $50. Posible problema de delivery" |

---

## 6.B Estructura de Cada Alerta

Toda alerta en AdPilot sigue un formato de 4 campos obligatorios:

```
┌─────────────────────────────────────────────────────────┐
│ PROBLEMA:    Qué se detectó                             │
│ SEVERIDAD:   Crítica | Alta | Media | Baja              │
│ IMPACTO:     Cuánto dinero/rendimiento está en juego    │
│ ACCIÓN:      Qué hacer ahora mismo                     │
└─────────────────────────────────────────────────────────┘
```

### Ejemplos reales con los 4 campos

**Alerta 1: CTR bajo**
```
PROBLEMA:   CTR de 0.6% en Ad Set "Retargeting Mayo" (por debajo del 0.8% mínimo)
SEVERIDAD:  Media
IMPACTO:    CPC inflado a $3.20 (2x tu promedio). Gasto ineficiente de ~$45/día
ACCIÓN:     El creativo no genera clicks. Probar nuevo ángulo visual o cambiar copy del headline
```

**Alerta 2: Campaña zombie**
```
PROBLEMA:   Campaña "Launch V2" gastó $240 en 4 días con 0 conversiones
SEVERIDAD:  Crítica
IMPACTO:    Pérdida directa de $240. Proyección si no se pausa: $60/día ($1,800/mes)
ACCIÓN:     Pausar inmediatamente. Revisar audiencia y oferta antes de relanzar
```

**Alerta 3: Fatiga creativa**
```
PROBLEMA:   Frecuencia 3.4 en Ad Set "Lookalike US". CTR cayó de 2.1% a 1.3% en 6 días
SEVERIDAD:  Alta
IMPACTO:    CPA subió 35% ($11 → $15). Si no se actúa, seguirá degradándose
ACCIÓN:     Rotar creativos: nuevo video/imagen con ángulo diferente. No cambiar audiencia
```

**Alerta 4: Oportunidad de escala**
```
PROBLEMA:   Campaña "Webinar Funnel" lleva 7 días con ROAS 4.8x y CPA estable en $9
SEVERIDAD:  Baja (oportunidad, no problema)
IMPACTO:    Potencial de revenue adicional si se escala. Actualmente genera $480/día
ACCIÓN:     Subir presupuesto 25% ($100 → $125/día). Monitorear CPA las primeras 48h
```

**Alerta 5: Embudo roto**
```
PROBLEMA:   CTR 2.3% (excelente) pero tasa de conversión 0.4% (muy baja) en "Promo Black Friday"
SEVERIDAD:  Alta
IMPACTO:    Estás pagando por clicks que no convierten. CPA real: $38 (objetivo: $15)
ACCIÓN:     El ad funciona. El problema es la landing page. Revisar: velocidad de carga, oferta, CTA, formulario
```

---

## 6.C Contexto por Objetivo de Campaña

Las métricas clave y reglas de análisis cambian según el objetivo de la campaña. AdPilot adapta su evaluación automáticamente:

### Lead Generation
| Métrica primaria | Verde | Amarillo | Rojo |
|-----------------|-------|----------|------|
| **CPL** (Costo por Lead) | < objetivo | 1x-1.5x objetivo | > 1.5x objetivo |
| **Tasa de conversión** (leads/clicks) | > 10% | 5%-10% | < 5% |
| **Costo por Lead Calificado** | < 2x CPL | 2x-3x CPL | > 3x CPL |

```
Reglas específicas:
- SI CPL < objetivo Y tasa conversión > 10% → "Lead gen saludable. Evaluar calidad de leads"
- SI CPL bajo PERO leads no califican → "Volumen alto, calidad baja. Revisar targeting o formulario"
- SI tasa conversión < 5% → "Formulario o landing no convierte. Simplificar campos o mejorar oferta"
```

### Ventas / Conversiones
| Métrica primaria | Verde | Amarillo | Rojo |
|-----------------|-------|----------|------|
| **ROAS** | > 3x | 2x-3x | < 2x |
| **CPA** | < objetivo | 1x-1.5x objetivo | > 1.5x objetivo |
| **AOV** (Valor Promedio de Orden) | Estable o subiendo | Cayendo < 10% | Cayendo > 10% |

```
Reglas específicas:
- SI ROAS > 3x Y CPA estable 5+ días → "Escalar"
- SI ROAS > 3x PERO AOV cayendo → "Revenue por vanidad. Vendes más pero de menor valor"
- SI CPA sube Y ROAS baja simultáneamente → "Doble degradación. Acción urgente"
```

### Mensajes (WhatsApp/Messenger)
| Métrica primaria | Verde | Amarillo | Rojo |
|-----------------|-------|----------|------|
| **Costo por conversación** | < objetivo | 1x-1.5x objetivo | > 1.5x objetivo |
| **Tasa de inicio de chat** | > 15% | 8%-15% | < 8% |
| **Costo por respuesta** | < 2x costo por chat | 2x-3x | > 3x |

```
Reglas específicas:
- SI costo/conversación bajo PERO poca gente responde → "Leads fríos. Revisar copy del ad o pre-cualificar"
- SI tasa de inicio alta → "Buen engagement. Asegurar que hay capacidad de respuesta"
```

### Tráfico
| Métrica primaria | Verde | Amarillo | Rojo |
|-----------------|-------|----------|------|
| **CTR (link)** | > 2% | 1%-2% | < 1% |
| **CPC** | < $1.00 | $1.00-$2.00 | > $2.00 |
| **Bounce rate** (si hay analytics) | < 40% | 40%-60% | > 60% |

```
Reglas específicas:
- SI CTR alto Y CPC bajo → "Tráfico eficiente"
- SI CTR alto PERO bounce rate alto → "Atrae clicks pero la landing decepciona. Alinear promesa del ad con contenido"
- SI CPC > $2 → "Tráfico caro. Probar audiencias más amplias o creativos más llamativos"
```

### Lógica de detección de objetivo

AdPilot detecta el objetivo automáticamente del campo `objective` de la API de Facebook:
```
OUTCOME_SALES      → Ventas/Conversiones
OUTCOME_LEADS      → Lead Generation
OUTCOME_ENGAGEMENT → Mensajes (si optimiza por messaging_conversations)
OUTCOME_TRAFFIC    → Tráfico
OUTCOME_AWARENESS  → Alcance (benchmarks más laxos, foco en CPM y frecuencia)
```

---

## 6.D Análisis por Ventana de Tiempo

El sistema analiza campañas en 4 ventanas y compara entre ellas para detectar tendencias:

### Ventanas de análisis

| Ventana | Uso | Decisión típica |
|---------|-----|-----------------|
| **1 día** | Decisiones rápidas, detección de anomalías | "¿Algo explotó hoy? ¿Gasto anormal?" |
| **3 días** | Tendencia inicial, primeras señales | "¿El CPA está subiendo o fue un día malo?" |
| **7 días** | Validación de rendimiento, base de comparación | "¿Esta campaña realmente funciona o fue suerte?" |
| **14 días** | Estabilidad, madurez de campaña | "¿Puedo confiar en estos números para escalar?" |

### Comparación entre ventanas

La IA compara automáticamente la ventana corta vs. la larga para diagnosticar:

```
DETERIORO
  SI métrica(1d) < métrica(7d) × 0.8
  ENTONCES → "CPA hoy: $18. Promedio 7 días: $12. Deterioro de 50%. Observar mañana"
  
  SI métrica(3d) < métrica(7d) × 0.8
  ENTONCES → "Tendencia confirmada: CPA subió 40% en 3 días vs. promedio semanal. Acción requerida"

MEJORA
  SI métrica(3d) > métrica(7d) × 1.2
  ENTONCES → "ROAS mejoró 25% en últimos 3 días vs. promedio semanal. Posible candidata para escalar"

FATIGA
  SI métrica(7d) > métrica(14d) × 1.1
  Y frecuencia(7d) > frecuencia(14d)
  ENTONCES → "Degradación sostenida. CPA subió 15% semana vs. semana y frecuencia en aumento. Fatiga confirmada"

ESTABILIDAD (señal para escalar)
  SI variación(métrica, 7d) < 15%
  Y ROAS > objetivo
  ENTONCES → "Rendimiento estable por 7 días. Candidata segura para escalar"

RECUPERACIÓN
  SI métrica(3d) > métrica(7d)
  Y métrica(7d) < métrica(14d)
  ENTONCES → "Hubo una caída la semana pasada pero los últimos 3 días muestran recuperación"
```

### Dashboard: selector de ventana

El usuario puede cambiar la ventana de tiempo en cualquier vista. El dashboard muestra por defecto **7 días** con indicadores de tendencia:

```
Campaña "Funnel Webinar"
├─ ROAS: 4.2x  ▲ +18% vs semana anterior
├─ CPA:  $11   ▼ -8% vs semana anterior  (mejorando)
├─ CTR:  1.9%  ● sin cambio significativo
└─ Freq: 2.1   ▲ +0.4 vs semana anterior (vigilar)
```

Flechas de tendencia:
- ▲ verde = mejorando (para ROAS, CTR) / empeorando (para CPA, frecuencia, CPC)
- ▼ rojo = empeorando (para ROAS, CTR) / mejorando (para CPA, frecuencia, CPC)  
- ● gris = estable (variación < 5%)

*Nota: las flechas invierten su color según la métrica. Para CPA, "bajar" es bueno (verde). Para ROAS, "bajar" es malo (rojo).*

---

## 7. Campañas Ganadoras vs Perdedoras

### Definición basada en métricas del usuario

Al onboarding, el usuario define sus umbrales. AdPilot clasifica automáticamente:

```
GANADORA (verde)
├─ ROAS > objetivo del usuario (ej: > 3x)
├─ CPA < objetivo del usuario (ej: < $15)
├─ Tendencia estable o mejorando (3+ días)
└─ Delivery saludable (no Learning Limited)

EN RIESGO (amarillo)
├─ ROAS entre breakeven y objetivo (ej: 2x-3x)
├─ CPA entre objetivo y 150% del objetivo
├─ Frecuencia subiendo (>2.5 prospecting)
└─ CTR en declive vs. semana anterior

PERDEDORA (rojo)
├─ ROAS < breakeven del usuario (ej: < 2x)
├─ CPA > 150% del objetivo
├─ Sin conversiones después de gastar 2x CPA objetivo
└─ Learning Limited por más de 7 días

NUEVA / EN APRENDIZAJE (gris)
├─ Menos de 3 días activa
├─ Menos de 50 conversiones en la semana
└─ No se clasifica aún — se observa
```

### Tabla de referencia (benchmarks generales)

| Métrica | Verde (bueno) | Amarillo (atención) | Rojo (problema) |
|---------|---------------|---------------------|------------------|
| CTR (link) | > 1.5% | 0.8% – 1.5% | < 0.8% |
| CPC | < $1.50 | $1.50 – $3.00 | > $3.00 |
| CPM | < $15 | $15 – $30 | > $30 |
| ROAS | > 3x | 2x – 3x | < 2x |
| Frecuencia (prospecting) | < 2 | 2 – 3 | > 3 |
| Frecuencia (retargeting) | < 4 | 4 – 6 | > 6 |
| Hook Rate (video) | > 30% | 20% – 30% | < 20% |

**Nota:** Estos son benchmarks generales. AdPilot prioriza los umbrales personalizados del usuario sobre los genéricos. El sistema aprende del historial de cada cuenta.

---

## 8. Métricas Clave a Analizar

### Métricas de Rendimiento (las que importan para el negocio)
| Métrica | Qué mide | Por qué importa |
|---------|----------|-----------------|
| **ROAS** | Revenue / Spend | ¿Estoy ganando dinero? |
| **CPA** | Costo por adquisición | ¿Cuánto me cuesta un cliente? |
| **Conversiones** | Acciones completadas | ¿Cuántos resultados obtuve? |
| **Spend** | Gasto total | ¿Cuánto estoy invirtiendo? |
| **Revenue** | Ingresos atribuidos | ¿Cuánto generaron mis ads? |

### Métricas de Eficiencia (las que diagnostican problemas)
| Métrica | Qué mide | Por qué importa |
|---------|----------|-----------------|
| **CTR (link)** | Clicks al enlace / Impresiones | ¿Mi anuncio genera interés? |
| **CPC** | Costo por click | ¿Estoy pagando demasiado por atención? |
| **CPM** | Costo por 1,000 impresiones | ¿Qué tan caro es el mercado? |
| **Frecuencia** | Impresiones / Alcance | ¿Estoy saturando la audiencia? |
| **Tasa de conversión** | Conversiones / Clicks | ¿Mi landing page convierte? |

### Métricas de Creativos (video)
| Métrica | Qué mide | Por qué importa |
|---------|----------|-----------------|
| **Hook Rate** | Views 3s / Impresiones | ¿El gancho del video atrapa? |
| **Hold Rate** | ThruPlays / Views 3s | ¿El video retiene después del gancho? |
| **Video completions** | % que ve el video completo | ¿El mensaje llega completo? |

### Métricas de Delivery
| Métrica | Qué mide | Por qué importa |
|---------|----------|-----------------|
| **Delivery status** | Estado de entrega del ad set | ¿Está corriendo normalmente? |
| **Learning phase** | ¿En optimización o estable? | ¿Puedo tomar decisiones o debo esperar? |
| **Budget utilization** | Gasto real vs. presupuesto | ¿Está gastando lo que debería? |

---

## 9. Reglas Básicas de Análisis

El motor de reglas de AdPilot evalúa combinaciones de métricas, no métricas aisladas.

### Reglas de diagnóstico

```
REGLA: creative_fatigue
  SI frecuencia > 2.5
  Y CTR cayó > 20% vs promedio 7 días
  ENTONCES → "Fatiga creativa. Rota creativos."
  PRIORIDAD: media

REGLA: landing_page_problem
  SI CTR > 1.5%
  Y tasa de conversión < 1%
  ENTONCES → "El ad funciona, la landing no convierte."
  PRIORIDAD: alta

REGLA: zombie_campaign
  SI gasto > (CPA_objetivo × 2)
  Y conversiones == 0
  ENTONCES → "Campaña zombie. Pausar inmediatamente."
  PRIORIDAD: crítica

REGLA: ready_to_scale
  SI ROAS > objetivo por 5+ días consecutivos
  Y CPA estable (variación < 15%)
  Y delivery == ACTIVE (no Learning Limited)
  ENTONCES → "Lista para escalar. Sube presupuesto 20-30%."
  PRIORIDAD: oportunidad

REGLA: bad_scaling
  SI presupuesto aumentó > 30% en un día
  Y delivery == LEARNING
  ENTONCES → "Salto de presupuesto muy grande. Reseteó aprendizaje."
  PRIORIDAD: media

REGLA: audience_saturation
  SI ROAS en descenso 5+ días
  Y frecuencia en ascenso
  Y CTR en descenso
  ENTONCES → "Audiencia saturada. Expande targeting o prueba lookalikes."
  PRIORIDAD: alta

REGLA: bleeding_money
  SI suma de gasto diario en ad sets con ROAS < 1x > $50
  ENTONCES → "Sangrado: $X/día en ad sets no rentables. Proyección mensual: $Y."
  PRIORIDAD: crítica

REGLA: cpm_anomaly
  SI CPM > 150% del promedio 7 días
  Y sin cambios en targeting
  ENTONCES → "CPM anómalo. Posible estacionalidad o competencia."
  PRIORIDAD: baja

REGLA: learning_limited_stuck
  SI delivery_status == LEARNING_LIMITED por > 7 días
  ENTONCES → "Ad set no viable. Necesita más presupuesto o audiencia más amplia."
  PRIORIDAD: media

REGLA: overspend_pacing
  SI gasto en primeras 4 horas > 50% del presupuesto diario
  ENTONCES → "Ritmo de gasto anormal. Revisa pacing."
  PRIORIDAD: alta

REGLA: underspend
  SI gasto < 50% del presupuesto a mitad del día
  ENTONCES → "Delivery bajo. Posible audiencia muy pequeña o bid muy bajo."
  PRIORIDAD: media

REGLA: winner_concentration
  SI top 2 campañas generan > 70% del revenue
  Y hay 3+ campañas activas más
  ENTONCES → "Concentración de riesgo. 70% del retorno depende de 2 campañas."
  PRIORIDAD: media
```

### Lógica de priorización de alertas

```
1. CRÍTICA → Pérdida activa de dinero (zombie, bleeding)
2. ALTA → Degradación que empeorará (landing page, audience saturation, overspend)
3. MEDIA → Problemas que necesitan atención pronto (fatigue, CPA subiendo, learning limited)
4. BAJA → Informativo (CPM anómalo, oportunidad de escala)
```

---

## 10. Evolución Futura (NO implementar en MVP)

### Fase 2: Automatización
- Pausar/activar campañas automáticamente según reglas
- Ajuste automático de presupuesto (escalar ganadoras, pausar perdedoras)
- Rotación automática de creativos cuando se detecta fatiga
- Scheduling: reglas por horario ("pausa esta campaña después de las 11PM")

### Fase 3: Inteligencia Avanzada
- Predicción de fatiga creativa antes de que pase (modelo ML sobre tendencias)
- Análisis de creativos con vision AI (qué elementos visuales correlacionan con alto CTR)
- Atribución propia (comparar ROAS de Facebook vs. revenue real del backend)
- Análisis de audiencia: qué segmentos (edad, género, ubicación) rinden mejor
- Scoring de anuncios antes de lanzarlos (basado en patrones históricos)

### Fase 4: Multi-plataforma
- Google Ads
- TikTok Ads
- Vista unificada cross-platform
- Comparativa de rendimiento entre plataformas

### Fase 5: Equipo y Agencia
- Multi-tenant (agencias con múltiples clientes)
- Roles y permisos
- Reportes automáticos para clientes
- White-label

### Fase 6: Marketplace de Estrategias
- Templates de reglas compartidos por la comunidad
- Benchmarks anónimos por industria
- Ranking de creativos por vertical

---

## Estructura de Datos (Facebook Ads API)

### Jerarquía
```
Ad Account
  └── Campaign (objetivo, presupuesto CBO)
       └── Ad Set (audiencia, presupuesto ABO, schedule, placements)
            └── Ad (creative: imagen/video, copy, CTA)
```

### Campos clave del API de Insights
```
Rendimiento: impressions, clicks, spend, reach, actions, action_values
Costos: cpc, cpm, cost_per_action_type
Video: video_p25_watched, video_p50_watched, video_p75_watched, video_p100_watched
Status: effective_status, delivery_info
Budget: daily_budget, lifetime_budget (en centavos: $50 = 5000)
```

### Breakdowns disponibles
```
Demográficos: age, gender, country
Plataforma: publisher_platform, platform_position, device_platform
Tiempo: hourly_stats, daily (time_increment=1)
```

### Atribución post-iOS 14.5
Default: 7-day click, 1-day view. Los datos reportados son **modelados** (estimados), no 100% exactos. ROAS real suele ser 20-40% menor al reportado.

---

## Scope del MVP (Fase 1)

| Incluido | NO incluido |
|----------|-------------|
| Dashboard con métricas clave | Automatizaciones |
| Clasificación ganadora/perdedora/en riesgo | Acciones automáticas sobre campañas |
| Alertas inteligentes (in-app) | Notificaciones push/email/SMS |
| Chat con IA (preguntas sobre campañas) | Predicción ML avanzada |
| Reglas de análisis predefinidas | Reglas custom del usuario |
| Conexión con 1 ad account | Multi-account / multi-plataforma |
| Historial últimos 30 días | Historial ilimitado |
| 1 usuario por cuenta | Equipos / roles / permisos |
| Benchmarks generales | Benchmarks por industria |

---

*Este documento es la fuente de verdad para el diseño e implementación de AdPilot.*
*Toda feature debe validarse contra este documento antes de construirse.*

---
name: Modelos de IA en AdPilot
description: Configuracion de modelos de IA - OpenRouter con auto-rotacion, Google AI quota 0, Anthropic sin creditos
type: reference
---

## Modelo actual: OpenRouter (gratuito)
- **Config:** `src/lib/ai-model.ts` — sistema de auto-rotación entre 6 modelos
- **Key:** OPENROUTER_API_KEY en `.env.local`
- **Modelos (en orden de prioridad):**
  1. nvidia/nemotron-nano-9b-v2:free
  2. arcee-ai/trinity-mini:free
  3. minimax/minimax-m2.5:free
  4. qwen/qwen3.6-plus:free
  5. nvidia/nemotron-3-super-120b-a12b:free
  6. liquid/lfm-2.5-1.2b-instruct:free

## Problema: modelos gratuitos son intermitentes
- Rate limits frecuentes
- Timeouts en hora pico
- Mitigación: auto-rotación + 3 reintentos en frontend

## Alternativas configuradas pero no funcionales:
- **Google AI:** GOOGLE_GENERATIVE_AI_API_KEY tiene quota 0 (no funciona)
- **Anthropic:** ANTHROPIC_API_KEY sin créditos

## Archivos que usan IA:
- `src/app/api/chat/route.ts` — Chat principal (getModel() + rotateModel())
- `src/app/api/critic/route.ts` — AdPilot Critic (getModel() + rotateModel())
- `src/lib/creative-lab.ts` — Generación de copy (fetch directo a OpenRouter)

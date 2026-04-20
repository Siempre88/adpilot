import { streamText, stepCountIs } from 'ai'
import { getModel, rotateModel } from '@/lib/ai-model'
import { z } from 'zod'
import { getCampaignsWithMetrics, getTopCampaigns, getWorstCampaigns } from '@/lib/meta-ads'
import { getCreativeInsights } from '@/lib/creative-lab'
import { withMetaAuth } from '@/lib/api-auth'

const CRITIC_PROMPT = `Evalúas anuncios de Facebook. Directo. Proteges dinero.

FORMATO:

**ANÁLISIS:**
- Lo bueno: (si hay algo bueno, reconócelo)
- Lo malo: (específico, sin rodeos)

**PROBLEMA:** [1 frase simple y directa]

**IMPACTO:** [Qué pasa con el dinero. Usa datos reales si hay.]

**VEREDICTO:** NO PUBLICAR / PROBAR / PUBLICAR

REGLAS DE VEREDICTO:

NO PUBLICAR: copy largo, hook débil, no se entiende rápido, CTA débil, no detiene scroll.

PROBAR: estructura decente, necesita ajuste menor.

PUBLICAR: hook claro, copy corto, CTA directo, se entiende al instante.

DESPUÉS DEL VEREDICTO:

Si NO PUBLICAR → generar corrección completa:
**VERSIÓN CORREGIDA:**
**Hook:** [máx 8 palabras]
**Copy:** [máx 2 líneas]
**CTA:** [máx 4 palabras]
**Por qué funciona:** [1 línea]

Si PROBAR → solo sugerir 1-2 ajustes pequeños. NO reescribir todo.

Si PUBLICAR → decir "Listo. Publícalo." y si acaso 1 sugerencia menor.

REGLA CLAVE: Si el anuncio ya es bueno, NO lo rehaces. No sobre-optimices. Un anuncio simple y claro gana en feed. No le agregues complejidad.

PROHIBIDO SIEMPRE (en análisis Y en correcciones):
- Inventar credibilidad: "25 años", "estudios", "universidad", "certificado", "expertos dicen"
- Superlativos falsos: "el mejor", "increíble", "único", "revolucionario", "premium"
- Términos técnicos innecesarios: "propuesta de valor", "engagement", "awareness", "funnel"
- Clickbait: "no vas a creer", "esto cambia todo"
- Sonar corporativo: habla como persona, no como empresa

PERMITIDO:
- Datos reales: "12 sabores", "entrega en 2h", "quedan 5"
- Urgencia verificable: "se acaban antes de las 2pm"
- Beneficio concreto: "crujientes por fuera, suaves por dentro"
- Lenguaje simple: como le hablas a un vecino, no a un inversionista

TONO: Simple y directo. Nada de jerga. Si tu abuela no entiende la frase, cámbiala.
IDIOMA: Español.
DATOS: Usa tools para comparar contra campañas reales si están disponibles.
LARGO: Máximo 15 líneas.`

const datePresetSchema = z.enum(['today', 'last_3d', 'last_7d', 'last_14d', 'last_30d', 'last_90d', 'maximum']).default('last_7d')

const criticTools = {
  getAccountMetrics: {
    description: 'Obtiene métricas reales de la cuenta para comparar contra el creativo propuesto.',
    parameters: z.object({ datePreset: datePresetSchema }),
    execute: async ({ datePreset }: { datePreset: string }) => {
      const campaigns = await getCampaignsWithMetrics(datePreset as any)
      const winners = campaigns.filter(c => c.classification === 'winner' && c.total_spend > 0)
      const losers = campaigns.filter(c => c.classification === 'loser' && c.total_spend > 0)
      return {
        total_campaigns: campaigns.length,
        winners: winners.length,
        losers: losers.length,
        avg_winner_ctr: winners.length > 0
          ? Math.round((winners.reduce((s, c) => s + c.avg_ctr, 0) / winners.length) * 100) / 100
          : 0,
        avg_loser_ctr: losers.length > 0
          ? Math.round((losers.reduce((s, c) => s + c.avg_ctr, 0) / losers.length) * 100) / 100
          : 0,
        best_campaign: winners[0] ? { name: winners[0].name, ctr: winners[0].avg_ctr, score: winners[0].score } : null,
        worst_campaign: losers[0] ? { name: losers[0].name, ctr: losers[0].avg_ctr, score: losers[0].score } : null,
      }
    },
  },

  getWinningPatterns: {
    description: 'Obtiene los patrones creativos que funcionan en esta cuenta.',
    parameters: z.object({ datePreset: datePresetSchema }),
    execute: async ({ datePreset }: { datePreset: string }) => {
      const insights = await getCreativeInsights(datePreset)
      return {
        winning_patterns: insights.winning_patterns,
        losing_patterns: insights.losing_patterns,
        recommendation: insights.recommendation,
        best_ctr: insights.best_ctr,
        worst_ctr: insights.worst_ctr,
      }
    },
  },

  getTopCampaigns: {
    description: 'Obtiene las campañas con mejor rendimiento para comparar.',
    parameters: z.object({ datePreset: datePresetSchema, limit: z.number().default(3) }),
    execute: async ({ datePreset, limit }: { datePreset: string; limit: number }) => {
      const top = await getTopCampaigns(datePreset as any, limit)
      return top.map(c => ({
        name: c.name, score: c.score, avg_ctr: c.avg_ctr,
        total_clicks: c.total_clicks, total_spend: c.total_spend,
      }))
    },
  },
}

export async function POST(req: Request) {
  const auth = await withMetaAuth()
  if ('error' in auth) return auth.error

  const { messages } = await req.json()

  const result = streamText({
    model: getModel(),
    system: CRITIC_PROMPT,
    messages,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: criticTools as any,
    stopWhen: stepCountIs(4),
    timeout: 30000,
  })

  return result.toUIMessageStreamResponse()
}

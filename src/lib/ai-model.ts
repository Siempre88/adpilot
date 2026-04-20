import { createOpenRouter } from '@openrouter/ai-sdk-provider'

// Models ordered by preference. If one fails, the next is tried automatically.
const FREE_MODELS = [
  'nvidia/nemotron-nano-9b-v2:free',
  'arcee-ai/trinity-mini:free',
  'minimax/minimax-m2.5:free',
  'qwen/qwen3.6-plus:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'liquid/lfm-2.5-1.2b-instruct:free',
]

let currentModelIndex = 0
let lastFailTime = 0

export function getModel() {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set')

  // If last fail was more than 5 min ago, reset to preferred model
  if (Date.now() - lastFailTime > 5 * 60 * 1000) {
    currentModelIndex = 0
  }

  const modelId = FREE_MODELS[currentModelIndex] || FREE_MODELS[0]
  console.log(`[AI Model] Using: ${modelId}`)
  return createOpenRouter({ apiKey })(modelId)
}

export function rotateModel() {
  lastFailTime = Date.now()
  currentModelIndex = (currentModelIndex + 1) % FREE_MODELS.length
  console.log(`[AI Model] Rotating to: ${FREE_MODELS[currentModelIndex]}`)
}

---
name: Meta Ads del proyecto AdPilot
description: Credenciales y configuracion de Meta Ads API para AdPilot, cuenta act_212677000
type: reference
---

- **Ad Account ID:** act_212677000
- **Account Name:** Ever Enriquez
- **App ID:** 1715443232957334
- **Graph API Version:** v21.0
- **Token actual:** No expira (long-lived)
- **Service file:** `src/lib/meta-ads.ts` (Graph API directa, sin SDK)
- **Error handling:** `MetaAuthError` class + `validateMetaToken()` + `/api/health/meta`
- **API Routes:** `/api/campaigns`, `/api/insights`, `/api/alerts`, `/api/chat`, `/api/health`, `/api/health/meta`, `/api/settings/meta`, `/api/creative-lab`, `/api/critic`
- **Credenciales** en `.env.local` (META_ACCESS_TOKEN, META_AD_ACCOUNT_ID, META_APP_ID, META_APP_SECRET)
- **31 campañas** en la cuenta, 15 con gasto historico
- **Tipo de campañas:** Marketplace promotions (vehiculos, productos)
- **Fallback:** Si `last_7d` retorna vacio, automáticamente usa `maximum`
- **Settings UI:** `/settings` permite cambiar token sin reiniciar servidor

# Medovant — Technical Debt Register

Deuda técnica reconocida, decisiones de diseño pendientes y riesgos asumidos.
Cada item tiene un id (`TD-xx`), estado y referencia al issue de GitHub cuando existe.

| ID | Tema | Estado |
|----|------|--------|
| TD-01 | Indexer on-chain → off-chain | Abierto (issue separado) |
| TD-02 | Metadata en localStorage en vez de Supabase | Cerrado (#69) — código en Supabase; riesgo residual: env vars de deploy |
| TD-03 | Discovery loop 1-10 con `getProgramAccounts` | Abierto |
| TD-03b | PST: transacción parcialmente firmada (hand-off hospital ↔ técnico) | Implementado (#14) |
| TD-04 | Modelo de confianza de la evidencia off-chain | Cerrado por el modelo Edge Function (ver abajo) |
| TD-05 | Ventana de disputa / cancelación de reporte | Abierto (candidato v1.2) |
| TD-08 | RLS abiertas en `maintenance_events` y bucket `evidence` | Cerrado (#26) |

---

## TD-02 — Metadata de activos: localStorage → Supabase

Cerrado a nivel de código
([#69](https://github.com/licette32/medovant-protocol/issues/69)): la metadata de
activos vive en la tabla `assets` de Supabase, escrita y leída vía
`utils/assetMetadata.ts` (`upsertAssetMeta`, `hydrateAssetMetadata`, con migración
one-time desde localStorage por hospital). El store legacy queda únicamente como
fallback de demo cuando faltan `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY`.

Riesgo residual asumido: es de **configuración de deploy, no de código**. Las env
vars ya están configuradas en Vercel; el escenario de regresión es un redeploy o
proyecto nuevo sin ellas, donde la app degrada silenciosamente a `localStorage`.
Mitigación operativa: verificarlas tras cada cambio de proyecto/deploy (ver
`docs/DEPLOYMENT.md`).

---

## TD-04 — Modelo de confianza de la evidencia off-chain

### El gap
Las filas de `maintenance_events` (issue #4) se escribían con la anon key desde el
bundle del frontend, con policies `using (true)` / `with check (true)`. Como la
anon key es pública, cualquier cliente podía insertar una fila para un `asset_pda`
o `technician` arbitrario — incluso un activo que nunca se tocó on-chain — y esa
fila aparecía en el modal de revisión del hospital justo antes de firmar la
liberación del escrow. `evidence_hash` protege la integridad del archivo, no la
identidad del que lo sube.

### Modelo elegido (cierra el hueco de escritura — TD-08, #26)
- **Orden: primero el tx, después la evidencia.** La evidencia se sube únicamente
  después de que `complete_maintenance` aterriza on-chain. Nunca existe una fila
  "provisional" sin verificar: no hay estado pending que un atacante pueda dejar
  "como si fuera legítimo".
- **Un solo escritor: Edge Function `evidence`** (`supabase/functions/evidence`).
  El cliente envía el archivo + `tx_signature`. La función verifica contra el RPC
  de devnet que:
  1. el tx existe y no falló (`meta.err == null`),
  2. el programa medovant (`5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD`) está
     entre los programas invocados,
  3. el `asset_pda` reclamado aparece entre las cuentas del tx,
  4. el `technician` reclamado firmó el tx.
  Solo si pasa, sube el archivo al bucket `evidence` e inserta la fila con el
  service role (bypass de RLS).
- **RLS cerrada.** `maintenance_events`: sin policy de `insert`/`update` para anon
  (default deny); `select` restringido a filas con `tx_signature is not null`
  (filas legacy sin verificar son invisibles para la UI). Bucket `evidence`:
  lectura pública, escritura denegada a anon.
- **Trade-offs asumidos.**
  - La verificación es a nivel de "cuentas del tx" (programa + asset PDA + signer),
    no decodifica el evento Anchor `MaintenanceCompleted`. Para un atacante, tener
    un tx real que pase esos 4 checks equivale a ser el técnico dueño del activo
    (solo el dueño del `TechnicianProfile` puede firmar `complete_maintenance` para
    ese asset), así que el claim de identidad queda anclado on-chain.
  - El hash se calcula server-side en la Edge Function; el cliente ya no lo envía.
  - El deploy de la función es manual (`supabase functions deploy evidence`) — ver
    `docs/DEPLOYMENT.md`. Si no está deployada, `isEvidenceConfigured()` devuelve
    false (falta `VITE_SUPABASE_FUNCTIONS_URL`) y la UI oculta el uploader.

### Alternativas descartadas
- **Solo RLS / función Postgres:** no hay claim verificable en Postgres (la anon
  key es pública y no hay Supabase Auth); una `SECURITY DEFINER` tampoco puede
  distinguir al atacante sin consultar el RPC (pg_net es asíncrono).
- **Fila provisional + confirmación:** agrega estados pending/expiry y reglas de
  caducidad; más superficie de abuso que el orden tx-primero.

### Relación con TD-09 (#27) y el indexer (TD-01)
Este modelo es la decisión escrita que pide **TD-09 (#27)**: toda escritura off-chain
se valida contra la verdad on-chain antes de tratarse como autoritativa. El flujo de
evidencia lo implementa; el flujo de metadatos de `assets` queda fuera de alcance del
#27. Si el **indexer (TD-01)** llega a ser el único escritor de estas tablas, este
problema queda subsumido: la verificación pasaría a ser derivación de eventos
on-chain, y la Edge Function podría retirarse.

---

## TD-08 — RLS en `maintenance_events` y bucket `evidence`

Cerrado por [#26](https://github.com/licette32/medovant-protocol/issues/26) con el
modelo documentado en TD-04: escritura exclusiva vía Edge Function con verificación
on-chain, `select` restringido a filas verificadas, y bucket `evidence` sin escritura
anon.

---

## TD-03b — Transacción parcialmente firmada (PST)

El hand-off hospital ↔ técnico (PstPanel) construye un `complete_maintenance`
parcialmente firmado por el hospital y el técnico firma al pegar el payload. La
evidencia se sube después del submit del tx firmado por el técnico (mismo flujo
TD-04). Deuda residual: no hay reintento automático si la subida de evidencia falla
tras el tx (el tx ya quedó on-chain; la evidencia puede reintentarse manualmente).
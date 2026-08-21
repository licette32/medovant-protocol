# Arquitectura técnica — Medovant Protocol

Documento de referencia para la arquitectura del sistema. Corresponde al Milestone 3 del programa de incubación Solana Latam Labs / WayLearn.

---

## Versiones

| Versión | Estado | Descripción |
|---------|--------|-------------|
| v1.0 | ✅ Deployed (Devnet) | MVP técnico — hackathon |
| v1.1 | 🔄 En desarrollo | Incubación — indexer + DB off-chain |
| v2.0 | 📋 Planificado | Abstracción wallet + CMMS integration |

---

## Capas del sistema

### Capa 1 — Cliente (Browser)

**Stack:** React 18 + Vite + TypeScript + Tailwind CSS

Dos modos diferenciados dentro de la misma aplicación:
- **Hospital Mode:** registro de activos, reporte de incidencias, verificación de mantenimientos
- **Technician Mode:** visualización de órdenes disponibles, cobro automático, reputación

**Principio de diseño:** el usuario no necesita entender wallets, SOL ni transacciones para operar. La complejidad blockchain opera por debajo de la interfaz.

**Wallet integration:** `@solana/wallet-adapter` + Phantom. Target v1.1: abstracción de wallet para usuarios no cripto (wallets custodiales o firma delegada).

---

### Capa 2 — Solana (On-chain)

**Stack:** Anchor 0.32.1 + Rust

**Program ID:** `5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD`

**Network:** Devnet → Mainnet (antes del Demo Day)

#### Instrucciones

| Instrucción | Firmantes | Efecto on-chain |
|-------------|-----------|----------------|
| `register_technician` | técnico | Crea TechnicianProfile PDA |
| `initialize_asset(asset_id)` | hospital | Crea Asset PDA, status = Active |
| `report_issue(reward)` | hospital | Crea Vault PDA, transfiere SOL, failure_count++ |
| `complete_maintenance` | hospital + técnico | invoke_signed libera SOL, jobs_completed++ |
| `decommission_asset` | hospital | Cierra Asset PDA, devuelve rent |

#### Dual-Wallet `complete_maintenance` (PST Hand-Off)

Since **v1.0** the `complete_maintenance` instruction requires **two distinct signers** (hospital + technician). To avoid sharing private keys, the protocol uses a **Partially Signed Transaction (PST) hand-off**:

1. **Hospital** builds the tx, signs partially (fee payer), exports JSON payload.
2. **Technician** imports payload, re-derives all PDAs from trusted fields, verifies invariants, adds their signature, submits.

Full specification: [`docs/PST_HANDOFF.md`](PST_HANDOFF.md)

#### PDAs (Program Derived Addresses)

**Asset PDA**
```
seeds: [b"equipment", hospital_pubkey, asset_id_u64_le]
datos: asset_id, hospital, status, asset_name, failure_count, maintenance_reward, bump
estados: Active (0) | IssueReported (1) | Decommissioned (2)
```

**Vault PDA**
```
seeds: [b"vault", asset_pda]
tipo: system-owned (space=0) — el único patrón correcto para escrow nativo de SOL
liberación: invoke_signed con vault_seeds — no puede ser debitado via CPI ordinario
datos: solo SOL (sin datos struct)
```

**TechnicianProfile PDA**
```
seeds: [b"technician", tech_pubkey]
datos: is_registered, jobs_completed, bump
propósito: reputación verificable y portable entre instituciones
```

#### Mecanismo de escrow

```rust
// report_issue: crea vault y bloquea SOL
system_program::create_account(
    CpiContext::new_with_signer(
        ctx.accounts.system_program.to_account_info(),
        CreateAccount { from: hospital, to: vault },
        &[vault_seeds]
    ),
    rent_exempt_minimum,
    0,  // space = 0, system-owned
    &system_program::ID,
)?;
system_program::transfer(CpiContext::new(...), reward)?;

// complete_maintenance: libera SOL al técnico
system_program::transfer(
    CpiContext::new_with_signer(..., &[vault_seeds]),
    reward
)?;
```

---

### Capa 3 — Off-chain (v1.1 en desarrollo)

#### Event Indexer

**Stack:** Helius RPC webhooks

Escucha el log del programa on-chain y emite eventos cuando ocurren:
- `AssetInitialized` → nuevo activo registrado
- `IssueReported` → incidencia con escrow abierto
- `MaintenanceCompleted` → pago liberado, reputación actualizada
- `AssetDecommissioned` → activo dado de baja

#### Base de datos

**Stack:** PostgreSQL vía Supabase

Tablas planificadas:
```
assets
  asset_pda       TEXT PRIMARY KEY   -- clave pública de la PDA on-chain
  hospital        TEXT               -- pubkey del hospital propietario
  name            TEXT               -- nombre del equipo
  location        TEXT               -- ubicación física
  asset_type      TEXT               -- tipo (ventilador, resonador, etc.)
  created_at      TIMESTAMPTZ

maintenance_events
  id              UUID PRIMARY KEY
  asset_pda       TEXT REFERENCES assets
  event_type      TEXT               -- IssueReported | MaintenanceCompleted
  tx_signature    TEXT               -- firma de la transacción Solana
  evidence_url    TEXT               -- URL a foto/reporte en Supabase Storage
  timestamp       TIMESTAMPTZ
```

#### QR por activo (v1.1)

Cada equipo físico tendrá una etiqueta QR que codifica la URL:
```
https://app.medovant.io/asset/{asset_pda}
```

Al escanear, la app carga el historial completo del activo directamente desde la DB (metadata) y desde la cadena (estado actual).

---

## Flujo completo del sistema

```
Usuario (Hospital)
    │
    │  1. Conecta Phantom Wallet
    ▼
React App
    │
    │  2. Llama a initialize_asset(asset_id, name)
    ▼
@coral-xyz/anchor → Phantom firma tx
    │
    │  3. Transacción RPC a Devnet
    ▼
Anchor Program
    │
    │  4. Crea Asset PDA on-chain
    │     seeds: [equipment, hospital, asset_id]
    ▼
Solana Devnet
    │
    │  5. Emite evento AssetInitialized
    ▼
Event Indexer (Helius) [v1.1]
    │
    │  6. Persiste metadata en DB
    ▼
PostgreSQL / Supabase [v1.1]
    │
    │  7. Frontend consulta metadata
    ▼
React App muestra inventario actualizado
```

---

## División on-chain / off-chain

| Dato | Dónde vive | Por qué |
|------|-----------|---------|
| Estado del activo (Active/IssueReported/Decommissioned) | On-chain | Inmutable, auditable por cualquiera |
| SOL bloqueado en escrow | On-chain | Trustless — nadie puede tomarlo unilateralmente |
| Reputación del técnico (jobs_completed) | On-chain | Portable entre instituciones, no modificable |
| Historial de transacciones | On-chain (Solana) | Inmutable por diseño |
| Nombre y ubicación del equipo | Off-chain (DB) | No hay beneficio de inmutabilidad, reduce costos |
| Evidencia de mantenimiento (fotos, PDFs) | Off-chain (Storage) | Archivos grandes no van on-chain |
| Hash de evidencia (opcional) | On-chain | Para verificar integridad del archivo off-chain |

---

## Riesgos técnicos

Ver [TECHNICAL_DEBT.md](TECHNICAL_DEBT.md) para el detalle completo.

| Riesgo | Nivel | Mitigation |
|--------|-------|------------|
| Metadata en localStorage | 🔴 Alto | Migrar a Supabase (Semana 3) |
| Discovery loop 1-10 | 🔴 Alto | getProgramAccounts o event indexer |
| Secret key técnico en localStorage | 🔴 Alto | Wallet Phantom propia del técnico |
| Barrera UX: usuario necesita Phantom | 🟡 Medio | Abstracción wallet en v2.0 |
| CMMS integration (SAP, IBM Maximo) | 🟡 Medio | API pública en v2.0 |
| Escrow en SOL para uso institucional | 🟡 Medio | Abstracción stablecoin en v2.0 |
| Migración Devnet → Mainnet | 🟢 Bajo | Anchor upgradeable programs |

---

## Dependencias críticas

| Dependencia | Versión | Propósito |
|-------------|---------|-----------|
| `@coral-xyz/anchor` | 0.32.1 | Genera tipos TypeScript del programa |
| `@solana/wallet-adapter` | latest | Integración Phantom y otras wallets |
| `@solana/web3.js` | latest | RPC, transacciones, PDAs |
| Helius RPC | — | RPC confiable + webhooks para indexer (v1.1) |
| Supabase | — | PostgreSQL + Storage (v1.1) |
| Solana Devnet / Mainnet | — | Red de producción |
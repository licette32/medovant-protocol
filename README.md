<div align="center">

<img src="app/public/logo-home.png" alt="Medovant Logo" height="120" />

# MEDOVANT PROTOCOL

### *Infraestructura verificable para el mantenimiento de equipamiento médico crítico*

[![Solana](https://img.shields.io/badge/Solana-Devnet-3FAF8F?style=for-the-badge&logo=solana&logoColor=white)](https://explorer.solana.com/address/5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD?cluster=devnet)
[![Anchor](https://img.shields.io/badge/Anchor-0.32.1-5BC0BE?style=for-the-badge)](https://www.anchor-lang.com/)
[![React](https://img.shields.io/badge/React-18-E6B980?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3FAF8F?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Tests-8%20passing-3FAF8F?style=for-the-badge)](tests/)

<br/>

**[🎥 Ver Demo](https://youtu.be/k2O5ubKsi5w)** &nbsp;·&nbsp;
**[🔍 Solana Explorer](https://explorer.solana.com/address/5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD?cluster=devnet)** &nbsp;·&nbsp;
**[📂 Documentación](docs/)**

</div>

---

## Estado actual

> **En incubación activa** — Solana Latam Labs · WayLearn · Junio–Agosto 2026

| Milestone | Fecha | Estado |
|-----------|-------|--------|
| 🧭 Roadmap inicial del producto | 26 jun | ✅ Entregado |
| 🧱 Business Foundation | 3 jul | ✅ Entregado |
| 🏗️ Arquitectura técnica del MVP | 10 jul | ✅ Entregado |
| 🔍 Validación inicial con usuarios | 31 jul | 🔄 En progreso |
| ⚙️ MVP funcional | 21 ago | ⏳ Pendiente |
| 🎤 Pitch deck + Demo Day Readiness | 28 ago | ⏳ Pendiente |
| 🚀 Demo Day | 31 ago | ⏳ Pendiente |

El programa Anchor está deployado en Devnet con 8 tests automatizados pasando. Durante la incubación el foco es validar el producto con usuarios reales del sector salud y madurar la arquitectura hacia v1.1.

---

## El problema

El mantenimiento de equipos médicos críticos — ventiladores, resonadores, equipos de diagnóstico — se gestiona con **papel, confianza ciega y procesos manuales**. No hay verificación independiente de que el trabajo se realizó, los pagos llegan tarde o generan conflictos, y reunir documentación para una auditoría regulatoria puede tomar días.

| Actor | Problema hoy |
|-------|-------------|
| 🏥 **Hospital / clínica** | Paga el mantenimiento sin poder verificar de forma independiente si el trabajo se hizo correctamente |
| 🔧 **Técnico biomédico** | Cobra tarde, o no cobra — sin forma de construir reputación verificable entre distintos clientes |
| 📋 **Auditor / regulador** | Sin trazabilidad confiable del historial de mantenimiento para procesos de auditoría |

---

## La solución

Medovant registra cada activo médico como una identidad digital on-chain. Los pagos se bloquean en un vault PDA al reportar una falla y se liberan automáticamente cuando hospital y técnico confirman que el trabajo fue realizado — sin intermediarios, sin papel, sin posibilidad de modificar el historial.

```
El hospital paga solo cuando el trabajo está verificado.
El técnico cobra automáticamente al completarlo.
El auditor consulta el historial sin depender de nadie.
```

> Medovant nace desde la perspectiva de la ingeniería clínica: el protocolo fue diseñado desde el conocimiento del dominio, no al revés.

---

## ¿Por qué Solana?

<table>
<tr>
<td align="center" width="33%">

**🚀 Velocidad**

Finalidad sub-segundo. Las intervenciones médicas no pueden esperar confirmaciones de minutos.

</td>
<td align="center" width="33%">

**💰 Costo**

Registrar cientos de equipos cuesta menos de $5. Viable para hospitales de cualquier tamaño.

</td>
<td align="center" width="33%">

**🔐 Escrow nativo**

Vault PDA system-owned con `invoke_signed`. Sin contratos complejos ni intermediarios.

</td>
</tr>
</table>

---

## Flujo del protocolo

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   🏥 Hospital          ◎ Vault PDA          🔧 Técnico         │
│       │                     │                    │             │
│       │  initialize_asset   │                    │             │
│       │ ──────────────────► │                    │             │
│       │                     │                    │             │
│       │  report_issue       │                    │             │
│       │  + lock SOL ──────► │                    │             │
│       │                     │  SOL bloqueado     │             │
│       │                     │  (nadie lo toca)   │             │
│       │                     │                    │             │
│       │     complete_maintenance (ambos firman)   │             │
│       │ ──────────────────────────────────────►  │             │
│       │                     │                    │             │
│       │                     │  SOL liberado ───► │             │
│       │                     │                    │  +reputation│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Arquitectura

```
Wallet (Phantom)
        │
        ▼
React Frontend (Vite + TypeScript + Tailwind)
├── 🏥 Hospital Mode   → registro, incidencias, verificación
└── 🔧 Technician Mode → jobs disponibles, cobro, reputación
        │
        ▼
Anchor Program ── 5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD
        │
        ├── Asset PDA              seeds: ["equipment", hospital, asset_id]
        ├── Vault PDA              seeds: ["vault", asset_pda]  ← system-owned escrow
        └── TechnicianProfile PDA  seeds: ["technician", tech_pubkey]

        [v1.1 — en desarrollo]
        ├── Event Indexer (Helius RPC)
        └── PostgreSQL / Supabase
```

→ Ver arquitectura completa en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## Instrucciones del smart contract

| Instrucción | Firmantes | Efecto |
|-------------|-----------|--------|
| `register_technician` | 🔧 Técnico | Crea TechnicianProfile PDA |
| `initialize_asset(asset_id)` | 🏥 Hospital | Crea Asset PDA · status = Active |
| `report_issue(reward)` | 🏥 Hospital | Bloquea SOL en Vault PDA · failure_count++ |
| `complete_maintenance` | 🏥 + 🔧 Ambos | Doble firma · libera escrow · reputación +1 |
| `decommission_asset` | 🏥 Hospital | Cierra PDA · rent devuelto al hospital |

---

## Mecanismo de escrow

El Vault PDA es una cuenta **system-owned (space=0)** — el patrón correcto para escrow nativo de SOL en Solana:

```rust
// report_issue: crea vault y bloquea SOL
system_program::create_account(CpiContext::new_with_signer(...))?;
system_program::transfer(CpiContext::new(...), reward)?;

// complete_maintenance: libera SOL al técnico via invoke_signed
system_program::transfer(
    CpiContext::new_with_signer(..., &[vault_seeds]),
    reward
)?;
```

> ⚠️ Las cuentas program-owned no pueden ser debitadas via CPI ordinario. El vault system-owned con `invoke_signed` es el único patrón correcto para escrow nativo de SOL.

---

## Seguridad

| Mecanismo | Dónde se aplica |
|-----------|----------------|
| `has_one = hospital` | `report_issue`, `decommission_asset` |
| `require!(status == Active)` | `report_issue` |
| `require!(status == IssueReported)` | `complete_maintenance` |
| `require!(reward > 0)` | `report_issue` |
| Doble firma obligatoria | `complete_maintenance` (hospital + técnico) |
| PDA seed validation | Todas las instrucciones via Anchor |

---

## Frontend

<table>
<tr>
<td width="50%">

**🏥 Hospital Mode**
- Dashboard con KPIs conectados a datos on-chain
- Registro y gestión de activos médicos
- Reporte de incidencias con bloqueo de fondos
- Verificación y aprobación de mantenimientos

</td>
<td width="50%">

**🔧 Technician Mode**
- Earnings on-chain verificables
- Jobs completados con reputación on-chain
- Órdenes disponibles con escrow garantizado
- Complete & Get Paid en un click

</td>
</tr>
</table>

Light/Dark mode · Bilingüe EN/ES · Responsive · Wallet adapter (Phantom)

---

## Tests

```bash
anchor test
```

```
medovant
  ✔ register_technician: creates technician profile
  ✔ initialize_asset: creates PDA with Active status
  ✔ report_issue with reward=0 fails with RewardTooLow
  ✔ report_issue: locks escrow in vault PDA
  ✔ report_issue fails if asset not Active
  ✔ complete_maintenance: releases escrow to technician
  ✔ complete_maintenance fails if not IssueReported
  ✔ decommission_asset: closes account and returns rent

8 passing ✅
```

---

## Correr localmente

**Prerrequisitos:** Rust · Solana CLI · Anchor 0.32.1 · Node.js 18+

```bash
# Smart contract
anchor build
anchor test
anchor deploy --provider.cluster devnet

# Copiar IDL al frontend
cp target/idl/medovant.json app/src/idl/medovant.json

# Frontend
cd app && npm install && npm run dev
# → localhost:5173
```

> 💡 El técnico firma con su propia wallet conectada (Phantom) — el rol técnico usa tu wallet en modo demo. Asegurate de tener SOL en Devnet para las fees de transacción.

---

## Roadmap

```
v1.0 ✅  MVP técnico (Hackathon — Marzo 2026)
          Escrow PDA · Reputación on-chain · Dual role UI · 8 tests · Devnet deploy

v1.1 🔄  Incubación WayLearn (Junio–Agosto 2026)
          Indexador de eventos · Historial completo por activo
          QR físico por equipo · Metadata off-chain (Supabase)
          Evidencia adjunta al mantenimiento · Validación con usuarios reales

v2.0 📋  Post-Demo Day
          Abstracción de wallet para usuarios no cripto
          Integración con sistemas hospitalarios (CMMS/HIS)
          Marketplace de técnicos certificados · API pública

v3.0 🔭  Escala
          Redes hospitalarias y ministerios de salud
          Empresas de mantenimiento tercerizadas
          Infraestructura crítica fuera del sector salud
```

→ Ver roadmap detallado en [docs/ROADMAP.md](docs/ROADMAP.md)

---

## Deployment

| | |
|---|---|
| **Network** | Solana Devnet |
| **Program ID** | `5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD` |
| **Upgrade Authority** | `2BaSXPAHkDZyusqegFACrHfU1WdBiWNuPdJNZTsvri76` |
| **Explorer** | [Ver programa en Devnet](https://explorer.solana.com/address/5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD?cluster=devnet) |
| **Demo** | [Ver en YouTube](https://youtu.be/k2O5ubKsi5w) |

---

## Stack

![Solana](https://img.shields.io/badge/Solana-Devnet-3FAF8F?style=flat-square&logo=solana&logoColor=white)
![Anchor](https://img.shields.io/badge/Anchor-0.32.1-5BC0BE?style=flat-square)
![Rust](https://img.shields.io/badge/Rust-1.75-E6B980?style=flat-square&logo=rust&logoColor=white)
![React](https://img.shields.io/badge/React-18-3FAF8F?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-5BC0BE?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-E6B980?style=flat-square&logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-CSS-3FAF8F?style=flat-square&logo=tailwindcss&logoColor=white)

---

<div align="center">

**Solana Latam Labs · Incubación WayLearn · 2026**

*"Infraestructura crítica construida sobre Solana."*

</div>
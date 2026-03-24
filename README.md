<div align="center">

<img src="app/public/logo-dark.png" alt="Medovant Logo" height="120" />

# MEDOVANT PROTOCOL

### *El Protocolo de Escrow para Mantenimiento de Infraestructura Médica Crítica*

[![Solana](https://img.shields.io/badge/Solana-Devnet-3FAF8F?style=for-the-badge&logo=solana&logoColor=white)](https://explorer.solana.com/address/5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD?cluster=devnet)
[![Anchor](https://img.shields.io/badge/Anchor-0.32.1-5BC0BE?style=for-the-badge)](https://www.anchor-lang.com/)
[![React](https://img.shields.io/badge/React-18-E6B980?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3FAF8F?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Tests-8%20passing-3FAF8F?style=for-the-badge)](tests/)

<br/>

**[🎥 Ver Demo en YouTube](https://youtu.be/k2O5ubKsi5w)** &nbsp;·&nbsp;
**[🔍 Ver en Solana Explorer](https://explorer.solana.com/address/5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD?cluster=devnet)** &nbsp;·&nbsp;
**[📂 Documentación](docs/)**

</div>

---

## 🏥 El problema

El mantenimiento de equipos médicos en hospitales depende de **papel, confianza ciega y procesos manuales**. No hay verificación, no hay historial confiable, y los pagos llegan tarde o no llegan.

| Actor | Problema |
|-------|----------|
| 🏥 **Hospital** | Paga sin poder verificar si el trabajo se hizo |
| 🔧 **Técnico** | Cobra tarde, o no cobra — sin reputación verificable |
| 📋 **Sistema** | Sin trazabilidad para auditorías regulatorias |

> *Un resonador fuera de servicio o un ventilador mal calibrado no es solo un problema operativo — es un riesgo directo para pacientes.*

---

## ✅ La solución

Medovant crea **gemelos digitales** de equipos médicos en Solana. Cada evento del ciclo de vida queda registrado on-chain. Los pagos se bloquean en un vault PDA al reportar un problema y se liberan automáticamente cuando el mantenimiento está verificado por ambas partes.

```
El hospital paga solo cuando el trabajo está verificado.
El técnico cobra automáticamente al completarlo.
Sin intermediarios. Sin papel. La confianza está garantizada por el protocolo.
```

---

## ⚡ ¿Por qué Solana?

<table>
<tr>
<td align="center" width="33%">

**🚀 Velocidad**

Finalidad sub-segundo. Las emergencias médicas no pueden esperar confirmaciones de minutos.

</td>
<td align="center" width="33%">

**💰 Costo**

Registrar 500 equipos cuesta menos de $5. Viable para cualquier hospital.

</td>
<td align="center" width="33%">

**🔐 Escrow nativo**

PDAs como vault trustless. Sin contratos complejos ni intermediarios.

</td>
</tr>
</table>

---

## 🔄 Flujo del protocolo

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

## 🏗️ Arquitectura

```
Wallet (Phantom / Solflare)
        │
        ▼
React Frontend (Vite + TypeScript)
├── 🏥 Hospital Mode   → gestión, control, escrow
└── 🔧 Technician Mode → jobs, earnings, reputación
        │
        ▼
Anchor Program ── 5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD
        │
        ├── MedicalAsset PDA      seeds: ["equipment", hospital, asset_id]
        │     status · failure_count · maintenance_reward · bump
        │
        ├── EscrowVault PDA       seeds: ["vault", medical_asset]
        │     system-owned · holds SOL · space = 0
        │     liberado via invoke_signed
        │
        └── TechnicianProfile PDA seeds: ["technician", technician]
              jobs_completed · total_earned · bump
```

---

## 📋 Instrucciones del smart contract

| Instrucción | Firmantes | Efecto |
|-------------|-----------|--------|
| `initialize_asset(asset_id)` | 🏥 Hospital | Crea MedicalAsset PDA · status = Active |
| `report_issue(reward)` | 🏥 Hospital | Bloquea SOL en vault PDA · failure_count++ |
| `complete_maintenance` | 🏥 + 🔧 Ambos | Libera escrow al técnico · actualiza reputación |
| `decommission_asset` | 🏥 Hospital | Cierra PDA · rent devuelto al hospital |
| `register_technician` | 🔧 Técnico | Crea TechnicianProfile PDA |

---

## 🔐 Mecanismo de escrow

El vault PDA es una cuenta **system-owned (space=0)** — el patrón correcto de producción para escrow en Solana:

```rust
// 1. report_issue: crea vault y bloquea SOL
system_program::create_account(CpiContext::new_with_signer(...))?;
system_program::transfer(CpiContext::new(...), reward)?;

// 2. complete_maintenance: libera SOL al técnico via invoke_signed
system_program::transfer(
    CpiContext::new_with_signer(..., &[vault_seeds]),
    reward
)?;
```

> ⚠️ Las cuentas program-owned no pueden ser debitadas via CPI. Un vault system-owned con `invoke_signed` es el único patrón correcto para escrow nativo de SOL.

---

## 🛡️ Seguridad

| Mecanismo | Dónde se aplica |
|-----------|----------------|
| `has_one = hospital` | report_issue, decommission_asset |
| `require!(status == Active)` | report_issue |
| `require!(status == IssueReported)` | complete_maintenance |
| `require!(reward > 0)` | report_issue |
| Double signature | complete_maintenance (hospital + técnico) |
| PDA seed validation | Todas las instrucciones via Anchor |

---

## 💻 Frontend

<table>
<tr>
<td width="50%">

**🏥 Hospital Mode**
- Flujo del protocolo visual
- KPIs conectados a datos on-chain
- Tabla con acciones contextuales por equipo
- Modales inline por estado del activo

</td>
<td width="50%">

**🔧 Technician Mode**
- Earnings on-chain (SOL ganado)
- Jobs completed con barra de reputación
- Available jobs con escrow bloqueado
- Complete & Get Paid en un click

</td>
</tr>
</table>

**Extras:** 🌙 Light/Dark mode · 🌐 Bilingüe EN/ES · 📱 Responsive · ⚡ Wallet adapter (Phantom + Solflare)

---

## 🧪 Tests

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

## 🚀 Correr localmente

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

> 💡 El técnico demo usa un keypair en `localStorage`. Para fondear en Devnet:
> ```bash
> solana airdrop 1 <PUBKEY_TECNICO> --url devnet
> ```

---

## 🗺️ Roadmap

```
v1.0 ✅  MVP Hackathon
          Escrow PDA · Reputación on-chain · Dual role UI · Devnet deploy

v1.1 🔜  Infraestructura
          Indexer de eventos · Historial completo · QR por equipo

v2.0 📋  Ecosistema
          Marketplace de técnicos · Clasificación equipos Clase I/II/III
          NFTs de certificación (threshold: jobs_completed >= 50)

v3.0 🔭  Plataforma
          IA assistant para técnicos · DeFi yield en escrow
          DAO de gobernanza · Integración con sistemas HIS
```

---

## 📊 Criterios del hackathon

| Criterio | Medovant |
|----------|----------|
| **Viabilidad técnica** | ✅ Anchor + vault PDA escrow + invoke_signed + double-signature + Devnet deploy |
| **Prototipo funcional** | ✅ Flujo completo end-to-end funcionando en Devnet |
| **Nivel de complejidad** | ✅ System-owned vault PDA + create_account CPI + TechnicianProfile + failure tracking |
| **Originalidad** | ✅ Protocolo de coordinación para infraestructura médica — no es un DEX ni un NFT |

---

## 🛠️ Stack

![Solana](https://img.shields.io/badge/Solana-Devnet-3FAF8F?style=flat-square&logo=solana&logoColor=white)
![Anchor](https://img.shields.io/badge/Anchor-0.32.1-5BC0BE?style=flat-square)
![Rust](https://img.shields.io/badge/Rust-1.75-E6B980?style=flat-square&logo=rust&logoColor=white)
![React](https://img.shields.io/badge/React-18-3FAF8F?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-5BC0BE?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-E6B980?style=flat-square&logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-CSS-3FAF8F?style=flat-square&logo=tailwindcss&logoColor=white)

---

## 📦 Deployment

| | |
|---|---|
| **Network** | Solana Devnet |
| **Program ID** | `5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD` |
| **Upgrade Authority** | `2BaSXPAHkDZyusqegFACrHfU1WdBiWNuPdJNZTsvri76` |
| **Explorer** | [Ver programa](https://explorer.solana.com/address/5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD?cluster=devnet) |
| **Demo video** | [Ver en YouTube](https://youtu.be/k2O5ubKsi5w) |
| **Frontend** | `cd app && npm run dev` → localhost:5173 |

---

<div align="center">

*Solana LATAM Hackathon 2026 · Marzo 20–23*

**"Infraestructura crítica construida sobre Solana."**

</div>
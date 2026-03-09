# Medovant

Programa en Solana (Anchor + Rust) para gestión de equipos médicos en hospitales. Usa PDAs y sigue un flujo CRUD.

## Qué hace

Permite a hospitales:

- **Registrar** equipos médicos (una cuenta PDA por equipo)
- **Reportar** averías cuando un equipo falla
- **Registrar** mantenimientos completados (con pago al técnico en lamports)
- **Dar de baja** equipos y recuperar el rent de la cuenta

Cada equipo tiene un estado (activo, con avería reportada, etc.) y solo se permiten transiciones válidas. El hospital es el dueño del equipo; el técnico firma junto al hospital al completar un mantenimiento.

## CRUD + PDA

**CRUD:** Create (registrar equipo), Update (reportar avería, completar mantenimiento), Delete (dar de baja y cerrar cuenta). La lectura se hace off-chain vía RPC al consultar la cuenta.

**PDA:** Cada equipo es una cuenta PDA derivada de forma determinista. Las seeds incluyen el hospital y el ID del equipo, así cada par (hospital, equipo) tiene una única dirección. El programa valida las seeds en cada instrucción.

## Stack

- **Rust** – programa on-chain
- **Anchor** – framework
- **Solana** – PDAs, lamports
- **TypeScript** – tests y cliente de prueba

## Estructura

```
medovant/
├── README.md
├── Anchor.toml
├── Cargo.toml
├── package.json
├── programs/medovant/src/lib.rs
├── tests/medovant.test.ts
└── client/client.ts
```

## Programa en Devnet

[Ver en Solana Explorer](https://explorer.solana.com/address/5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD?cluster=devnet)

## Cómo ejecutar

```bash
anchor keys sync
npm install   # o yarn
anchor build
anchor test
```

Para el cliente (conectar a Devnet):

```bash
# Variables: ANCHOR_PROVIDER_URL, ANCHOR_WALLET
yarn client:devnet
# o: npx ts-node client/client.ts
```

## Requisitos

Rust, Solana CLI, [Anchor CLI](https://www.anchor-lang.com/docs/installation), Node.js (v18+).

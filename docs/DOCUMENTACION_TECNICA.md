# Medovant — Documentación técnica (estado del proyecto)

Documento de referencia del **Medovant**: protocolo de mantenimiento con escrow en **Solana Devnet**, programa **Anchor (Rust)** y aplicación web **React + TypeScript (Vite)** en la carpeta **`app/`**.

**Última actualización:** marzo 2026  
**Program ID (Devnet):** `5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD`

---

## 1. Resumen ejecutivo

Medovant modela equipamiento médico como cuentas **PDA** con una máquina de estados y un **vault PDA** por activo para retener **SOL** hasta completar el mantenimiento. El hospital firma con la wallet conectada (Phantom/Solflare); en el demo la misma wallet conectada firma también como técnico (doble firma en `complete_maintenance`), sin guardar material de claves en el navegador.

La SPA (`app/`) incluye:

- **Home:** conexión de wallet, tema claro/oscuro, idioma EN/ES, identidad visual (logos, rejilla, botón wallet estilizado).
- **Dashboard hospital:** flujo del protocolo, **KPIs derivados de datos on-chain**, tabla de equipos con acciones y modales, actividad, panel blockchain.
- **Dashboard técnico:** métricas del perfil on-chain, trabajos demo, formulario para completar mantenimiento.

Los **nombres y ubicaciones** de equipos **no** están en el programa; se guardan en **`localStorage`** (`assetNames.ts`) indexados por `wallet + assetId`.

> **Nota sobre el README raíz:** describe una carpeta `client/` para un cliente Node; el front principal de producto vive en **`app/`** (Vite + React).

---

## 2. Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│  Navegador — React SPA (app/)                                │
│  Wallet Adapter + Anchor (IDL JSON estático)                 │
│  Contextos: Theme, Lang, Role (hospital | técnico solo UI) │
└────────────────────────────┬────────────────────────────────┘
                             │ JSON-RPC Devnet
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Solana Devnet — Programa Medovant                           │
│  MedicalAsset, Escrow Vault (PDA), TechnicianProfile         │
└─────────────────────────────────────────────────────────────┘
```

| Capa | Tecnología |
|------|------------|
| Blockchain | Solana **Devnet** |
| Contrato | **Anchor** (~0.32), Rust |
| Cliente web | **React 18**, **Vite 5**, **TypeScript** |
| Wallet | `@solana/wallet-adapter-react` (Phantom, Solflare) |
| Estilos | **Tailwind CSS** + variables en **`app/src/index.css`** |
| Toasts | **Sonner** |
| Routing | **React Router** (`/`, `/dashboard`) |

---

## 3. Programa on-chain (Anchor)

**Ruta:** `programs/medovant/src/lib.rs`

### 3.1 Cuentas principales

- **`MedicalAsset` (PDA)** — seeds: `["equipment", hospital, asset_id u64 LE]`  
  Campos relevantes: `hospital`, `asset_id`, `status`, `last_maintenance`, `bump`, `maintenance_reward` (escrow en lamports), `failure_count`.

- **Vault de escrow (PDA)** — seeds: `["vault", medical_asset_pubkey]`; creación lazy en `report_issue` con CPI firmada por el PDA.

- **`TechnicianProfile` (PDA)** — seeds: `["technician", technician_pubkey]`; reputación / totales on-chain.

### 3.2 Estados (`AssetStatus`)

`Active` → `IssueReported` → (flujo UI) → `Active` tras `complete_maintenance`; `UnderMaintenance` en enum; `Decommissioned` con cierre de cuenta.

### 3.3 Instrucciones (resumen)

| Instrucción | Firmantes clave | Efecto |
|-------------|-----------------|--------|
| `register_technician` | Técnico | Crea perfil técnico |
| `initialize_asset` | Hospital | Crea activo en `Active` |
| `report_issue` | Hospital | Escrow + `IssueReported` |
| `complete_maintenance` | Hospital + técnico | Libera escrow al técnico, `Active` |
| `decommission_asset` | Hospital | Baja y cierra PDA del activo |

### 3.4 Errores y eventos

`MedovantError` (autorización, estados inválidos, recompensa, perfil técnico). Eventos Anchor (`AssetInitialized`, `IssueReported`, etc.) para trazabilidad.

---

## 4. Cliente — derivación de PDAs

**Archivo:** `app/src/utils/pdas.ts` — debe coincidir con el programa:

- `getMedicalAssetPDA(hospital, assetId)`
- `getEscrowVaultPDA(medicalAssetPDA)`
- `getTechnicianProfilePDA(technician)`

**Program ID** en cliente: alineado con `declare_id!` e IDL en `app/src/idl/medovant.json`.

Tras `anchor build`, sincronizar IDL:

```bash
cp target/idl/medovant.json app/src/idl/medovant.json
```

*(En Windows PowerShell: `Copy-Item` equivalente.)*

---

## 5. Frontend (`app/`)

### 5.1 Entrada y proveedores

- **`main.tsx`:** `SolanaWalletProvider` (Devnet) → `ThemeProvider` (`data-theme` en `document.documentElement`) → `RoleProvider` → `LangProvider`.
- **`App.tsx`:** `/` → `Home`; `/dashboard` → ruta protegida por wallet conectada.

### 5.2 Programa Anchor

**`hooks/useProgram.ts`:** carga IDL desde `app/src/idl/medovant.json`, `commitment: 'confirmed'`.

### 5.3 Dashboard hospital — estado compartido y KPIs

**`HospitalDashboard.tsx`**

- Mantiene **`assets`** y **`assetsLoading`**.
- **`fetchAssets`:** escanea IDs **1–10** para la wallet hospital, construye objetos alineados con **`OnChainAsset`** (`mapAssetStatus`, metadatos `getAssetMeta`, lamports normalizados).
- **KPIs en tiempo real** (conteos por estado + total de equipos):
  - Total de activos encontrados on-chain (`assets.length`).
  - Activos, incidencias, en mantenimiento, dados de baja (strings de estado: `Active`, `Issue Reported`, `Under Maintenance`, `Decommissioned`).
  - Tarjeta de incidencias: si hay escrow agregado (`kpiEscrowSOL > 0`), subtítulo con **SOL bloqueado** (ES/EN según idioma); si no, texto de i18n (`kpiIssuesSub`).
- Pasa a **`EquipmentTable`:** `assets`, `assetsLoading`, `onAssetsChange={fetchAssets}` para que tras transacciones o “Refresh” se actualicen tabla y KPIs a la vez.

### 5.4 Tabla de equipos

**`EquipmentTable.tsx`**

- Tipo exportado **`OnChainAsset`** y callback **`OnTxSuccess`**.
- **Modo controlado:** si la prop **`assets`** está definida (`!== undefined`), la tabla **no** ejecuta el fetch interno al montar; usa datos del padre y **`assetsLoading`**.
- **Modo autónomo:** si no se pasan `assets`, mantiene el fetch interno en IDs **1–5** (comportamiento histórico sin cambiar el bucle).
- **`refreshAssets()`:** si existe `onAssetsChange`, lo invoca; si no, hace fetch interno.
- Tras registro, reporte, completar o baja: **`refreshAssets()`** para sincronizar UI.
- **Modales:** registro (guarda meta en localStorage antes de `initializeAsset`), reporte, completar (registro técnico si falta + `completeMaintenance`), decommission.
- Botones de fila con clases **`btn-issue`**, **`btn-complete`**, **`btn-decomm`** para overrides de **modo claro** en CSS (sin cambiar lógica).
- Filas demo cuando no hay activos y wallet conectada.

### 5.5 Dashboard técnico

**`TechnicianDashboard.tsx`:** perfil on-chain de la wallet conectada, formulario de completar por `assetId`, copy i18n para trabajos demo.

### 5.6 Utilidades destacadas

| Archivo | Uso |
|---------|-----|
| `utils/formatters.ts` | `mapAssetStatus`, `normalizeTxSignature`, `truncatePubkey` / `truncateSig`, `lamportsToSol` |
| `utils/assetNames.ts` | `getAssetMeta`, `saveAssetMeta`, `getAssetDisplayName` |
| `utils/solanaTxError.ts` | `toastAnchorTxError`, logs de `SendTransactionError` |
| `components/Toast.tsx` | Toasts de tx + enlace Explorer |
| `ActivityFeed.tsx` | Tipos de actividad con manejo defensivo |
| `BlockchainPanel.tsx` | Enlaces Explorer con firma segura |

### 5.7 Internacionalización

**`i18n/translations.ts`:** claves EN/ES; **`LangContext`:** `t(key)`, `toggleLang`.

### 5.8 Tema e identidad visual (`index.css`)

- **`:root` / `[data-theme='dark']` y `[data-theme='light']`:** tokens `--bg`, `--surface*`, `--text*`, `--green`, `--amber`, `--red`, etc.
- **Wallet adapter** y **`.home-wallet-btn`:** estilos para botón de conexión en Home.
- **Modo claro — tablas:** `table th` / `td`, hover de filas (legibilidad).
- **Modo claro — acciones:** `.btn-issue`, `.btn-complete`, `.btn-decomm` con colores explícitos (`!important`).

**`Sidebar` / `Home`:** logos (`logo-dashboard.png`, `logo-home.png`, variantes por tema según implementación).

---

## 6. Flujos resumidos (sin lógica nueva)

1. **Registro:** meta en localStorage → `initializeAsset` → `fetchAssets` / `refreshAssets`.
2. **Incidencia:** `reportIssue` con lamports al vault → estado `Issue Reported`.
3. **Completar:** posible `registerTechnician` + `completeMaintenance` (hospital + técnico) → escrow al técnico.
4. **Errores:** toasts con Anchor + logs; falta de SOL en devnet documentada / mensajes orientativos.

---

## 7. Estructura de carpetas (relevante)

```
Medovant-solana/
├── programs/medovant/          # Programa Anchor
├── tests/
├── app/                        # SPA React (producto principal)
│   ├── public/
│   ├── src/
│   │   ├── idl/medovant.json
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── i18n/
│   │   ├── pages/
│   │   ├── providers/
│   │   ├── utils/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── vite.config.ts
│   └── package.json
├── client/                     # Cliente Node (ver README)
├── target/idl/
├── Anchor.toml
├── README.md
└── docs/
    └── DOCUMENTACION_TECNICA.md
```

---

## 8. Comandos útiles

| Objetivo | Comando |
|----------|---------|
| Compilar programa | `anchor build` |
| Tests | `anchor test` |
| Desarrollo UI | `cd app && npm run dev` |
| Typecheck front | `cd app && npx tsc --noEmit` |
| Airdrop (técnico / hospital en Devnet) | `solana airdrop 1 <PUBKEY> --url devnet` |

---

## 9. Limitaciones y decisiones (demo / hackathon)

1. **Rango de IDs:** el hospital escanea **1–10** para KPIs y tabla cuando se usa el dashboard integrado; el modo autónomo de la tabla sigue **1–5**.
2. **Metadatos de nombre:** solo **localStorage** por navegador.
3. **Técnico demo:** keypair local; no es modelo de producción.
4. **Sin indexer:** no hay listado global off-chain de todos los activos.

---

## 10. Seguridad (recordatorio)

- No commitear claves privadas reales.
- Keypair técnico solo para **Devnet**.
- Tras redeploy: verificar **Program ID** e **IDL**.

---

## 11. Enlaces

- **Explorer (programa):**  
  https://explorer.solana.com/address/5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD?cluster=devnet  
- **Visión general y despliegue:** `README.md` (raíz).

---

*Medovant — documentación técnica alineada con el código en `app/` y `programs/medovant`.*

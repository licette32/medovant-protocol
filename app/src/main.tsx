import React from 'react'
import ReactDOM from 'react-dom/client'
import { RoleProvider } from '@/context/RoleContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { LangProvider } from '@/i18n/LangContext'
import { SolanaWalletProvider } from '@/providers/WalletProvider'
import App from '@/App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SolanaWalletProvider>
      <ThemeProvider>
        <RoleProvider>
          <LangProvider>
            <App />
          </LangProvider>
        </RoleProvider>
      </ThemeProvider>
    </SolanaWalletProvider>
  </React.StrictMode>
)

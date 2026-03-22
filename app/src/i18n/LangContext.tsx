import { createContext, useContext, useState, type ReactNode } from 'react'
import { translations, type Lang, type TranslationKey } from './translations'

interface LangContextType {
  lang: Lang
  t: (key: TranslationKey) => string
  toggleLang: () => void
}

const LangContext = createContext<LangContextType>({
  lang: 'en',
  t: (key) => translations.en[key],
  toggleLang: () => {},
})

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('en')
  const t = (key: TranslationKey): string => translations[lang][key] ?? translations.en[key]
  const toggleLang = () => setLang((l) => (l === 'en' ? 'es' : 'en'))
  return <LangContext.Provider value={{ lang, t, toggleLang }}>{children}</LangContext.Provider>
}

export function useLang() {
  return useContext(LangContext)
}

import { useState, useEffect, useMemo } from 'react'
import { LangContext, getInitialLang, translate } from '../i18n'

// مزوّد لغة الواجهة — يغلف التطبيق ويوفر t() لكل المكونات
export default function LangProvider({ children }) {
  const [lang, setLangState] = useState(getInitialLang)

  useEffect(() => {
    const handler = (e) => setLangState(e.detail === 'en' ? 'en' : 'ar')
    window.addEventListener('ui-lang-change', handler)
    return () => window.removeEventListener('ui-lang-change', handler)
  }, [])

  const value = useMemo(() => ({
    lang,
    setLang: setLangState,
    t: (key) => translate(lang, key),
  }), [lang])

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

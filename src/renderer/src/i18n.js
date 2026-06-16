import { createI18n } from 'vue-i18n'

import de from './locales/de.json'
import en from './locales/en.json'

const savedLocale = localStorage.getItem('locale')
const locale = savedLocale === 'de' ? 'de' : 'en'

export const i18n = createI18n({
  fallbackLocale: 'en',
  globalInjection: true,
  legacy: false,
  locale,
  messages: {
    de,
    en
  }
})

import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { ptBR } from './pt-BR';

const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources: { 'pt-BR': { translation: ptBR } },
  lng: 'pt-BR',
  fallbackLng: 'pt-BR',
  interpolation: { escapeValue: false },
  initAsync: false,
});

export default i18n;

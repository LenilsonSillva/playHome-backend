// ============================================
// GAME WORDS DATABASE - LANGUAGE SELECTION
// ============================================
// Função pura que seleciona o banco de palavras baseado no idioma

import { WORDS_BR, WORDS_PT } from "./portuguese.js";
import { WORDS_US, WORDS_GB } from "./english.js";
import { WORDS_ES, WORDS_LATAM } from "./spanish.js";
import { WORDS_FR } from "./french.js";
import { WORDS_DE } from "./german.js";
import { WORDS_IT } from "./italian.js";
import { WORDS_RU } from "./russian.js";
import { WORDS_KO } from "./korean.js";
import { WORDS_JA } from "./japanese.js";
import { WORDS_ZH } from "./chinese.js";
import { WORDS_HI } from "./hindi.js";
import { WORDS_AR } from "./arabic.js";

/**
 * Retorna o banco de palavras baseado no código de idioma
 * @param {string} lang - Código do idioma (ex: "pt-BR", "en-US", "es-ES")
 * @returns {Array} Array com objetos { word, category, hint, related }
 * 
 * Idiomas suportados:
 * - pt-BR: Português Brasileiro (padrão)
 * - pt-PT: Português Europeu
 * - en-US: English (USA)
 * - en-GB: English (UK)
 * - es-ES: Español
 * - es-419 / es-LATAM: Español Latinoamericano
 * - fr: Français
 * - de: Deutsch
 * - it: Italiano
 * - ru: Русский
 * - ko: 한국어
 * - ja: 日本語
 * - zh: 中文
 * - hi: हिन्दी
 * - ar: العربية
 */
export function getWordDatabase(lang) {
  if (!lang) return WORDS_US; // fallback seguro

  const base = lang.split("-")[0];

  // Verifica variações específicas primeiro
  switch (lang) {
    case "pt-PT":
      return WORDS_PT;
    case "en-GB":
      return WORDS_GB;
    case "es-419":
    case "es-LATAM":
    case "es-latam":
      return WORDS_LATAM;
    default:
      // Depois verifica pelo código base (primeira parte antes do hífen)
      switch (base) {
        case "pt":
          return WORDS_BR;
        case "en":
          return WORDS_US;
        case "es":
          return WORDS_ES;
        case "fr":
          return WORDS_FR;
        case "de":
          return WORDS_DE;
        case "it":
          return WORDS_IT;
        case "ru":
          return WORDS_RU;
        case "ko":
          return WORDS_KO;
        case "ja":
          return WORDS_JA;
        case "zh":
          return WORDS_ZH;
        case "hi":
          return WORDS_HI;
        case "ar":
          return WORDS_AR;
        default:
          return WORDS_US;
      }
  }
}

/**
 * Extrai categorias únicas de um banco de palavras
 * @param {Array} wordDatabase - Array com os dados de palavras
 * @returns {Array<string>} Array com categorias únicas e ordenadas
 */
export function getCategories(wordDatabase) {
  return Array.from(new Set(wordDatabase.map((w) => w.category))).sort();
}

/**
 * Para compatibilidade com código antigo que importa WORDS do index
 * Usamos o banco padrão em português brasileiro
 */
export const WORDS = WORDS_BR;

/**
 * Para compatibilidade, exportar as categorias do banco padrão
 */
export const categories = getCategories(WORDS_BR);

import * as admin from 'firebase-admin';
import { IntentService } from './intent.service';
import { EntityService } from './entity.service';
import { FulfillmentService } from './fulfillment.service';

export interface Language {
  code: string; // ISO 639-1 (pt, en, es, etc.)
  name: string;
  nativeName: string;
  enabled: boolean;
  isDefault: boolean;
  region?: string; // BR, US, ES, etc.
  direction: 'ltr' | 'rtl';
}

export interface Translation {
  id?: string;
  key: string;
  language: string;
  value: string;
  context?: string;
  category: 'intent' | 'entity' | 'response' | 'system' | 'custom';
  source: 'manual' | 'auto' | 'import';
  validated: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface LanguageDetectionResult {
  language: string;
  confidence: number;
  alternatives: Array<{ language: string; confidence: number }>;
}

export interface TranslationRequest {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  context?: string;
  category?: string;
}

export interface MultilingualContent {
  intentName: string;
  trainingPhrases: { [language: string]: string[] };
  responses: { [language: string]: string[] };
  entities: { [language: string]: Array<{ value: string; synonyms: string[] }> };
}

export class MultiLanguageService {
  private db: admin.firestore.Firestore;
  private intentService: IntentService;
  private entityService: EntityService;
  private fulfillmentService: FulfillmentService;
  private supportedLanguages: Language[];
  private translationCache: Map<string, string>;

  constructor(
    intentService: IntentService, 
    entityService: EntityService, 
    fulfillmentService: FulfillmentService
  ) {
    this.db = admin.firestore();
    this.intentService = intentService;
    this.entityService = entityService;
    this.fulfillmentService = fulfillmentService;
    this.supportedLanguages = [];
    this.translationCache = new Map();
    this.initializeDefaultLanguages();
  }

  private initializeDefaultLanguages(): void {
    this.supportedLanguages = [
      {
        code: 'pt',
        name: 'Portuguese',
        nativeName: 'Português',
        enabled: true,
        isDefault: true,
        region: 'BR',
        direction: 'ltr'
      },
      {
        code: 'en',
        name: 'English',
        nativeName: 'English',
        enabled: true,
        isDefault: false,
        region: 'US',
        direction: 'ltr'
      },
      {
        code: 'es',
        name: 'Spanish',
        nativeName: 'Español',
        enabled: false,
        isDefault: false,
        region: 'ES',
        direction: 'ltr'
      },
      {
        code: 'fr',
        name: 'French',
        nativeName: 'Français',
        enabled: false,
        isDefault: false,
        region: 'FR',
        direction: 'ltr'
      }
    ];
  }

  async detectLanguage(text: string): Promise<LanguageDetectionResult> {
    try {
      // Implementação simplificada de detecção de idioma
      // Em produção, usar serviços como Google Cloud Translation API
      
      const patterns = {
        'pt': /\b(o|a|de|em|para|com|por|do|da|um|uma|é|são|está|estão|não|sim|obrigado|tchau)\b/gi,
        'en': /\b(the|and|or|but|in|on|at|to|for|of|with|by|is|are|was|were|have|has|had|will|would|can|could|should|thank|hello|goodbye)\b/gi,
        'es': /\b(el|la|de|en|para|con|por|del|un|una|es|son|está|están|no|sí|gracias|hola|adiós)\b/gi,
        'fr': /\b(le|la|de|en|pour|avec|par|du|un|une|est|sont|était|étaient|non|oui|merci|bonjour|au revoir)\b/gi
      };

      const scores: { [language: string]: number } = {};

      Object.entries(patterns).forEach(([lang, pattern]) => {
        const matches = text.match(pattern);
        scores[lang] = matches ? matches.length : 0;
      });

      // Calcular confiança baseada no número de palavras encontradas
      const totalWords = text.split(/\s+/).length;
      const alternatives = Object.entries(scores)
        .map(([language, score]) => ({
          language,
          confidence: totalWords > 0 ? score / totalWords : 0
        }))
        .sort((a, b) => b.confidence - a.confidence);

      const topLanguage = alternatives[0];

      return {
        language: topLanguage.language,
        confidence: Math.min(topLanguage.confidence, 1.0),
        alternatives: alternatives.slice(1, 4)
      };

    } catch (error) {
      console.error('❌ Error detecting language:', error);
      return {
        language: 'pt', // fallback para português
        confidence: 0.5,
        alternatives: []
      };
    }
  }

  async translateText(request: TranslationRequest): Promise<string> {
    try {
      const cacheKey = `${request.sourceLanguage}:${request.targetLanguage}:${request.text}`;
      
      // Verificar cache
      if (this.translationCache.has(cacheKey)) {
        return this.translationCache.get(cacheKey)!;
      }

      // Implementação simplificada de tradução
      // Em produção, integrar com serviços como Google Cloud Translation API
      const translation = await this.performTranslation(request);
      
      // Armazenar em cache
      this.translationCache.set(cacheKey, translation);
      
      // Salvar tradução no banco para futura referência
      await this.saveTranslation({
        key: this.generateTranslationKey(request.text),
        language: request.targetLanguage,
        value: translation,
        context: request.context,
        category: request.category as any || 'custom',
        source: 'auto',
        validated: false
      });

      return translation;

    } catch (error) {
      console.error('❌ Error translating text:', error);
      return request.text; // retornar texto original em caso de erro
    }
  }

  private async performTranslation(request: TranslationRequest): Promise<string> {
    // Implementação simplificada - dicionário básico
    const translations: { [key: string]: { [key: string]: string } } = {
      'pt': {
        'hello': 'olá',
        'goodbye': 'tchau',
        'thank you': 'obrigado',
        'yes': 'sim',
        'no': 'não',
        'help': 'ajuda',
        'pricing': 'preços',
        'demo': 'demonstração',
        'contact': 'contato'
      },
      'en': {
        'olá': 'hello',
        'tchau': 'goodbye',
        'obrigado': 'thank you',
        'sim': 'yes',
        'não': 'no',
        'ajuda': 'help',
        'preços': 'pricing',
        'demonstração': 'demo',
        'contato': 'contact'
      },
      'es': {
        'hello': 'hola',
        'goodbye': 'adiós',
        'thank you': 'gracias',
        'yes': 'sí',
        'no': 'no',
        'help': 'ayuda',
        'pricing': 'precios',
        'demo': 'demostración',
        'contact': 'contacto'
      }
    };

    const targetTranslations = translations[request.targetLanguage];
    if (targetTranslations) {
      const lowerText = request.text.toLowerCase();
      for (const [source, target] of Object.entries(targetTranslations)) {
        if (lowerText.includes(source.toLowerCase())) {
          return request.text.toLowerCase().replace(source.toLowerCase(), target);
        }
      }
    }

    // Se não encontrou tradução específica, retornar texto original
    return request.text;
  }

  async saveTranslation(translation: Translation): Promise<string> {
    try {
      const translationData = {
        ...translation,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await this.db.collection('translations').add(translationData);
      return docRef.id;

    } catch (error) {
      console.error('❌ Error saving translation:', error);
      throw new Error('Failed to save translation');
    }
  }

  async getTranslation(key: string, language: string): Promise<string | null> {
    try {
      const snapshot = await this.db
        .collection('translations')
        .where('key', '==', key)
        .where('language', '==', language)
        .where('validated', '==', true)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return doc.data().value;

    } catch (error) {
      console.error('❌ Error getting translation:', error);
      return null;
    }
  }

  async createMultilingualIntent(content: MultilingualContent): Promise<{ [language: string]: string }> {
    try {
      const results: { [language: string]: string } = {};
      
      for (const [language, trainingPhrases] of Object.entries(content.trainingPhrases)) {
        if (this.isLanguageSupported(language)) {
          const intent = {
            name: '',
            displayName: `${content.intentName}_${language}`,
            trainingPhrases: trainingPhrases.map(phrase => ({
              parts: [{ text: phrase }]
            })),
            parameters: []
          };

          const intentName = await this.intentService.createIntent(intent);
          results[language] = intentName;
        }
      }

      return results;

    } catch (error) {
      console.error('❌ Error creating multilingual intent:', error);
      throw new Error('Failed to create multilingual intent');
    }
  }

  async translateIntent(intentName: string, sourceLanguage: string, targetLanguages: string[]): Promise<void> {
    try {
      // Buscar intent original
      const intents = await this.intentService.listIntents();
      const sourceIntent = intents.find(i => i.displayName === intentName);
      
      if (!sourceIntent) {
        throw new Error(`Intent not found: ${intentName}`);
      }

      // Traduzir para cada idioma alvo
      for (const targetLanguage of targetLanguages) {
        if (!this.isLanguageSupported(targetLanguage)) {
          console.warn(`⚠️ Language not supported: ${targetLanguage}`);
          continue;
        }

        const translatedPhrases: string[] = [];
        
        for (const trainingPhrase of sourceIntent.trainingPhrases) {
          const originalText = trainingPhrase.parts.map(p => p.text).join(' ');
          
          const translation = await this.translateText({
            text: originalText,
            sourceLanguage,
            targetLanguage,
            context: 'training_phrase',
            category: 'intent'
          });
          
          translatedPhrases.push(translation);
        }

        // Criar intent traduzido
        const translatedIntent = {
          name: '',
          displayName: `${intentName}_${targetLanguage}`,
          trainingPhrases: translatedPhrases.map(phrase => ({
            parts: [{ text: phrase }]
          })),
          parameters: sourceIntent.parameters
        };

        await this.intentService.createIntent(translatedIntent);
        console.log(`✅ Intent translated: ${intentName} -> ${targetLanguage}`);
      }

    } catch (error) {
      console.error('❌ Error translating intent:', error);
      throw new Error(`Failed to translate intent: ${intentName}`);
    }
  }

  async addLanguageSupport(language: Language): Promise<void> {
    try {
      // Salvar configuração do idioma
      await this.db.collection('languages').doc(language.code).set({
        ...language,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Atualizar lista local
      const existingIndex = this.supportedLanguages.findIndex(l => l.code === language.code);
      if (existingIndex >= 0) {
        this.supportedLanguages[existingIndex] = language;
      } else {
        this.supportedLanguages.push(language);
      }

      console.log(`✅ Language support added: ${language.name} (${language.code})`);

    } catch (error) {
      console.error('❌ Error adding language support:', error);
      throw new Error(`Failed to add language support: ${language.code}`);
    }
  }

  async getSupportedLanguages(): Promise<Language[]> {
    try {
      const snapshot = await this.db
        .collection('languages')
        .where('enabled', '==', true)
        .get();

      if (!snapshot.empty) {
        this.supportedLanguages = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            code: data.code,
            name: data.name,
            nativeName: data.nativeName,
            enabled: data.enabled,
            isDefault: data.isDefault,
            region: data.region,
            direction: data.direction
          };
        });
      }

      return this.supportedLanguages;

    } catch (error) {
      console.error('❌ Error getting supported languages:', error);
      return this.supportedLanguages;
    }
  }

  async getDefaultLanguage(): Promise<Language> {
    const languages = await this.getSupportedLanguages();
    return languages.find(l => l.isDefault) || languages[0];
  }

  isLanguageSupported(languageCode: string): boolean {
    return this.supportedLanguages.some(l => l.code === languageCode && l.enabled);
  }

  async generateTranslationReport(): Promise<{
    totalTranslations: number;
    translationsByLanguage: { [language: string]: number };
    translationsByCategory: { [category: string]: number };
    validationStatus: { validated: number; pending: number };
    missingTranslations: Array<{ key: string; missingLanguages: string[] }>;
  }> {
    try {
      const snapshot = await this.db.collection('translations').get();
      const translations = snapshot.docs.map(doc => doc.data() as Translation);

      const translationsByLanguage: { [language: string]: number } = {};
      const translationsByCategory: { [category: string]: number } = {};
      const validationStatus = { validated: 0, pending: 0 };

      translations.forEach(translation => {
        // Por idioma
        translationsByLanguage[translation.language] = 
          (translationsByLanguage[translation.language] || 0) + 1;

        // Por categoria
        translationsByCategory[translation.category] = 
          (translationsByCategory[translation.category] || 0) + 1;

        // Status de validação
        if (translation.validated) {
          validationStatus.validated++;
        } else {
          validationStatus.pending++;
        }
      });

      // Identificar traduções faltantes
      const translationKeys = [...new Set(translations.map(t => t.key))];
      const supportedLanguageCodes = this.supportedLanguages.filter(l => l.enabled).map(l => l.code);
      
      const missingTranslations = translationKeys.map(key => {
        const existingLanguages = translations
          .filter(t => t.key === key)
          .map(t => t.language);
        
        const missingLanguages = supportedLanguageCodes.filter(
          lang => !existingLanguages.includes(lang)
        );

        return { key, missingLanguages };
      }).filter(item => item.missingLanguages.length > 0);

      return {
        totalTranslations: translations.length,
        translationsByLanguage,
        translationsByCategory,
        validationStatus,
        missingTranslations
      };

    } catch (error) {
      console.error('❌ Error generating translation report:', error);
      throw new Error('Failed to generate translation report');
    }
  }

  async exportTranslations(language?: string): Promise<Translation[]> {
    try {
      let query = this.db.collection('translations') as admin.firestore.Query;

      if (language) {
        query = query.where('language', '==', language);
      }

      const snapshot = await query.get();
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          key: data.key,
          language: data.language,
          value: data.value,
          context: data.context,
          category: data.category,
          source: data.source,
          validated: data.validated,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate()
        };
      });

    } catch (error) {
      console.error('❌ Error exporting translations:', error);
      return [];
    }
  }

  async importTranslations(translations: Translation[]): Promise<void> {
    try {
      const batch = this.db.batch();
      
      translations.forEach(translation => {
        const docRef = this.db.collection('translations').doc();
        batch.set(docRef, {
          ...translation,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });

      await batch.commit();
      console.log(`✅ Imported ${translations.length} translations`);

    } catch (error) {
      console.error('❌ Error importing translations:', error);
      throw new Error('Failed to import translations');
    }
  }

  private generateTranslationKey(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  async validateTranslation(translationId: string, isValid: boolean): Promise<void> {
    try {
      await this.db.collection('translations').doc(translationId).update({
        validated: isValid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

    } catch (error) {
      console.error('❌ Error validating translation:', error);
      throw new Error(`Failed to validate translation: ${translationId}`);
    }
  }

  async getLanguagePreference(userId: string): Promise<string> {
    try {
      const userDoc = await this.db.collection('users').doc(userId).get();
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        return userData?.languagePreference || (await this.getDefaultLanguage()).code;
      }

      return (await this.getDefaultLanguage()).code;

    } catch (error) {
      console.error('❌ Error getting language preference:', error);
      return (await this.getDefaultLanguage()).code;
    }
  }

  async setLanguagePreference(userId: string, languageCode: string): Promise<void> {
    try {
      if (!this.isLanguageSupported(languageCode)) {
        throw new Error(`Language not supported: ${languageCode}`);
      }

      await this.db.collection('users').doc(userId).update({
        languagePreference: languageCode,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

    } catch (error) {
      console.error('❌ Error setting language preference:', error);
      throw new Error(`Failed to set language preference: ${languageCode}`);
    }
  }
}
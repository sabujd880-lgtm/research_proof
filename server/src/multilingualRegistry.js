/**
 * ResearchProof AI — Phase 5 Multilingual Registry & Unicode Typesetting Engine
 * Supports 19+ academic languages, deterministic Unicode script detection,
 * XeLaTeX/LuaLaTeX fontspec configuration, bidi RTL text, and mixed-script wrapping.
 */

export const SCRIPT_DEFINITIONS = {
  latin: {
    id: 'latin',
    name: 'Latin',
    regex: /[\u0041-\u005A\u0061-\u007A\u00C0-\u024F\u1E00-\u1EFF]/g,
    direction: 'ltr'
  },
  bengali: {
    id: 'bengali',
    name: 'Bengali',
    regex: /[\u0980-\u09FF]/g,
    direction: 'ltr'
  },
  devanagari: {
    id: 'devanagari',
    name: 'Devanagari',
    regex: /[\u0900-\u097F]/g,
    direction: 'ltr'
  },
  tamil: {
    id: 'tamil',
    name: 'Tamil',
    regex: /[\u0B80-\u0BFF]/g,
    direction: 'ltr'
  },
  telugu: {
    id: 'telugu',
    name: 'Telugu',
    regex: /[\u0C00-\u0C7F]/g,
    direction: 'ltr'
  },
  malayalam: {
    id: 'malayalam',
    name: 'Malayalam',
    regex: /[\u0D00-\u0D7F]/g,
    direction: 'ltr'
  },
  kannada: {
    id: 'kannada',
    name: 'Kannada',
    regex: /[\u0C80-\u0CFF]/g,
    direction: 'ltr'
  },
  gujarati: {
    id: 'gujarati',
    name: 'Gujarati',
    regex: /[\u0A80-\u0AFF]/g,
    direction: 'ltr'
  },
  gurmukhi: {
    id: 'gurmukhi',
    name: 'Gurmukhi',
    regex: /[\u0A00-\u0A7F]/g,
    direction: 'ltr'
  },
  arabic: {
    id: 'arabic',
    name: 'Arabic',
    regex: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g,
    direction: 'rtl'
  },
  han: {
    id: 'han',
    name: 'Han (Chinese)',
    regex: /[\u4E00-\u9FFF\u3400-\u4DBF]/g,
    direction: 'ltr'
  },
  hiragana_katakana: {
    id: 'hiragana_katakana',
    name: 'Japanese (Kana)',
    regex: /[\u3040-\u309F\u30A0-\u30FF]/g,
    direction: 'ltr'
  },
  hangul: {
    id: 'hangul',
    name: 'Hangul (Korean)',
    regex: /[\uAC00-\uD7AF\u1100-\u11FF]/g,
    direction: 'ltr'
  }
};

export const LANGUAGE_REGISTRY = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    script: 'latin',
    direction: 'ltr',
    polyglossiaName: 'english',
    recommendedEngine: 'xelatex',
    supportedEngines: ['xelatex', 'lualatex', 'pdflatex'],
    font: 'TeX Gyre Termes',
    fontFamily: 'TeX Gyre Termes',
    fallbackFonts: ['Times New Roman', 'DejaVu Serif', 'FreeSerif'],
    supportLevel: 'verified',
    sampleText: 'The present empirical investigation analyzes working memory under acute cognitive load.'
  },
  bn: {
    code: 'bn',
    name: 'Bengali',
    nativeName: 'বাংলা',
    script: 'bengali',
    direction: 'ltr',
    polyglossiaName: 'bengali',
    recommendedEngine: 'xelatex',
    supportedEngines: ['xelatex', 'lualatex'],
    font: 'Noto Serif Bengali',
    fontFamily: 'Noto Serif Bengali',
    fallbackFonts: ['Kalpurush', 'SolaimanLipi', 'FreeSerif', 'Siyam Rupali'],
    supportLevel: 'verified',
    sampleText: 'বর্তমান গবেষণায় স্মৃতিশক্তি ও জ্ঞানীয় প্রক্রিয়ার পারস্পরিক প্রভাব বিশ্লেষণ করা হয়েছে।'
  },
  hi: {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    script: 'devanagari',
    direction: 'ltr',
    polyglossiaName: 'hindi',
    recommendedEngine: 'xelatex',
    supportedEngines: ['xelatex', 'lualatex'],
    font: 'Noto Serif Devanagari',
    fontFamily: 'Noto Serif Devanagari',
    fallbackFonts: ['Lohit Devanagari', 'Mangal', 'FreeSerif', 'Gargi'],
    supportLevel: 'verified',
    sampleText: 'प्रस्तुत अध्ययन में कार्यकारी स्मृति एवं संज्ञानात्मक भार का मूल्यांकन किया गया है।'
  },
  mr: {
    code: 'mr',
    name: 'Marathi',
    nativeName: 'मराठी',
    script: 'devanagari',
    direction: 'ltr',
    polyglossiaName: 'marathi',
    recommendedEngine: 'xelatex',
    supportedEngines: ['xelatex', 'lualatex'],
    font: 'Noto Serif Devanagari',
    fontFamily: 'Noto Serif Devanagari',
    fallbackFonts: ['Lohit Devanagari', 'Mangal', 'FreeSerif'],
    supportLevel: 'verified',
    sampleText: 'या संशोधनात स्मरणशक्ती आणि मानसिक प्रक्रियेचा अभ्यास करण्यात आला आहे.'
  },
  ta: {
    code: 'ta',
    name: 'Tamil',
    nativeName: 'தமிழ்',
    script: 'tamil',
    direction: 'ltr',
    polyglossiaName: 'tamil',
    recommendedEngine: 'xelatex',
    supportedEngines: ['xelatex', 'lualatex'],
    font: 'Noto Serif Tamil',
    fontFamily: 'Noto Serif Tamil',
    fallbackFonts: ['Lohit Tamil', 'Latha', 'FreeSerif'],
    supportLevel: 'verified',
    sampleText: 'இந்த ஆய்வில் நினைவக சுமை மற்றும் கற்றல் திறன்கள் ஆராயப்படுகின்றன.'
  },
  te: {
    code: 'te',
    name: 'Telugu',
    nativeName: 'తెలుగు',
    script: 'telugu',
    direction: 'ltr',
    polyglossiaName: 'telugu',
    recommendedEngine: 'xelatex',
    supportedEngines: ['xelatex', 'lualatex'],
    font: 'Noto Serif Telugu',
    fontFamily: 'Noto Serif Telugu',
    fallbackFonts: ['Lohit Telugu', 'Gautami', 'FreeSerif'],
    supportLevel: 'verified',
    sampleText: 'ఈ పరిశోధనలో జ్ఞాపకశక్తి మరియు అభిజ్ఞా ప్రక్రియల ప్రభావం విశ్లేషించబడింది.'
  },
  ml: {
    code: 'ml',
    name: 'Malayalam',
    nativeName: 'മലയാളം',
    script: 'malayalam',
    direction: 'ltr',
    polyglossiaName: 'malayalam',
    recommendedEngine: 'xelatex',
    supportedEngines: ['xelatex', 'lualatex'],
    font: 'Noto Serif Malayalam',
    fontFamily: 'Noto Serif Malayalam',
    fallbackFonts: ['Rachana', 'Meera', 'FreeSerif'],
    supportLevel: 'verified',
    sampleText: 'ഈ പഠനത്തിൽ ഓർമ്മശക്തിയും മനശാസ്ത്രപരമായ പ്രക്രിയകളും വിശകലനം ചെയ്യുന്നു.'
  },
  kn: {
    code: 'kn',
    name: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
    script: 'kannada',
    direction: 'ltr',
    polyglossiaName: 'kannada',
    recommendedEngine: 'xelatex',
    supportedEngines: ['xelatex', 'lualatex'],
    font: 'Noto Serif Kannada',
    fontFamily: 'Noto Serif Kannada',
    fallbackFonts: ['Lohit Kannada', 'Kedage', 'FreeSerif'],
    supportLevel: 'verified',
    sampleText: 'ಈ ಸಂಶೋಧನೆಯಲ್ಲಿ ಸ್ಮರಣಶಕ್ತಿ ಮತ್ತು ಅರಿವಿನ ಪ್ರಕ್ರಿಯೆಗಳ ಪ್ರಭಾವವನ್ನು ವಿಶ್ಲೇಷಿಸಲಾಗಿದೆ.'
  },
  gu: {
    code: 'gu',
    name: 'Gujarati',
    nativeName: 'ગુજરાતી',
    script: 'gujarati',
    direction: 'ltr',
    polyglossiaName: 'gujarati',
    recommendedEngine: 'xelatex',
    supportedEngines: ['xelatex', 'lualatex'],
    font: 'Noto Serif Gujarati',
    fontFamily: 'Noto Serif Gujarati',
    fallbackFonts: ['Lohit Gujarati', 'Shruti', 'FreeSerif'],
    supportLevel: 'verified',
    sampleText: 'આ સંશોધનમાં સ્મરણશક્તિ અને વિચાર પ્રક્રિયાઓના પ્રભાવનું વિશ્લેષણ કરવામાં આવ્યું છે.'
  },
  pa: {
    code: 'pa',
    name: 'Punjabi',
    nativeName: 'ਪੰਜਾਬੀ',
    script: 'gurmukhi',
    direction: 'ltr',
    polyglossiaName: 'punjabi',
    recommendedEngine: 'xelatex',
    supportedEngines: ['xelatex', 'lualatex'],
    font: 'Noto Serif Gurmukhi',
    fontFamily: 'Noto Serif Gurmukhi',
    fallbackFonts: ['Lohit Gurmukhi', 'Raavi', 'FreeSerif'],
    supportLevel: 'verified',
    sampleText: 'ਇਸ ਖੋਜ ਵਿੱਚ ਯਾਦਦਾਸ਼ਤ ਅਤੇ ਸਿੱਖਣ ਪ੍ਰਕਿਰਿਆਵਾਂ ਦੇ ਪ੍ਰਭਾਵ ਦਾ ਅਧਿਐਨ ਕੀਤਾ ਗਿਆ ਹੈ।'
  },
  ur: {
    code: 'ur',
    name: 'Urdu',
    nativeName: 'اردو',
    script: 'arabic',
    direction: 'rtl',
    polyglossiaName: 'urdu',
    recommendedEngine: 'xelatex',
    supportedEngines: ['xelatex'],
    font: 'Noto Nastaliq Urdu',
    fontFamily: 'Noto Nastaliq Urdu',
    fallbackFonts: ['Jameel Noori Nastaleeq', 'Amiri', 'Scheherazade New'],
    supportLevel: 'verified',
    sampleText: 'اس تحقیقی مقالے میں یادداشت اور شعوری صلاحیتوں کے باہمی تعلق کا جائزہ لیا گیا ہے۔'
  },
  ar: {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    script: 'arabic',
    direction: 'rtl',
    polyglossiaName: 'arabic',
    recommendedEngine: 'xelatex',
    supportedEngines: ['xelatex', 'lualatex'],
    font: 'Amiri',
    fontFamily: 'Amiri',
    fallbackFonts: ['Scheherazade New', 'Noto Naskh Arabic', 'Traditional Arabic'],
    supportLevel: 'verified',
    sampleText: 'تبحث هذه الدراسة التجريبية في أثر العبء المعرفي على كفاءة الذاكرة العاملة وحل المشكلات.'
  },
  fr: {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    script: 'latin',
    direction: 'ltr',
    polyglossiaName: 'french',
    recommendedEngine: 'lualatex',
    supportedEngines: ['lualatex', 'xelatex', 'pdflatex'],
    font: 'TeX Gyre Termes',
    fontFamily: 'TeX Gyre Termes',
    fallbackFonts: ['Times New Roman', 'DejaVu Serif'],
    supportLevel: 'verified',
    sampleText: 'Cette étude empirique examine la charge cognitive et la rétention mnésique.'
  },
  de: {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    script: 'latin',
    direction: 'ltr',
    polyglossiaName: 'german',
    recommendedEngine: 'lualatex',
    supportedEngines: ['lualatex', 'xelatex', 'pdflatex'],
    font: 'TeX Gyre Termes',
    fontFamily: 'TeX Gyre Termes',
    fallbackFonts: ['Times New Roman', 'DejaVu Serif'],
    supportLevel: 'verified',
    sampleText: 'Diese empirische Studie untersucht die kognitive Belastung und das Arbeitsgedächtnis.'
  },
  es: {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    script: 'latin',
    direction: 'ltr',
    polyglossiaName: 'spanish',
    recommendedEngine: 'lualatex',
    supportedEngines: ['lualatex', 'xelatex', 'pdflatex'],
    font: 'TeX Gyre Termes',
    fontFamily: 'TeX Gyre Termes',
    fallbackFonts: ['Times New Roman', 'DejaVu Serif'],
    supportLevel: 'verified',
    sampleText: 'Este estudio empírico analiza la carga cognitiva y la retención en la memoria.'
  },
  pt: {
    code: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    script: 'latin',
    direction: 'ltr',
    polyglossiaName: 'portuguese',
    recommendedEngine: 'lualatex',
    supportedEngines: ['lualatex', 'xelatex', 'pdflatex'],
    font: 'TeX Gyre Termes',
    fontFamily: 'TeX Gyre Termes',
    fallbackFonts: ['Times New Roman', 'DejaVu Serif'],
    supportLevel: 'verified',
    sampleText: 'Este estudo empírico investiga a carga cognitiva e a memória operacional.'
  },
  zh: {
    code: 'zh',
    name: 'Chinese (Simplified)',
    nativeName: '中文 (简体)',
    script: 'han',
    direction: 'ltr',
    polyglossiaName: 'chinese',
    recommendedEngine: 'xelatex',
    supportedEngines: ['xelatex', 'lualatex'],
    font: 'Noto Serif CJK SC',
    fontFamily: 'Noto Serif CJK SC',
    fallbackFonts: ['SimSun', 'Microsoft YaHei', 'PingFang SC', 'Source Han Serif SC'],
    supportLevel: 'verified',
    sampleText: '本实证研究探讨了认知负荷对工作记忆提取与学术问题解决能力的影响。'
  },
  ja: {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    script: 'hiragana_katakana',
    direction: 'ltr',
    polyglossiaName: 'japanese',
    recommendedEngine: 'xelatex',
    supportedEngines: ['xelatex', 'lualatex'],
    font: 'Noto Serif CJK JP',
    fontFamily: 'Noto Serif CJK JP',
    fallbackFonts: ['Yu Mincho', 'MS Mincho', 'Hiragino Mincho ProN', 'Source Han Serif JP'],
    supportLevel: 'verified',
    sampleText: '本研究では、認知的負荷が作業記憶の保持および問題解決に与える影響を検証する。'
  },
  ko: {
    code: 'ko',
    name: 'Korean',
    nativeName: '한국어',
    script: 'hangul',
    direction: 'ltr',
    polyglossiaName: 'korean',
    recommendedEngine: 'xelatex',
    supportedEngines: ['xelatex', 'lualatex'],
    font: 'Noto Serif CJK KR',
    fontFamily: 'Noto Serif CJK KR',
    fallbackFonts: ['Batang', 'Malgun Gothic', 'Apple Myungjo', 'Source Han Serif KR'],
    supportLevel: 'verified',
    sampleText: '본 실증 연구는 인지 부하가 작업 기억 유지 및 학술적 문제 해결에 미치는 영향을 분석한다.'
  }
};

/**
 * Deterministically analyzes text to detect scripts present, character counts, and percentages.
 */
export function detectScripts(text = '') {
  if (typeof text !== 'string' || !text.trim()) {
    return {
      primaryScript: 'Latin',
      primaryScriptKey: 'latin',
      detectedScripts: ['Latin'],
      detectedScriptDetails: [{ script: 'latin', name: 'Latin', count: 0, percentage: 100 }],
      distribution: {
        Latin: { script: 'latin', name: 'Latin', count: 0, percentage: 100 },
        latin: { script: 'latin', name: 'Latin', count: 0, percentage: 100 }
      },
      isMixed: false,
      isMixedScript: false,
      isRtl: false
    };
  }

  const scriptCounts = {};
  let totalScriptChars = 0;

  for (const [scriptKey, def] of Object.entries(SCRIPT_DEFINITIONS)) {
    const matches = text.match(def.regex);
    const count = matches ? matches.length : 0;
    if (count > 0) {
      scriptCounts[scriptKey] = count;
      totalScriptChars += count;
    }
  }

  if (totalScriptChars === 0) {
    return {
      primaryScript: 'Latin',
      primaryScriptKey: 'latin',
      detectedScripts: ['Latin'],
      detectedScriptDetails: [{ script: 'latin', name: 'Latin', count: 0, percentage: 100 }],
      distribution: {
        Latin: { script: 'latin', name: 'Latin', count: 0, percentage: 100 },
        latin: { script: 'latin', name: 'Latin', count: 0, percentage: 100 }
      },
      isMixed: false,
      isMixedScript: false,
      isRtl: false
    };
  }

  const scriptDetails = Object.entries(scriptCounts)
    .map(([script, count]) => {
      const percentage = Math.round((count / totalScriptChars) * 1000) / 10;
      const def = SCRIPT_DEFINITIONS[script];
      const name = def?.name ? def.name.split(' ')[0] : script;
      return {
        script,
        name,
        fullName: def?.name || script,
        count,
        percentage
      };
    })
    .sort((a, b) => b.count - a.count);

  const topScript = scriptDetails[0];
  const primaryScript = topScript.name;
  const primaryScriptKey = topScript.script;
  const isMixed = scriptDetails.length > 1 && scriptDetails[1].percentage >= 2.0;
  const isRtl = SCRIPT_DEFINITIONS[primaryScriptKey]?.direction === 'rtl';

  const distribution = {};
  scriptDetails.forEach(s => {
    distribution[s.name] = s;
    distribution[s.script] = s;
    if (s.fullName) distribution[s.fullName] = s;
  });

  const detectedScriptNames = scriptDetails.map(s => s.name);

  return {
    primaryScript,
    primaryScriptKey,
    detectedScripts: detectedScriptNames,
    detectedScriptDetails: scriptDetails,
    distribution,
    isMixed,
    isMixedScript: isMixed,
    isRtl
  };
}

/**
 * Resolves appropriate language configuration from user preference and detected scripts.
 */
export function resolveDocumentLanguage(text = '', userSelectedCode = 'auto') {
  const scriptAnalysis = detectScripts(text);

  if (userSelectedCode && userSelectedCode !== 'auto') {
    const config = LANGUAGE_REGISTRY[userSelectedCode];
    if (config) {
      return {
        selectedCode: userSelectedCode,
        language: config,
        scriptAnalysis,
        isRtl: config.direction === 'rtl'
      };
    }
  }

  // Automatic language inference from primary script
  let inferredCode = 'en';
  switch (scriptAnalysis.primaryScriptKey) {
    case 'bengali': inferredCode = 'bn'; break;
    case 'devanagari': inferredCode = 'hi'; break;
    case 'tamil': inferredCode = 'ta'; break;
    case 'telugu': inferredCode = 'te'; break;
    case 'malayalam': inferredCode = 'ml'; break;
    case 'kannada': inferredCode = 'kn'; break;
    case 'gujarati': inferredCode = 'gu'; break;
    case 'gurmukhi': inferredCode = 'pa'; break;
    case 'arabic': inferredCode = 'ar'; break;
    case 'han': inferredCode = 'zh'; break;
    case 'hiragana_katakana': inferredCode = 'ja'; break;
    case 'hangul': inferredCode = 'ko'; break;
    default: inferredCode = 'en'; break;
  }

  const resolvedConfig = LANGUAGE_REGISTRY[inferredCode] || LANGUAGE_REGISTRY.en;

  return {
    selectedCode: inferredCode,
    language: resolvedConfig,
    scriptAnalysis,
    isRtl: resolvedConfig.direction === 'rtl'
  };
}

/**
 * Wraps secondary script segments with LaTeX font/script macros (e.g. \textbengali{...}) in Mode B (Mixed Language).
 * Preserves math segments and LaTeX commands untouched.
 */
export function wrapMixedLanguageSegments(text = '', primaryScript = 'latin') {
  if (typeof text !== 'string' || !text.trim()) return text;

  const normalizedPrimary = (primaryScript || 'latin').toLowerCase();

  // Protect LaTeX commands, math segments, and placeholders
  const protectedTokens = [];
  const tokenized = text.replace(/(\\[a-zA-Z]+(\{[^{}]*\}|\[[^[\]]*\])*|\$[^$]+\$|XRPX[A-Z0-9]+XENDX)/g, (match) => {
    const placeholder = `__RP_MIXED_TOKEN_${protectedTokens.length}__`;
    protectedTokens.push(match);
    return placeholder;
  });

  let processed = tokenized;

  // Identify secondary scripts present
  for (const [scriptKey, def] of Object.entries(SCRIPT_DEFINITIONS)) {
    if (scriptKey === normalizedPrimary) continue;

    // Match runs of secondary script characters (including combining diacritics and joiners)
    const scriptRunRegex = new RegExp(`(${def.regex.source}[\\s\\u200C\\u200D${def.regex.source.slice(1,-1)}]*${def.regex.source})`, 'g');
    processed = processed.replace(scriptRunRegex, (match) => {
      // Clean script command name
      const cmdName = `text${scriptKey.replace(/[^a-zA-Z]/g, '')}`;
      return `\\${cmdName}{${match}}`;
    });
  }

  // Restore protected tokens
  for (let i = 0; i < protectedTokens.length; i++) {
    processed = processed.replace(`__RP_MIXED_TOKEN_${i}__`, protectedTokens[i]);
  }

  return processed;
}

/**
 * Generates Unicode-capable preamble blocks using fontspec, polyglossia, and bidi for XeLaTeX/LuaLaTeX.
 */
export function generateUnicodePreamble(arg1 = {}, arg2 = [], arg3 = 'xelatex') {
  let langConfig;
  let detectedScripts = [];
  let documentMode = 'mixed';
  let engine = 'xelatex';

  if (typeof arg1 === 'string') {
    langConfig = LANGUAGE_REGISTRY[arg1] || LANGUAGE_REGISTRY.en;
    detectedScripts = Array.isArray(arg2) ? arg2 : [];
    engine = typeof arg3 === 'string' ? arg3 : 'xelatex';
  } else if (arg1 && typeof arg1 === 'object') {
    if (arg1.polyglossiaName || arg1.script || arg1.font || arg1.fontFamily) {
      // Direct language config object
      langConfig = {
        code: arg1.code || 'en',
        name: arg1.name || 'English',
        script: (arg1.script || 'latin').toLowerCase(),
        fontFamily: arg1.fontFamily || arg1.font || 'DejaVu Serif',
        polyglossiaName: arg1.polyglossiaName || (arg1.name ? arg1.name.toLowerCase() : 'english'),
        direction: arg1.isRtl || arg1.direction === 'rtl' ? 'rtl' : 'ltr',
        fallbackFonts: arg1.fallbackFonts || []
      };
      detectedScripts = Array.isArray(arg2) && arg2.length > 0 ? arg2 : (arg1.detectedScripts || []);
      engine = typeof arg3 === 'string' && arg3 !== 'xelatex' ? arg3 : (arg1.engine || arg3 || 'xelatex');
      documentMode = arg1.documentMode || 'mixed';
    } else {
      // Standard options object
      const code = arg1.primaryLanguage || arg1.documentLanguage || 'en';
      langConfig = LANGUAGE_REGISTRY[code] || LANGUAGE_REGISTRY.en;
      detectedScripts = Array.isArray(arg1.detectedScripts) ? arg1.detectedScripts : (Array.isArray(arg2) ? arg2 : []);
      documentMode = arg1.documentMode || 'mixed';
      engine = arg1.engine || (typeof arg3 === 'string' ? arg3 : 'xelatex');
    }
  } else {
    langConfig = LANGUAGE_REGISTRY.en;
  }

  const isRtl = langConfig.direction === 'rtl';

  let preamble = `% ResearchProof AI — Multilingual Unicode Configuration\n`;
  preamble += `\\usepackage{fontspec}\n`;
  preamble += `\\usepackage{polyglossia}\n`;

  // Set default / main language (polyglossia supports \setmainlanguage as standard)
  const langName = langConfig.polyglossiaName || 'english';
  preamble += `\\setmainlanguage{${langName}}\n`;
  preamble += `\\setdefaultlanguage{${langName}}\n`;

  // Primary font family configuration
  const fontName = langConfig.fontFamily;
  const scriptName = SCRIPT_DEFINITIONS[langConfig.script]?.name || 'Latin';
  preamble += `\\setmainfont{${fontName}}[\n`;
  preamble += `  Script=${scriptName.split(' ')[0]},\n`;
  preamble += `  Path=,\n`;
  preamble += `  Extension=.ttf,\n`;
  preamble += `  UprightFont=*,\n`;
  preamble += `  BoldFont=*-Bold,\n`;
  preamble += `  ItalicFont=*-Italic,\n`;
  preamble += `  BoldItalicFont=*-BoldItalic,\n`;
  preamble += `  Fallback={${(langConfig.fallbackFonts || []).join(',')}}\n`;
  preamble += `]\n\n`;

  // Also define \<script>font family for direct script switching (e.g., \arabicfont)
  const primaryCleanCmd = langConfig.script.replace(/[^a-zA-Z]/g, '');
  preamble += `\\newfontfamily\\${primaryCleanCmd}font{${fontName}}[\n`;
  preamble += `  Script=${scriptName.split(' ')[0]}\n`;
  preamble += `]\n\n`;

  // Define secondary languages and script fonts for mixed mode
  const activeSecondaryScripts = new Set();
  if (documentMode === 'mixed' || documentMode === 'preserve') {
    detectedScripts.forEach(s => {
      const scriptKey = typeof s === 'string' ? s.toLowerCase() : (s.script || '').toLowerCase();
      if (scriptKey && scriptKey !== langConfig.script) {
        activeSecondaryScripts.add(scriptKey);
      }
    });
  }

  activeSecondaryScripts.forEach(scriptKey => {
    const repLang = Object.values(LANGUAGE_REGISTRY).find(l => l.script === scriptKey);
    const polyName = repLang?.polyglossiaName || scriptKey;
    const cleanCmd = scriptKey.replace(/[^a-zA-Z]/g, '');

    preamble += `\\setotherlanguage{${polyName}}\n`;
    preamble += `\\newfontfamily\\${cleanCmd}font{${repLang?.fontFamily || 'DejaVu Serif'}}[\n`;
    preamble += `  Script=${SCRIPT_DEFINITIONS[scriptKey]?.name?.split(' ')[0] || 'Latin'}\n`;
    preamble += `]\n`;
    preamble += `\\newcommand{\\text${cleanCmd}}[1]{{\\${cleanCmd}font #1}}\n\n`;
  });

  // Bidi & RTL support
  if (isRtl || activeSecondaryScripts.has('arabic')) {
    preamble += `% Bidirectional RTL Support for Arabic/Urdu\n`;
    if (engine === 'lualatex') {
      preamble += `\\usepackage{luabidi}\n\n`;
    } else {
      preamble += `\\usepackage{bidi}\n\n`;
    }
  }

  return preamble;
}

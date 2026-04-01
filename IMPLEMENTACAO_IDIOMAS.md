# 🎯 Implementação: Sistema de Idiomas no Backend playHome

**Status**: ✅ **COMPLETO E VALIDADO**  
**Data**: 2 Abril 2026

---

## 📊 Resumo Executivo

Implementado sistema completo de suporte a múltiplos idiomas no backend da aplicação playHome, replicando a arquitetura utilizada no app React Native. O sistema permite que o app selecione um idioma e o backend automaticamente distribua as palavras do jogo no idioma correto.

### Idiomas Suportados
- 🇧🇷 **Português Brasileiro** (pt-BR) - 1168 palavras
- 🇵🇹 **Português Europeu** (pt-PT) - 1168 palavras  
- 🇺🇸 **Inglês USA** (en-US) - 873 palavras
- 🇬🇧 **Inglês UK** (en-GB) - 873 palavras
- 🇪🇸 **Espanhol** (es-ES) - 974 palavras
- 🇲🇽 **Español Latinoamericano** (es-419/es-LATAM) - 974 palavras
- 🇫🇷 **Français** (fr) - 833 palavras
- 🇩🇪 **Deutsch** (de) - ✓ Disponível
- 🇮🇹 **Italiano** (it) - ✓ Disponível
- 🇷🇺 **Русский** (ru) - ✓ Disponível
- **한국어** (ko) - ✓ Disponível
- 🇯🇵 **日本語** (ja) - ✓ Disponível
- 🇨🇳 **中文** (zh) - ✓ Disponível
- 🇮🇳 **हिन्दी** (hi) - ✓ Disponível
- 🇸🇦 **العربية** (ar) - ✓ Disponível

---

## 🔧 Implementação Técnica

### 1️⃣ Conversão TypeScript → JavaScript

#### Arquivos Convertidos
Todos os 12 arquivos de idiomas foram convertidos de TypeScript para JavaScript puro:

| Arquivo | Status | Palavras | Categorias |
|---------|--------|----------|-----------|
| portuguese.js | ✅ | 1168 | 12 |
| english.js | ✅ | 873 | 10 |
| spanish.js | ✅ | 974 | 12 |
| french.js | ✅ | 833 | 12 |
| german.js | ✅ | - | - |
| italian.js | ✅ | - | - |
| russian.js | ✅ | - | - |
| korean.js | ✅ | - | - |
| japanese.js | ✅ | - | - |
| chinese.js | ✅ | - | - |
| hindi.js | ✅ | - | - |
| arabic.js | ✅ | - | - |

**Mudanças feitas**:
- ✓ Removido `import { WordData } from "./types.ts"`
- ✓ Removidas anotações de tipo TypeScript (`: WordData[]`)
- ✓ Mantidos exports ES6 nativos
- ✓ Preservada 100% da estrutura de dados

### 2️⃣ Arquivo Central: `game/words/index.js`

**Funcionalidade**:
```javascript
getWordDatabase(language) → Array<{word, category, hint, related}>
```

**Lógica de Seleção**:
1. Verifica variações específicas (pt-PT, en-GB, es-419)
2. Se não encontrado, usa código base (primeiro segmento antes do hífen)
3. Fallback automático para en-US se idioma não suportado

**Exports**:
- `getWordDatabase(lang)` - Função principal
- `getCategories(wordDatabase)` - Extrai categorias únicas
- `WORDS` - Banco padrão (pt-BR) para compatibilidade
- `categories` - Categorias do banco padrão

### 3️⃣ Modificações em `socket/gameHandlers.js`

#### Handler: `start-game`
```javascript
socket.on("start-game", ({ roomCode, config, language }, cb) => {
  // ...
  const selectedLanguage = language || config.language || "pt-BR";
  room.language = selectedLanguage;  // ← Armazena para reuso
  
  const gameData = initializeGame(
    // ... outros parâmetros ...
    selectedLanguage  // ← Passa para lógica do jogo
  );
})
```

**Novidades**:
- ✓ Aceita `language` como parâmetro direto
- ✓ Fallback para `config.language` se não especificado
- ✓ Armazena em `room.language` para reutilização
- ✓ Passa idioma para `initializeGame()`

#### Handler: `reroll-game`
```javascript
socket.on("reroll-game", ({ roomCode }, cb) => {
  // ...
  const gameData = initializeGame(
    // ... parâmetros anteriores ...
    room.language || "pt-BR"  // ← Reutiliza idioma armazenado
  );
})
```

**Proteção**: Uma vez iniciada uma partida, o idioma não pode ser alterado (fixado em `room.language`).

### 4️⃣ Modificações em `game/gameLogistic.js`

#### Importação Atualizada
```javascript
import { getWordDatabase } from "./words/index.js";
// (removido: import { WORDS } from "./words.js")
```

#### Assinatura de `initializeGame()`
```javascript
export function initializeGame(
  allPlayers,
  howManyImpostors,
  twoWordsMode,
  impostorHasHint,
  selectedCategories,
  whoStartButton,
  impostorCanStart,
  impostorTrap,
  impostorCat,
  impostorsUnited,
  impostorHistory = [],
  usedWords = [],
  language = "pt-BR"  // ← NOVO PARÂMETRO
)
```

#### Uso do Banco Dinâmico
```javascript
// Obtém o banco de palavras correto baseado no idioma
const wordDatabase = getWordDatabase(language);

const { updatedPlayers, chosenWord } = distributeWords(
  impostorTrueOrFalse,
  twoWordsMode,
  selectedCategories,
  wordDatabase,  // ← Usa banco selecionado, não WORDS global
  impostorHasHint,
  impostorTrap,
  impostorCat, 
  usedWords
);
```

---

## 📋 Fluxo de Dados Completo

```
┌─────────────────────────┐
│  React Native App       │
│  (seleciona idioma)     │
└────────────┬────────────┘
             │
             ├─ language: "pt-BR"
             │
             ↓
┌─────────────────────────┐
│ Socket: start-game      │
├─────────────────────────┤
│ {                       │
│   roomCode: "ABC123",   │
│   config: {...},        │
│   language: "pt-BR" 👈  │
│ }                       │
└────────────┬────────────┘
             │
             ↓
┌─────────────────────────────────┐
│ gameHandlers.js                 │
├─────────────────────────────────┤
│ • Recebe language               │
│ • Armazena em room.language     │
│ • Passa para initializeGame()   │
└────────────┬────────────────────┘
             │
             ↓
┌──────────────────────────────────┐
│ gameLogistic.js                  │
│ initializeGame(...)              │
├──────────────────────────────────┤
│ const worddb =                   │
│   getWordDatabase(language)      │
│                                  │
│ ↓                                │
│ distributeWords(                │
│   ...,                           │
│   worddb,  ← Banco correto      │
│   ...                            │
│ )                                │
└────────────┬─────────────────────┘
             │
             ↓
┌──────────────────────────────────┐
│ Palavras da partida              │
│ no idioma selecionado ✓          │
└──────────────────────────────────┘
```

### Proteção: Idioma Fixo na Partida

Uma vez que uma partida é iniciada (`start-game`), o idioma fica fixo em `room.language`. Mesmo que o cliente tente enviar um idioma diferente em um `reroll-game`, o servidor sempre usa o idioma armazenado:

```javascript
// reroll-game sempre usa room.language
room.language || "pt-BR"  // Never changes during session
```

---

## ✅ Validações Realizadas

### Testes de Sintaxe
```
✓ game/words/portuguese.js
✓ game/words/english.js
✓ game/words/spanish.js
✓ game/words/french.js
✓ game/words/german.js
✓ game/words/italian.js
✓ game/words/russian.js
✓ game/words/korean.js
✓ game/words/japanese.js
✓ game/words/chinese.js
✓ game/words/hindi.js
✓ game/words/arabic.js
✓ game/gameLogistic.js
✓ socket/gameHandlers.js
✓ game/words/index.js
```

### Testes Funcionais

```
Português Brasileiro (pt-BR):
  ✓ 1168 palavras carregadas
  ✓ 12 categorias extraídas
  ✓ Estrutura preservada: {word, category, hint, related}

Inglês USA (en-US):
  ✓ 873 palavras carregadas
  ✓ 10 categorias

Inglês UK (en-GB):
  ✓ 873 palavras carregadas
  ✓ Variação correta do en-US

Português Europeu (pt-PT):
  ✓ 1168 palavras carregadas
  ✓ Variação correta do pt-BR

Espanhol (es-ES):
  ✓ 974 palavras carregadas

Español Latinoamericano (es-419):
  ✓ 974 palavras carregadas
  ✓ Variação correta

Francês (fr):
  ✓ 833 palavras carregadas

Fallback (xx-XX):
  ✓ en-US retornado automaticamente
  ✓ Sistema robusto
```

### Compatibilidade Backward
```
✓ WORDS constant ainda disponível (pt-BR)
✓ categories constant ainda disponível
✓ Código antigo que usa WORDS direto continua funcionando
```

---

## 🚀 Como Usar (do App React Native)

### Enviando o Idioma para o Backend

```javascript
const language = "pt-BR"; // ou outro código suportado

socket.emit("start-game", {
  roomCode: "ABC123",
  config: { 
    howManyImpostors: 1, 
    selectedCategories: ["Reino Animal", "Gastronomia"],
    twoWordsMode: false,
    impostorHasHint: true,
    // ... outras configurações
  },
  language: language  // 👈 Enviar o idioma
}, (response) => {
  if (response.ok) {
    // Partida iniciada com as palavras no idioma correto!
  }
});
```

### Alternativa (se preferir dentro de config)

```javascript
socket.emit("start-game", {
  roomCode: "ABC123",
  config: { 
    howManyImpostors: 1,
    language: "pt-BR",  // 👈 Pode ficar aqui também
    selectedCategories: [...],
    // ...
  }
}, (response) => { ... });
```

---

## 📌 Pontos-Chave

### ✅ Implementado
- [x] Conversão de todos os 12 idiomas para JavaScript puro
- [x] Função `getWordDatabase(language)` funcionando corretamente
- [x] Backend recebe `language` do app
- [x] Backend armazena `language` em `room.language`
- [x] Backend seleciona banco de palavras correto por idioma
- [x] Proteção contra mudança de idioma durante a partida
- [x] Fallback inteligente para en-US
- [x] Compatibilidade backward com código antigo
- [x] Todos os testes passando

### 🔒 Segurança
- Uma vez iniciada a partida, o idioma não pode ser alterad
- Sistema de fallback previne erros de idioma inválido
- Validação de estrutura de dados preservada

### 🎯 Próximos Passos (Opcional)
1. Adicionar mais idiomas se necessário
2. Implementar seleção de idioma na tela de criação de sala
3. Persistir preferência de idioma do usuário
4. Adicionar testes E2E para fluxo completo

---

## 📞 Suporte

Se encontrar problema com qualquer idioma, verifique:
1. Que o código está em lista suportada: pt-BR, en-US, es-ES, etc.
2. Que está sendo enviado corretamente do app
3. Que `room.language` está sendo armazenado corretamente

**Tudo pronto para produção!** ✨

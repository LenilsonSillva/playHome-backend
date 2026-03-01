# 📋 Análise de Arquitetura - PlayHome Backend

## 1️⃣ ESTRUTURA DE DADOS (TIPOS)

### Problema: Falta de Type Definition Centralizada

Atualmente o código não tem uma definição clara de tipos. Necessário criar interfaces para:

#### **Player Base**
```typescript
interface PlayerBase {
  socketId: string;
  id: string;
  name: string;
  emoji: string;
  color: string;
}
```

#### **Game Player (dentro do jogo)**
```typescript
interface GamePlayer extends PlayerBase {
  isImpostor: boolean;
  isAlive: boolean;
  word: string | null;
  hint?: string | undefined;
  revealed: boolean;
  ready: boolean;
  voted: boolean;
  // 🔴 PROBLEMA: score e globalScore são tratados de forma inconsistente
  score: number;
  globalScore: number;
}
```

#### **Room**
```typescript
interface Room {
  code: string;
  hostId: string;
  players: PlayerBase[];
  waitingPlayers?: PlayerBase[];
  phase: "lobby" | "reveal" | "discussion" | "voting" | "result";
  config: GameConfig;
  game: GameState | null;
}
```

#### **Game State**
```typescript
interface GameState {
  allPlayers: GamePlayer[];
  phase: string;
  roomCode: string;
  hostId: string;
  howManyImpostors: number;
  twoWordsMode: boolean;
  impostorHasHint: boolean;
  selectedCategories: string[];
  whoStart: string | undefined;
  impostorCanStart: boolean;
  chosenWord: [string, string];
  votes: Record<string, string>;
  votingFinished: boolean;
  eliminatedId: string | null;
  impostorHistory: string[][];
  usedWords: string[];
}
```

---

## 2️⃣ PROBLEMA: SCORE E GLOBALSCORE

### Status Atual ❌

**Em `gameLogistic.js` → `createImpostorPlayers()`:**
```javascript
score: 0,
globalScore: p.globalScore ?? 0
```

**Em `gameHandlers.js` → confirmar eliminação:**
```javascript
if (isGameOver) {
  game.allPlayers.forEach(player => {
    const roundPoints = getRoundPoints(player);
    player.score = (player.score || 0) + roundPoints;
    player.globalScore = (player.globalScore || 0) + player.score;
    player.score = 0;  // ❌ RESET AQUI
  });
}
```

**Em `buildPlayerView()` / `buildSpectatorView()`:**
```javascript
score: p.score || 0,
globalScore: p.globalScore || 0,
```

### Problemas Identificados 🔴

1. **Score é resetado para 0 no `confirm-elimination`** mas depois aparece como 0 na view
   - O jogador nunca vê sua pontuação da rodada final
   
2. **Inconsistência no `reroll-game`:**
   ```javascript
   globalScore: old?.globalScore ?? 0,
   // score NÃO é preservado/resetado explicitamente
   ```
   
3. **No frontend offline:** não há lógica clara de quando somar score a globalScore

4. **Resetar score duas vezes:**
   - Uma vez em `confirm-elimination`
   - Outra vez quando `initializeGame` é chamado

### Solução Proposta ✅

**Padrão único para todos os modos (offline/online):**

```javascript
// Estado base de um novo jogo
interface PlayerScore {
  score: number;        // Pontos DA RODADA ATUAL
  globalScore: number;  // Pontos ACUMULADOS de todas as rodadas
}

// Fluxo correto:
// 1. Rodada começa → score = 0
// 2. Rodada termina → score recebe pontos baseado em getRoundPoints()
// 3. Jogador vê sua pontuação
// 4. Próxima rodada → globalScore += score; score = 0
```

**Locais onde isso precisa acontecer:**
- ✅ server (já faz isso em `confirm-elimination`)
- ❌ offline (frontend precisa fazer igual)

---

## 3️⃣ PROBLEMA: SPECTATORS (isSpectator)

### Status Atual ❌

#### **Cenário 1: Jogador entra em sala em andamento**

Código em `roomHandlers.js`:
```javascript
socket.on("join-room", ({ name, id, emoji, color, roomCode }, cb) => {
  const room = rooms[roomCode];
  if (!room) return safeCb(cb, { error: "Sala não existe" });
  if (room.phase !== "lobby") return safeCb(cb, { error: "Jogo já começou" }); // ❌ ERRO AQUI!

  // ... resto do código
  if (room.phase !== "lobby") { // ❌ REDUNDANTE: nunca chega aqui
    room.waitingPlayers ??= [];
    room.waitingPlayers.push(...)
  }
```

**Problema:** A primeira checagem retorna erro, a segunda nunca é executada!

#### **Cenário 2: Rejoin de um spectador**

Código em `gameHandlers.js`:
```javascript
socket.on("rejoin-room", ({ roomCode }, cb) => {
  const room = rooms[roomCode];
  if (!room) return safeCb(cb, { error: "Sala não existe" });
  socket.join(roomCode);
  
  if (room.game) {
    const isParticipant = room.game.allPlayers.some(p => p.id === socket.id);
    
    if (isParticipant) {
      socket.emit("game-update", buildPlayerView(room.game, socket.id));
    } else {
      socket.emit("game-update", buildSpectatorView(room.game, socket.id));
    }
  }
  safeCb(cb, { ok: true });
});
```

**Problema:** `socket.id` mas `room.game.allPlayers` usa `p.id`. Inconsistência de nomenclatura!
- `socketId` é usado em `room.players`
- `id` é usado em `game.allPlayers`

#### **Cenário 3: BuildSpectatorView**

```javascript
export function buildSpectatorView(game, socketId) {
  const baseView = {
    phase: game.phase,
    roomCode: game.roomCode,
    isSpectator: true,
    // ❌ FALTAM: myName, myEmoji, myColor, myColor para mostrar dados do próprio jogador
    // ...
  };

  if (["reveal", "discussion", "voting", "result"].includes(game.phase)) {
    return {
      ...baseView,
      players: game.allPlayers.map(p => ({
        // ✅ Aqui tem os dados dos outros
      }))
    };
  }
  // ❌ Na fase "lobby" onde estão os dados de quem entrou?
}
```

#### **Cenário 4: Quando spectador vira jogador**

Código em `start-game`:
```javascript
if (room.waitingPlayers?.length) {
  room.players.push(...room.waitingPlayers);
  room.waitingPlayers = [];
}

const playersForGame = room.players.map((p) => ({ ...p, id: p.socketId }));
```

**Problema:** Um spectador que entrou como `waitingPlayer` vira jogador sem ter sido selecionado!
- Se a fase não era "lobby", o jogador entra em `waitingPlayers`
- Na próxima rodada, ele vira jogador automaticamente
- **Isso não combina com a intenção visual de "espectador"**

---

## 4️⃣ PROBLEMA: DADOS QUE CHEGAM AO SPECTADOR

### O que falta no `buildSpectatorView`:

1. **Info de si mesmo:**
   - Precisa saber seu próprio nome, emoji, cor
   - Mesmo que seja spectador, o frontend precisa mostrar "você está assistindo"

2. **Fases específicas:**
   - Fase "lobby" → spectador não recebe dados dos players
   - Deveria receber lista de players + waiting players para contexto

3. **Sincronização ao entrar:**
   - Quando entra no meio do jogo (por exemplo, fase "discussion")
   - Precisa receber: quem foi eliminado, quem está vivo, votos atuais

---

## 5️⃣ INCONSISTÊNCIAS DE NOMENCLATURA

| Objeto | ID Field | Uso |
|--------|----------|-----|
| `room.players[]` | `socketId` | Identificador da conexão |
| `game.allPlayers[]` | `id` | Identificador do jogo |
| `rejoin-room` | `socket.id` | Comparação (❌ ERRADO) |
| `game.votes` | `socket.id` | Chave de voto |

**Problema:** Há mix de `socketId` vs `id` que quebra comparações!

---

## 6️⃣ FLUXO DE DADOS: Offline vs Online

### Modo OFFLINE (Frontend SÒ)
```
Jogo local:
1. Score acumula durante rodada (getRoundPoints)
2. Fim de rodada → score some no globalScore
3. score reseta
4. Próxima rodada começa
```

### Modo ONLINE (Frontend + Backend)
```
1. Frontend envia voto ao backend
2. Backend calcula pontos (❌ frontend faz igual?)
3. Backend emite novo game-update
4. Frontend mostra pontos
```

**Pergunta:** Quem calcula os pontos? Frontend ou Backend? Ambos?

---

## 7️⃣ RESUMO DAS FIXES NECESSÁRIAS

### 🔴 CRÍTICO

1. **`join-room` handler** (linha ~35 de roomHandlers.js)
   - Remover primeira checagem `if (room.phase !== "lobby")`
   - Refatorar lógica para: se fase !== lobby → add a waitingPlayers, senão → add a players

2. **`buildSpectatorView`**
   - Sempre incluir dados pessoais (nome, emoji, cor) mesmo como spectador
   - Incluir contexto correto em cada fase

3. **Score reset**
   - Documentar exatamente QUANDO score é resetado
   - Não resetar duas vezes
   - Garantir que frontend vê a pontuação antes do reset

4. **Comparações de ID**
   - Padronizar: usar `id` em loógica de jogo, `socketId` apenas na room

### 🟡 IMPORTANTE

5. **Tipos/Interfaces**
   - Criar arquivo de types.d.js ou types.ts

6. **Comentários**
   - Documentar fluxo de spectators
   - Explicar quando alguém vira participante after waiting

7. **Função `handlePlayerExit`**
   - Garantir que trata spectators corretamente
   - Não quebra outros espectadores

---

## 8️⃣ RECOMENDAÇÕES DE ARQUITETURA

### Estrutura de Pasta Proposta:
```
game/
  gameLogistic.js      (lógica de inicialização)
  impostor.utils.js    (ferramentas gerais)
  words.js             (banco de palavras)
  scoringSystem.js     (NOVO: sistema de pontuação)
  playerModels.js      (NOVO: modelos de jogadores)

socket/
  index.js
  roomHandlers.js
  gameHandlers.js
  spectatorHandlers.js (NOVO: lógica específica de spectators)

state/
  rooms.js
  types.d.js           (NOVO: definições de tipos)
```

### Função Proposta: `updatePlayerScores(game, playerWhoEliminated)`
```javascript
export function updatePlayerScores(game, isGameOver) {
  if (!isGameOver) return;
  
  game.allPlayers.forEach(player => {
    const roundPoints = getRoundPoints(player);
    
    // Score da rodada = apenas os pontos ganhos NESSA rodada
    player.score = roundPoints;
    
    // GlobalScore = acumulação histórica
    player.globalScore = (player.globalScore || 0) + roundPoints;
  });
}
```

Depois, no ciclo:
```javascript
// Fim do jogo
updatePlayerScores(game, true);

// Antes de nova rodada
game.allPlayers.forEach(p => {
  p.score = 0;        // reseta apenas ANTES de nova rodada
  p.voted = false;
  p.revealed = false;
  // globalScore NÃO reseta
});
```

---

## ✅ CHECKLIST DE FIXES

- [ ] Criar `types.d.js` com interfaces
- [ ] Fixar `join-room` logic
- [ ] Fixar `buildSpectatorView` com dados pessoais
- [ ] Criar `updatePlayerScores()` function
- [ ] Garantir `game.allPlayers` usa sempre `id` (não `socketId`)
- [ ] Testar spectator em fase reveal, discussion, voting, result
- [ ] Testar spectator vira player na próxima rodada
- [ ] Documentar fluxo de dados offline vs online


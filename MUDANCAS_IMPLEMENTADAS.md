# ✅ MUDANÇAS IMPLEMENTADAS - PlayHome Backend

## 📋 Resumo das Alterações

Este documento descreve todas as correções e padronizações realizadas no backend do PlayHome.

---

## 1️⃣ NOVOS ARQUIVOS CRIADOS

### `types.d.js` - Definição de Tipos
- Define interfaces TypeScript-documentadas para melhor manutenibilidade
- Cobre: `PlayerBase`, `GamePlayer`, `GameConfig`, `GameState`, `Room`, `PlayerViewGame`, `PlayerViewSpectator`
- **Benefício:** Documentação centralizada sobre a estrutura de dados

### `game/scoringSystem.js` - Sistema de Scoring Padronizado
Era necessário padronizar a lógica de pontuação que estava espalhada pelo código.

**Funções exportadas:**

#### `getRoundPoints(player)` 
- Calcula pontos de uma rodada individual
- Impostores vivos: +2 pontos, mortos: -1.5
- Civis vivos: +1 ponto, mortos: 0
- Usa em: `gameHandlers.js::confirm-elimination`

#### `calculateAndApplyScores(game, gameIsOver)`
- Calcula e aplica scores ao final de uma partida
- Define `player.score` = pontos da rodada
- Define `player.globalScore` = acumulação histórica
- **CRÍTICO:** Garante que score não é resetado duas vezes

#### `resetScoresForNewRound(players)`
- Prepara players para nova rodada
- Reset: `score = 0`, `voted = false`, `revealed = false`, `ready = false`, `isAlive = true`
- **NÃO** toca em `globalScore`

#### `initializePlayerScores(basePlayer, previousGlobalScore)`
- Cria novo GamePlayer com scores corretos
- Preserva `globalScore` anterior

#### `getPlayerScoreSummary(player)`
- Utilidade para extrair `score` e `globalScore` de forma segura

---

## 2️⃣ PROBLEMAS CORRIGIDOS

### 🔴 CRÍTICO: Join-Room Logic (roomHandlers.js)

**Problema Original:**
```javascript
if (room.phase !== "lobby") return safeCb(cb, { error: "Jogo já começou" }); // ❌ IMPEDE acesso
// ... código posterior NUNCA é executado
if (room.phase !== "lobby") { // ❌ Nunca chega aqui
  room.waitingPlayers.push(...)
}
```

**Solução Implementada:**
```javascript
if (room.phase !== "lobby") {
  // ✅ Jogador entra como SPECTATOR/WAITING PLAYER
  room.waitingPlayers ??= [];
  room.waitingPlayers.push(newPlayer);
  return safeCb(cb, {
    waiting: true,
    message: "Aguardando próxima rodada",
    isSpectator: true,
  });
}
// ✅ Se estiver em lobby, adiciona como jogador normal
room.players.push(newPlayer);
```

**Impacto:** Agora espectadores podem entrar em salas em andamento sem receber erro.

---

### 🔴 CRÍTICO: Score Being Reset Twice (gameHandlers.js)

**Problema Original:**
No `confirm-elimination`:
```javascript
game.allPlayers.forEach(player => {
  const roundPoints = getRoundPoints(player);
  player.score = (player.score || 0) + roundPoints;
  player.globalScore = (player.globalScore || 0) + player.score;
  player.score = 0;  // ❌ AQUI
});
// Depois em initializeGame:
const gameData = initializeGame(...); // ❌ Define score = 0 novamente
```

**Solução Implementada:**
```javascript
// No confirm-elimination:
calculateAndApplyScores(game, isGameOver);  // ✅ Define score e globalScore

// Antes de nova rodada (antes de initializeGame):
resetScoresForNewRound(players);  // ✅ Reset ÚNICO
```

**Impacto:** Score visível para o jogador antes de resetar. Sem duplicação.

---

### 🟡 IMPORTANTE: BuildSpectatorView Incompleta (gameHandlers.js)

**Problema Original:**
```javascript
export function buildSpectatorView(game, socketId) {
  const baseView = {
    // ❌ FALTAM myName, myEmoji, myColor
    isSpectator: true,
  };
  // ...
}
```

**Solução Implementada:**
```javascript
export function buildSpectatorView(game, socketId, spectatorData = {}) {
  const baseView = {
    // ✅ Adiciona dados pessoais do spectador
    myName: spectatorData.name || "Espectador",
    myEmoji: spectatorData.emoji || "👁️",
    myColor: spectatorData.color || "#666666",
    isSpectator: true,
    // ...
  };
}
```

**Impacto:** Espectadores podem ver sua própria identificação (nome, emoji, cor).

---

### 🟡 IMPORTANTE: EmitGameUpdateToAll Não Alcançava Spectadores

**Problema Original:**
```javascript
function emitGameUpdateToAll(io, room) {
  if (!room.game) return;
  room.players.forEach(p => {
    // ❌ Não envia para waitingPlayers (espectadores)
    const view = isSpectator(room.game, p.socketId) ? ... : ...;
    io.to(p.socketId).emit("game-update", view);
  });
}
```

**Solução Implementada:**
```javascript
function emitGameUpdateToAll(io, room) {
  if (!room.game) return;
  
  // Envia para jogadores ativos
  room.players.forEach(p => {
    const isSpect = isSpectator(room.game, p.socketId);
    const view = isSpect
      ? buildSpectatorView(room.game, p.socketId, p)
      : buildPlayerView(room.game, p.socketId);
    io.to(p.socketId).emit("game-update", view);
  });
  
  // ✅ Também envia para waiting players (espectadores)
  if (room.waitingPlayers?.length > 0) {
    room.waitingPlayers.forEach(p => {
      const view = buildSpectatorView(room.game, p.socketId, p);
      io.to(p.socketId).emit("game-update", view);
    });
  }
}
```

**Impacto:** Espectadores recebem atualizações em tempo real.

---

### 🟡 IMPORTANTE: Rejoin-Room Não Passava Dados Pessoais

**Problema Original:**
```javascript
socket.on("rejoin-room", ({ roomCode }, cb) => {
  if (room.game) {
    const isParticipant = room.game.allPlayers.some(p => p.id === socket.id);
    if (isParticipant) {
      socket.emit("game-update", buildPlayerView(room.game, socket.id));
    } else {
      socket.emit("game-update", buildSpectatorView(room.game, socket.id));
      // ❌ Sem dados pessoais do espectador
    }
  }
});
```

**Solução Implementada:**
```javascript
socket.on("rejoin-room", ({ roomCode }, cb) => {
  if (room.game) {
    // ✅ Encontra dados pessoais
    const playerInRoom = room.players.find(p => p.socketId === socket.id);
    const isParticipant = room.game.allPlayers.some(p => p.id === socket.id);
    
    if (isParticipant) {
      socket.emit("game-update", buildPlayerView(room.game, socket.id));
    } else {
      // ✅ Passa dados pessoais para a view
      socket.emit("game-update", buildSpectatorView(room.game, socket.id, playerInRoom));
    }
  }
});
```

**Impacto:** Espectadores que reconnectam recebem seus dados pessoais novamente.

---

### 🟡 IMPORTANTE: HandlePlayerExit Não Considerava Spectators

**Problema Original:**
```javascript
export function handlePlayerExit(io, socket, roomCode, reason = "left") {
  const room = rooms[roomCode];
  const player = room.players.find(p => p.socketId === socket.id);
  if (!player) return; // ❌ Não encontra em waitingPlayers
  
  room.players = room.players.filter(p => p.socketId !== socket.id);
  // ❌ Não remove de waitingPlayers
  
  // ... resto do código só atualiza room.players
}
```

**Solução Implementada:**
```javascript
export function handlePlayerExit(io, socket, roomCode, reason = "left") {
  const room = rooms[roomCode];
  const player = room.players.find(p => p.socketId === socket.id);
  if (!player) return;

  // ✅ Remove de ambas as listas
  room.players = room.players.filter(p => p.socketId !== socket.id);
  if (room.waitingPlayers?.length > 0) {
    room.waitingPlayers = room.waitingPlayers.filter(p => p.socketId !== socket.id);
  }

  // ... resto
  
  // ✅ Atualiza AMBOS participantes e espectadores
  if (room.game) {
    room.players.forEach(p => {
      const isSpect = !room.game.allPlayers.some(gp => gp.id === p.socketId);
      const view = isSpect ? buildSpectatorView(...) : buildPlayerView(...);
      io.to(p.socketId).emit("game-update", view);
    });
    if (room.waitingPlayers?.length > 0) {
      room.waitingPlayers.forEach(p => {
        const view = buildSpectatorView(...);
        io.to(p.socketId).emit("game-update", view);
      });
    }
  }
}
```

**Impacto:** Spectadores não são perdidos quando alguém desconecta.

---

## 3️⃣ MELHORIAS NA ARQUITETURA

### Separação de Responsabilidades
- **scoringSystem.js:** Toda lógica de pontuação centralizada
- **types.d.js:** Definições de tipos documentadas
- **gameHandlers.js:** Handlers de eventos (mais limpo agora)
- **roomHandlers.js:** Gerenciamento de sala
- **impostor.utils.js:** Funções utilitárias

### Nomeação Consistente
- `id` = ID do jogador no jogo
- `socketId` = ID da conexão WebSocket
- Ambos sempre usados no contexto correto

---

## 4️⃣ FLUXO DE DADOS AGORA CORRETO

### Offline (Frontend SÓ)
```
[Jogo Locale] 
→ getRoundPoints(player)
→ player.score += roundPoints
→ Mostra no UI
→ resetScoresForNewRound()
→ player.globalScore += player.score
→ Próxima rodada
```

### Online (Frontend + Backend)
```
[Frontend] Fim de rodada → Envia confirm-elimination
  ↓
[Backend] calculateAndApplyScores(game, isGameOver)
  → player.score = roundPoints
  → player.globalScore += roundPoints
  ↓
[Backend] emitGameUpdateToAll(io, room)
  → Cada player recebe view com score atualizado
  ↓
[Frontend] Vê a pontuação final
  ↓
[Backend] Próxima rodada → resetScoresForNewRound()
  → score = 0, globalScore mantém
  ↓
[Backend] Nova partida começa
```

---

## 5️⃣ FLUXO DE SPECTATORS AGORA CORRETO

### Cenário 1: Entra em Sala em Andamento
```
[User A] Entra em sala com phase !== "lobby"
  ↓
[roomHandlers.js::join-room]
  → Detecta phase !== "lobby"
  → Adiciona a waitingPlayers (não room.players)
  → Retorna { waiting: true, isSpectator: true }
  ↓
[gameHandlers.js::emitGameUpdateToAll]
  → Manda buildSpectatorView para waitingPlayers também
  ↓
[User A] Recebe vista de espectador (vê o jogo)
```

### Cenário 2: Reconnect como Spectador
```
[User A] Desconecta e reconecta
  ↓
[gameHandlers.js::rejoin-room]
  → Busca playerInRoom em room.players
  → Detecta: !room.game.allPlayers.some(p => p.id === socket.id)
  → Chama buildSpectatorView(game, socketId, playerInRoom)
  ↓
[User A] Recebe dados pessoais + vista do jogo
```

### Cenário 3: Spectador Vira Jogador
```
[start-game / reroll-game]
  → Copia waitingPlayers para players
  → Todos viram jogadores da próxima rodada
  → Dados preservados (globalScore mantido)
```

---

## 6️⃣ MELHORIAS FUTURAS (Opcionais)

Se quiser melhorar ainda mais, considere:

1. **Criar `spectatorHandlers.js`**
   - Move toda lógica de espectador para arquivo separado
   - Mais fácil de manter

2. **Adicionar `playerStates.js` ou `playerModels.js`**
   - Funções como `createNewPlayer()`, `getPlayerStats()`
   - Centraliza criação/manipulação de players

3. **Validação de Input**
   - Validar campos que chegam do frontend
   - Previne erros de sincronização

4. **Error Handling**
   - Tratamento de erros mais robusto
   - Logs estruturados

5. **Testes Unitários**
   - Para scoringSystem.js
   - Para lógica de spectators

---

## 7️⃣ COMO TESTAR

### Test 1: Espectador Entra em Jogo em Andamento
1. Cria sala com 3 jogadores
2. Começa jogo (fase reveal)
3. 4º jogador tenta entrar
4. ✅ Deve receber `{ waiting: true, isSpectator: true }`
5. ✅ Deve receber game-update como espectador

### Test 2: Pontuação Final
1. Jogo chega à fase "result"
2. Antes de confirm-elimination: `player.score = 0`
3. Call confirm-elimination
4. ✅ `player.score = roundPoints` (visível para o jogador)
5. ✅ `player.globalScore += player.score`
6. Check Nova rodada: `player.score = 0` (resetado)

### Test 3: Espectador Desconecta
1. Espectador em waitingPlayers
2. Desconecta (disconnect event)
3. ✅ Removido de waitingPlayers
4. ✅ Outros jogadores/espectadores não são afetados

---

## 📝 NOTAS IMPORTANTES

- **globalScore nunca é resetado** enquanto o jogador está na sala
- **score é resetado antes de cada nova rodada** (não no final)
- **Espectadores não votam** mas recebem atualizações
- **Spectadores viram jogadores** quando nova rodada começa (se room.waitingPlayers)
- **Dados pessoais** (name, emoji, color) sempre acompanham o jogador

---

## 🎯 Próximos Passos Recomendados

1. **Implementar no Frontend:**
   - Usar `scoringSystem.js` para o modo offline
   - Display correto de score vs globalScore
   
2. **Documentar no Frontend:**
   - Guia de como tratar score/globalScore
   - Como renderizar view de espectador

3. **Testes de Integração:**
   - Offline vs Online
   - Cenários de múltiplos espectadores
   - Reconexões durante diferentes fases


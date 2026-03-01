# 🔍 REFERÊNCIA RÁPIDA - PlayHome Backend Refatoração

## 📍 Localização dos Arquivos-Chave

```
playHome Backend/
├── game/
│   ├── gameLogistic.js          (inicialização de jogo)
│   ├── impostor.utils.js        (utilidades - MODIFICADO)
│   ├── words.js                 (banco de palavras)
│   └── scoringSystem.js         (✅ NOVO - Sistema de scoring)
├── socket/
│   ├── index.js                 (router de sockets)
│   ├── gameHandlers.js          (handlers de jogo - MODIFICADO)
│   ├── roomHandlers.js          (handlers de sala - MODIFICADO)
├── state/
│   └── rooms.js                 (storage de salas)
├── types.d.js                   (✅ NOVO - Definições de tipos)
└── [Documentação]
    ├── ANALISE_E_REFATORACAO.md         ← Leia primeiro
    ├── MUDANCAS_IMPLEMENTADAS.md        ← Details técnicos
    ├── GUIA_FRONTEND_SCORE_SPECTATORS.md ← Frontend guide
    └── RESUMO_EXECUTIVO.md              ← Overview
```

---

## 🎯 Funções Principais

### scoringSystem.js

```javascript
// ✅ Calcular pontos de uma rodada
getRoundPoints(player) → number

// ✅ Aplicar scores ao final do jogo
calculateAndApplyScores(game, gameIsOver) → void
  // Define: player.score = roundPoints
  // Define: player.globalScore += roundPoints

// ✅ Resetar para nova rodada
resetScoresForNewRound(players) → void
  // Define: player.score = 0
  // Mantém: player.globalScore

// ✅ Versão segura
getPlayerScoreSummary(player) → { score, globalScore }

// ✅ Novo player
initializePlayerScores(basePlayer, previousGlobalScore = 0) → GamePlayer
```

### gameHandlers.js - Key Functions

```javascript
// ✅ Detecta se é spectador
isSpectator(game, socketId) → boolean

// ✅ Emite para um específico
emitGameUpdate(io, room, socketId) → void

// ✅ Emite para TODOS (players + waiting)
emitGameUpdateToAll(io, room) → void

// ✅ View para participante
buildPlayerView(game, socketId) → PlayerViewGame

// ✅ View para espectador
buildSpectatorView(game, socketId, spectatorData?) → PlayerViewSpectator
```

### roomHandlers.js - Join Fix

```javascript
socket.on("join-room", ({ name, id, emoji, color, roomCode }, cb) => {
  // ✅ NOVO: Lógica clara
  if (room.phase !== "lobby") {
    // → Spectador/waiting player
    return safeCb(cb, { waiting: true, isSpectator: true });
  }
  // → Jogador normal
  room.players.push(newPlayer);
});
```

### impostor.utils.js - HandlePlayerExit Enhanced

```javascript
// ✅ Agora remove de AMBAS as listas
room.players = room.players.filter(...);
room.waitingPlayers = room.waitingPlayers.filter(...);

// ✅ Atualiza spectators também
if (room.waitingPlayers?.length > 0) {
  room.waitingPlayers.forEach(...);
}
```

---

## 💾 Estrutura de Dados

### Player States

```
room.players[]
  ├─ socketId   (identificador da conexão)
  ├─ id         (identificador do jogador)
  ├─ name, emoji, color
  └─ (NOT incluído em game.allPlayers até ser jogador)

waitingPlayers[] (espectadores)
  (mesma estrutura de room.players)
  
game.allPlayers[]
  ├─ id         (do jogador)
  ├─ name, emoji, color
  ├─ isImpostor, isAlive
  ├─ word, hint, revealed, ready, voted
  ├─ score      (pontos DESSA rodada)
  └─ globalScore (histórico)
```

---

## 🔄 Fluxos Importantes

### Score da Rodada (Flow)
```
1. Fim votação detectado
2. cast-vote completa
3. confirm-elimination chamado
4. calculateAndApplyScores(game, true)
   → player.score = getRoundPoints(player)
   → player.globalScore += player.score
5. emitGameUpdateToAll()
   → playerView.score = 2 (visível!)
   → playerView.globalScore = 25
6. Frontend mostra: "Ganhou 2 pontos! (Total: 25)"
7. Host clica próxima
8. reroll-game ou start-game
9. resetScoresForNewRound()
   → player.score = 0 (reset aqui)
   → player.globalScore = 25 (MANTÉM)
10. Nova rodada começa com score = 0
```

### Spectator Flow (Flow)
```
1. User joins room em fase !== "lobby"
2. roomHandlers.js::join-room detecta
3. Adiciona a waitingPlayers
4. Retorna { waiting: true, isSpectator: true }
5. emitGameUpdateToAll() envia:
   → buildSpectatorView(game, socketId, playerData)
   → { isSpectator: true, myName, myEmoji, myColor, ... }
6. Frontend renderiza SpectatorView
7. User vê o jogo acontecendo
8. Próxima rodada começa
9. start-game copia waitingPlayers → players
10. User vira jogador da próxima rodada
11. Recebe game-update com buildPlayerView
12. Frontend detecta isSpectator = false
13. Renderiza PlayerView (agora tem palavra!)
```

---

## 🧪 Quick Tests

### Teste 1: Score Não Duplica
```javascript
// Pré-condição: Game em phase result
// Ação: Call confirm-elimination
// Esperado:
assert(player.score === getRoundPoints(player));
assert(player.globalScore === previousGlobal + player.score);
// (apenas UMA adição)
```

### Teste 2: Spectator Entra
```javascript
// Pré-condição: Game em phase "discussion"
// Ação: New User joins
// Esperado:
assert(response.waiting === true);
assert(response.isSpectator === true);
assert(room.waitingPlayers.length === 1);
```

### Teste 3: Spectator Vira Jogador
```javascript
// Pré-condição: Spectator em waitingPlayers
// Ação: start-game (nova rodada)
// Esperado:
assert(gameState.allPlayers.some(p => p.id === spectator.id));
assert(!waitingPlayers.some(p => p.socketId === spectator.socketId));
```

---

## 🐛 Debugging Tips

### Score Problems
```javascript
// Se score = 0 ao final:
// → Verificar se calculateAndApplyScores foi chamado
// → Conferir se emitGameUpdateToAll envia score atual

// Se score duplica/soma errado:
// → Procurar por resetScoresForNewRound duplas
// → Verificar confirmação de eliminação

// Se globalScore reseta:
// → globalScore SÓ muda em calculateAndApplyScores
// → Verificar se resetScoresForNewRound toca globalScore (NÃO DEVE)
```

### Spectator Problems
```javascript
// Se não recebe updates:
// → Verificar se está em room.waitingPlayers
// → Conferir emitGameUpdateToAll inclui waitingPlayers

// Se não vira jogador na próxima rodada:
// → start-game deve copiar waitingPlayers → players
// → reroll-game também deve fazer isso

// Se vê dados de outro jogador:
// → buildSpectatorView usa socketId (certo)
// → Verificar se playerData está sendo passado

// Se desconecta e quebra jogo:
// → handlePlayerExit deve remover de waitingPlayers
// → Verificar validação de players >= 3
```

---

## 📝 Checklist de Code Review

### Para Qualquer Mudança Futura

- [ ] Score sendo resetado? Usar `resetScoresForNewRound()`
- [ ] Novo jogador? Usar `initializePlayerScores()`
- [ ] Fim de jogo? Usar `calculateAndApplyScores()`
- [ ] Enviar game-update? Usar `emitGameUpdateToAll()`
- [ ] Detectar spectator? Usar `isSpectator(game, socketId)`
- [ ] Remove player? Procurar em room.players E room.waitingPlayers
- [ ] Documentação? Usar formato JSDoc (vide scoringSystem.js)

---

## 🎯 Impacto de Mudanças Futuras

| Mudança | Arquivos Afetados | Testes Necessários |
|---------|-------------------|-------------------|
| Alterar pontos (2 → 3) | scoringSystem.js::getRoundPoints | Score tests |
| Novo tipo de player | types.d.js, gameHandlers.js | Type tests |
| Spectator pode votar | gameHandlers.js::cast-vote | Spectator tests |
| Score persistente entre sessões | Database layer | Score persistence tests |
| Múltiplas salas simultâneas | rooms storage | Concurrency tests |

---

## 📚 Leitura Recomendada

1. **Primeiro (5 min):** RESUMO_EXECUTIVO.md
2. **Depois (15 min):** ANALISE_E_REFATORACAO.md (seções 2 e 3)
3. **Para Código (20 min):** MUDANCAS_IMPLEMENTADAS.md (seção 2)
4. **Para Frontend (20 min):** GUIA_FRONTEND_SCORE_SPECTATORS.md (seções 1, 2)

---

## 🔗 Links Diretos

- Calcular score: `game/scoringSystem.js::getRoundPoints()`
- Aplicar score: `socket/gameHandlers.js::confirm-elimination`
- Espectador: `socket/gameHandlers.js::buildSpectatorView()`
- Entrar sala: `socket/roomHandlers.js::join-room`
- Player sair: `game/impostor.utils.js::handlePlayerExit()`

---

## ⚙️ Configurações Importantes

```javascript
// Em gameLogistic.js
const PLAYER_ICONS = [...];        // Emojis disponíveis
const ICON_COLORS = [...];         // Cores disponíveis
const getImpostorCount = (n) => ;  // Quantidade de impostores

// Em gameHandlers.js
const MAX_CONSECUTIVE = 2;  // Máximo de rodadas consecutivas como impostor
const getRoundPoints = (p) => ;    // Pontos por resultado (IMPORTANTÍSSIMO)
  // Impostor vivo: +2
  // Impostor morto: -1.5
  // Civil vivo: +1
  // Civil morto: 0
```

---

## 🚨 Avisos

⚠️ **Critical:** Score é processado em `confirm-elimination`, não em `cast-vote`  
⚠️ **Critical:** GlobalScore NUNCA é resetado enquanto jogador está na sala  
⚠️ **Important:** Spectators estão em `waitingPlayers`, não em `game.allPlayers`  
⚠️ **Important:** `socketId` vs `id` - use correto por contexto  

---

## 🎓 Notas de Aprendizado

- Evitar lógica duplicada (scoring estava em 3 lugares!)
- Padronizar fluxos (offline/online agora usam mesma lógica)
- Documentar tipos (types.d.js economiza horas de debugging)
- Considerar edge cases (spectators, reconexões, desconexões)
- Manter separação clara entre concerns (score vs jogo vs room)


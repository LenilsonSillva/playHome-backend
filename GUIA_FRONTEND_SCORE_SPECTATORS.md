# 🎮 Guia de Implementação Frontend - Score e Spectators

Este guia descreve como o frontend deve trabalhar com as mudanças do backend.

---

## 1️⃣ SCORE E GLOBALSCORE - SINCRONIZAÇÃO OFFLINE/ONLINE

### Estrutura de Dados Esperada no Frontend

```javascript
// Player do jogo
interface GamePlayer {
  id: string;
  socketId?: string;  // Apenas online
  name: string;
  emoji: string;
  color: string;
  
  // Estado do jogo
  isImpostor: boolean;
  isAlive: boolean;
  word: string | null;
  hint?: string;
  revealed: boolean;
  ready: boolean;
  voted: boolean;
  
  // 🎯 SCORES - CRÍTICO
  score: number;        // Pontos DESTA RODADA APENAS
  globalScore: number;  // Acumulação histórica
}
```

### Fluxo de Score - Modo OFFLINE

**1. Inicializar Nova Rodada:**
```javascript
function initializeNewRound(players) {
  players.forEach(player => {
    player.score = 0;              // Novo jogo = sem pontos
    player.voted = false;
    player.revealed = false;
    player.ready = false;
    player.isAlive = true;
    // globalScore NÃO toca
  });
}
```

**2. Durante a Rodada:**
```javascript
// Nenhuma mudança em score durante a rodada
// Score só muda ao final
```

**3. Ao Final da Rodada (Fase Result):**
```javascript
// ANTES de resetar, CALCULA os pontos
function calculateScoreForGameEnd(players) {
  players.forEach(player => {
    const roundPoints = getRoundPoints(player);
    
    // Define score desta rodada
    player.score = roundPoints;
    
    // Soma no global
    player.globalScore = (player.globalScore || 0) + roundPoints;
  });
}

// MOSTRA ao jogador
// UI: "Você ganhou 2 pontos! (Total: 15)"

// DEPOIS, antes de nova rodada
function resetScoresForNewRound(players) {
  players.forEach(player => {
    player.score = 0;  // AGORA sim reseta
    // globalScore continua igual
  });
}
```

### Fluxo de Score - Modo ONLINE

**Recebe game-update do servidor:**
```javascript
socket.on("game-update", (view) => {
  // view.phase = "result"
  // view.players[i].score = pontos da rodada
  // view.players[i].globalScore = total acumulado
  
  // Renderiza score para o jogador
  const me = view.players.find(p => p.name === myName);
  displayScore(me.score, me.globalScore);
});
```

### Função Auxiliar - Para usar em AMBOS os modos (offline/online)

```javascript
// ✅ REUTILIZAR do backend npm install (se exportado)
// ou implementar localmente
function getRoundPoints(player) {
  if (player.isImpostor) {
    return player.isAlive ? 2 : -1.5;
  }
  return player.isAlive ? 1 : 0;
}

function getPlayerScoreSummary(player) {
  return {
    score: player.score || 0,
    globalScore: player.globalScore || 0,
  };
}
```

---

## 2️⃣ SPECTATORS - IMPLEMENTAÇÃO NO FRONTEND

### Type de View Esperada do Servidor

**Para Participante:**
```javascript
interface PlayerViewGame {
  phase: "reveal" | "discussion" | "voting" | "result";
  roomCode: string;
  isSpectator?: false;  // Omitido ou false
  
  // Dados pessoais
  myName: string;
  myEmoji: string;
  myColor: string;
  isImpostor: boolean;
  word: string | null;
  hint?: string;
  
  // Estado
  isHost: boolean;
  revealed: boolean;
  ready: boolean;
  voted: boolean;
  
  // Contexto
  whoStart?: string;
  twoWordsMode: boolean;
  votingFinished: boolean;
  votes: Record<string, string>;
  eliminatedId: string | null;
  
  // Array de players (em fases específicas)
  players?: Array<{
    id: string;
    name: string;
    emoji: string;
    color: string;
    isImpostor: boolean;
    isAlive: boolean;
    score: number;
    globalScore: number;
    voted: boolean;
  }>;
}
```

**Para Spectator:**
```javascript
interface PlayerViewSpectator {
  phase: "reveal" | "discussion" | "voting" | "result";
  roomCode: string;
  isSpectator: true;  // 🎯 DIFERENCIADOR
  
  // 🆕 Dados pessoais DO ESPECTADOR
  myName: string;
  myEmoji: string;
  myColor: string;
  
  // Contexto
  whoStart?: string;
  twoWordsMode: boolean;
  votingFinished: boolean;
  eliminatedId: string | null;
  
  // Array de players (mesma estrutura)
  players?: Array<{...}>;
}
```

### Como Detectar e Renderizar Spectator

**No Component do Jogo:**
```javascript
export function GameComponent() {
  const [gameState, setGameState] = useState(null);
  
  useEffect(() => {
    socket.on("game-update", (view) => {
      setGameState(view);
    });
  }, []);
  
  if (!gameState) return <Loading />;
  
  // Detecta se é espectador
  const isSpectator = gameState.isSpectator === true;
  
  if (isSpectator) {
    return <SpectatorView gameState={gameState} />;
  } else {
    return <PlayerView gameState={gameState} />;
  }
}
```

### Component Spectator View

```javascript
function SpectatorView({ gameState }) {
  const { myName, myEmoji, myColor, phase, players } = gameState;
  
  return (
    <div className="spectator-view">
      {/* Header: Identifica como espectador */}
      <div className="spectator-badge">
        <span>{myEmoji}</span>
        <span>{myName} (Assistindo)</span>
      </div>
      
      {/* Mostra o jogo */}
      {phase === "reveal" && <RevealPhaseSpectator players={players} />}
      {phase === "discussion" && <DiscussionPhaseSpectator players={players} />}
      {phase === "voting" && <VotingPhaseSpectator players={players} />}
      {phase === "result" && <ResultPhaseSpectator players={players} />}
      
      {/* Mensagem de espera */}
      <div className="spectator-message">
        Você está assistindo a partida. Entrará como jogador na próxima rodada.
      </div>
    </div>
  );
}
```

### O que Spectator PODE e NÃO PODE fazer

```javascript
// ❌ ESPECTADOR NÃO PODE:
function spectatorCannotVote() {
  // Não tem acesso a room.game.votes
  // socket.on("cast-vote") será ignorado se for espectador
}

function spectatorCannotReady() {
  // socket.on("toggle-ready") não funciona
}

// ✅ SPECTADOR PODE:
function spectatorCan() {
  // Ver o status de todos
  // Ver votos (em voting phase)
  // Ver quem foi eliminado
  // Ver scores e globalScores
  // Chat (depende da implementação)
  
  // Esperar ser convidado para próxima rodada
  // OU deixar sala e procurar outra
}
```

---

## 3️⃣ TRATAMENTO DE CASOS EDGE

### Caso 1: Spectator entra durante reveal
```javascript
socket.on("game-update", (view) => {
  if (view.isSpectator && view.phase === "reveal") {
    // Espectador vê apenas allPlayers com ready status
    // NÃO vê as palavras (são privadas dos participantes)
    
    return <RevealPhaseSpectator players={view.allPlayers} hideWords={true} />;
  }
});
```

### Caso 2: Spectator no lobbying de players fazendo ready
```javascript
// Se há próxima rodada e players estão prontos
if (nextRoundReady && spectator) {
  // Mostrar: "Próxima rodada começando..."
  // Spectator será adicionado automaticamente aos players
}
```

### Caso 3: Reconnect como Spectator
```javascript
socket.on("connect", () => {
  socket.emit("rejoin-room", { roomCode }, (response) => {
    if (response.error) {
      // Sala foi deletada ou outro erro
      redirectToHome();
    } else {
      // Aguarda game-update para saber seu status
      // Pode ser participante ou espectador
    }
  });
});
```

---

## 4️⃣ COMPONENTES QUE PRECISAM MUDAR

### Exemplo: Component de Score

**ANTES (Problemático):**
```javascript
function ScoreBoard({ players }) {
  return (
    <div>
      {players.map(p => (
        <div key={p.id}>
          {p.name}: {p.score}  {/* ❌ Score pode estar zerado */}
        </div>
      ))}
    </div>
  );
}
```

**DEPOIS (Correto):**
```javascript
function ScoreBoard({ players, phase }) {
  return (
    <div>
      {players.map(p => (
        <div key={p.id}>
          <span>{p.name}</span>
          
          {/* Score da rodada (apenas em result) */}
          {phase === "result" && (
            <span className="round-score">
              +{p.score} pontos
            </span>
          )}
          
          {/* Global score sempre visível */}
          <span className="global-score">
            Total: {p.globalScore}
          </span>
        </div>
      ))}
    </div>
  );
}
```

### Exemplo: Component de Players Waiting

**NOVO (Para mostrar espectadores):**
```javascript
function WaitingPlayersView({ waiting, alreadyParticipating }) {
  if (waiting.length === 0) return null;
  
  return (
    <div className="waiting-players">
      <h3>Espectadores ({waiting.length})</h3>
      {waiting.map(player => (
        <div key={player.socketId} className="waiting-badge">
          <span>{player.emoji}</span>
          <span>{player.name}</span>
          <span className="badge">Aguardando</span>
        </div>
      ))}
    </div>
  );
}
```

---

## 5️⃣ CHECKLIST DE IMPLEMENTAÇÃO

### Player Logic (Offline)
- [ ] `getRoundPoints()` implementada
- [ ] `calculateScoreForGameEnd()` chamada na fase result
- [ ] `resetScoresForNewRound()` chamada antes de nova rodada
- [ ] Score exibido ANTES de resetar
- [ ] globalScore nunca reseta

### Spectator UI
- [ ] Component SpectatorView criado
- [ ] Badge "Assistindo" visível
- [ ] Detecta `isSpectator === true`
- [ ] Mostra lista de players
- [ ] Mostra mensagem "entrará na próxima rodada"
- [ ] Esconde informações privadas (word, hint)

### Sync Online/Offline
- [ ] Usa `game-update` do backend quando online
- [ ] Usa lógica local quando offline
- [ ] Tratamento igual de score em ambos os modos

### Reconnect
- [ ] Emit `rejoin-room` ao reconectar
- [ ] Aguarda `game-update` para sincronizar
- [ ] Respeita status de participante vs spectador

### Edge Cases
- [ ] Spectator vindo de reveal
- [ ] Spectator em voting
- [ ] Spectator virou jogador
- [ ] Disconnect spectator (não quebra jogo)

---

## 6️⃣ EXEMPLO COMPLETO DE FLUXO

### Jogador A Entra em Sala em Andamento

```
[Server] Sala C2B72 em fase "discussion"
[Jogador A] Abre app → Join room C2B72
  ↓
[Server::join-room]
  detecta phase !== "lobby"
  adiciona a waitingPlayers
  retorna { waiting: true, isSpectator: true }
  ↓
[Server::emitGameUpdateToAll]
  envia buildSpectatorView(game, A.socketId, A.playerData)
  ↓
[Client A]
  game-update.isSpectator = true
  game-update.myName = "João",etc
  game-update.phase = "discussion"
  game-update.players = [array com status dos players]
  ↓
[Component GameComponent]
  detecta isSpectator = true
  renderiza <SpectatorView>
    mostra badge "João (Assistindo)"
    mostra players em discussion
    mostra mensagem "entrará na próxima..."
  ↓
[User A] Observa o jogo
  ↓
[Fase vai para result]
  server envia novo game-update
  [Client A] mostra resultado (sem poder votar)
  ↓
[Host confirma resultado]
  [Server::start-game]
  waitingPlayers.forEach(p => players.push(p))
  cria novo gameState
  ↓
[Server::emitGameUpdateToAll]
  agora A é participante
  envia buildPlayerView com sua palavra
  ↓
[Client A]
  game-update.isSpectator = false ou omitido
  game-update.myWord = "banana"
  renderiza <PlayerView>
  A agora é jogador!
```

---

## 7️⃣ DOCUMENTAÇÃO PARA DESENVOLVEDORES

### Resumo Rápido

**Score:**
- `score`: Reseta a cada rodada. Mostra o ganho/perda da rodada.
- `globalScore`: Nunca se move sozinho. Recebe contribuição de `score` ao final da rodada.

**Spectators:**
- Entra como `waitingPlayer` se entra durante jogo.
- Vira `player` quando próxima rodada começa.
- Sempre recebe `game-update` com status apropriado.

**Views:**
- `isSpectator === true` → mostrar SpectatorView
- `isSpectator === false` ou omitido → mostrar PlayerView

---

## 8️⃣ TESTES SUGERIDOS

### Unit Test: Score Calculation
```javascript
test("getRoundPoints retorna valores corretos", () => {
  const impostorAlive = { isImpostor: true, isAlive: true };
  const impostorDead = { isImpostor: true, isAlive: false };
  const civilAlive = { isImpostor: false, isAlive: true };
  const civilDead = { isImpostor: false, isAlive: false };
  
  expect(getRoundPoints(impostorAlive)).toBe(2);
  expect(getRoundPoints(impostorDead)).toBe(-1.5);
  expect(getRoundPoints(civilAlive)).toBe(1);
  expect(getRoundPoints(civilDead)).toBe(0);
});
```

### Integration Test: Score Sync
```javascript
test("Score sincroniza corretamente entre offline/online", () => {
  // 1. Jogo offline: calcula score
  // 2. Sincroniza com server
  // 3. Recebe game-update com mesmo score
  // 4. Verifica se globalScore foi somado
  expect(player.globalScore).toBe(previousGlobal + player.score);
});
```

### E2E Test: Spectator to Player
```javascript
test("Espectador vira jogador na próxima rodada", () => {
  // 1. User A entra como spectator
  // 2. esperase "Assistindo"
  // 3. Próxima rodada
  // 4. Recebe game-update com myWord
  // 5. Agora é PlayerView
});
```


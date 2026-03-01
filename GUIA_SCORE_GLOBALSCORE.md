## 📚 GUIA DE SCORE/GLOBALCORE - Frontend & Backend

### 🎯 Convenção Padrão

Em TODOS os contextos (offline, online, frontend, backend) seguir:

```typescript
// Por JOGADOR
score: number;          // ✅ Pontos obtidos NA RODADA ATUAL
globalScore: number;    // ✅ Acumulação histórica (todas as rodadas)
```

---

### 📊 Exemplos Práticos

#### Cenário 1: Uma Rodada
```
Jogador A (Civil vivo) participa de 1 rodada:
- Recebe: +1 ponto
- Resultado: score = 1, globalScore = 1
```

#### Cenário 2: Duas Rodadas (Online)
```
Jogador A entra em uma sala com já 1 rodada completa:

Rodada 1 (antes de A entrar):
- Não participou

Rodada 2 (A participa - Civil vivo):
- Backend calcula: score = 1, globalScore = 1
- A recebe: {score: 1, globalScore: 1}

Rodada 3 (A participa - Civil morto):
- Backend calcula: score = 0, globalScore = 1 (mantém rodada anterior)
- A recebe: {score: 0, globalScore: 1}

Rodada 4 (A participa - Impostor vivo):
- Backend calcula: score = 2, globalScore = 3
- A recebe: {score: 2, globalScore: 3}
```

#### Cenário 3: Offline - Múltiplas Rodadas
```
Mesmo jogador, múltiplas rodadas offline:

Rodada 1 (Civil vivo): +1
- score = 1, globalScore = 1

Rodada 2 (Impostor morto): -1.5
- score = -1.5, globalScore = -0.5 (acumulou)

Rodada 3 (Civil vivo): +1
- score = 1, globalScore = 0.5 (acumulou)
```

---

### 🔄 Fluxo por FASE

#### Fase: REVEAL → DISCUSSION → VOTING → RESULT

**Durante jogo (reveal/discussion/voting):**
- `score`: Sempre da rodada anterior (ou 0 se primeira)
- `globalScore`: Histórico mantido

**Ao chegar em RESULT:**
- Backend usa `calculateAndApplyScores()`:
  - Calcula `roundPoints` usando `getRoundPoints(player)`
  - Define `score = roundPoints`
  - Acumula `globalScore += roundPoints`

**Após RESULT (antes próxima rodada):**
- Backend usa `resetScoresForNewRound()`:
  - Reseta `score = 0`
  - **Mantém** `globalScore`

---

### 💾 Sincronização Backend → Frontend

#### Online (WebSocket event: "game-update")

Backend envia via `buildPlayerView()`:
```typescript
{
  ...gameData,
  players: game.allPlayers.map(p => ({
    id: p.id,
    name: p.name,
    score: p.score || 0,        // ✅ Sem inversão!
    globalScore: p.globalScore || 0,  // ✅ Sem inversão!
    // ... outros campos
  }))
}
```

Frontend recebe e **NÃO INVERTE**:
```typescript
// ❌ ANTIGO (gambiarra):
score: globalScore,        // ERRADO
globalScore: score,        // ERRADO

// ✅ NOVO (correto):
score: data.score,         // Correto!
globalScore: data.globalScore,  // Correto!
```

---

### 🎨 Exibição na UI

#### ResultPhase.tsx - RankingRow

```typescript
// Coluna 1: Score da rodada (com cor +/-)
<CustomText style={{ color: getScoreColor(player.score) }}>
  {formatScoreDisplay(player.score)}
  {/* Exibe: "+2", "-1.5", ou "-" */}
</CustomText>

// Coluna 2: Total acumulado
<CustomText>
  {player.globalScore || 0} pts
  {/* Exibe: "5 pts", "0 pts", etc */}
</CustomText>
```

#### PodiumBar (Pódio visual)

```typescript
<CustomText>
  {player.globalScore || 0} pts
  {/* Ordena por globalScore (maior vence) */}
</CustomText>
```

---

### 🛠️ Utilitários Disponíveis

#### Frontend: `scoringUtils.ts`

```typescript
// Cálculo
getRoundPoints(player: ImpostorPlayer): number
// Retorna: 2 (impostor vivo), -1.5 (impostor morto), 1 (civil vivo), 0 (civil morto)

// Formatação
formatScoreDisplay(score: number): string
// Retorna: "+2", "-1.5", ou "-"

formatGlobalScoreDisplay(globalScore: number): string
// Retorna: "5", "0", etc

// UI
getScoreColor(score: number, positiveColor?, negativeColor?): string
// Retorna: cor para passar ao Text component
```

---

### ↔️ Sincronização Offline

#### useOfflineImpostor.ts

```typescript
// Ao fim do jogo (resolveElimination):
const roundPoints = getRoundPoints(player);
return {
  ...player,
  score: roundPoints,                        // ✅ Pontos da rodada
  globalScore: (player.globalScore || 0) + roundPoints  // ✅ Acumula
};

// Antes de nova rodada (via initializeGame → createImpostorPlayers):
return {
  ...player,
  score: 0,                // ✅ Resetado
  globalScore: p.globalScore ?? 0  // ✅ Preservado
};
```

---

### ⚠️ Armadilhas Comuns

#### ❌ ERRADO
```typescript
// Inverter score e globalScore
score: globalScore,
globalScore: score,

// Usar score como fallback para globalScore
globalScore: p.globalScore ?? p.score,

// Não resetar score entre rodadas
// (fazer isso causa acúmulo duplicado)

// Ordenar ranking por score ao invés de globalScore
[...players].sort((a, b) => a.score - b.score)
```

#### ✅ CORRETO
```typescript
// Usar valores corretos
score: data.score,
globalScore: data.globalScore,

// Globalizar sempre começa em 0
globalScore: p.globalScore ?? 0,

// Reset explícito entre rodadas
score = 0,  // mas mantém globalScore

// Ordenar por total acumulado
[...players].sort((a, b) => (b.globalScore || 0) - (a.globalScore || 0))
```

---

### 📞 Referências Rápidas

| Campo | Onde Resetar | Quando Resetar | Padrão |
|-------|--------------|----------------|--------|
| `score` | Antes de rodada nova | Depois de Result | 0 |
| `globalScore` | **NUNCA** | - | 0 (primeira rodada) ou histórico |

---

### 🔗 Arquivos Relacionados

**Backend:**
- `game/scoringSystem.js` - Lógica de cálculo
- `socket/gameHandlers.js` - Aplicação de scores em "confirm-elimination"

**Frontend:**
- `games/impostor/utils/scoringUtils.ts` - Utilitários (novo!)
- `screens/Impostor/phasesScreen/ResultPhase.tsx` - Exibição de scores
- `games/impostor/hooks/useOfflineImpostor.ts` - Offline
- `games/impostor/hooks/useOnlineImpostorGame.ts` - Online
- `games/impostor/types/game.ts` - Tipos com JSDoc

---

### ✅ Checklist para Manutenção Futura

- [ ] Sempre usar `getRoundPoints()` para calcular (não duplicar lógica)
- [ ] Sempre resetar `score` entre rodadas (use `resetScoresForNewRound()`)
- [ ] Nunca modificar `globalScore` diretamente (sempre acumular)
- [ ] Usar utilitários de formatação (`formatScoreDisplay`, `getScoreColor`)
- [ ] Validar dados do backend não estão invertidos
- [ ] Ordenar rankings por `globalScore`, não `score`
- [ ] Testes incluem "múltiplas rodadas" para validar acumulação

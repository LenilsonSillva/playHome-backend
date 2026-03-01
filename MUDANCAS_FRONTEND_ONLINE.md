## 🎯 MUDANÇAS IMPLEMENTADAS - Frontend PlayHome (Modo Online & Offline)

### 📋 Resumo Executivo

Removidas as gambiarras de inversão de `score`/`globalScore` e padronizado o sistema de pontuação para ser consistente com o backend. O código agora é mais manutenível, testável e segue uma única convenção em todos os modos (offline e online).

---

## 🔧 MUDANÇAS POR ARQUIVO

### 1️⃣ **hooks/useOnlineImpostorGame.ts**

#### Problema Original
- Invertia `score` e `globalScore` ao receber dados do backend
- Causava confusão entre "pontos da rodada" e "acumulado"

#### Solução
Removida inversão em **2 locais**:

**Local 1: Inicialização (useState)**
```typescript
// ❌ ANTES
const { allPlayers, score, globalScore, ...rest } = raw;
return {
  ...rest,
  score: globalScore,  // INVERTIDO
  globalScore: score,  // INVERTIDO
  players: (allPlayers || []).map((p) => ({
    ...p,
    score: p.globalScore,      // INVERTIDO
    globalScore: p.score       // INVERTIDO
  })),
};

// ✅ DEPOIS
const { allPlayers, score, globalScore, ...rest } = raw;
return {
  ...rest,
  score,                        // Sem inversão!
  globalScore,                  // Sem inversão!
  players: allPlayers || [],    // Dados intactos
};
```

**Local 2: Socket listener onGameUpdate**
```typescript
// ❌ ANTES
const invertedPlayers = sourcePlayers.map((p) => ({
  ...p,
  score: p.globalScore,      // INVERTIDO
  globalScore: p.score       // INVERTIDO
}));
return {
  ...rest,
  score: globalScore,        // INVERTIDO
  globalScore: score,        // INVERTIDO
  players: invertedPlayers,
};

// ✅ DEPOIS
return {
  ...rest,
  score,                      // Sem inversão!
  globalScore,                // Sem inversão!
  players: sourcePlayers,     // Dados intactos
};
```

#### Impacto
- ✅ Dados recebidos agora correspondem à verdade do backend
- ✅ Menos confusão para manutenção futura
- ✅ UI exibe valores corretos automaticamente

---

### 2️⃣ **hooks/useOfflineImpostor.ts**

#### Problema Original
- `globalScore` não era acumulativo (recebia apenas pontos da rodada)
- Lógica de cálculo duplicada (não usava utilitários centralizados)

#### Solução 1: Corrigir acumulação
```typescript
// ❌ ANTES
const updatedWithScores = prev.players.map((p) => {
  let points = p.isImpostor ? (p.isAlive ? 2 : -1.5) : (p.isAlive ? 1 : 0);
  return {
    ...p,
    score: (p.score || 0) + points,     // Acumula score
    globalScore: points                  // ❌ NÃO acumula!
  };
});

// ✅ DEPOIS
const updatedWithScores = prev.players.map((p) => {
  const roundPoints = getRoundPoints(p);  // Usa utilitário!
  return {
    ...p,
    score: roundPoints,                   // Pontros da rodada
    globalScore: (p.globalScore || 0) + roundPoints  // Acumula!
  };
});
```

#### Solução 2: Centralizar lógica
```typescript
// Adicionado import
import { getRoundPoints } from "../utils/scoringUtils";

// Agora usa função centralizada ao invés de duplicar lógica
```

#### Impacto
- ✅ `globalScore` agora é acumulativo (como esperado)
- ✅ Sem duplicação de lógica de cálculo
- ✅ Offline e Online usam mesma fórmula

---

### 3️⃣ **types/game.ts**

#### Adição
Documentação (JSDoc) explicando a convenção de `score` vs `globalScore`

```typescript
export type ImpostorPlayer = {
  // ... outros campos ...
  /** Pontos obtidos NA RODADA ATUAL (pode ser positivo ou negativo) */
  score: number;
  /** Acumulação histórica de pontos (resultado permanente) */
  globalScore: number;
};

export type OnlineImpostorGame = {
  // ... outros campos ...
  /** Pontos obtidos NA RODADA ATUAL (pode ser positivo ou negativo) */
  score: number;
  /** Acumulação histórica de pontos (resultado permanente) */
  globalScore: number;
};
```

#### Impacto
- ✅ Documentação clara no próprio tipo
- ✅ IDE ajuda com autocomplete + documentação
- ✅ Novos desenvolvedores entendem a convenção

---

### 4️⃣ **utils/scoringUtils.ts** ✨ NOVO

Arquivo centralizado com toda lógica de scoring (assim como no backend!)

#### Funções

```typescript
getRoundPoints(player: ImpostorPlayer): number
// - Impostor vivo: +2
// - Impostor morto: -1.5
// - Civil vivo: +1
// - Civil morto: 0

calculateAndApplyScores(players: ImpostorPlayer[], isGameOver: boolean)
// Calcula e aplica scores no final de uma rodada

resetScoresForNewRound(players: ImpostorPlayer[])
// Reseta score = 0, mantém globalScore

formatScoreDisplay(score: number): string
// Formata para UI: "+2", "-1.5", "-"

formatGlobalScoreDisplay(globalScore: number): string
// Formata para UI: "5", "0"

getScoreColor(score: number, positiveColor?, negativeColor?): string
// Retorna cor para score positivo/negativo
```

#### Impacto
- ✅ Lógica centralizada (não duplicada em múltiplos hooks)
- ✅ Fácil manutenção (muda em um lugar)
- ✅ Compatível com backend (`game/scoringSystem.js`)
- ✅ Testável

---

### 5️⃣ **logic/createImpostorPlayers.ts**

#### Problema Original
```typescript
const score = p.score ?? 0;
const globalScore = p.globalScore ?? score;  // ❌ Fallback errado!
```

Se `globalScore` não existisse, usava `score` como fallback. Isso poderia misturar conceitos.

#### Solução
```typescript
// ✅ Score sempre zerado em nova rodada
score: 0,
// ✅ GlobalScore preserva histórico (ou começa em 0)
globalScore: p.globalScore ?? 0,
```

#### Impacto
- ✅ Semântica clara
- ✅ Score e globalScore não se misturam
- ✅ Nova rodada começa limpa

---

### 6️⃣ **phasesScreen/ResultPhase.tsx**

#### Mudança 1: Importar utilitários
```typescript
import { formatScoreDisplay, getScoreColor } from "@/games/impostor/utils/scoringUtils";
```

#### Mudança 2: Ordenação correta
```typescript
// ❌ ANTES
const sortedPlayers = [...data.players].sort((a, b) => (b.score || 0) - (a.score || 0));

// ✅ DEPOIS
const sortedPlayers = [...data.players].sort((a, b) => (b.globalScore || 0) - (a.globalScore || 0));
```

#### Mudança 3: Exibição em RankingRow
```typescript
// ❌ ANTES exibia invertido
<CustomText style={{ color: COLORS.greenLight }}>
  {player.globalScore > 0 ? "+" + player.globalScore : player.globalScore}
</CustomText>
<CustomText>{player.score} pts</CustomText>

// ✅ DEPOIS exibe correto
<CustomText style={{ color: getScoreColor(player.score) }}>
  {formatScoreDisplay(player.score)}
</CustomText>
<CustomText>{player.globalScore || 0} pts</CustomText>
```

#### Mudança 4: PodiumBar (visual)
```typescript
// ❌ ANTES
<CustomText>{player.score} pts</CustomText>

// ✅ DEPOIS
<CustomText>{player.globalScore || 0} pts</CustomText>
```

#### Impacto
- ✅ Scores exibidos corretamente
- ✅ Ranking ordena pelo histórico (justo)
- ✅ Formatação consistente (usa utilitários)
- ✅ Cores inteligentes (+/- automático)

---

## 📊 Comparativo: Antes vs Depois

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Inversão dados** | Invertia score/globalScore | Sem inversão |
| **globalScore acumulativo** | ❌ Não (offline) | ✅ Sim |
| **Lógica centralizada** | ❌ Duplicada | ✅ scoringUtils.ts |
| **Ranking ordenado por** | score (errado) | globalScore (correto) |
| **Documentação** | Implícita | JSDoc nos tipos |
| **Cores score** | ❌ Hardcoded | ✅ getScoreColor() |
| **Formatação** | ❌ Inline | ✅ formatScoreDisplay() |
| **Manutenibilidade** | 😞 Confusa | 😊 Clara |

---

## 🎯 Checklist de Impactos

### Para o Usuário
- [ ] ✅ Pontuação exibida corretamente
- [ ] ✅ Ranking final ordenado por total acumulado
- [ ] ✅ Cores de score positivo/negativo funcionam
- [ ] ✅ Múltiplas rodadas preservam histórico

### Para o Desenvolvedor
- [ ] ✅ Menos gambiarras no código
- [ ] ✅ Lógica centralizada (DRY)
- [ ] ✅ Tipos bem documentados
- [ ] ✅ Fácil adicionar novas Features
- [ ] ✅ Offline e Online alinhados

---

## 🧪 Testes Recomendados

### Teste 1: Offline - Single Round
```
1. Criar jogo offline com 3 players
2. Fim de jogo: 2 civis vivos (+1 cada), 1 impostor morto (-1.5)
3. Verificar:
   - Scores exibem correct (+1, +1, -1.5)
   - globalScore = score (primeira rodada)
   - Ordenação: 2 civs no topo
```

### Teste 2: Offline - Multiple Rounds
```
1. Mesmo jogo, clica "Próxima Mação"
2. Novo setup, fim novamente
3. Verificar:
   - Score resetado para 0 antes
   - globalScore acumulou (preservou rodada anterior)
   - UI mostra corretamente
```

### Teste 3: Online - Receive Data
```
1. Conectar online
2. Backend envia game-update com {score: 2, globalScore: 5}
3. Verificar:
   - Frontend recebe sem inversão
   - UI exibe: "+2" e "5 pts"
```

### Teste 4: Spectator → Player
```
1. Spectador assiste rodada 1
2. Entra como jogador rodada 2
3. Verificar:
   - globalScore começa em 0 (primeira participação)
   - Após rodada: globalScore = pontos dessa rodada
```

---

## 📁 Arquivos Modificados

```
src/games/impostor/
├── hooks/
│   ├── useOnlineImpostorGame.ts      [MODIFICADO] Remove inversão
│   └── useOfflineImpostor.ts         [MODIFICADO] Corrige globalScore acumulativo
├── logic/
│   └── createImpostorPlayers.ts      [MODIFICADO] Fix fallback globalScore
├── types/
│   └── game.ts                       [MODIFICADO] Adiciona JSDoc
├── utils/
│   └── scoringUtils.ts               [NOVO] ✨ Lógica centralizada
└── phasesScreen/
    └── ResultPhase.tsx               [MODIFICADO] Usa novos dados/utilitários
```

---

## 🚀 Próximos Passos Opcionais

1. **Testes Unitários**
   - Teste `getRoundPoints()` com todos os cenários
   - Teste `calculateAndApplyScores()`

2. **Otimização**
   - Adicionar `useMemo` em `formatScoreDisplay` se chamado muitas vezes
   - Avaliar performance de re-renders em ranking com muitos players

3. **Melhorias UX**
   - Animação de score ao mudar (+1 aparece com confete)
   - Histórico de rodadas em card separado
   - Leaderboard persistente (salvar globalScore)

4. **Sincronização**
   - Salvar globalScore localmente (AsyncStorage)
   - Sync com backend quando reconectar

---

## 📞 Referência Rápida

**Antes de commitar, certifique-se de:**
- [ ] Sem inversão de `score`/`globalScore`
- [ ] `globalScore` é acumulativo
- [ ] Ranking ordena por `globalScore`, não `score`
- [ ] Usando utilitários centralizados (`scoringUtils`)
- [ ] Testes passam

**Para dúvidas sobre convenção:**
→ Veja `GUIA_SCORE_GLOBALSCORE.md`

**Para análise de bugs:**
→ Veja `ANALISE_BUGS_FRONTEND_ONLINE.md`

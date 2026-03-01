## 📋 ANÁLISE DE BUGS E SINCRONIZAÇÃO - Frontend Online Impostor

### 🔴 BUGS CORRIGIDOS

#### 1. **Inversão de score/globalScore no Online**
- **Arquivo:** `useOnlineImpostorGame.ts`
- **Problema:** Backend envia `score` = pontos da rodada, `globalScore` = acumulado
  - Frontend invertia esses valores
  - Causava exibição incorreta dos pontos
- **Solução:** Removida a lógica de inversão. Dados agora recebidos corretamente do backend
- **Status:** ✅ CORRIGIDO

#### 2. **globalScore não acumulativo no Offline**
- **Arquivo:** `useOfflineImpostor.ts`, método `resolveElimination`
- **Problema:** `globalScore` recebia apenas os pontos da rodada (não era acumulativo)
- **Solução:** Alterado para `globalScore = (p.globalScore || 0) + roundPoints`
- **Status:** ✅ CORRIGIDO

#### 3. **Fallback incorreto em createImpostorPlayers**
- **Arquivo:** `createImpostorPlayers.ts`
- **Problema:** `globalScore = p.globalScore ?? score` (se globalScore não existisse, usava score)
  - Isso causaria confusão entre score da rodada (temporário) e histórico (permanente)
- **Solução:** `globalScore = p.globalScore ?? 0` (padrão é 0, não score)
- **Status:** ✅ CORRIGIDO

#### 4. **Exibição incorreta de scores no ResultPhase**
- **Arquivo:** `ResultPhase.tsx`
- **Problema:** Mostrava `score` como total e `globalScore` como rodada (invertido)
  - Ordenação de ranking estava por `score` ao invés de `globalScore`
- **Solução:**
  - Ordenação agora por `globalScore`
  - Exibição: `score` (com cor +/-) + `globalScore pts` (total)
- **Status:** ✅ CORRIGIDO

---

### 🟡 POTENCIAIS PROBLEMAS A MONITORAR

#### 1. **Sincronização de globalScore entre rodadas (Online)**
- **Risco:** Se o backend falha ao preservar `globalScore` quando cria nova partida
- **Solução atual:** Backend preserva em `reroll-game` e `start-game`
- **Verificação:** Confirmar que no backend `calculateAndApplyScores` preserva `globalScore`
- **Recomendação:**
  ```typescript
  // Backend deve fazer isso (VERIFICAR):
  calculateAndApplyScores(game.allPlayers, isGameOver);
  // Depois, antes de nova rodada:
  resetScoresForNewRound(game.allPlayers);
  ```

#### 2. **Display correto de scores quando fase = "result"**
- **Risco:** Se backend não envia os dados corretos de `score` na fase result
- **Verificação:** Confirmar que `buildPlayerView` no backend envia ambos os campos
- **Recomendação:** Adicionar defensive check:
  ```typescript
  if (!player.score) player.score = 0;
  if (!player.globalScore) player.globalScore = 0;
  ```

#### 3. **Score negativo (-1.5 para impostor morto)**
- **Risco:** UI pode ter problemas renderizando -1.5 (não é inteiro)
- **Verificação:** Confirmar que `formatScoreDisplay` lida corretamente com decimais
- **Recomendação:** Testar com impostor morto e verificar exibição

#### 4. **Reset de scores quando espectador vira jogador**
- **Risco:** Se um espectador entrar na próxima rodada, seu `score` deve ser resetado
- **Solução:**
  - Backend: `resetScoresForNewRound` reseta `score: 0`
  - Frontend: Confirmar que isso é aplicado
- **Verificação:** Testar: Espectador → reconecta na rodada 2 como jogador → score limpo

#### 5. **Offline vs Online globalScore**
- **Risco:** Se jogador alterna entre offline e online, globalScore pode desincronizar
- **Contexto:** Esse projeto parece ter dois modos (offline e online) separados
- **Recomendação:** Não mixer dados de offline com online (estão isolados, OK)

---

### 🟢 MELHORIAS IMPLEMENTADAS

#### 1. **Centralização de lógica de scoring**
- **Arquivo novo:** `scoringUtils.ts`
- **Funções:**
  - `getRoundPoints(player)` - Cálculo padronizado
  - `calculateAndApplyScores(players, isGameOver)` - Aplicação de scores
  - `resetScoresForNewRound(players)` - Reset para nova rodada
  - `formatScoreDisplay(score)` - Formatação para UI
  - `getScoreColor(score)` - Cor baseada em monto

#### 2. **Documentação em types**
- **Arquivo:** `game.ts` (tipos ImpostorPlayer e OnlineImpostorGame)
- **Adição:** JSDoc comentários explicando `score` vs `globalScore`

#### 3. **Utilitários de formatação**
- **Benefício:** UI consistente em todos os componentes
- **Uso:** `ResultPhase.tsx` agora usa `formatScoreDisplay` e `getScoreColor`

---

### 🧪 CENÁRIOS DE TESTE RECOMENDADOS

#### Teste 1: Offline completo
1. Criar jogo offline com 3 jogadores
2. 2 civis vivos, 1 impostor morto → score = [+1, +1, -1.5]
3. Verificar: `globalScore` agora tem esses valores acumulados
4. Nada próxima rodada: `score = 0`, `globalScore` preservado

#### Teste 2: Online - Pontuação ao fim
1. Jogo online com 3 players
2. Fim de jogo (fase "result")
3. Verificar dados recebidos:
   - Backend envia `score` e `globalScore` para cada player
   - Frontend **não inverte** (antes fazia isso)
   - UI exibe corretamente

#### Teste 3: Online - Múltiplas rodadas
1. Rodada 1: Player A = {score: 2, globalScore: 2}
2. Rodada 2: Player A vivo + outro morto = {score: 1, globalScore: 3}
3. Verificar: globalScore acumulou (+1 de novo)

#### Teste 4: Espectador → Jogador
1. Spectador assiste rodada 1
2. Entra na rodada 2 como jogador
3. Seu globalScore deve vir zerado (primeira participação)
4. Após rodada 2 fim: globalScore = pontos da rodada 2 (não mescla com "observação")

---

### 📝 NOTAS FINAIS

- **Comportamento agora alinhado com backend** (vide `MUDANCAS_IMPLEMENTADAS.md` do backend)
- **Sem gambiarras** - Mais manutenível no futuro
- **Scores consistentes** - Offline e online usam mesma lógica de cálculo
- **UI mais clara** - Usuário vê distinção entre pontos da rodada e total acumulado

---

## ⚠️ CHECKLIST PRÉ-PRODUÇÃO

- [ ] Testar offline: Fim de jogo mostra scores acumulados corretamente
- [ ] Testar online: Recebe dados corretos do backend (sem inversão)
- [ ] Testar online: Múltiplas rodadas preservam globalScore
- [ ] Verificar tipos: Todos com JSDoc explicativo
- [ ] Performance: Verificar se `formatScoreDisplay` é chamado muitas vezes (considerar useMemo)
- [ ] Acessibilidade: Cores de score (positivo/negativo) funcionam em modo escuro
- [ ] Documentação: Adicionar comentário no código sobre a convenção score vs globalScore

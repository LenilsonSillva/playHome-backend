/**
 * Sistema de Pontuação Padronizado
 * 
 * REGRA GERAL:
 * - score: Pontos APENAS desta rodada (resetado a cada nova rodada)
 * - globalScore: Acumulação histórica (NUNCA reseta enquanto jogador está na sala)
 * 
 * FLUXO:
 * 1. Rodada começa → score = 0
 * 2. Jogador participa → score pode ganhar/perder pontos (getRoundPoints)
 * 3. Rodada termina → mostra score atual
 * 4. ANTES da próxima rodada → globalScore += score; score = 0
 */

/**
 * Calcula pontos de uma rodada individual baseado no resultado final
 * @param {GamePlayer} player - O jogador
 * @returns {number} Pontos da rodada
 */
export function getRoundPoints(player) {
  if (player.isImpostor) {
    return player.isAlive ? 2 : -1.5;
  }
  return player.isAlive ? 1 : 0;
}

/**
 * Atualiza scores ao final de uma rodada (quando jogo acaba)
 * 
 * IMPORTANTE: Deve ser chamado APENAS uma vez quando game termina
 * @param {GameState} game - Estado do jogo
 * @param {boolean} gameIsOver - Se o jogo realmente terminou
 */
export function calculateAndApplyScores(game, gameIsOver) {
  if (!gameIsOver) {
    return; // Nada a fazer se jogo não terminou
  }

  game.allPlayers.forEach(player => {
    // Calcula pontos desta rodada
    const roundPoints = getRoundPoints(player);
    
    // Adiciona ao score da rodada (para exibir ao jogador)
    player.score = roundPoints;
    
    // Soma no global score (histórico)
    player.globalScore = (player.globalScore || 0) + roundPoints;
  });
}

/**
 * Prepara players para uma nova rodada
 * DEVE ser chamado antes de initializeGame()
 * 
 * @param {GamePlayer[]} players - Jogadores a preparar
 */
export function resetScoresForNewRound(players) {
  players.forEach(player => {
    // Score volta a 0 (será recalculado na rodada)
    player.score = 0;
    // GlobalScore NÃO é tocado (histórico mantém-se)
    
    // Reset outros estados da rodada
    player.voted = false;
    player.revealed = false;
    player.ready = false;
    player.isAlive = true;
  });
}

/**
 * Cria um novo GamePlayer com scores inicializados corretamente
 * Usado quando um jogador entra na sala (novo jogador)
 * 
 * @param {PlayerBase} basePlayer - Dados base do jogador
 * @param {number} previousGlobalScore - GlobalScore anterior (se houver)
 * @returns {GamePlayer}
 */
export function initializePlayerScores(basePlayer, previousGlobalScore = 0) {
  return {
    ...basePlayer,
    score: 0,                    // Começa a rodada com 0
    globalScore: previousGlobalScore, // Mantém histórico de outro servidor ou sessão
  };
}

/**
 * Obtém um resumo formatado dos scores de um player
 * @param {GamePlayer} player
 * @returns {Object} { score, globalScore }
 */
export function getPlayerScoreSummary(player) {
  return {
    score: player.score || 0,
    globalScore: player.globalScore || 0,
  };
}

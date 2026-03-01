/**
 * @typedef {Object} PlayerBase
 * @property {string} socketId - ID da conexão WebSocket
 * @property {string} id - ID único do jogador
 * @property {string} name - Nome do jogador
 * @property {string} emoji - Emoji do jogador
 * @property {string} color - Cor do jogador em hex
 */

/**
 * @typedef {Object} GamePlayer
 * @extends PlayerBase
 * @property {boolean} isImpostor - Se é impostor
 * @property {boolean} isAlive - Se está vivo no jogo
 * @property {string|null} word - Palavra que conhece
 * @property {string|undefined} hint - Dica do impostor (se aplicável)
 * @property {boolean} revealed - Se já revelou a palavra
 * @property {boolean} ready - Se está pronto
 * @property {boolean} voted - Se votou nesta rodada
 * @property {number} score - Pontos DESTA RODADA APENAS
 * @property {number} globalScore - Pontos ACUMULADOS de todas as rodadas
 */

/**
 * @typedef {Object} GameConfig
 * @property {string[]} categories - Categorias selecionadas
 * @property {boolean} hasHint - Se impostor tem dica
 * @property {boolean} twoWordsMode - Se usa modo duas palavras
 * @property {number} howManyImpostors - Quantidade de impostores
 * @property {boolean} impostorCanStart - Se impostor pode começar
 * @property {boolean} whoStart - Se há sorteio de quem começa
 */

/**
 * @typedef {Object} GameState
 * @property {GamePlayer[]} allPlayers - Todos os jogadores dessa partida
 * @property {string} phase - Fase atual: 'reveal', 'discussion', 'voting', 'result'
 * @property {string} roomCode - Código da sala
 * @property {string} hostId - ID do host (socketId)
 * @property {number} howManyImpostors - Quantidade de impostores
 * @property {boolean} twoWordsMode - Modo duas palavras
 * @property {boolean} impostorHasHint - Impostor tem dica
 * @property {string[]} selectedCategories - Categorias da rodada
 * @property {string|undefined} whoStart - Quem começa a falar
 * @property {boolean} impostorCanStart - Se impostor pode começar
 * @property {string[]} chosenWord - [wordA, wordB] escolhidas nessa rodada
 * @property {Object.<string, string>} votes - Mapa de votes: socketId -> votedId
 * @property {boolean} votingFinished - Se votação terminou
 * @property {string|null} eliminatedId - ID de quem foi eliminado
 * @property {string[][]} impostorHistory - Histórico das últimas rodadas
 * @property {string[]} usedWords - Palavras já usadas
 */

/**
 * @typedef {Object} Room
 * @property {string} code - Código da sala
 * @property {string} hostId - ID do host (socketId)
 * @property {PlayerBase[]} players - Jogadores ativos na sala
 * @property {PlayerBase[]} waitingPlayers - Jogadores esperando próxima rodada
 * @property {string} phase - Fase: 'lobby' ou fases de jogo
 * @property {GameConfig} config - Configurações do tabuleiro
 * @property {GameState|null} game - Estado do jogo (null se em lobby)
 */

/**
 * @typedef {Object} PlayerViewGame - O que um jogador PARTICIPANTE vê
 * @property {string} phase - Fase do jogo
 * @property {string} roomCode - Código da sala
 * @property {string} myName - Seu nome
 * @property {string} myEmoji - Seu emoji
 * @property {string} myColor - Sua cor
 * @property {boolean} isImpostor - Se você é impostor
 * @property {string|null} word - Sua palavra (null se impostor)
 * @property {string|undefined} hint - Dica (se impostor e habilitado)
 * @property {boolean} isHost - Se você é host
 * @property {boolean} revealed - Se já revelou
 * @property {boolean} ready - Se está pronto
 * @property {boolean} voted - Se votou
 * @property {string|undefined} whoStart - Quem começa
 * @property {boolean} twoWordsMode - Modo duas palavras
 * @property {boolean} votingFinished - Votação terminou
 * @property {Object.<string, string>} votes - Votos
 * @property {string|null} eliminatedId - Quem foi eliminado
 * @property {Object[]} [players] - Array de dados dos players (em phases específicas)
 * @property {Object[]} [allPlayers] - Array de players prontos (em fase reveal)
 */

/**
 * @typedef {Object} PlayerViewSpectator - O que um ESPECTADOR vê
 * @property {string} phase - Fase do jogo
 * @property {string} roomCode - Código da sala
 * @property {boolean} isSpectator - True sempre
 * @property {string|undefined} whoStart - Quem começa
 * @property {boolean} twoWordsMode - Modo duas palavras
 * @property {boolean} votingFinished - Votação terminou
 * @property {string|null} eliminatedId - Quem foi eliminado
 * @property {Object[]} [players] - Array de dados dos players (em phases específicas)
 * @property {Object[]} [allPlayers] - Array de players (em fase reveal/lobby)
 */

exports.types = {
  PlayerBase: {},
  GamePlayer: {},
  GameConfig: {},
  GameState: {},
  Room: {},
  PlayerViewGame: {},
  PlayerViewSpectator: {},
};

import { getWordDatabase } from "./words/index.js";
import { pickRandom, shuffleArray } from "./impostor.utils.js";

export function getImpostorCount(playersCount) {
  if (playersCount >= 7) return 3;
  if (playersCount >= 5) return 2;
  return 1;
}

const PLAYER_ICONS = [
  "🤫","😁","👾","🧑🏻‍🚀","👩🏽‍🚀","👽","🤖","😎","😛","🤔","🤐",
  "😶‍🌫️","😶","🫠","🥸","🤥","🫣","🧐","👹","🫢","🤓","😈","👿",
  "💀","👻","👺","🧞‍♀️","🧞‍♂️","🧟","🧌","👨🏻","👨🏽","👩🏽",
  "👩🏻","🤴🏻","👸🏻","🧑🏻‍🎄","🕵🏻‍♀️","🦹🏻","🦸🏻","🧙🏻","🧛🏻"
];

const ICON_COLORS = [
  // --- Vermelhos e Pinks (Perigo/Intensidade) ---
  "#FF003C", // Red Neon (Principal do Impostor)
  "#FF3399", // Hot Pink
  "#FB7185", // Rose Tech
  
  // --- Laranjas e Amarelos (Alertas) ---
  "#FF7B00", // Orange Signal
  "#FACC15", // Cyber Yellow
  "#FB923C", // Tangerine
  "#F59E0B", // Amber Alert

  // --- Verdes (Energia/Sinal) ---
  "#ADFF2F", // Lime Electric
  "#22C55E", // Bio Green
  "#10B981", // Emerald Tech
  "#4ADE80", // Mint Signal

  // --- Cyans e Teals (Interface/HUD) ---
  "#00F2FF", // Electric Cyan
  "#2DD4BF", // Turquoise
  "#0EA5E9", // Sky Blue

  // --- Blues (Plasma/Sistemas) ---
  "#3B82F6", // Plasma Blue
  "#6366F1", // Indigo Neon
  "#2563EB", // Royal Systems

  // --- Roxos e Magentas (Mistério/Espaço) ---
  "#8B5CF6", // Electric Violet
  "#A855F7", // Deep Purple
  "#D946EF", // Neon Magenta
];

function pickImpostors(players, howManyImpostors, impostorHistory = []) {
  // Máximo de vezes SEGUIDAS que um jogador pode ser impostor (máximo 2 seguidas)
  const MAX_CONSECUTIVE = 2;

  // inicializa contadores de sequências consecutivas
  const consecutiveCount = {};
  const sequenceBroken = {}; // rastreia se a sequência já foi quebrada
  
  players.forEach(p => {
    consecutiveCount[p.id] = 0;
    sequenceBroken[p.id] = false;
  });

  // percorre histórico de trás para frente (do mais recente para o mais antigo)
  // contando quantas vezes SEGUIDAS cada jogador foi impostor começando do fim
  for (let i = impostorHistory.length - 1; i >= 0; i--) {
    const round = impostorHistory[i];

    // Para cada jogador, verifica se foi impostor nesta rodada
    players.forEach(p => {
      // Se a sequência já foi quebrada, não verifica mais rodadas anteriores
      if (sequenceBroken[p.id]) {
        return; // continue para o próximo jogador
      }

      if (round.includes(p.id)) {
        // Foi impostor: incrementa a sequência
        consecutiveCount[p.id]++;
      } else {
        // NÃO foi impostor: a sequência foi quebrada
        // Marca para parar de verificar rodadas anteriores para este jogador
        sequenceBroken[p.id] = true;
      }
    });
  }

  // bloqueia jogadores que foram impostores mais de MAX_CONSECUTIVE vezes seguidas
  // Exemplo: MAX_CONSECUTIVE = 2 significa máximo 2 seguidas
  // Logo bloqueamos quando count > 2 (ou seja, 3 ou mais)
  const blockedIds = players
    .filter(p => consecutiveCount[p.id] > MAX_CONSECUTIVE)
    .map(p => p.id);

  // pool válida (sem bloqueados)
  let pool = players.filter(p => !blockedIds.includes(p.id));

  // fallback: se não há jogadores suficientes disponíveis, permite todos
  // (garante que o jogo sempre possa continuar, mesmo em casos extremos)
  if (pool.length < howManyImpostors) {
    pool = [...players];
  }

  // sorteio aleatório da pool válida
  return shuffleArray(pool)
    .slice(0, howManyImpostors)
    .map(p => p.id);
}

function createImpostorPlayers(players, impostorNumber, impostorHistory = []) {
  const impostorIds = pickImpostors(
    players,
    impostorNumber,
    impostorHistory
  );

const shuffledIcons = shuffleArray([...PLAYER_ICONS]);
const shuffledColors = shuffleArray([...ICON_COLORS]);

  return players.map((p, index) => {
    return {
      ...p,
      isImpostor: impostorIds.includes(p.id),
      isAlive: true,
      word: null,
      emoji: shuffledIcons[index],
      color: shuffledColors[index],
      revealed: false,
      ready: false,
      score: 0,
      globalScore: p.globalScore ?? 0
    };
  });
}

function selectWhoStart(playersData, whoStartButton, impostorCanStart) {
  if (!whoStartButton) return undefined;
  const candidate = pickRandom(playersData);
  if (candidate.isImpostor && !impostorCanStart) {
    return selectWhoStart(playersData, whoStartButton, impostorCanStart);
  }
  return candidate.name;
}

function distributeWords(players, twoWordsMode, selectedCategories, wordBank, impostorHasHint, impostorTrap, impostorCat, usedWords = []) {
  let filteredWords = wordBank.filter((word) =>
    selectedCategories.includes(word.category)
  );

  let availableWords = filteredWords.filter((w) => {
    const isMainWordUsed = usedWords.includes(w.word);
    const isAnyRelatedWordUsed = w.related?.some((r) => usedWords.includes(r));
    return !isMainWordUsed && !isAnyRelatedWordUsed;
  });

  if (availableWords.length === 0) {
    availableWords = filteredWords.length > 0 ? filteredWords : wordBank;
  }

  const word = pickRandom(availableWords);

  const wordA = word.word;
  const wordB =
    twoWordsMode && word.related && word.related.length > 0
      ? word.related[0]
      : wordA;

  const nonImpostors = players.filter((p) => !p.isImpostor);
  const getGroupASize = Math.floor(nonImpostors.length / 2);
  const shuffledCivils = shuffleArray(nonImpostors.map((p) => p.id));
  const groupAIds = shuffledCivils.slice(0, getGroupASize);

  const updatedPlayers = players.map((player) => {
    if (player.isImpostor) {
      let hint = undefined;

      // 🔥 Lógica da Dica/ Categotia - Enganar Impostor
      if (impostorHasHint) {
        if (impostorCat) {
          hint = word.category;
        } else {
          hint = word.hint;
        }

        // Se a armadilha está ativa, 50% de chance de embaralhar
        if (impostorTrap && Math.random() < 0.5) {
          const randomFakeWord = pickRandom(wordBank.filter(w => w.word !== word.word));
          if (impostorCat) {
            hint = `Categoria: ${randomFakeWord.category}`;
          } else {
            hint = randomFakeWord.hint;
          }
        }
      }

      return {
        ...player,
        word: null,
        hint: hint,
      };
    } else {
      const finalWord =
        twoWordsMode && groupAIds.includes(player.id) ? wordB : wordA;
      return { ...player, word: finalWord };
    }
  });

  return { updatedPlayers, chosenWord: [wordA, wordB] };
}

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
  language = "pt-BR"
) {
  // Obtém o banco de palavras correto baseado no idioma
  const wordDatabase = getWordDatabase(language);

  const impostorTrueOrFalse = createImpostorPlayers(
    allPlayers,
    howManyImpostors,
    impostorHistory
  );

  const { updatedPlayers, chosenWord } = distributeWords(
    impostorTrueOrFalse,
    twoWordsMode,
    selectedCategories,
    wordDatabase,
    impostorHasHint,
    impostorTrap,
    impostorCat, 
    usedWords
  );

  const setWhoStart = selectWhoStart(
    updatedPlayers,
    whoStartButton,
    impostorCanStart
  );

  return {
    allPlayers: updatedPlayers,
    howManyImpostors,
    twoWordsMode,
    impostorHasHint,
    impostorTrap,
    impostorCat,
    impostorsUnited,
    selectedCategories,
    whoStart: setWhoStart,
    impostorCanStart,
    chosenWord,
  };
}

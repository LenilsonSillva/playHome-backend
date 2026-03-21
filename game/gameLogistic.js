import { WORDS } from "./words.js";
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
  const MAX_CONSECUTIVE = 2;

  // inicializa contadores
  const consecutiveCount = {};
  players.forEach(p => {
    consecutiveCount[p.id] = 0;
  });

  // percorre histórico de trás para frente
  for (let i = impostorHistory.length - 1; i >= 0; i--) {
    const round = impostorHistory[i];

    let someoneBroke = false;

    players.forEach(p => {
      if (round.includes(p.id)) {
        consecutiveCount[p.id]++;
        if (consecutiveCount[p.id] >= MAX_CONSECUTIVE) {
          someoneBroke = true;
        }
      } else {
        consecutiveCount[p.id] = 0;
      }
    });

    if (someoneBroke) break;
  }

  // bloqueados
  const blockedIds = players
    .filter(p => consecutiveCount[p.id] >= MAX_CONSECUTIVE)
    .map(p => p.id);

  // pool válida
  let pool = players.filter(p => !blockedIds.includes(p.id));

  // fallback de segurança
  if (pool.length < howManyImpostors) {
    pool = [...players];
  }

  // sorteio
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
) {
  const impostorTrueOrFalse = createImpostorPlayers(
    allPlayers,
    howManyImpostors,
    impostorHistory
  );

  const { updatedPlayers, chosenWord } = distributeWords(
    impostorTrueOrFalse,
    twoWordsMode,
    selectedCategories,
    WORDS,
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

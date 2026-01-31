import { WORDS } from "./words.js";
import { pickRandom, shuffleArray } from "./impostor.utils.js";

export function getImpostorCount(playersCount) {
  if (playersCount >= 7) return 3;
  if (playersCount >= 5) return 2;
  return 1;
}

const PLAYER_ICONS = [
  "🤫",
  "😁",
  "👾",
  "🧑🏻‍🚀",
  "👩🏽‍🚀",
  "👽",
  "🤖",
  "😎",
  "🫥",
  "🤔",
  "🤐",
  "😶‍🌫️",
  "😶",
  "🫠",
  "🥸",
  "🤥",
  "🫣",
  "🧐",
  "👹",
  "🫢",
  "🤓",
  "😈",
  "👿",
  "💀",
  "👻",
  "👺",
  "🧞‍♀️",
  "🧞‍♂️",
  "🧟",
  "🧌",
  "👨🏻",
  "👨🏽",
  "👩🏽",
  "👩🏻",
  "🤴🏻",
  "👸🏻",
  "🧑🏻‍🎄",
  "🕵🏻‍♀️",
  "🦹🏻",
  "🦸🏻",
  "🧙🏻",
  "🧛🏻",
];

const ICON_COLORS = [
  "#ff003c",
  "#3b82f6",
  "#facc15",
  "#51890c",
  "#6d28d9",
  "#19a5ac",
  "#ff7b00",
  "#ff00fb",
  "#00ff40",
  "#69166b",
  "#7f1d1d",
  "#075985",
  "#a16207",
  "#065f46",
  "#4c1d95",
  "#13697f",
  "#b91c1c",
  "#1d4ed8",
  "#ba8d07",
  "#777777",
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
      ready: false
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

function distributeWords(players, twoWordsMode, selectedCategories, wordBank, impostorHasHint, usedWords = []) {
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
      return {
        ...player,
        word: null,
        hint: impostorHasHint ? word.hint : undefined,
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
    selectedCategories,
    whoStart: setWhoStart,
    impostorCanStart,
    chosenWord,
  };
}

import { rooms } from "../state/rooms.js";
import { initializeGame } from "../game/gameLogistic.js";

function safeCb(cb, payload) {
  if (typeof cb === "function") cb(payload);
}

function getRoundPoints(player) {
  if (player.isImpostor) {
    return player.isAlive ? 2 : -1.5;
  }
  return player.isAlive ? 1 : 0;
}

function buildPlayerView(game, socketId) {
  const player = game.allPlayers.find(p => p.id === socketId);
  if (!player) return null;

  const baseView = {
    phase: game.phase,
    roomCode: game.roomCode,
    myName: player.name,
    myEmoji: player.emoji,
    myColor: player.color,
    isImpostor: player.isImpostor,
    word: player.word,
    hint: player.hint,
    isHost: game.hostId === socketId,
    revealed: player.revealed,
    ready: player.ready,
    voted: player.voted || false,
    whoStart: game.whoStart,
    twoWordsMode: game.twoWordsMode,
    votingFinished: game.votingFinished || false,
    votes: game.votes || {},
  };

  if (["discussion", "voting", "result"].includes(game.phase)) {
    return {
      ...baseView,
      players: game.allPlayers.map(p => ({
        id: p.id,
        name: p.name,
        emoji: p.emoji,
        color: p.color,
        isImpostor: p.isImpostor,
        isAlive: p.isAlive,
        score: p.score || 0,
        globalScore: p.globalScore || 0,
        hint: p.hint,
        voted: p.voted || false,
      }))
    };
  }

  return {
    ...baseView,
    allPlayers: game.allPlayers.map(p => ({
      socketId: p.id,
      name: p.name,
      ready: p.ready,
    }))
  };
}

export function registerGameHandlers(io, socket) {

  // --- START GAME ---
  socket.on("start-game", ({ roomCode, config }, cb) => {
    const room = rooms[roomCode];
    if (!room) return safeCb(cb, { error: "Sala não existe" });
    if (room.hostId !== socket.id) return safeCb(cb, { error: "Somente host" });

    room.config = config;
    const playersForGame = room.players.map((p) => ({ ...p, id: p.socketId }));

    const gameData = initializeGame(
      playersForGame,
      config.howManyImpostors,
      config.twoWordsMode,
      config.impostorHasHint,
      config.selectedCategories,
      config.whoStart,
      config.impostorCanStart,
      room.game?.impostorHistory ?? [],
      room.game?.usedWords ?? []
    );

    gameData.allPlayers = gameData.allPlayers.map((p) => ({
      ...p,
      revealed: false,
      ready: false,
      voted: false
    }));

    room.game = {
      ...gameData,
      phase: "reveal",
      roomCode,
      hostId: room.hostId,
      votes: {},
      impostorHistory: room.game?.impostorHistory ?? [],
      usedWords: [...(room.game?.usedWords ?? []), ...gameData.chosenWord],
    };

    room.players.forEach((p) => {
      io.to(p.socketId).emit("game-update", buildPlayerView(room.game, p.socketId));
    });
    safeCb(cb, { ok: true });
  });

  // --- REVEAL WORD ---
  socket.on("reveal-word", ({ roomCode }, cb) => {
    const room = rooms[roomCode];
    if (!room?.game) return;
    const player = room.game.allPlayers.find((p) => p.id === socket.id);
    if (player) player.revealed = true;
    room.players.forEach((p) => io.to(p.socketId).emit("game-update", buildPlayerView(room.game, p.socketId)));
    safeCb(cb, { ok: true });
  });

  // --- NEXT PHASE ---
  socket.on("next-phase", ({ roomCode, phase }, cb) => {
    const room = rooms[roomCode];
    if (!room?.game || room.hostId !== socket.id) return;
    room.game.phase = phase;
    room.players.forEach((p) => io.to(p.socketId).emit("game-update", buildPlayerView(room.game, p.socketId)));
    safeCb(cb, { ok: true });
  });

  // --- REROLL GAME ---
  socket.on("reroll-game", ({ roomCode }, cb) => {
    const room = rooms[roomCode];
    if (!room?.game || room.hostId !== socket.id) return;
    const config = room.config;
    const playersForGame = room.players.map((p) => ({ ...p, id: p.socketId }));
    const gameData = initializeGame(playersForGame, config.howManyImpostors, config.twoWordsMode, config.impostorHasHint, config.selectedCategories, config.whoStart, config.impostorCanStart, room.game.impostorHistory, room.game.usedWords);

    gameData.allPlayers = gameData.allPlayers.map(p => {
      const old = room.game.allPlayers.find(op => op.id === p.id);

      return {
        ...p,
        emoji: old.emoji,
        color: old.color,
        revealed: false,
        ready: false,
        voted: false,
        globalScore: old?.globalScore ?? 0,
      };
    });
    room.game = { ...gameData, phase: "reveal", roomCode, hostId: room.hostId, votes: {}, impostorHistory: room.game.impostorHistory, usedWords: [...room.game.usedWords, ...gameData.chosenWord] };

    room.players.forEach((p) => io.to(p.socketId).emit("game-update", buildPlayerView(room.game, p.socketId)));
    safeCb(cb, { ok: true });
  });

  // --- REJOIN ---
  socket.on("rejoin-room", ({ roomCode }, cb) => {
    const room = rooms[roomCode];
    if (!room) return safeCb(cb, { error: "Sala não existe" });
    socket.join(roomCode);
    if (room.game) socket.emit("game-update", buildPlayerView(room.game, socket.id));
    safeCb(cb, { ok: true });
  });

  // --- LÓGICA DE VOTO ONLINE IGUAL AO OFFLINE ---
  socket.on("cast-vote", ({ roomCode, votedId }, cb) => {
    const room = rooms[roomCode];
    if (!room?.game) return;

    room.game.votes ??= {};
    room.game.votes[socket.id] = votedId;

    const playerWhoVoted = room.game.allPlayers.find(p => p.id === socket.id);
    if (playerWhoVoted) playerWhoVoted.voted = true;

    const alivePlayers = room.game.allPlayers.filter(p => p.isAlive);
    const allVoted = alivePlayers.every(p => Object.prototype.hasOwnProperty.call(room.game.votes, p.id));

    if (allVoted) {
      room.game.votingFinished = true;
      const voteCount = {};
      Object.values(room.game.votes).forEach(id => {
        if (id && id !== "NULO") {
          voteCount[id] = (voteCount[id] || 0) + 1;
        }
      });

      let maxVotes = 0;
      let candidates = [];
      Object.entries(voteCount).forEach(([id, count]) => {
        if (count > maxVotes) {
          maxVotes = count;
          candidates = [id];
        } else if (count === maxVotes) {
          candidates.push(id);
        }
      });

      // Se houver empate ou ninguém recebeu votos (votos nulos/abstenção)
      if (candidates.length !== 1 || maxVotes === 0) {

        // votação acabou, mas sem eliminação
        // o front mostra o card neutro
      } else {
        // ELIMINAÇÃO
        const eliminatedId = candidates[0];
        const playerToKill = room.game.allPlayers.find(p => p.id === eliminatedId);
        if (playerToKill) playerToKill.isAlive = false;

        // VERIFICA CONDIÇÃO DE VITÓRIA APÓS ELIMINAÇÃO
        const survivors = room.game.allPlayers.filter(p => p.isAlive);
        const impostorsAlive = survivors.filter(p => p.isImpostor).length;
        const crewAlive = survivors.length - impostorsAlive;

        // Regra: Fim de jogo se impostores morrerem OU se igualarem os civis
        const isGameOver = impostorsAlive === 0 || impostorsAlive >= crewAlive;

        // Se o jogo acabou, vai para o "result" (Pódio). 
        // Se NÃO acabou, envia para o "result" também porque o componente do Front 
        // usa 'finished' (baseado na fase result) para exibir o Card de Identidade do morto.
        
        // Dica: Se quiser que o pódio final seja uma tela diferente do Card de Identidade,
        // você precisaria criar uma fase "podium" e mudar o front. 
        // Do jeito que está seu front, 'result' abre o Card do Morto.
      }
    }

    room.players.forEach(p => io.to(p.socketId).emit("game-update", buildPlayerView(room.game, p.socketId)));
    safeCb(cb, { ok: true });
  });

  socket.on("confirm-elimination", ({ roomCode }, cb) => {
  const room = rooms[roomCode];
  if (!room?.game) return;

  if (room.hostId !== socket.id) {
    return cb?.({ error: "Somente o host pode prosseguir" });
  }

  const game = room.game;

  // 🔄 RESET DE VOTOS (sempre)
  game.votes = {};
  game.votingFinished = false;
  game.allPlayers.forEach(p => p.voted = false);

  // 🔍 VERIFICA CONDIÇÃO DE FIM DE JOGO
 const alivePlayers = game.allPlayers.filter(p => p.isAlive);
  const impostorsAlive = alivePlayers.filter(p => p.isImpostor).length;
  const crewAlive = alivePlayers.length - impostorsAlive;

  const isGameOver =
    impostorsAlive === 0 || impostorsAlive >= crewAlive;

  // 🏁 SE O JOGO ACABOU → CALCULA PONTUAÇÃO FINAL
  if (isGameOver) {
    game.allPlayers.forEach(player => {
      const roundPoints = getRoundPoints(player);

      // score da rodada
      player.score = (player.score || 0) + roundPoints;

      // soma no placar global
      player.globalScore = (player.globalScore || 0) + player.score;

      // zera score da rodada
      player.score = 0;
    });

    game.phase = "result";
  } else {
    // 🔁 CONTINUA O JOGO (empate ou eliminação normal)
    game.phase = "discussion";
  }

  // 🔄 EMITE UPDATE PARA TODOS
  room.players.forEach(p => {
    io.to(p.socketId).emit(
      "game-update",
      buildPlayerView(game, p.socketId)
    );
  });

  cb?.({ ok: true });
});


  socket.on("toggle-ready", ({ roomCode }, cb) => {
    const room = rooms[roomCode];
    if (!room?.game) return;
    const player = room.game.allPlayers.find(p => p.id === socket.id);
    if (player) player.ready = !player.ready;
    room.players.forEach(p => io.to(p.socketId).emit("game-update", buildPlayerView(room.game, p.socketId)));
    safeCb(cb, { ok: true });
  });
}
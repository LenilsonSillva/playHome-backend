import { rooms } from "../state/rooms.js";
import { initializeGame } from "../game/gameLogistic.js";
import { 
  calculateAndApplyScores, 
  resetScoresForNewRound,
  getRoundPoints 
} from "../game/scoringSystem.js";

function safeCb(cb, payload) {
  if (typeof cb === "function") cb(payload);
}

function isSpectator(game, socketId) {
  return !game.allPlayers.some(p => p.id === socketId);
}

function emitGameUpdate(io, room, socketId) {
  if (!room.game) return;
  const view = isSpectator(room.game, socketId)
    ? buildSpectatorView(room.game, socketId)
    : buildPlayerView(room.game, socketId);
  io.to(socketId).emit("game-update", view);
}

function emitGameUpdateToAll(io, room) {
  if (!room.game) return;
  
  room.players.forEach(p => {
    const isSpect = isSpectator(room.game, p.socketId);
    const view = isSpect
      ? buildSpectatorView(room.game, p.socketId, p)
      : buildPlayerView(room.game, p.socketId);
    io.to(p.socketId).emit("game-update", view);
  });
  
  if (room.waitingPlayers?.length > 0) {
    room.waitingPlayers.forEach(p => {
      const view = buildSpectatorView(room.game, p.socketId, p);
      io.to(p.socketId).emit("game-update", view);
    });
  }
}

// 🔥 NOVA FUNÇÃO AUXILIAR: Calcula o morto. Usada pelo botão e pelo cronômetro!
function processVotingResults(room, io) {
  room.game.votingFinished = true;
  const voteCount = {};
  
  Object.values(room.game.votes).forEach(id => {
  if (id !== null) {
    voteCount[id] = (voteCount[id] || 0) + 1;
  }
});

  let maxVotes = 0;
  let candidates = [];
  Object.entries(voteCount).forEach(([id, count]) => {
    if (count > maxVotes) {
      maxVotes = count;
      candidates =[id];
    } else if (count === maxVotes) {
      candidates.push(id);
    }
  });

  // Empate ou Nulos
  if (candidates.length !== 1 || maxVotes === 0) {
    room.game.eliminatedId = null; 
  } else {
    const eliminatedId = candidates[0];
    room.game.eliminatedId = eliminatedId; 
    const playerToKill = room.game.allPlayers.find(p => p.id === eliminatedId);
    if (playerToKill) playerToKill.isAlive = false;
  }

  emitGameUpdateToAll(io, room);
}

export function buildPlayerView(game, socketId) {
  const player = game.allPlayers.find(p => p.id === socketId);
  if (!player) return null;

  const baseView = {
    phase: game.phase,
    roomCode: game.roomCode,
    serverTime: Date.now(),
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
    votingEndTime: game.votingEndTime || null, // 🔥 O Servidor manda o tempo pro App!
    votes: game.votes || {},
    eliminatedId: game.eliminatedId || null,
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
      socketId: p.id, name: p.name, ready: p.ready,
    }))
  };
}

export function buildSpectatorView(game, socketId, spectatorData = {}) {
  const baseView = {
    phase: game.phase,
    roomCode: game.roomCode,
    serverTime: Date.now(),
    isSpectator: true,
    myName: spectatorData.name || "Espectador",
    myEmoji: spectatorData.emoji || "👁️",
    myColor: spectatorData.color || "#666666",
    whoStart: game.whoStart,
    twoWordsMode: game.twoWordsMode,
    votingFinished: game.votingFinished || false,
    votingEndTime: game.votingEndTime || null,
    eliminatedId: game.eliminatedId || null,
  };

  if (["reveal", "discussion", "voting", "result"].includes(game.phase)) {
    return {
      ...baseView,
      players: game.allPlayers.map(p => ({
        id: p.id, name: p.name, emoji: p.emoji, color: p.color,
        isImpostor: p.isImpostor, isAlive: p.isAlive,
        score: p.score || 0, globalScore: p.globalScore || 0,
        hint: p.hint, voted: p.voted || false,
      }))
    };
  }

  return {
    ...baseView,
    allPlayers: game.allPlayers.map(p => ({
      socketId: p.id, name: p.name, ready: p.ready,
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
      playersForGame, config.howManyImpostors, config.twoWordsMode,
      config.impostorHasHint, config.selectedCategories, config.whoStart,
      config.impostorCanStart, config.impostorTrap, config.impostorCat,
      room.game?.impostorHistory ??[], room.game?.usedWords ??[]
    );

    gameData.allPlayers = gameData.allPlayers.map((p) => ({
      ...p, revealed: false, ready: false, voted: false
    }));

    const newHistory = [
      ...(room.game?.impostorHistory ?? []),
      gameData.allPlayers.filter(p => p.isImpostor).map(p => p.id)
    ].slice(-2);

    if (room.waitingPlayers?.length) {
      room.players.push(...room.waitingPlayers);
      room.waitingPlayers =[];
    }

    room.game = {
      ...gameData, phase: "reveal", roomCode, hostId: room.hostId,
      votes: {}, impostorHistory: newHistory,
      usedWords: [...(room.game?.usedWords ?? []), ...gameData.chosenWord],
    };

    emitGameUpdateToAll(io, room);
    safeCb(cb, { ok: true });
  });

  socket.on("reveal-word", ({ roomCode }, cb) => {
    const room = rooms[roomCode];
    if (!room?.game) return;
    const player = room.game.allPlayers.find((p) => p.id === socket.id);
    if (player) player.revealed = true;
    emitGameUpdateToAll(io, room);
    safeCb(cb, { ok: true });
  });

  // --- NEXT PHASE ---
  socket.on("next-phase", ({ roomCode, phase }, cb) => {
    const room = rooms[roomCode];
    if (!room?.game || room.hostId !== socket.id) return;
    
    room.game.phase = phase;

    // 🔥 O SERVIDOR ASSUME O CRONÔMETRO
    if (phase === "voting") {
      const TOTAL_TIME_MS = 60000; // 60 segundos
      room.game.votingEndTime = Date.now() + TOTAL_TIME_MS; // Salva pra mandar pro Frontend
      room.game.votes = {}; 
      
      // Limpa timer se existir
      if (room.game.votingTimeout) clearTimeout(room.game.votingTimeout);

      // Cria a BOMBA RELÓGIO
      room.game.votingTimeout = setTimeout(() => {
        if (!room.game) return; 
        
        const alivePlayers = room.game.allPlayers.filter(p => p.isAlive);
        // O tempo acabou! Força NULO em quem não votou
        alivePlayers.forEach(p => {
          if (!(p.id in room.game.votes)) {
            room.game.votes[p.id] = null;
            p.voted = true;
          }
        });

        if (!room.game.votingFinished) {
          processVotingResults(room, io);
        }
      }, TOTAL_TIME_MS);
    } else {
      if (room.game.votingTimeout) {
        clearTimeout(room.game.votingTimeout);
        room.game.votingTimeout = null;
      }
    }

    emitGameUpdateToAll(io, room);
    safeCb(cb, { ok: true });
  });

  socket.on("reroll-game", ({ roomCode }, cb) => {
    const room = rooms[roomCode];
    if (!room?.game || room.hostId !== socket.id) return;
    const config = room.config;
    const playersForGame = room.players.map((p) => ({ ...p, id: p.socketId }));
    const gameData = initializeGame(
      playersForGame, config.howManyImpostors, config.twoWordsMode, 
      config.impostorHasHint, config.selectedCategories, config.whoStart, 
      config.impostorCanStart, config.impostorTrap, config.impostorCat, 
      room.game.impostorHistory, room.game.usedWords
    );

    if (room.waitingPlayers?.length) {
      room.players.push(...room.waitingPlayers);
      room.waitingPlayers =[];
    }
    
    gameData.allPlayers = gameData.allPlayers.map(p => {
      const old = room.game.allPlayers.find(op => op.id === p.id);
      return {
        ...p, emoji: old?.emoji ?? p.emoji, color: old?.color ?? p.color,
        revealed: false, ready: false, voted: false, globalScore: old?.globalScore ?? 0,
      };
    });
    room.game = { ...gameData, phase: "reveal", roomCode, hostId: room.hostId, votes: {}, impostorHistory: room.game.impostorHistory, usedWords: [...room.game.usedWords, ...gameData.chosenWord] };

    emitGameUpdateToAll(io, room);
    safeCb(cb, { ok: true });
  });

  socket.on("rejoin-room", ({ roomCode }, cb) => {
    const room = rooms[roomCode];
    if (!room) return safeCb(cb, { error: "Sala não existe" });
    socket.join(roomCode);
    
    if (room.game) {
      const playerInRoom = room.players.find(p => p.socketId === socket.id);
      const isParticipant = room.game.allPlayers.some(p => p.id === socket.id);
      if (isParticipant) {
        socket.emit("game-update", buildPlayerView(room.game, socket.id));
      } else {
        socket.emit("game-update", buildSpectatorView(room.game, socket.id, playerInRoom));
      }
    }
    safeCb(cb, { ok: true });
  });

  // --- LÓGICA DE VOTO ONLINE ---
  socket.on("cast-vote", ({ roomCode, votedId }, cb) => {
    const room = rooms[roomCode];
    if (!room?.game) return;
    if (room.game.votingFinished) return safeCb(cb, { ok: true });

    // Segurança: Somente vivos votam
    const playerWhoVoted = room.game.allPlayers.find(p => p.id === socket.id);
    if (!playerWhoVoted || !playerWhoVoted.isAlive) {
      return safeCb(cb, { error: "Apenas vivos podem votar." });
    }

    if (socket.id === votedId) {
      return safeCb(cb, { error: "Você não pode votar em si mesmo." });
    }

    room.game.votes ??= {};
    room.game.votes[socket.id] = votedId ?? null;
    playerWhoVoted.voted = true;

    const alivePlayers = room.game.allPlayers.filter(p => p.isAlive);
    const allVoted = alivePlayers.every(p => Object.prototype.hasOwnProperty.call(room.game.votes, p.id));

    if (allVoted) {
      // 🔥 Todo mundo foi rápido! Desarma a bomba-relógio!
      if (room.game.votingTimeout) {
        clearTimeout(room.game.votingTimeout);
        room.game.votingTimeout = null;
      }
      processVotingResults(room, io);
    } else {
      emitGameUpdateToAll(io, room);
    }

    safeCb(cb, { ok: true });
  });

  socket.on("confirm-elimination", ({ roomCode }, cb) => {
    const room = rooms[roomCode];
    if (!room?.game) return;
    if (room.hostId !== socket.id) return cb?.({ error: "Somente o host pode prosseguir" });

    const game = room.game;

    game.votes = {};
    game.votingFinished = false;
    game.votingEndTime = null; // Limpa o tempo
    game.eliminatedId = null;
    game.allPlayers.forEach(p => p.voted = false);

    const alivePlayers = game.allPlayers.filter(p => p.isAlive);
    const impostorsAlive = alivePlayers.filter(p => p.isImpostor).length;
    const crewAlive = alivePlayers.length - impostorsAlive;
    const isGameOver = impostorsAlive === 0 || impostorsAlive >= crewAlive;

    if (isGameOver) {
      calculateAndApplyScores(game, true);
      game.phase = "result";
    } else {
      game.phase = "discussion";
    }

    emitGameUpdateToAll(io, room);
    cb?.({ ok: true });
  });

  socket.on("toggle-ready", ({ roomCode }, cb) => {
    const room = rooms[roomCode];
    if (!room?.game) return;
    const player = room.game.allPlayers.find(p => p.id === socket.id);
    if (player) player.ready = !player.ready;
    emitGameUpdateToAll(io, room);
    safeCb(cb, { ok: true });
  });
}
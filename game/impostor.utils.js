import { buildPlayerView, buildSpectatorView } from "../socket/gameHandlers.js";
import { rooms } from "../state/rooms.js";

export function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function pickRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

export function generateRoomCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function handlePlayerExit(io, socket, roomCode, reason = "left") {
  const room = rooms[roomCode];
  if (!room) return;

  // Procura o jogador em ambas as listas
  const player = room.players.find(p => p.socketId === socket.id);
  if (!player) return; // Jogador não encontrado

  // 1. Remove da lista principal de jogadores
  room.players = room.players.filter(p => p.socketId !== socket.id);
  
  // 2. Remove de waiting players também (se estiver lá como espectador)
  if (room.waitingPlayers?.length > 0) {
    room.waitingPlayers = room.waitingPlayers.filter(p => p.socketId !== socket.id);
  }

  // ALERTA PARA TODOS
  io.to(roomCode).emit("player-left", {
    playerId: player.id,
    name: player.name,
    reason, // "left" | "disconnect"
  });

  // 🔻 MENOS DE 3 JOGADORES ATIVOS → ENCERRA SALA SE HOUVER JOGO
  if ((room.players.length < 3) && (room.game !== null)) {
    io.to(roomCode).emit("force-lobby", {
      reason: "not-enough-players",
    });

    delete rooms[roomCode];
    return;
  }

  // Se a sala ficar totalmente vazia, destrua-a imediatamente
  if (room.players.length === 0) {
    delete rooms[roomCode];
    return;
  }

  // 👑 SE ERA HOST → PASSA HOST
  if ((room.hostId === socket.id)) {
    // ✅ Seleciona novo host APENAS DE JOGADORES ATIVOS (não espectadores)
    // Se houver jogo em andamento, pega do game.allPlayers
    // Se não, pega qualquer um de room.players
    let candidates = [];
    
    if (room.game?.allPlayers?.length > 0) {
      // Jogo em progresso: novo host deve ser jogador ativo
      candidates = room.players.filter(p =>
        room.game.allPlayers.some(gp => gp.id === p.socketId)
      );
    } else {
      // Sem jogo ou em lobby: qualquer jogador em room.players (não espectador)
      candidates = room.players;
    }

    if (candidates.length === 0) {
      // Sem candidatos válidos, não há o que fazer
      return;
    }

    const newHost = candidates[Math.floor(Math.random() * candidates.length)];
    room.hostId = newHost.socketId;

    io.to(roomCode).emit("host-changed", {
      newHostId: newHost.socketId,
    });

    // Se houver um jogo em andamento, atualiza o hostId
    if (room.game) {
      room.game.hostId = room.hostId;
      // Emite updates para todos respeitando status de participante/espectador
      room.players.forEach(p => {
        const isSpect = !room.game.allPlayers.some(gp => gp.id === p.socketId);
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
  }

  // 🎮 SE O JOGO ESTAVA ACONTECENDO
  if (room.game && room.game.phase !== "lobby") {
    // Se está na fase 'reveal', remove o jogador do jogo completamente
    if (room.game.phase === "reveal") {
      const existed = room.game.allPlayers.some(p => p.id === socket.id);
      if (existed) {
        room.game.allPlayers = room.game.allPlayers.filter(p => p.id !== socket.id);

        // Emite update para todos
        room.players.forEach(p => {
          const isSpect = !room.game.allPlayers.some(gp => gp.id === p.socketId);
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
    } else {
      // Em outras fases, marca como morto ao invés de remover
      const gamePlayer = room.game.allPlayers.find(p => p.id === socket.id);

      if (gamePlayer) {
        gamePlayer.isAlive = false;

        // Recalcula condição de vitória
        const alivePlayers = room.game.allPlayers.filter(p => p.isAlive);
        const impostorsAlive = alivePlayers.filter(p => p.isImpostor).length;
        const crewAlive = alivePlayers.length - impostorsAlive;

        if (impostorsAlive === 0 || impostorsAlive >= crewAlive) {
          room.game.phase = "result";
          room.game.gameOver = true;
        }

        // Atualiza TODOS (participantes e espectadores)
        room.players.forEach(p => {
          const isSpect = !room.game.allPlayers.some(gp => gp.id === p.socketId);
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
    }
  }

  io.to(roomCode).emit("room-updated", room);
}
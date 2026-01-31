import { buildPlayerView } from "../socket/gameHandlers.js";
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

  const player = room.players.find(p => p.socketId === socket.id);
  if (!player) return;

  // remove da lista de players
  room.players = room.players.filter(p => p.socketId !== socket.id);

  // ALERTA PARA TODOS
  io.to(roomCode).emit("player-left", {
    playerId: player.id,
    name: player.name,
    reason, // "left" | "disconnect"
  });

  // 🔻 MENOS DE 3 JOGADORES → ENCERRA SALA
  if (room.players.length < 3) {
    io.to(roomCode).emit("force-lobby", {
      reason: "not-enough-players",
    });

    delete rooms[roomCode];
    return;
  }

  // 👑 SE ERA HOST → PASSA HOST
  if (room.hostId === socket.id) {
    const newHost = room.players[Math.floor(Math.random() * room.players.length)];
    // newHost.socketId is the socket identifier used across the codebase
    room.hostId = newHost.socketId;

    io.to(roomCode).emit("host-changed", {
      newHostId: newHost.socketId,
    });

    // se houver um jogo em andamento, atualiza o hostId dentro do objeto game
    if (room.game) {
      room.game.hostId = room.hostId;
      room.players.forEach(p =>
        io.to(p.socketId).emit("game-update", buildPlayerView(room.game, p.socketId))
      );
    }
  }

  // 🎮 SE O JOGO ESTAVA ACONTECENDO
  // 🎮 SE O JOGO ESTAVA ACONTECENDO
  if (room.game && room.game.phase !== "lobby") {
    // Se estamos na fase 'reveal', removemos o jogador do jogo completamente
    if (room.game.phase === "reveal") {
      const existed = room.game.allPlayers.some(p => p.id === socket.id);
      if (existed) {
        room.game.allPlayers = room.game.allPlayers.filter(p => p.id !== socket.id);

        // Emite update para todos com a nova lista (quem saiu não receberá mais)
        room.players.forEach(p =>
          io.to(p.socketId).emit("game-update", buildPlayerView(room.game, p.socketId))
        );

        io.to(roomCode).emit("player-left", {
          playerId: player.id,
          name: player.name,
          reason,
        });
      }
    } else {
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

        // Atualiza todos os players
        room.players.forEach(p =>
          io.to(p.socketId).emit("game-update", buildPlayerView(room.game, p.socketId))
        );

        // Emite evento extra para frontend se quiser mostrar mensagem
        io.to(roomCode).emit("player-left", {
          playerId: gamePlayer.id,
          name: gamePlayer.name,
          reason,
        });
      }
    }
  }

  io.to(roomCode).emit("room-updated", room);
}
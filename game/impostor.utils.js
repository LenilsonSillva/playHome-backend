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
  if (!player) return; // Se o jogador já saiu ou não existe, ignora

  // 1. Remove da lista principal de jogadores
  room.players = room.players.filter(p => p.socketId !== socket.id);

  // 2. Alerta todos que o jogador desconectou
  io.to(roomCode).emit("player-left", {
    playerId: player.id || socket.id,
    name: player.name,
    reason, 
  });

  // 3. 🚨 CORREÇÃO 1: Se a sala ficar totalmente vazia, destrua-a imediatamente!
  if (room.players.length === 0) {
    delete rooms[roomCode];
    return;
  }

  // 4. 🚨 CORREÇÃO 2: Passa a Coroa (Host) SEMPRE! (mesmo se estiver no Lobby)
  if (room.hostId === socket.id) {
    const newHost = room.players[0]; // Pega o primeiro que sobrou na lista
    room.hostId = newHost.socketId;

    // Avisa o Frontend quem é o novo dono
    io.to(roomCode).emit("host-changed", { newHostId: newHost.socketId });

    // Se o jogo estivesse rolando, garante que ele saiba do novo host também
    if (room.game) {
      room.game.hostId = room.hostId;
    }
  }

  // 5. 🎮 LÓGICA DE JOGO EM ANDAMENTO
  if (room.game && room.game.phase !== "lobby") {
    
    // Se cair para menos de 3 jogadores DURANTE O JOGO, quebra a sala e manda pro lobby
    if (room.players.length < 3) {
      io.to(roomCode).emit("force-lobby", { reason: "not-enough-players" });
      delete rooms[roomCode]; 
      return;
    }

    if (room.game.phase === "reveal") {
      // Se estava apenas lendo a palavra, tira ele do array completamente
      room.game.allPlayers = room.game.allPlayers.filter(p => p.id !== socket.id);
    } else {
      // Nas demais fases (Discussão/Votação), NÃO apagamos do array.
      // Apenas definimos "isAlive = false" para não quebrar a matemática e histórico de votos.
      const gamePlayer = room.game.allPlayers.find(p => p.id === socket.id);
      if (gamePlayer) {
        gamePlayer.isAlive = false;

        // Recalcula se o Impostor ou a Tripulação ganharam com essa queda de jogador
        const alivePlayers = room.game.allPlayers.filter(p => p.isAlive);
        const impostorsAlive = alivePlayers.filter(p => p.isImpostor).length;
        const crewAlive = alivePlayers.length - impostorsAlive;

        if (impostorsAlive === 0 || impostorsAlive >= crewAlive) {
          room.game.phase = "result";
          room.game.gameOver = true;
        }
      }
    }

    // Atualiza o state do jogo para todos que ficaram na partida
    room.players.forEach(p =>
      io.to(p.socketId).emit("game-update", buildPlayerView(room.game, p.socketId))
    );
  }

  // Emite evento extra para frontend se quiser mostrar mensagem
        io.to(roomCode).emit("player-left", {
          playerId: gamePlayer.id,
          name: gamePlayer.name,
          reason,
        });

  // 6. Finalmente, atualiza as telas do Lobby
  io.to(roomCode).emit("room-updated", room);
}
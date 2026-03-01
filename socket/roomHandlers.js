import { rooms } from "../state/rooms.js";
import { generateRoomCode, handlePlayerExit } from "../game/impostor.utils.js";

function safeCb(cb, payload) {
  if (typeof cb === "function") cb(payload);
}

function normalizeName(name) {
  return name.trim().toLowerCase();
}

export function registerRoomHandlers(io, socket) {
  socket.on("create-room", ({ name, id, emoji, color }, cb) => {
    const roomCode = generateRoomCode();

    rooms[roomCode] = {
      code: roomCode,
      hostId: socket.id,
      players: [{ socketId: socket.id, id, name, emoji, color }],
      phase: "lobby",
      config: {
        categories: ["Objetos", "Animais", "Natureza"],
        hasHint: false,
      },
      game: null,
    };

    socket.join(roomCode);
    io.to(roomCode).emit("room-updated", rooms[roomCode]);

    safeCb(cb, { ok: true, roomCode });
  });

  socket.on("join-room", ({ name, id, emoji, color, roomCode }, cb) => {
    const room = rooms[roomCode];
    if (!room) return safeCb(cb, { error: "Sala não existe" });

    // Validação do nome
    const normalized = normalizeName(name);
    const nameAlreadyUsed = room.players.some(
      (p) => normalizeName(p.name) === normalized
    );

    if (nameAlreadyUsed) {
      return cb({ error: "Esse nome já está sendo usado na sala" });
    }

    const newPlayer = {
      socketId: socket.id,
      id,
      name: name.trim(),
      emoji,
      color,
    };

    // 🎮 Se o jogo JÁ COMEÇOU (fase !== lobby)
    if (room.phase !== "lobby") {
      // → Adiciona como ESPECTADOR (waiting player)
      // Espectador aguarda a próxima rodada para virar jogador
      room.waitingPlayers ??= [];
      room.waitingPlayers.push(newPlayer);
      socket.join(roomCode);

      return safeCb(cb, {
        waiting: true,
        message: "Aguardando próxima rodada",
        isSpectator: true,
      });
    }

    // 🏠 Se jogo está em LOBBY → Adiciona como jogador normal
    room.players.push(newPlayer);
    socket.join(roomCode);

    io.to(roomCode).emit("room-updated", room);
    safeCb(cb, { ok: true });
  });

socket.on("leave-room", ({ roomCode }, cb) => {
  socket.leave(roomCode);
  handlePlayerExit(io, socket, roomCode, "left");
  safeCb(cb, { ok: true });
});

socket.on("disconnect", () => {
  Object.entries(rooms).forEach(([roomCode, room]) => {
    if (room.players.some(p => p.socketId === socket.id)) {
      socket.leave(roomCode);
      handlePlayerExit(io, socket, roomCode, "disconnect");
    }
  });
});

}

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
    if (room.phase !== "lobby") return safeCb(cb, { error: "Jogo já começou" });

      const normalized = normalizeName(name);

    const nameAlreadyUsed = room.players.some(
        (p) => normalizeName(p.name) === normalized
    );

    if (nameAlreadyUsed) {
        return cb({ error: "Esse nome já está sendo usado na sala" });
    }

    if (room.phase !== "lobby") {
      room.waitingPlayers ??= [];

      room.waitingPlayers.push({
        socketId: socket.id,
        id,
        name,
        emoji,
        color,
      });

      socket.join(roomCode);

      return safeCb(cb, {
        waiting: true,
        message: "Aguardando próxima rodada",
      });
    }

    room.players.push({ socketId: socket.id, id, name: name.trim(), emoji, color });
    socket.join(roomCode);

    io.to(roomCode).emit("room-updated", room);

    safeCb(cb, { ok: true });
  });

socket.on("leave-room", ({ roomCode }, cb) => {
  handlePlayerExit(io, socket, roomCode, "left");
  safeCb(cb, { ok: true });
});

socket.on("disconnect", () => {
  Object.entries(rooms).forEach(([roomCode, room]) => {
    if (room.players.some(p => p.socketId === socket.id)) {
      handlePlayerExit(io, socket, roomCode, "disconnect");
    }
  });
});

}

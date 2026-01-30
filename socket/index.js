import { registerRoomHandlers } from "./roomHandlers.js";
import { registerGameHandlers } from "./gameHandlers.js";

export function registerSocket(io, socket) {
  registerRoomHandlers(io, socket);
  registerGameHandlers(io, socket);
}

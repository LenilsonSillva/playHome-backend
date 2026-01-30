import express from "express";
import http from "http";
import { Server } from "socket.io";
import { registerSocket } from "./socket/index.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "https://play-home-iota.vercel.app/",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("Nova conexão:", socket.id);
  registerSocket(io, socket);
});

server.listen(3000, () => {
  console.log("🔥 Impostor server running on port 3000");
});

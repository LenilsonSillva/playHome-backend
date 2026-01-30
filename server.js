import express from "express";
import http from "http";
import { Server } from "socket.io";
import { registerSocket } from "./socket/index.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "https://play-home-iota.vercel.app", 
      "http://localhost:5173",
      "192.168.1.202:5173"
    ],
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("Nova conexão:", socket.id);
  registerSocket(io, socket);
});


const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🔥 Impostor server running on port ${PORT}`);
});

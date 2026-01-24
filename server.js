const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: ["https://play-home-iota.vercel.app/", "http://localhost:5173"], // Em produção, coloque a URL do seu site na Vercel
        methods: ["GET", "POST"]
    }
});

// Importante: Você deve copiar o seu array de WORDS para cá ou para um arquivo words.js
const WORDS = [
    { word: "Cachorro", category: "Animais", related: ["Gato"], hint: "Melhor amigo do homem" },
    // ... adicione as outras palavras aqui
];

const rooms = new Map();

io.on('connection', (socket) => {
    console.log('Usuário conectado:', socket.id);

    // CRIAR SALA
    socket.on('create-room', ({ hostName }, callback) => {
        const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
        const roomData = {
            code: roomCode,
            hostId: socket.id,
            players: [{ id: socket.id, name: hostName }],
            gameStarted: false
        };
        
        rooms.set(roomCode, roomData);
        socket.join(roomCode);
        
        callback({ code: roomCode });
        console.log(`Sala ${roomCode} criada por ${hostName}`);
    });

    // ENTRAR NA SALA
    socket.on('join-room', ({ name, code }, callback) => {
        const room = rooms.get(code);

        if (!room) {
            return callback({ success: false, message: "Sala não encontrada" });
        }
        if (room.gameStarted) {
            return callback({ success: false, message: "Jogo já em andamento" });
        }

        const newPlayer = { id: socket.id, name };
        room.players.push(newPlayer);
        socket.join(code);

        callback({ success: true });
        
        // Avisa todos na sala que a lista de jogadores mudou
        io.to(code).emit('room-updated', room.players);
    });

    // INICIAR JOGO (Lógica do Servidor)
    socket.on('start-game', (config) => {
        const { roomCode, impostorCount, twoWordsMode, categories, impostorHasHint } = config;
        const room = rooms.get(roomCode);

        if (!room || socket.id !== room.hostId) return;

        // 1. Sortear Palavra
        const filteredWords = WORDS.filter(w => categories.includes(w.category));
        const wordData = filteredWords[Math.floor(Math.random() * filteredWords.length)] || WORDS[0];

        // 2. Sortear Impostores
        const shuffledPlayers = [...room.players].sort(() => Math.random() - 0.5);
        const impostorIds = shuffledPlayers.slice(0, impostorCount).map(p => p.id);

        // 3. Sortear quem recebe a palavra relacionada (se Two Words Mode ativo)
        const civils = room.players.filter(p => !impostorIds.includes(p.id));
        const groupAIds = civils.sort(() => Math.random() - 0.5)
                            .slice(0, Math.floor(civils.length / 2))
                            .map(p => p.id);

        // 4. Enviar dados PRIVADOS para cada jogador
        room.players.forEach(player => {
            const isImpostor = impostorIds.includes(player.id);
            let playerWord = null;

            if (!isImpostor) {
                playerWord = (twoWordsMode && groupAIds.includes(player.id) && wordData.related)
                    ? wordData.related[0]
                    : wordData.word;
            }

            io.to(player.id).emit('game-started', {
                isImpostor,
                word: playerWord,
                hint: (isImpostor && impostorHasHint) ? wordData.hint : null,
                allPlayers: room.players // Para saber quem está jogando
            });
        });

        room.gameStarted = true;
    });

    // DESCONEXÃO
    socket.on('disconnect', () => {
        rooms.forEach((room, code) => {
            const index = room.players.findIndex(p => p.id === socket.id);
            if (index !== -1) {
                room.players.splice(index, 1);
                if (room.players.length === 0) {
                    rooms.delete(code);
                } else {
                    io.to(code).emit('room-updated', room.players);
                }
            }
        });
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
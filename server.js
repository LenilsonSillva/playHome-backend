const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { WORDS } = require('./words');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Em produção substitua pela URL da Vercel sem a barra no final
        methods: ["GET", "POST"]
    }
});

// --- CONSTANTES ---
const PLAYER_ICONS = ["🤫","👾","🧑🏻‍🚀","👩🏽‍🚀","👽","🤖","😎","🤔","🤐","🫠","🥸","🫣","🧐","👹","🫢","🤓","😈","👿","💀","👻"];
const ICON_COLORS = ["#ff003c","#3b82f6","#facc15","#51890c","#6d28d9","#19a5ac","#ff7b00","#ff00fb","#00ff40","#69166b"];

// --- FUNÇÕES DE APOIO ---
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

function getImpostorCount(playersCount) {
    if (playersCount >= 7) return 3;
    if (playersCount >= 5) return 2;
    return 1;
}

function pickImpostors(playerIds, count, history = []) {
    const lastRound = history[history.length - 1] || [];
    const secondLastRound = history[history.length - 2] || [];
    const blocked = playerIds.filter(id => lastRound.includes(id) && secondLastRound.includes(id));
    let candidates = playerIds.filter(id => !blocked.includes(id));
    if (candidates.length < count) candidates = playerIds;
    return shuffleArray(candidates).slice(0, count);
}

const rooms = new Map();

// --- LÓGICA CENTRAL DE SORTEIO ---
const handleSorteio = (roomCode) => {
    const room = rooms.get(roomCode);
    if (!room || !room.config) return;

    const { config, players, impostorHistory, usedWords } = room;

    // 1. Quantidade de Impostores
    const count = getImpostorCount(players.length);

    // 2. Sortear IDs dos Impostores
    const impostorIds = pickImpostors(players.map(p => p.id), count, impostorHistory);
    room.impostorHistory.push(impostorIds);

    // 3. Sortear Palavras
    const filtered = WORDS.filter(w => config.categories.includes(w.category));
    let available = filtered.filter(w => !usedWords.includes(w.word));
    if (available.length === 0) available = filtered.length > 0 ? filtered : WORDS;
    
    const wordData = available[Math.floor(Math.random() * available.length)];
    const wordA = wordData.word;
    const wordB = (config.twoWordsMode && wordData.related?.length > 0) ? wordData.related[0] : wordA;
    room.usedWords.push(wordA, wordB);

    // 4. Divisão de Civis (Grupo A e B para Two Words Mode)
    const civils = players.filter(p => !impostorIds.includes(p.id));
    const groupAIds = shuffleArray(civils.map(p => p.id)).slice(0, Math.floor(civils.length / 2));

    // 5. Quem inicia
    const canStartIds = config.impostorCanStart ? players : civils;
    const starter = canStartIds[Math.floor(Math.random() * canStartIds.length)];

    // 6. Identidade Visual da Rodada
    const roundIcons = shuffleArray(PLAYER_ICONS);
    const roundColors = shuffleArray(ICON_COLORS);

    // 7. Enviar dados PRIVADOS para cada socket
    players.forEach((player, index) => {
        const isImpostor = impostorIds.includes(player.id);
        
        // Define a palavra do jogador
        let myWord = null;
        if (!isImpostor) {
            myWord = groupAIds.includes(player.id) ? wordB : wordA;
        }

        io.to(player.id).emit('game-started', {
            isImpostor: isImpostor,
            word: myWord,
            hint: (isImpostor && config.impostorHasHint) ? wordData.hint : null,
            allPlayers: players, 
            myColor: roundColors[index % roundColors.length],
            myEmoji: roundIcons[index % roundIcons.length],
            whoStart: starter.name,
            roomCode: roomCode,
            isHost: player.id === room.hostId, // Importante para o botão Trocar aparecer
            phase: "reveal"
        });
    });

    room.gameStarted = true;
};

// --- EVENTOS DO SOCKET ---
io.on('connection', (socket) => {
    
    socket.on('create-room', ({ hostName }, callback) => {
        const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
        const roomData = {
            code: roomCode,
            hostId: socket.id,
            players: [{ id: socket.id, name: hostName }],
            gameStarted: false,
            impostorHistory: [],
            usedWords: [],
            config: null
        };
        rooms.set(roomCode, roomData);
        socket.join(roomCode);
        callback({ code: roomCode });
    });

    socket.on('join-room', ({ name, code }, callback) => {
        const room = rooms.get(code);
        if (!room) return callback({ success: false, message: "Sala não encontrada" });
        
        room.players.push({ id: socket.id, name });
        socket.join(code);
        callback({ success: true });
        io.to(code).emit('room-updated', room.players);
    });

    // Início oficial do jogo
    socket.on('start-game', (config) => {
        const room = rooms.get(config.roomCode);
        if (room && socket.id === room.hostId) {
            room.config = config; // Salva a configuração para usar no Reroll
            handleSorteio(config.roomCode);
        }
    });

    // Trocar palavra (Reroll)
    socket.on('reroll-word', (roomCode) => {
        const room = rooms.get(roomCode);
        if (room && room.config && socket.id === room.hostId) {
            handleSorteio(roomCode);
        }
    });

    socket.on('disconnect', () => {
        rooms.forEach((room, code) => {
            const index = room.players.findIndex(p => p.id === socket.id);
            if (index !== -1) {
                room.players.splice(index, 1);
                if (room.players.length === 0) rooms.delete(code);
                else io.to(code).emit('room-updated', room.players);
            }
        });
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => console.log(`Servidor rodando na porta ${PORT}`));
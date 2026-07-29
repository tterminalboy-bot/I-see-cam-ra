const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

const activeCodes = {};

io.on('connection', (socket) => {

    // 1. Génération du code avec préfixe interne (Récepteur)
    socket.on('request-code', (data) => {
        const prefix = (data.type === 'camera') ? 'C-' : 'S-';
        const randomNumber = Math.floor(100000 + Math.random() * 900000).toString();
        const fullCode = prefix + randomNumber;
        
        activeCodes[fullCode] = {
            socketId: socket.id, // ID du récepteur
            type: data.type
        };

        socket.emit('code-generated', fullCode);
    });

    // 2. Vérification du code (Émetteur)
    socket.on('verify-code', ({ code, deviceName, type }) => {
        const codeNettoye = code.trim().toUpperCase();
        const target = activeCodes[codeNettoye];

        if (!target) {
            socket.emit('error-message', 'Code invalide ou expiré.');
            return;
        }

        if (target.type !== type) {
            socket.emit('error-message', 'Code invalide pour ce mode de diffusion.');
            return;
        }

        // Sauvegarde de l'ID de l'émetteur
        target.streamerSocketId = socket.id;

        // Demande de permission au récepteur
        io.to(target.socketId).emit('ask-permission', { 
            streamerId: socket.id, 
            streamerName: deviceName 
        });
    });

    // 3. Gestion des autorisations & signaux WebRTC
    socket.on('permission-response', ({ code, accepted }) => {
        const target = activeCodes[code];
        if (target && target.streamerSocketId) {
            const viewerSocketId = target.socketId;          // Récepteur (PC)
            const streamerSocketId = target.streamerSocketId; // Émetteur (Téléphone)

            if (accepted) {
                io.to(streamerSocketId).emit('connection-approved', { targetId: viewerSocketId });
                io.to(viewerSocketId).emit('connection-approved', { targetId: streamerSocketId });
            } else {
                io.to(streamerSocketId).emit('connection-denied');
            }
        }
    });

    socket.on('rtc-signal', ({ to, sdp, candidate }) => {
        io.to(to).emit('rtc-signal', { sdp, candidate });
    });

    socket.on('request-reselect', ({ to }) => {
        io.to(to).emit('request-reselect');
    });

    socket.on('rtc-disconnect', ({ to }) => {
        io.to(to).emit('rtc-disconnect');
    });

    // Nettoyage lors de la déconnexion
    socket.on('disconnect', () => {
        for (const code in activeCodes) {
            if (activeCodes[code].socketId === socket.id || activeCodes[code].streamerSocketId === socket.id) {
                delete activeCodes[code];
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});

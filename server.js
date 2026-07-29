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

    // 1. Génération du code
    socket.on('request-code', (data) => {
        const prefix = (data.type === 'camera') ? 'C-' : 'S-';
        const randomNumber = Math.floor(100000 + Math.random() * 900000).toString();
        const fullCode = prefix + randomNumber;
        
        activeCodes[fullCode] = {
            socketId: socket.id,
            type: data.type
        };

        socket.emit('code-generated', fullCode);
    });

    // 2. Vérification du code saisi
    socket.on('verify-code', ({ code, deviceName, type }) => {
        const codeNettoye = code.trim().toUpperCase();
        const target = activeCodes[codeNettoye];

        if (!target) {
            socket.emit('error-message', 'Code invalide, expiré, ou déjà utilisé.');
            return;
        }

        if (target.type !== type) {
            socket.emit('error-message', 'Code invalide pour ce mode de diffusion.');
            return;
        }

        // Demande l'autorisation au récepteur
        io.to(target.socketId).emit('ask-permission', { 
            streamerId: socket.id, 
            streamerName: deviceName 
        });
    });

    // 3. Réponse à l'autorisation et INVALIDATION DU CODE
    socket.on('permission-response', ({ code, accepted }) => {
        const target = activeCodes[code];
        if (target) {
            if (accepted) {
                // On connecte les deux appareils
                io.to(target.socketId).emit('connection-approved', { targetId: socket.id });
                socket.emit('connection-approved', { targetId: target.socketId });
                
                // 🔒 INVALIDATION : On supprime le code pour qu'il ne soit plus jamais utilisable
                delete activeCodes[code];
            } else {
                io.to(target.socketId).emit('connection-denied');
            }
        }
    });

    // 4. Signaux WebRTC
    socket.on('rtc-signal', ({ to, sdp, candidate }) => {
        io.to(to).emit('rtc-signal', { sdp, candidate });
    });

    socket.on('request-reselect', ({ to }) => {
        io.to(to).emit('request-reselect');
    });

    socket.on('rtc-disconnect', ({ to }) => {
        io.to(to).emit('rtc-disconnect');
    });

    // Nettoyage à la déconnexion
    socket.on('disconnect', () => {
        for (const code in activeCodes) {
            if (activeCodes[code].socketId === socket.id) {
                delete activeCodes[code];
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});

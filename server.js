const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Stockage temporaire des sessions de couplage
const pendingConnections = {}; 

io.on('connection', (socket) => {
    console.log(`Nouvel appareil connecté : ${socket.id}`);

    // 1. Le PC (Afficheur) demande un code
    socket.on('request-code', (deviceName) => {
        const code = Math.floor(100000 + Math.random() * 900000).toString(); // Code à 6 chiffres
        pendingConnections[code] = {
            viewerId: socket.id,
            viewerName: deviceName,
            streamerId: null
        };
        socket.emit('code-generated', code);
    });

    // 2. Le téléphone (Caméra) entre le code
    socket.on('verify-code', ({ code, deviceName }) => {
        if (pendingConnections[code]) {
            const session = pendingConnections[code];
            session.streamerId = socket.id;
            
            // On demande l'autorisation au PC en envoyant le nom du téléphone
            io.to(session.viewerId).emit('ask-permission', { 
                streamerName: deviceName, 
                code: code 
            });
        } else {
            socket.emit('error-message', 'Code invalide ou expiré.');
        }
    });

    // 3. Réponse du PC (Accepté ou Refusé)
    socket.on('permission-response', ({ code, accepted }) => {
        const session = pendingConnections[code];
        if (!session) return;

        if (accepted) {
            // Liaison réussie ! On peut lancer le WebRTC
            io.to(session.streamerId).emit('connection-approved', { targetId: session.viewerId });
            io.to(session.viewerId).emit('connection-approved', { targetId: session.streamerId });
        } else {
            io.to(session.streamerId).emit('connection-denied');
            delete pendingConnections[code];
        }
    });

    socket.on('disconnect', () => {
        // Nettoyage si un appareil se déconnecte
        console.log(`Appareil déconnecté : ${socket.id}`);
    });
});

server.listen(3000, () => console.log('Serveur sécurisé lancé sur le port 3000'));

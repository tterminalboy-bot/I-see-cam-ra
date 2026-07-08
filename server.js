const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const pendingConnections = {}; 

io.on('connection', (socket) => {
    // Génération du code à 8 chiffres
    socket.on('request-code', (deviceName) => {
        const code = Math.floor(10000000 + Math.random() * 90000000).toString(); 
        pendingConnections[code] = {
            viewerId: socket.id,
            viewerName: deviceName,
            streamerId: null
        };
        socket.emit('code-generated', code);
    });

    socket.on('verify-code', ({ code, deviceName }) => {
        if (pendingConnections[code]) {
            const session = pendingConnections[code];
            session.streamerId = socket.id;
            io.to(session.viewerId).emit('ask-permission', { streamerName: deviceName, code });
        } else {
            socket.emit('error-message', 'Code invalide.');
        }
    });

    socket.on('permission-response', ({ code, accepted }) => {
        const session = pendingConnections[code];
        if (!session) return;

        if (accepted) {
            io.to(session.streamerId).emit('connection-approved', { targetId: session.viewerId });
            io.to(session.viewerId).emit('connection-approved', { targetId: session.streamerId });
        } else {
            io.to(session.streamerId).emit('connection-denied');
            delete pendingConnections[code];
        }
    });
});

server.listen(3000, () => console.log('Serveur CamLink Pro sur le port 3000'));

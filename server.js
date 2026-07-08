const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const pendingConnections = {}; 

io.on('connection', (socket) => {
    
    // 1. Demande de code par le PC
    socket.on('request-code', (deviceName) => {
        const code = Math.floor(10000000 + Math.random() * 90000000).toString(); 
        pendingConnections[code] = {
            viewerId: socket.id,
            viewerName: deviceName,
            streamerId: null
        };
        socket.emit('code-generated', code);
    });

    // 2. Vérification du code par le téléphone
    socket.on('verify-code', ({ code, deviceName }) => {
        if (pendingConnections[code]) {
            const session = pendingConnections[code];
            session.streamerId = socket.id;
            // On envoie la demande d'autorisation au PC
            io.to(session.viewerId).emit('ask-permission', { streamerName: deviceName, code });
        } else {
            socket.emit('error-message', 'Code invalide.');
        }
    });

    // 3. Réponse d'autorisation du PC
    socket.on('permission-response', ({ code, accepted }) => {
        const session = pendingConnections[code];
        if (!session) return;

        if (accepted) {
            // Liaison acceptée : on donne l'identifiant de l'un à l'autre
            io.to(session.streamerId).emit('connection-approved', { targetId: session.viewerId });
            io.to(session.viewerId).emit('connection-approved', { targetId: session.streamerId });
        } else {
            io.to(session.streamerId).emit('connection-denied');
            delete pendingConnections[code];
        }
    });

    // 4. TRANSFERT DES SIGNAUX VIDÉO (L'élément manquant !)
    socket.on('rtc-signal', ({ to, sdp, candidate }) => {
        io.to(to).emit('rtc-signal', { sdp, candidate });
    });

    // 5. GESTION DE LA DÉCONNEXION VOLONTAIRE
    socket.on('rtc-disconnect', ({ to }) => {
        io.to(to).emit('rtc-disconnect');
    });

    socket.on('disconnect', () => {
        // Nettoyage automatique si un appareil se ferme brusquement
        for (const code in pendingConnections) {
            if (pendingConnections[code].viewerId === socket.id || pendingConnections[code].streamerId === socket.id) {
                const target = pendingConnections[code].viewerId === socket.id ? pendingConnections[code].streamerId : pendingConnections[code].viewerId;
                if (target) io.to(target).emit('rtc-disconnect');
                delete pendingConnections[code];
            }
        }
    });
});

// Adaptation dynamique du port pour Render
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Serveur CamLink Pro actif sur le port ${PORT}`));

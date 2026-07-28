// Stockage dynamique des codes actifs
const activeCodes = {};

// 1. Génération du code
socket.on('request-code', (data) => {
    // Génère un code à 6 chiffres
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // On enregistre le socket, le code et LE TYPE STRICT ("camera" ou "screen")
    activeCodes[code] = {
        socketId: socket.id,
        type: data.type
    };

    // On renvoie le code au récepteur
    socket.emit('code-generated', code);
});

// 2. Vérification du code par l'émetteur
socket.on('verify-code', ({ code, deviceName, type }) => {
    const target = activeCodes[code];

    // VÉRIFICATION 1 : Est-ce que le code existe ?
    if (!target) {
        socket.emit('error-message', 'Code invalide ou expiré.');
        return;
    }

    // VÉRIFICATION 2 : SÉCURITÉ STRICTE DU TYPE (Bloque immédiatement si ça ne correspond pas)
    if (target.type !== type) {
        // On retourne délibérément le message "Code invalide" pour ne donner aucune info
        socket.emit('error-message', 'Code invalide pour ce mode de diffusion.');
        return;
    }

    // Si le type correspond PARFAITEMENT, on demande la permission au récepteur
    io.to(target.socketId).emit('ask-permission', { 
        streamerId: socket.id, 
        streamerName: deviceName 
    });
});

// Nettoyage automatique des codes quand un utilisateur se déconnecte
socket.on('disconnect', () => {
    for (const code in activeCodes) {
        if (activeCodes[code].socketId === socket.id) {
            delete activeCodes[code];
        }
    }
});

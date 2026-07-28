// Stockage des codes avec leur type (ex: { "123456": { socketId: "...", type: "camera" } })
const activeCodes = {};

socket.on('request-code', (data) => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // On enregistre le socket ET le type de flux (camera ou screen)
    activeCodes[code] = {
        socketId: socket.id,
        type: data.type
    };

    socket.emit('code-generated', code);
});

socket.on('verify-code', ({ code, deviceName, type }) => {
    const target = activeCodes[code];

    if (!target) {
        socket.emit('error-message', 'Code invalide ou expiré.');
        return;
    }

    // VÉRIFICATION DU TYPE : Bloque si les deux appareils ne sont pas sur le même mode
    if (target.type !== type) {
        const modeAttendu = target.type === 'camera' ? 'Caméra' : 'Partage d\'écran';
        socket.emit('error-message', `Incompatibilité : Le récepteur est en mode ${modeAttendu}.`);
        return;
    }

    // Si tout est bon, on demande la permission au récepteur
    io.to(target.socketId).emit('ask-permission', { 
        streamerId: socket.id, 
        streamerName: deviceName 
    });
});

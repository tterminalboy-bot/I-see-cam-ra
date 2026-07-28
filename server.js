async function confirmAndStartStream() {
    // 1. Demande d'avertissement et de consentement à l'utilisateur
    const userConsent = confirm(
        "Autorisez-vous l'application à capturer et diffuser votre écran ?\n\n" +
        "Assurez-vous de ne pas afficher d'informations confidentielles."
    );

    // Si l'utilisateur clique sur "Annuler"
    if (!userConsent) {
        alert("Diffusion annulée par l'utilisateur.");
        goBack();
        return;
    }

    switchScreen('mobile-streaming-screen');
    const success = await startMediaStream();
    
    if (!success) {
        goBack();
        return;
    }

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('rtc-signal', { to: targetDeviceID, sdp: peerConnection.localDescription });
}

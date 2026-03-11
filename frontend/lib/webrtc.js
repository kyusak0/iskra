export function createPeerConnection(sendSignal) {
    const pc = new RTCPeerConnection({
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" }
        ]
    });

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            sendSignal('call_ice', {
                candidate: event.candidate
            });
        }
    };

    return pc;
}
// Lobby state logic for Bomberman frontend
// No UI, just core logic

class LobbyState {
    constructor() {
        this.lobbyId = null;
        this.name = null;
        this.players = {};
        this.maxPlayers = 4;
        this.minPlayers = 2;
        this.gameStarted = false;
        this.createdAt = null;
        this.messages = [];
        this.waitTimer = 20;
        this.startTimer = 10;
        this.host = null;
        this.status = 'waiting';
    }

    updateFromPayload(payload) {
        if (payload.lobby) {
            Object.assign(this, payload.lobby);
        }
        if (payload.playerCount !== undefined) {
            this.playerCount = payload.playerCount;
        }
        if (payload.status !== undefined) {
            this.status = payload.status;
        }
        if (payload.timeLeft !== undefined) {
            this.timeLeft = payload.timeLeft;
        }
    }
}

// Export for use in other frontend modules
if (typeof module !== 'undefined') {
    module.exports = LobbyState;
}

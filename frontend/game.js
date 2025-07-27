// Game logic for Bomberman frontend
// No UI, just core logic

class Game {
    constructor() {
        this.players = {};
        this.map = [];
        this.started = false;
        this.startTime = null;
    }

    start(gameStartPayload) {
        this.started = true;
        this.startTime = gameStartPayload.startTime;
        this.map = gameStartPayload.map;
        this.players = gameStartPayload.players;
    }

    updatePlayer(playerId, data) {
        if (this.players[playerId]) {
            Object.assign(this.players[playerId], data);
        }
    }

    end() {
        this.started = false;
        this.map = [];
        this.players = {};
        this.startTime = null;
    }
}

// Export for use in other frontend modules
if (typeof module !== 'undefined') {
    module.exports = Game;
}

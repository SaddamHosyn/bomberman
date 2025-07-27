// Chat logic for Bomberman frontend
// No UI, just core logic

class Chat {
    constructor() {
        this.messages = [];
    }

    addMessage({ id, playerId, nickname, message, timestamp, type }) {
        this.messages.push({ id, playerId, nickname, message, timestamp, type });
        // Keep only last 50 messages
        if (this.messages.length > 50) {
            this.messages = this.messages.slice(-50);
        }
    }

    getHistory() {
        return this.messages;
    }
}

// Export for use in other frontend modules
if (typeof module !== 'undefined') {
    module.exports = Chat;
}

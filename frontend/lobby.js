// Lobby logic for Bomberman frontend
// No UI, just core logic and event handling

class Lobby {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.playerId = null;
        this.nickname = null;
        this.lobbyState = null;
        this.connected = false;
        this.eventHandlers = {};
    }

    connect(nickname) {
        this.nickname = nickname;
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            this.connected = true;
            this._emit('connected');
        };

        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this._handleMessage(message);
        };

        this.ws.onclose = () => {
            this.connected = false;
            this._emit('disconnected');
        };

        this.ws.onerror = (error) => {
            this._emit('error', error);
        };
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
    }

    joinLobby() {
        if (!this.connected || !this.nickname) return;
        const msg = {
            type: 'join_lobby',
            payload: {
                nickname: this.nickname,
                playerId: this.playerId
            }
        };
        this.ws.send(JSON.stringify(msg));
    }

    sendChat(message) {
        if (!this.connected) return;
        const msg = {
            type: 'chat_message',
            payload: { message }
        };
        this.ws.send(JSON.stringify(msg));
    }

    requestLobbyStatus() {
        if (!this.connected) return;
        const msg = {
            type: 'lobby_status',
            payload: {}
        };
        this.ws.send(JSON.stringify(msg));
    }

    sendPing() {
        if (!this.connected) return;
        const msg = {
            type: 'ping',
            payload: {}
        };
        this.ws.send(JSON.stringify(msg));
    }

    on(event, handler) {
        this.eventHandlers[event] = handler;
    }

    _emit(event, data) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event](data);
        }
    }

    _handleMessage(message) {
        switch (message.type) {
            case 'success':
                if (message.payload.playerId) {
                    this.playerId = message.payload.playerId;
                }
                this._emit('success', message.payload);
                break;
            case 'error':
                this._emit('error', message.payload);
                break;
            case 'player_joined':
                this._emit('player_joined', message.payload);
                break;
            case 'player_left':
                this._emit('player_left', message.payload);
                break;
            case 'lobby_update':
            case 'lobby_status':
                this.lobbyState = message.payload;
                this._emit('lobby_update', message.payload);
                break;
            case 'chat_message':
                this._emit('chat_message', message.payload);
                break;
            case 'game_start':
                this._emit('game_start', message.payload);
                break;
            case 'pong':
                this._emit('pong', message.payload);
                break;
            default:
                this._emit('unknown', message);
        }
    }
}

// Export for use in other frontend modules
if (typeof module !== 'undefined') {
    module.exports = Lobby;
}

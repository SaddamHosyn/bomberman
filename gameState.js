/**
 * @fileoverview WebSocket Game State Manager for Bomberman DOM
 * @author Chan
 */

/**
 * GameState class - manages the real WebSocket connection to backend
 */
export class GameState {
    constructor() {
        this.state = {
            currentScreen: 'nickname',
            nickname: '',
            playerId: null,
            players: [],
            messages: [],
            waitingTimer: null,
            gameTimer: null,
            maxPlayers: 4,
            minPlayers: 2,
            error: null,
            chatError: null,
            isJoining: false,
            isConnected: false
        };
        this.listeners = [];
        this.websocket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    /**
     * Subscribe to state changes
     */
    subscribe(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(listener => listener !== callback);
        };
    }

    /**
     * Update state and notify listeners
     */
    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.notifyListeners();
    }

    /**
     * Get current state
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Notify all listeners of state change
     */
    notifyListeners() {
        this.listeners.forEach(listener => {
            try {
                listener(this.state);
            } catch (error) {
                console.error('Error in state listener:', error);
            }
        });
    }

    /**
     * Connect to WebSocket server and join game
     */
connectAndJoinGame(nickname) {
    console.log('Connecting to WebSocket with nickname:', nickname);
    
    this.setState({
        isJoining: true,
        error: null
    });

    // FIXED: No nickname in URL - send it in message instead
    const wsUrl = `ws://localhost:8080/ws/lobby`;
    
    try {
        this.websocket = new WebSocket(wsUrl);
        
        this.websocket.onopen = () => {
            console.log('WebSocket connected');
            this.setState({
                isConnected: true,
                nickname: nickname
            });
            
            // CRITICAL: Send join_lobby message to actually join the lobby
            const joinMessage = {
                type: 'join_lobby',
                data: {
                    nickname: nickname  
                }
            };
            
            console.log('📤 SENDING JOIN LOBBY MESSAGE:', joinMessage);
            this.websocket.send(JSON.stringify(joinMessage));
            this.reconnectAttempts = 0;
        };













            this.websocket.onmessage = (event) => {
                this.handleWebSocketMessage(event);
            };

            this.websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.setState({
                    error: 'Connection error. Please try again.',
                    isJoining: false,
                    isConnected: false
                });
            };

            this.websocket.onclose = (event) => {
                console.log('WebSocket closed:', event.code, event.reason);
                this.setState({
                    isConnected: false
                });
                
                // Auto-reconnect if it wasn't a clean close
                if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.attemptReconnect();
                } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                    this.setState({
                        error: 'Connection lost. Please refresh the page.',
                        currentScreen: 'nickname'
                    });
                }
            };

        } catch (error) {
            console.error('Failed to create WebSocket:', error);
            this.setState({
                error: 'Failed to connect to server. Please try again.',
                isJoining: false,
                isConnected: false
            });
        }
    }

    /**
     * Handle incoming WebSocket messages
     */
handleWebSocketMessage(event) {
    try {
        const message = JSON.parse(event.data);
        console.log('=== RECEIVED MESSAGE DEBUG ===');
        console.log('Type:', message.type);
        console.log('Data/Data:', message.data || message.Data);
        console.log('Full message:', message);
        console.log('==============================');

        // Handle both 'data' and 'Data' for compatibility
        const messageData = message.data || message.Data || {};

        switch (message.type) {
    case 'success':
    console.log('✅ Success message:', messageData);
    
    // Handle initial connection success  
    if (messageData.message?.includes('Connected successfully - please provide nickname')) {
        console.log('📡 Connected to WebSocket, join_lobby message sent');
    }
    // Handle lobby join success
    else if (messageData.message?.includes('Joined lobby successfully')) {
        console.log('🎉 SUCCESSFULLY JOINED LOBBY!');
        console.log('👥 Player count now:', messageData.playerCount);
        
        // Create player object for the joined user
        const currentPlayer = {
            id: messageData.playerId,
            WebSocketID: messageData.playerId,
            nickname: messageData.nickname,
            lives: 3,
            isHost: false
        };
        
        this.setState({
            currentScreen: 'waiting',
            isJoining: false,
            playerId: messageData.playerId,
            players: [currentPlayer]  // Initialize with current player
        });
    }
    break;


                
            case 'lobby_update':
                this.handleLobbyUpdate(messageData);
                break;
            
            case 'chat_message':
                this.handleChatMessage(messageData);
                break;
            
            case 'chat_history':
                this.handleChatHistory(messageData);
                break;
            
            case 'timer_update':
                this.handleTimerUpdate(messageData);
                break;
            
            case 'game_start':
                this.handleGameStart(messageData);
                break;
            
            case 'error':
                this.handleError(messageData);
                break;
            
            default:
                console.warn('⚠️ Unknown message type:', message.type, messageData);
        }
    } catch (error) {
        console.error('❌ Error parsing WebSocket message:', error);
        console.log('Raw message data:', event.data);
    }
}



    /**
     * Handle lobby update from server
     */
/**
 * Handle lobby update from server - FIXED to extract timer data
 */


/**
 * Handle lobby update from server - FIXED field names and data extraction
 */
handleLobbyUpdate(data) {
    console.log('🏠 Lobby update data received:', data);
    console.log('🚨 === TIMER DEBUG START ===');
    console.log('FULL DATA RECEIVED:', JSON.stringify(data, null, 2));
    console.log('data.status:', data.status);        // ← FIXED: lowercase
    console.log('data.timeLeft:', data.timeLeft);    // ← FIXED: lowercase
    console.log('data.playerCount:', data.playerCount); // ← FIXED: lowercase
    console.log('🚨 === TIMER DEBUG END ===');
    
    // Extract players from nested lobby object
    let players = [];
    if (data.lobby && data.lobby.players) {
        players = Object.values(data.lobby.players).map(player => ({
            id: player.webSocketId,
            WebSocketID: player.webSocketId,
            nickname: player.Name,  // Backend uses 'Name'
            lives: player.Lives,
            isHost: data.lobby.host === player.webSocketId
        }));
    }
    
    // Extract timer data - FIXED: Use lowercase field names
    let waitingTimer = null;
    let gameTimer = null;
    
    if (data.status === "waiting_for_players" && data.timeLeft > 0) {
        waitingTimer = data.timeLeft;  // 20-second wait timer
        console.log('⏳ SETTING WAITING TIMER:', waitingTimer);
    } else if (data.status === "starting" && data.timeLeft > 0) {
        gameTimer = data.timeLeft;     // 10-second game start timer
        console.log('🎮 SETTING GAME TIMER:', gameTimer);
    }
    
    console.log('📊 Timer Update:', {
        status: data.status,           // ← FIXED: lowercase
        timeLeft: data.timeLeft,       // ← FIXED: lowercase
        waitingTimer,
        gameTimer,
        playerCount: data.playerCount  // ← FIXED: lowercase
    });
    
    this.setState({
        players: players,              // ← NOW PROPERLY EXTRACTED
        playerId: data.your_player_id || data.player_id || this.state.playerId,
        waitingTimer: waitingTimer,    // ← NOW PROPERLY SET
        gameTimer: gameTimer,          // ← NOW PROPERLY SET
    });
}








/**
 * Handle player joined events - NEW
 */
handlePlayerJoined(data) {
    console.log('👤 Player joined:', data);
    
    if (data.Player) {
        // Convert backend player format to frontend format
        const newPlayer = {
            id: data.Player.WebSocketID,
            WebSocketID: data.Player.WebSocketID,
            nickname: data.Player.Name,  // Backend uses 'Name'
            lives: data.Player.Lives,
            isHost: false
        };
        
        // Add/update the player in the list
        const updatedPlayers = this.state.players.filter(p => 
            p.WebSocketID !== newPlayer.WebSocketID
        );
        updatedPlayers.push(newPlayer);
        
        this.setState({
            players: updatedPlayers
        });
    }
}



















    /**
     * Handle new chat message from server
     */
/**
 * Handle new chat message from server - FIXED field mapping
 */
/**
 * Handle new chat message from server - FIXED field mapping
 */
handleChatMessage(data) {
    console.log('🗨️ Processing chat message:', data);
    
    // Backend sends: Nickname, Message, Timestamp (capitalized)
    const author = data.Nickname || data.nickname || data.author || 'Unknown';
    const text = data.Message || data.message || data.text || '';
    
    if (!text) {
        console.warn('⚠️ Empty chat message received:', data);
        return;
    }

    const newMessage = {
        id: data.ID || Date.now() + Math.random(),
        author: author,
        text: text,
        timestamp: data.Timestamp ? new Date(data.Timestamp) : new Date()
    };

    console.log('✅ Adding message to chat:', newMessage);
    
    this.setState({
        messages: [...this.state.messages, newMessage],
        chatError: null
    });
}



/**
    /**
     * Handle chat history from server
     */
    handleChatHistory(data) {
        const messages = (data.messages || []).map((msg, index) => ({
            id: msg.id || Date.now() + index,
            author: msg.author || msg.nickname,
            text: msg.message || msg.text,
            timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
        }));

        this.setState({
            messages: messages
        });
    }

    /**
     * Handle timer updates from server
     */
    handleTimerUpdate(data) {
        this.setState({
            waitingTimer: data.waiting_timer,
            gameTimer: data.game_timer
        });
    }

    /**
     * Handle game start from server
     */
    handleGameStart(data) {
        this.setState({
            currentScreen: 'game',
            waitingTimer: null,
            gameTimer: null
        });
        console.log('Game starting with data:', data);
    }

    /**
     * Handle error from server
     */
handleError(data) {
    console.log('Error data received:', data); // Add debugging
    this.setState({
        error: data.message || data.error || 'An error occurred',
        isJoining: false
    });
}
    /**
     * Send chat message to server
     */
 sendChatMessage(message) {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
        console.error('❌ WebSocket not connected');
        this.setState({
            chatError: 'Not connected to server'
        });
        return;
    }

    if (!message || message.trim().length === 0) {
        console.warn('⚠️ Empty message, not sending');
        return;
    }

    const chatMessage = {
        type: 'chat_message',
        data: {
            message: message.trim()
        }
    };

    console.log('📤 Sending chat message:', chatMessage);

    try {
        this.websocket.send(JSON.stringify(chatMessage));
        console.log('✅ Chat message sent successfully');
        this.setState({
            chatError: null
        });
    } catch (error) {
        console.error('❌ Error sending chat message:', error);
        this.setState({
            chatError: 'Failed to send message'
        });
    }
}



    /**
     * Leave the game/lobby
     */
    leaveGame() {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.close(1000, 'User left game');
        }
        this.resetToNickname();
    }

    /**
     * Attempt to reconnect to WebSocket
     */
    attemptReconnect() {
        this.reconnectAttempts++;
        console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        
        setTimeout(() => {
            if (this.state.nickname) {
                this.connectAndJoinGame(this.state.nickname);
            }
        }, 2000 * this.reconnectAttempts); // Exponential backoff
    }

    /**
     * Reset to nickname screen
     */
    resetToNickname() {
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }

        this.setState({
            currentScreen: 'nickname',
            nickname: '',
            playerId: null,
            players: [],
            messages: [],
            waitingTimer: null,
            gameTimer: null,
            error: null,
            chatError: null,
            isJoining: false,
            isConnected: false
        });
        
        this.reconnectAttempts = 0;
    }

    /**
     * Clean up when destroyed
     */
    destroy() {
        if (this.websocket) {
            this.websocket.close();
        }
        this.listeners = [];
    }
}

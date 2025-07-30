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
            sessionId: null,
            players: [],
            messages: [],
            waitingTimer: null,
            gameTimer: null,
            maxPlayers: 4,
            minPlayers: 2,
            error: null,
            chatError: null,
            isJoining: false,
            isConnected: false,
            isReconnecting: false,
            lastSyncTimestamp: null
        };
        this.listeners = [];
        this.websocket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        this.sessionRestoreTimeout = null;
        this.isSessionRestoreActive = false;
        
        // Only try session restore if we're not explicitly starting fresh
        if (!this.shouldStartFresh()) {
            this.tryRestoreSession();
        } else {
            console.log('🔸 Starting fresh session');
            this.setState({ currentScreen: 'nickname' });
        }
    }

    /**
     * Check if we should start fresh (bypass session restore)
     */
    shouldStartFresh() {
        // Check if there's a URL parameter or flag to start fresh
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('fresh') === 'true' || sessionStorage.getItem('force_fresh') === 'true';
    }

    /**
     * Generate session ID
     */
    generateSessionId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        return `session_${timestamp}_${random}`;
    }

    /**
     * Save session to localStorage
     */
    saveSession(sessionData) {
        const sessionInfo = {
            sessionId: sessionData.sessionId,
            nickname: sessionData.nickname,
            playerId: sessionData.playerId,
            lobbyId: sessionData.lobbyId,
            currentScreen: this.state.currentScreen,
            timestamp: Date.now(),
            lastSyncTimestamp: this.state.lastSyncTimestamp
        };
        localStorage.setItem('bomberman_session', JSON.stringify(sessionInfo));
        console.log('💾 Session saved:', sessionInfo);
    }

    /**
     * Get stored session
     */
    getStoredSession() {
        try {
            const stored = localStorage.getItem('bomberman_session');
            if (!stored) return null;
            
            const session = JSON.parse(stored);
            const oneHourAgo = Date.now() - (60 * 60 * 1000); // 1 hour expiry instead of 2
            
            if (session.timestamp < oneHourAgo) {
                console.log('⏰ Session expired, clearing...');
                this.clearSession();
                return null;
            }
            
            return session;
        } catch (error) {
            console.error('Error reading session:', error);
            this.clearSession();
            return null;
        }
    }

    /**
     * Try to restore session on page load
     */
    tryRestoreSession() {
        const session = this.getStoredSession();
        if (session && !this.isSessionRestoreActive) {
            console.log('🔄 Found existing session, attempting restore:', session);
            this.isSessionRestoreActive = true;
            
            this.setState({
                nickname: session.nickname,
                playerId: session.playerId,
                sessionId: session.sessionId,
                currentScreen: 'connecting',
                isReconnecting: true,
                lastSyncTimestamp: session.lastSyncTimestamp
            });
            
            // Set a 5-second timeout for session restoration
            this.sessionRestoreTimeout = setTimeout(() => {
                console.log('⏰ Session restoration timeout - falling back to fresh start');
                this.forceStartFresh('Session restoration timeout');
            }, 5000);
            
            this.reconnectWithSession(session);
        } else {
            console.log('🔸 No valid session found or restore already active');
            this.setState({ currentScreen: 'nickname' });
        }
    }

    /**
     * Force start fresh session
     */
    forceStartFresh(reason) {
        console.log('🆕 Forcing fresh start:', reason);
        
        this.isSessionRestoreActive = false;
        
        if (this.sessionRestoreTimeout) {
            clearTimeout(this.sessionRestoreTimeout);
            this.sessionRestoreTimeout = null;
        }
        
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.close();
        }
        
        this.clearSession();
        sessionStorage.setItem('force_fresh', 'true');
        
        this.setState({
            currentScreen: 'nickname',
            nickname: '',
            playerId: null,
            sessionId: null,
            players: [],
            messages: [],
            waitingTimer: null,
            gameTimer: null,
            error: null,
            isReconnecting: false,
            isConnected: false,
            isJoining: false
        });
        
        this.reconnectAttempts = 0;
    }

    /**
     * Enhanced connection with session support
     */
    connectAndJoinGame(nickname) {
        console.log('🔗 Connecting to WebSocket with nickname:', nickname);
        
        // Clear fresh start flag
        sessionStorage.removeItem('force_fresh');
        
        // Clear any existing session restore timeout
        if (this.sessionRestoreTimeout) {
            clearTimeout(this.sessionRestoreTimeout);
            this.sessionRestoreTimeout = null;
        }
        
        this.setState({
            isJoining: true,
            error: null,
            isReconnecting: false
        });

        const wsUrl = `ws://localhost:8080/ws/lobby`;
        
        try {
            // Close existing connection if any
            if (this.websocket) {
                this.websocket.close();
            }
            
            this.websocket = new WebSocket(wsUrl);
            
            this.websocket.onopen = () => {
                console.log('✅ WebSocket connected');
                this.setState({
                    isConnected: true,
                    nickname: nickname
                });
                
                // Generate new session ID for fresh connection
                const sessionId = this.generateSessionId();
                this.setState({ sessionId: sessionId });
                
                const joinMessage = {
                    type: 'join_lobby',
                    data: {
                        nickname: nickname,
                        sessionId: sessionId,
                        isNewSession: true
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
                console.error('❌ WebSocket error:', error);
                this.setState({
                    error: 'Connection error. Please try again.',
                    isJoining: false,
                    isConnected: false
                });
            };

            this.websocket.onclose = (event) => {
                console.log('🔌 WebSocket closed:', event.code, event.reason);
                this.setState({
                    isConnected: false
                });
                
                // Only auto-reconnect for unexpected closes, not manual closes
                if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts && !this.isSessionRestoreActive) {
                    setTimeout(() => this.attemptReconnect(), 2000 * (this.reconnectAttempts + 1));
                }
            };

        } catch (error) {
            console.error('❌ Failed to create WebSocket:', error);
            this.setState({
                error: 'Failed to connect to server. Please try again.',
                isJoining: false,
                isConnected: false
            });
        }
    }

    /**
     * Reconnect with existing session
     */
    reconnectWithSession(session) {
        console.log('🔄 Attempting session reconnection...');
        
        this.setState({
            isReconnecting: true,
            error: null
        });

        const wsUrl = `ws://localhost:8080/ws/lobby`;
        
        try {
            if (this.websocket) {
                this.websocket.close();
            }
            
            this.websocket = new WebSocket(wsUrl);
            
            this.websocket.onopen = () => {
                console.log('✅ WebSocket connected for session restore');
                this.setState({
                    isConnected: true
                });
                
                const reconnectMessage = {
                    type: 'reconnect_session',
                    data: {
                        sessionId: session.sessionId,
                        playerId: session.playerId,
                        nickname: session.nickname,
                        lastSyncTimestamp: session.lastSyncTimestamp || 0
                    }
                };
                
                console.log('📤 SENDING SESSION RECONNECT:', reconnectMessage);
                this.websocket.send(JSON.stringify(reconnectMessage));
            };
            
            this.websocket.onmessage = (event) => {
                this.handleWebSocketMessage(event);
            };

            this.websocket.onerror = (error) => {
                console.error('❌ Session reconnection failed:', error);
                this.forceStartFresh('Session reconnection error');
            };

            this.websocket.onclose = (event) => {
                console.log('🔌 Session reconnect WebSocket closed:', event.code);
                if (event.code !== 1000 && this.isSessionRestoreActive) {
                    this.forceStartFresh('Session reconnect connection closed');
                }
            };

        } catch (error) {
            console.error('❌ Session reconnection error:', error);
            this.forceStartFresh('Session reconnection exception');
        }
    }

    /**
     * Enhanced message handling
     */
    handleWebSocketMessage(event) {
        try {
            const message = JSON.parse(event.data);
            console.log('=== RECEIVED MESSAGE DEBUG ===');
            console.log('Type:', message.type);
            console.log('Data:', message.data);
            console.log('==============================');

            this.setState({ lastSyncTimestamp: Date.now() });

            const messageData = message.data || message.Data || {};

            switch (message.type) {
                case 'success':
                    this.handleSuccessMessage(messageData);
                    break;

                case 'session_restored':
                    this.handleSessionRestored(messageData);
                    break;

                case 'missed_events':
                    this.handleMissedEvents(messageData);
                    break;

                case 'player_joined':
                    this.handlePlayerJoined(messageData);
                    break;
                    
                case 'player_left':
                    this.handlePlayerLeft(messageData);
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
                    console.warn('⚠️ Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('❌ Error parsing WebSocket message:', error);
        }
    }

    /**
     * Handle success messages
     */
    handleSuccessMessage(messageData) {
        console.log('✅ Success message:', messageData);
        
        // Clear session restore timeout on any success
        if (this.sessionRestoreTimeout) {
            clearTimeout(this.sessionRestoreTimeout);
            this.sessionRestoreTimeout = null;
        }
        this.isSessionRestoreActive = false;
        
        if (messageData.message?.includes('Connected successfully - please provide nickname')) {
            console.log('📡 Connected to WebSocket, join_lobby message sent');
        }
        else if (messageData.message?.includes('Joined lobby successfully')) {
            console.log('🎉 SUCCESSFULLY JOINED LOBBY!');
            
            // Save session after successful join
            this.saveSession({
                sessionId: this.state.sessionId || messageData.sessionId,
                nickname: messageData.nickname,
                playerId: messageData.playerId,
                lobbyId: messageData.lobbyId
            });
            
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
                isReconnecting: false,
                playerId: messageData.playerId,
                players: [currentPlayer],
                error: null
            });
        }
    }

    /**
     * Handle session restored message
     */
    handleSessionRestored(messageData) {
        console.log('🔄 Session restored successfully:', messageData);
        
        if (this.sessionRestoreTimeout) {
            clearTimeout(this.sessionRestoreTimeout);
            this.sessionRestoreTimeout = null;
        }
        this.isSessionRestoreActive = false;
        
        // Update session with latest data
        this.saveSession({
            sessionId: messageData.sessionId,
            nickname: messageData.nickname,
            playerId: messageData.playerId,
            lobbyId: messageData.lobbyId
        });
        
        this.setState({
            currentScreen: messageData.currentScreen || 'waiting',
            isReconnecting: false,
            playerId: messageData.playerId,
            players: messageData.players || [],
            messages: messageData.messages || [],
            waitingTimer: messageData.waitingTimer,
            gameTimer: messageData.gameTimer,
            error: null
        });
    }

    /**
     * Handle missed events
     */
    handleMissedEvents(messageData) {
        console.log('📥 Processing missed events:', messageData);
        
        const events = messageData.events || [];
        events.forEach(event => {
            console.log('⚡ Replaying event:', event);
            
            switch (event.type) {
                case 'player_joined':
                    this.handlePlayerJoined(event.data);
                    break;
                case 'player_left':
                    this.handlePlayerLeft(event.data);
                    break;
                case 'chat_message':
                    this.handleChatMessage(event.data);
                    break;
                case 'lobby_update':
                    this.handleLobbyUpdate(event.data);
                    break;
                case 'game_start':
                    this.handleGameStart(event.data);
                    break;
            }
        });
    }

    /**
     * Handle lobby update
     */
    handleLobbyUpdate(data) {
        console.log('🏠 Lobby update data received:', data);
        
        let players = [];
        if (data.lobby && data.lobby.players) {
            players = Object.values(data.lobby.players).map(player => ({
                id: player.webSocketId,
                WebSocketID: player.webSocketId,
                nickname: player.Name,
                lives: player.Lives,
                isHost: data.lobby.host === player.webSocketId
            }));
        }
        
        let waitingTimer = null;
        let gameTimer = null;
        
        if (data.status === "waiting_for_players" && data.timeLeft > 0) {
            waitingTimer = data.timeLeft;
            console.log('⏳ SETTING WAITING TIMER:', waitingTimer);
        } else if (data.status === "starting" && data.timeLeft > 0) {
            gameTimer = data.timeLeft;
            console.log('🎮 SETTING GAME TIMER:', gameTimer);
        }
        
        this.setState({
            players: players,
            playerId: data.your_player_id || data.player_id || this.state.playerId,
            waitingTimer: waitingTimer,
            gameTimer: gameTimer,
        });
    }

    /**
     * Handle player joined
     */
    handlePlayerJoined(data) {
        console.log('👤 Player joined:', data);
        
        if (data.Player) {
            const newPlayer = {
                id: data.Player.WebSocketID,
                WebSocketID: data.Player.WebSocketID,
                nickname: data.Player.Name,
                lives: data.Player.Lives,
                isHost: false
            };
            
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
     * Handle player left
     */
    handlePlayerLeft(data) {
        console.log('👋 Player left:', data);
        
        const updatedPlayers = this.state.players.filter(p => 
            p.WebSocketID !== data.playerId
        );
        
        this.setState({
            players: updatedPlayers
        });
    }

    /**
     * Handle chat message
     */
    handleChatMessage(data) {
        console.log('🗨️ Processing chat message:', data);
        
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
     * Handle chat history
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
     * Handle timer updates
     */
    handleTimerUpdate(data) {
        this.setState({
            waitingTimer: data.waiting_timer,
            gameTimer: data.game_timer
        });
    }

    /**
     * Handle game start
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
     * Handle error messages
     */
    handleError(data) {
        console.log('❌ Error data received:', data);
        
        // If session-related error during reconnection, force fresh start
        if (this.state.isReconnecting && (
            data.message?.includes('Session not found') || 
            data.message?.includes('Session expired') ||
            data.message?.includes('Invalid session') ||
            data.message?.includes('Nickname already taken')
        )) {
            console.log('🔄 Session error during reconnection, forcing fresh start');
            this.forceStartFresh('Session validation failed: ' + data.message);
            return;
        }
        
        this.setState({
            error: data.message || data.error || 'An error occurred',
            isJoining: false
        });
    }

    /**
     * Clear session
     */
    clearSession() {
        localStorage.removeItem('bomberman_session');
        console.log('🗑️ Session cleared');
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
     * Notify all listeners
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
     * Send chat message
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
     * Leave game
     */
    leaveGame() {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.close(1000, 'User left game');
        }
        this.resetToNickname();
    }

    /**
     * Attempt reconnect
     */
    attemptReconnect() {
        this.reconnectAttempts++;
        console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        
        if (this.state.nickname && !this.isSessionRestoreActive) {
            setTimeout(() => {
                this.connectAndJoinGame(this.state.nickname);
            }, 1000);
        }
    }

    /**
     * Reset to nickname screen
     */
    resetToNickname() {
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }

        if (this.sessionRestoreTimeout) {
            clearTimeout(this.sessionRestoreTimeout);
            this.sessionRestoreTimeout = null;
        }

        this.isSessionRestoreActive = false;
        sessionStorage.removeItem('force_fresh');

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
            isConnected: false,
            isReconnecting: false
        });
        
        this.reconnectAttempts = 0;
    }

    /**
     * Clean up
     */
    destroy() {
        if (this.websocket) {
            this.websocket.close();
        }
        if (this.sessionRestoreTimeout) {
            clearTimeout(this.sessionRestoreTimeout);
        }
        sessionStorage.removeItem('force_fresh');
        this.listeners = [];
    }
}

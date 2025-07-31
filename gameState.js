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
            isConnected: false,
            isReconnecting: false
        };
        this.listeners = [];
        this.websocket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
    }

   
    forceStartFresh(reason) {
        console.log('🆕 Forcing fresh start:', reason);
        
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.close();
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
            isReconnecting: false,
            isConnected: false,
            isJoining: false
        });
        
        this.reconnectAttempts = 0;
    }

    /**
     * Connect and join game with nickname
     */
    connectAndJoinGame(nickname) {
        console.log('🔗 Connecting to WebSocket with nickname:', nickname);
        
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
                if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
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
     * Enhanced message handling
     */
    handleWebSocketMessage(event) {
        try {
            const message = JSON.parse(event.data);
            console.log('=== RECEIVED MESSAGE DEBUG ===');
            console.log('Type:', message.type);
            console.log('Data:', message.data);
            console.log('==============================');

            const messageData = message.data || message.Data || {};

            switch (message.type) {
                case 'success':
                    this.handleSuccessMessage(messageData);
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
                
                case 'game_state_update':
                    this.handleGameStateUpdate(messageData);
                    break;
                
                case 'game_update':
                    console.log('🔄 Processing game_update message');
                    this.handleGameUpdate(messageData);
                    console.log('✅ game_update processed successfully');
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

        if (messageData.message?.includes('Connected successfully - please provide nickname')) {
            console.log('📡 Connected to WebSocket, join_lobby message sent');
        }
        else if (messageData.message?.includes('Joined lobby successfully')) {
            console.log('🎉 SUCCESSFULLY JOINED LOBBY!');

            // Use the players list from server if available, otherwise create current player
            let players = [];
            if (messageData.players && Array.isArray(messageData.players)) {
                players = messageData.players.map((p, index) => ({
                    id: p.WebSocketID || p.id,
                    WebSocketID: p.WebSocketID || p.id,
                    nickname: p.nickname,
                    lives: p.lives || 3,
                    isHost: p.isHost || false,
                    position: this.getStartingPosition(index),
                    alive: true
                }));
            } else {
                // Fallback: just add current player
                players = [{
                    id: messageData.playerId,
                    WebSocketID: messageData.playerId,
                    nickname: messageData.nickname,
                    lives: 3,
                    position: this.getStartingPosition(0),
                    alive: true,
                    isHost: messageData.isHost || false
                }];
            }

            this.setState({
                currentScreen: 'waiting',
                isJoining: false,
                isReconnecting: false,
                playerId: messageData.playerId,
                players: players, // Use the full players list from server
                error: null
            });
        }
    }

    /**
     * Handle lobby update
     */
    handleLobbyUpdate(data) {
        console.log('🏠 Lobby update data received:', data);
        
        let players = [];
        if (data.lobby && data.lobby.players) {
            players = Object.values(data.lobby.players).map((player, index) => ({
                id: player.webSocketId,
                WebSocketID: player.webSocketId,
                nickname: player.Name,
                lives: player.Lives,
                isHost: data.lobby.host === player.webSocketId,
                position: this.getStartingPosition(index),
                alive: true
            }));
        }
        
        let waitingTimer = null;
        let gameTimer = null;
        
        // Handle different lobby statuses - but DON'T auto-transition to game
        if (data.status === "waiting_for_players" && data.timeLeft > 0) {
            waitingTimer = data.timeLeft;
            console.log('⏳ SETTING WAITING TIMER:', waitingTimer);
        } else if (data.status === "starting" && data.timeLeft > 0) {
            gameTimer = data.timeLeft;
            console.log('🎮 SETTING GAME TIMER:', gameTimer);
        } else if (data.status === "playing") {
            // Game is in progress, but let game_start or game_state_update handle the transition
            console.log('🎮 Game is playing - waiting for game_start message to transition');
            waitingTimer = null;
            gameTimer = null;
        }
        
        this.setState({
            players: players,
            playerId: data.your_player_id || data.player_id || this.state.playerId,
            waitingTimer: waitingTimer,
            gameTimer: gameTimer
        });
    }

    /**
     * Handle player joined
     */
    handlePlayerJoined(data) {
        console.log('👤 Player joined:', data);
        
        if (data.Player) {
            const currentPlayers = this.state.players || [];
            const newPlayer = {
                id: data.Player.WebSocketID,
                WebSocketID: data.Player.WebSocketID,
                nickname: data.Player.Name,
                lives: data.Player.Lives,
                isHost: false,
                position: this.getStartingPosition(currentPlayers.length),
                alive: true
            };

            // Don't add if it's the current player (avoid duplicates)
            if (newPlayer.WebSocketID === this.state.playerId) {
                console.log('👤 Ignoring self-join message');
                return;
            }

            // Remove any existing player with same ID and add new one
            const updatedPlayers = this.state.players.filter(p =>
                p.WebSocketID !== newPlayer.WebSocketID
            );
            updatedPlayers.push(newPlayer);

            this.setState({
                players: updatedPlayers
            });

            console.log('👤 Updated players list:', updatedPlayers);
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
        console.log('⏱️ Timer update received:', data);
        
        // Only transition when we get explicit game_timer of 0 AND we're in countdown phase
        if (data.game_timer === 0 && this.state.gameTimer > 0 && this.state.currentScreen !== 'game') {
            console.log('🎮 Game countdown finished - transitioning to game');
            this.setState({
                currentScreen: 'game',
                waitingTimer: null,
                gameTimer: null
            });
        } else {
            this.setState({
                waitingTimer: data.waiting_timer,
                gameTimer: data.game_timer
            });
        }
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
        
        this.setState({
            error: data.message || data.error || 'An error occurred',
            isJoining: false
        });
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
     * Attempt reconnect
     */
    attemptReconnect() {
        this.reconnectAttempts++;
        console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        
        if (this.state.nickname) {
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
     * Send player move to server
     */
    sendPlayerMove(direction) {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            const moveMessage = {
                type: 'player_move',
                data: {
                    direction: direction
                }
            };
            console.log('📤 SENDING PLAYER MOVE:', moveMessage);
            this.websocket.send(JSON.stringify(moveMessage));
        } else {
            console.warn('⚠️ Cannot send move - WebSocket not connected');
        }
    }

    /**
     * Send bomb placement to server
     */
    sendPlaceBomb() {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            const bombMessage = {
                type: 'place_bomb',
                data: {}
            };
            console.log('📤 SENDING PLACE BOMB:', bombMessage);
            this.websocket.send(JSON.stringify(bombMessage));
        } else {
            console.warn('⚠️ Cannot place bomb - WebSocket not connected');
        }
    }

    /**
     * Handle game state updates from server
     */
    handleGameStateUpdate(data) {
        console.log('🎮 Game state update:', data);
        
        this.setState({
            gameMap: data.map,
            players: data.players,
            bombs: data.bombs,
            flames: data.flames,
            powerUps: data.powerUps,
            gameStatus: data.status,
            winner: data.winner,
            currentPlayer: data.players?.find(p => p.id === this.state.playerId)
        });
    }

    /**
     * Handle game update messages from server
     */
    handleGameUpdate(data) {
        console.log('🎮 Game update received:', data);
        
        try {
            if (data.type === 'player_move') {
                console.log(`Player ${data.player_id} moved ${data.direction}`);
                
                // Update player position in local state
                const updatedPlayers = [...(this.state.players || [])];
                const playerIndex = updatedPlayers.findIndex(p => p.id === data.player_id);
                
                if (playerIndex >= 0) {
                    const player = updatedPlayers[playerIndex];
                    const currentPos = player.position || { x: 1, y: 1 };
                    let newPos = { ...currentPos };
                    
                    // Calculate new position based on direction
                    switch (data.direction) {
                        case 'up':
                            newPos.y = Math.max(0, currentPos.y - 1);
                            break;
                        case 'down':
                            newPos.y = Math.min(12, currentPos.y + 1); // Assuming 13 height (0-12)
                            break;
                        case 'left':
                            newPos.x = Math.max(0, currentPos.x - 1);
                            break;
                        case 'right':
                            newPos.x = Math.min(14, currentPos.x + 1); // Assuming 15 width (0-14)
                            break;
                    }
                    
                    // COLLISION DETECTION: Check if new position is valid
                    if (this.isValidPosition(newPos)) {
                        // Update player position
                        updatedPlayers[playerIndex] = {
                            ...player,
                            position: newPos
                        };
                        
                        console.log(`🎯 Player ${data.player_id} moved from (${currentPos.x},${currentPos.y}) to (${newPos.x},${newPos.y})`);
                        
                        // Check for power-up collection
                        this.checkPowerUpCollection(data.player_id, newPos);
                        
                        // IMPORTANT: Force complete re-render to clear ghost players
                        this.setState({
                            players: updatedPlayers,
                            lastUpdate: Date.now() // Force re-render
                        });
                    } else {
                        console.log(`🚫 Player ${data.player_id} cannot move to (${newPos.x},${newPos.y}) - blocked!`);
                        // Don't update position if blocked
                    }
                }
                
                // Find player number for consistent CSS class matching
                const players = this.state.players || [];
                const sortedPlayerIds = players.map(p => p.id).sort();
                const playerIndex2 = sortedPlayerIds.indexOf(data.player_id);
                const playerNumber = playerIndex2 >= 0 ? playerIndex2 + 1 : 1;
                
                console.log(`🎯 Player ${data.player_id} mapped to player number ${playerNumber}`);
                
                // Add temporary movement animation to the player
                const playerElements = document.querySelectorAll(`.player.player-${playerNumber}`);
                console.log(`🎨 Found ${playerElements.length} player elements with class .player.player-${playerNumber}`);
                
                playerElements.forEach(element => {
                    element.classList.add('moving');
                    setTimeout(() => {
                        element.classList.remove('moving');
                    }, 300); // Remove after animation completes
                });
            } else if (data.type === 'bomb_placed') {
                console.log(`Player ${data.player_id} placed a bomb`);
                
                // Find player who placed the bomb
                const player = this.state.players?.find(p => p.id === data.player_id);
                if (player && player.position) {
                    // Check if player hasn't exceeded bomb limit
                    const currentBombs = this.state.bombs || [];
                    const playerBombs = currentBombs.filter(b => b.ownerId === data.player_id);
                    const maxBombs = player.maxBombs || 1;
                    
                    if (playerBombs.length >= maxBombs) {
                        console.log(`⚠️ Player ${data.player_id} has reached bomb limit (${maxBombs})`);
                        return;
                    }
                    
                    const newBomb = {
                        id: `bomb_${Date.now()}_${Math.random()}`,
                        position: { ...player.position },
                        ownerId: data.player_id,
                        timer: 3, // 3 seconds until explosion
                        timestamp: Date.now()
                    };
                    
                    this.setState({
                        bombs: [...currentBombs, newBomb]
                    });
                    
                    console.log(`💣 Bomb placed at (${player.position.x}, ${player.position.y}) (${playerBombs.length + 1}/${maxBombs})`);
                    
                    // Start bomb countdown timer
                    setTimeout(() => {
                        this.explodeBomb(newBomb.id);
                    }, 3000);
                }
            }
            
            // Update game state if needed
            this.setState({
                lastUpdate: data.timestamp || Date.now()
            });
            
            console.log('✅ handleGameUpdate completed successfully');
        } catch (error) {
            console.error('❌ Error in handleGameUpdate:', error);
            throw error; // Re-throw to see if this is causing the issue
        }
    }

    /**
     * Handle bomb explosion
     */
    explodeBomb(bombId) {
        console.log(`💥 Exploding bomb: ${bombId}`);
        
        const bombs = this.state.bombs || [];
        const bomb = bombs.find(b => b.id === bombId);
        
        if (!bomb) {
            console.warn(`⚠️ Bomb ${bombId} not found for explosion`);
            return;
        }
        
        // Remove the bomb from state
        const remainingBombs = bombs.filter(b => b.id !== bombId);
        
        // Find bomb owner to get their flame range
        const bombOwner = this.state.players?.find(p => p.id === bomb.ownerId);
        const flameRange = bombOwner?.flameRange || 2;
        
        console.log(`🔥 Bomb explosion with range ${flameRange} for player ${bomb.ownerId}`);
        
        // Create flame pattern (cross shape with player's range)
        const flames = [];
        const { x, y } = bomb.position;
        
        // Center flame
        flames.push({
            id: `flame_${Date.now()}_center`,
            position: { x, y },
            timestamp: Date.now()
        });
        
        // Horizontal flames
        for (let i = 1; i <= flameRange; i++) {
            flames.push({
                id: `flame_${Date.now()}_right_${i}`,
                position: { x: x + i, y },
                timestamp: Date.now()
            });
            flames.push({
                id: `flame_${Date.now()}_left_${i}`,
                position: { x: x - i, y },
                timestamp: Date.now()
            });
        }
        
        // Vertical flames
        for (let i = 1; i <= flameRange; i++) {
            flames.push({
                id: `flame_${Date.now()}_up_${i}`,
                position: { x, y: y - i },
                timestamp: Date.now()
            });
            flames.push({
                id: `flame_${Date.now()}_down_${i}`,
                position: { x, y: y + i },
                timestamp: Date.now()
            });
        }
        
        // Filter flames that are within map boundaries
        const validFlames = flames.filter(f => 
            f.position.x >= 0 && f.position.x < 15 && 
            f.position.y >= 0 && f.position.y < 13
        );
        
        // Check for player damage
        this.checkPlayerDamage(validFlames);
        
        // Check for block destruction
        this.checkBlockDestruction(validFlames);
        
        // Update state with explosion
        this.setState({
            bombs: remainingBombs,
            flames: [...(this.state.flames || []), ...validFlames],
            lastUpdate: Date.now() // Force re-render
        });
        
        console.log(`🔥 Added ${validFlames.length} flames, total flames: ${[...(this.state.flames || []), ...validFlames].length}`);
        
        // Remove flames after 800ms (shorter for less ghosting)
        setTimeout(() => {
            const currentFlames = this.state.flames || [];
            const remainingFlames = currentFlames.filter(f => 
                !validFlames.some(vf => vf.id === f.id)
            );
            console.log(`🧹 Cleaning up flames: ${currentFlames.length} → ${remainingFlames.length}`);
            this.setState({ 
                flames: remainingFlames,
                lastUpdate: Date.now() // Force re-render
            });
        }, 800);
    }

    /**
     * Check if any players are damaged by flames
     */
    checkPlayerDamage(flames) {
        const players = [...(this.state.players || [])];
        let playersUpdated = false;
        
        players.forEach(player => {
            if (!player.alive) return;
            
            const playerInFlame = flames.some(flame => 
                flame.position.x === player.position?.x && 
                flame.position.y === player.position?.y
            );
            
            if (playerInFlame) {
                player.lives = Math.max(0, (player.lives || 3) - 1);
                player.alive = player.lives > 0;
                playersUpdated = true;
                
                console.log(`💀 Player ${player.nickname} hit by explosion! Lives: ${player.lives}`);
                
                if (!player.alive) {
                    console.log(`☠️ Player ${player.nickname} eliminated!`);
                }
            }
        });
        
        if (playersUpdated) {
            this.setState({ players });
            
            // Check for game over
            const alivePlayers = players.filter(p => p.alive);
            if (alivePlayers.length <= 1) {
                console.log(`🏆 Game over! Winner: ${alivePlayers[0]?.nickname || 'None'}`);
                // TODO: Handle game over
            }
        }
    }

    /**
     * Check if flames destroy any blocks and spawn power-ups
     */
    checkBlockDestruction(flames) {
        if (!this.state.gameBoard) return;
        
        const board = this.state.gameBoard.map(row => [...row]);
        const newPowerUps = [...(this.state.powerUps || [])];
        let boardUpdated = false;
        
        flames.forEach(flame => {
            const { x, y } = flame.position;
            
            if (x >= 0 && x < board[0].length && y >= 0 && y < board.length) {
                // Check if there's a destructible block
                if (board[y][x] === 'B') {
                    board[y][x] = '.'; // Destroy block
                    boardUpdated = true;
                    console.log(`💥 Block destroyed at (${x}, ${y})`);
                    
                    // 30% chance to spawn power-up
                    if (Math.random() < 0.3) {
                        const powerUpTypes = ['speed', 'bombs', 'flames'];
                        const randomType = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
                        
                        newPowerUps.push({
                            position: { x, y },
                            type: randomType,
                            id: `power_${Date.now()}_${x}_${y}`
                        });
                        
                        console.log(`⚡ Power-up ${randomType} spawned at (${x}, ${y})`);
                    }
                }
            }
        });
        
        if (boardUpdated) {
            this.setState({
                gameBoard: board,
                powerUps: newPowerUps
            });
        }
    }

    /**
     * Check if a position is valid (not blocked by walls/blocks)
     */
    isValidPosition(position) {
        const { x, y } = position;
        
        // Check bounds
        if (x < 0 || x >= 15 || y < 0 || y >= 13) {
            return false;
        }
        
        // Check for walls (fixed walls are at even coordinates)
        if (x % 2 === 0 && y % 2 === 0) {
            return false;
        }
        
        // Check border walls
        if (x === 0 || x === 14 || y === 0 || y === 12) {
            return false;
        }
        
        // Check for destructible blocks
        if (this.state.gameBoard) {
            if (this.state.gameBoard[y] && this.state.gameBoard[y][x] === 'B') {
                return false;
            }
        }
        
        // Check for bombs
        const bombs = this.state.bombs || [];
        if (bombs.some(bomb => bomb.position.x === x && bomb.position.y === y)) {
            return false;
        }
        
        return true;
    }

    /**
     * Check if a player collected a power-up
     */
    checkPowerUpCollection(playerId, position) {
        const powerUps = [...(this.state.powerUps || [])];
        const players = [...(this.state.players || [])];
        
        // Find power-up at player's position
        const powerUpIndex = powerUps.findIndex(p => 
            p.position.x === position.x && p.position.y === position.y
        );
        
        if (powerUpIndex >= 0) {
            const powerUp = powerUps[powerUpIndex];
            const playerIndex = players.findIndex(p => p.id === playerId);
            
            if (playerIndex >= 0) {
                const player = players[playerIndex];
                
                // Apply power-up effect
                switch (powerUp.type) {
                    case 'speed':
                        player.speed = Math.min(5, (player.speed || 1) + 1);
                        console.log(`⚡ Player ${playerId} gained speed! New speed: ${player.speed}`);
                        break;
                    case 'bombs':
                        player.maxBombs = Math.min(8, (player.maxBombs || 1) + 1);
                        console.log(`💣 Player ${playerId} can place more bombs! Max: ${player.maxBombs}`);
                        break;
                    case 'flames':
                        player.flameRange = Math.min(8, (player.flameRange || 2) + 1);
                        console.log(`🔥 Player ${playerId} has bigger explosions! Range: ${player.flameRange}`);
                        break;
                }
                
                // Remove collected power-up
                powerUps.splice(powerUpIndex, 1);
                
                // Update state
                this.setState({
                    players: players,
                    powerUps: powerUps
                });
                
                console.log(`⭐ Player ${playerId} collected ${powerUp.type} power-up!`);
            }
        }
    }

    /**
     * Get starting position for a player based on their index
     */
    getStartingPosition(playerIndex) {
        const startingPositions = [
            { x: 1, y: 1 },     // Player 1: Top-left corner
            { x: 13, y: 1 },    // Player 2: Top-right corner  
            { x: 1, y: 11 },    // Player 3: Bottom-left corner
            { x: 13, y: 11 }    // Player 4: Bottom-right corner
        ];
        
        return startingPositions[playerIndex % 4] || startingPositions[0];
    }

    /**
     * Clean up
     */
    destroy() {
        if (this.websocket) {
            this.websocket.close();
        }
        this.listeners = [];
    }
}

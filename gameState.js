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

        const wsUrl = `ws://localhost:8080/ws`;
        
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
                    this.handleGameUpdate(messageData);
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
        if (messageData.message?.includes('Joined lobby successfully')) {
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
                players: players,
                error: null
            });
        }
    }

    /**
     * Handle lobby update
     */
    handleLobbyUpdate(data) {
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
        
        // Handle different lobby statuses
        if (data.status === "waiting_for_players" && data.timeLeft > 0) {
            waitingTimer = data.timeLeft;
        } else if (data.status === "starting" && data.timeLeft > 0) {
            gameTimer = data.timeLeft;
        } else if (data.status === "playing") {
            waitingTimer = null;
            gameTimer = null;
        }
        
        // If we're on game screen but still getting lobby updates, go back to waiting room
        let currentScreen = this.state.currentScreen;
        if (currentScreen === 'game' && data.status !== 'playing') {
            currentScreen = 'waiting';
        }
        
        this.setState({
            currentScreen: currentScreen,
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
        
        // DON'T automatically transition to game screen here
        // Wait for the actual game_start message from backend
        if (data.game_timer === 0 && this.state.gameTimer > 0) {
            console.log('🎮 Game countdown finished - waiting for game_start message from backend');
        }
        
        this.setState({
            waitingTimer: data.waiting_timer,
            gameTimer: data.game_timer
        });
    }

    /**
     * Handle game start
     */
    handleGameStart(data) {
        console.log('🎮 Game starting with data:', data);
        
        // Parse the backend game state if provided
        let gameState = {};
        if (data && data.Players) {
            // Map backend players to frontend format
            const players = data.Players.map((player, index) => ({
                id: player.ID,
                WebSocketID: player.ID,
                nickname: player.Name,
                lives: player.Lives,
                position: {
                    x: player.Position.X,  // Map X -> x
                    y: player.Position.Y   // Map Y -> y
                },
                alive: player.Alive,
                bombCount: player.BombCount || 1,
                flameRange: player.FlameRange || 1,
                speed: player.Speed || 0
            }));
            
            gameState = {
                players: players,
                gameMap: {
                    width: data.Map?.Width || 15,
                    height: data.Map?.Height || 13,
                    walls: (data.Map?.Walls || []).map(wall => ({
                        position: {
                            x: wall.Position.X,  // Map X -> x
                            y: wall.Position.Y   // Map Y -> y
                        }
                    })),
                    blocks: (data.Map?.Blocks || []).map(block => ({
                        position: {
                            x: block.Position.X,  // Map X -> x
                            y: block.Position.Y   // Map Y -> y
                        },
                        destroyed: block.Destroyed || false,
                        hiddenPowerUp: block.HiddenPowerUp
                    }))
                },
                bombs: (data.Bombs || []).map(bomb => ({
                    id: bomb.ID,
                    position: {
                        x: bomb.Position.X,  // Map X -> x
                        y: bomb.Position.Y   // Map Y -> y
                    },
                    ownerId: bomb.OwnerID,
                    timer: bomb.Timer,
                    timestamp: Date.now()
                })),
                powerUps: (data.PowerUps || []).map(powerUp => ({
                    id: powerUp.ID,
                    position: {
                        x: powerUp.Position.X,  // Map X -> x
                        y: powerUp.Position.Y   // Map Y -> y
                    },
                    type: powerUp.Type
                })),
                gameStatus: data.Status || 'in_progress'
            };
            
            console.log('🧱 Walls:', gameState.gameMap.walls.length);
            console.log('📦 Blocks:', gameState.gameMap.blocks.length);
            console.log('👥 Players:', gameState.players.map(p => `${p.nickname} at (${p.position.x},${p.position.y})`));
        }
        
        this.setState({
            currentScreen: 'game',
            waitingTimer: null,
            gameTimer: null,
            ...gameState
        });
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
        // Map backend game state format to frontend format
        let updateData = {};
        
        if (data.Players) {
            updateData.players = data.Players.map(player => ({
                id: player.ID,
                WebSocketID: player.ID,
                nickname: player.Name,
                lives: player.Lives,
                position: {
                    x: player.Position.X,  // Map X -> x
                    y: player.Position.Y   // Map Y -> y
                },
                alive: player.Alive,
                bombCount: player.BombCount || 1,
                flameRange: player.FlameRange || 1,
                speed: player.Speed || 0
            }));
        }
        
        if (data.Map) {
            updateData.gameMap = {
                width: data.Map.Width || 15,
                height: data.Map.Height || 13,
                walls: (data.Map.Walls || []).map(wall => ({
                    position: {
                        x: wall.Position.X,  // Map X -> x
                        y: wall.Position.Y   // Map Y -> y
                    }
                })),
                blocks: (data.Map.Blocks || []).map(block => ({
                    position: {
                        x: block.Position.X,  // Map X -> x
                        y: block.Position.Y   // Map Y -> y
                    },
                    destroyed: block.Destroyed || false,
                    hiddenPowerUp: block.HiddenPowerUp
                }))
            };
        }
        
        if (data.Bombs) {
            updateData.bombs = data.Bombs.map(bomb => ({
                id: bomb.ID,
                position: {
                    x: bomb.Position.X,  // Map X -> x
                    y: bomb.Position.Y   // Map Y -> y
                },
                ownerId: bomb.OwnerID,
                timer: bomb.Timer,
                timestamp: Date.now()
            }));
        }
        
        if (data.Flames) {
            updateData.flames = data.Flames.map(flame => ({
                id: flame.ID,
                position: {
                    x: flame.Position.X,  // Map X -> x
                    y: flame.Position.Y   // Map Y -> y
                },
                timestamp: Date.now()
            }));
        }
        
        if (data.PowerUps) {
            updateData.powerUps = data.PowerUps.map(powerUp => ({
                id: powerUp.ID,
                position: {
                    x: powerUp.Position.X,  // Map X -> x
                    y: powerUp.Position.Y   // Map Y -> y
                },
                type: powerUp.Type
            }));
        }
        
        updateData.gameStatus = data.Status || 'in_progress';
        updateData.lastUpdate = Date.now();
        
        if (updateData.players) {
            updateData.currentPlayer = updateData.players.find(p => p.id === this.state.playerId);
        }
        
        this.setState(updateData);
    }

    /**
     * Handle game update messages from server
     */
    handleGameUpdate(data) {
        try {
            if (data.type === 'player_move') {
                console.log(`🚶 ${data.player_id} moved ${data.direction}`);
                
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
                            newPos.y = Math.min(12, currentPos.y + 1);
                            break;
                        case 'left':
                            newPos.x = Math.max(0, currentPos.x - 1);
                            break;
                        case 'right':
                            newPos.x = Math.min(14, currentPos.x + 1);
                            break;
                    }
                    
                    // COLLISION DETECTION: Check if new position is valid
                    if (this.isValidPosition(newPos)) {
                        // Update player position
                        updatedPlayers[playerIndex] = {
                            ...player,
                            position: newPos
                        };
                        
                        console.log(`👤 ${player.nickname}: (${currentPos.x},${currentPos.y}) → (${newPos.x},${newPos.y})`);
                        
                        // Check for power-up collection
                        this.checkPowerUpCollection(data.player_id, newPos);
                        
                        // Force complete re-render to clear ghost players
                        this.setState({
                            players: updatedPlayers,
                            lastUpdate: Date.now()
                        });
                    } else {
                        console.log(`🚫 ${player.nickname} blocked at (${newPos.x},${newPos.y})`);
                    }
                }
            } else if (data.type === 'bomb_placed') {
                console.log(`💣 ${data.player_id} placed bomb - backend will handle state update`);
                // Don't create frontend bombs - wait for backend game_state_update
            }
            
            // Update game state if needed
            this.setState({
                lastUpdate: data.timestamp || Date.now()
            });
        } catch (error) {
            console.error('❌ Error in handleGameUpdate:', error);
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
        
        // Check for walls (boundary walls AND internal grid walls)
        if (x === 0 || x === 14 || y === 0 || y === 12) {
            return false; // Boundary walls
        }
        if (x % 2 === 0 && y % 2 === 0) {
            return false; // Internal grid walls
        }
        
        // Check walls from gameMap (in case backend sends different wall pattern)
        const gameMap = this.state.gameMap;
        if (gameMap && gameMap.walls) {
            const wallAtPosition = gameMap.walls.find(wall => 
                wall.position.x === x && wall.position.y === y
            );
            if (wallAtPosition) {
                return false;
            }
        }
        
        // Check for non-destroyed blocks from gameMap
        if (gameMap && gameMap.blocks) {
            const blockingBlock = gameMap.blocks.find(block => 
                block.position.x === x && 
                block.position.y === y && 
                !block.destroyed  // Only non-destroyed blocks block movement
            );
            if (blockingBlock) {
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

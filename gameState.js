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
      currentScreen: "nickname",
      nickname: "",
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
      isReconnecting: false,
    };
    this.listeners = [];
    this.websocket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
  }

  forceStartFresh(reason) {
    console.log("🆕 Forcing fresh start:", reason);

    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.close();
    }

    this.setState({
      currentScreen: "nickname",
      nickname: "",
      playerId: null,
      players: [],
      messages: [],
      waitingTimer: null,
      gameTimer: null,
      error: null,
      isReconnecting: false,
      isConnected: false,
      isJoining: false,
    });

    this.reconnectAttempts = 0;
  }

  /**
   * Connect and join game with nickname
   */
  connectAndJoinGame(nickname) {
    console.log("🔗 Connecting to WebSocket with nickname:", nickname);

    this.setState({
      isJoining: true,
      error: null,
      isReconnecting: false,
    });

    const wsUrl = `ws://localhost:8080/ws`;

    try {
      // Close existing connection if any
      if (this.websocket) {
        this.websocket.close();
      }

      this.websocket = new WebSocket(wsUrl);

      this.websocket.onopen = () => {
        console.log("✅ WebSocket connected");
        this.setState({
          isConnected: true,
          nickname: nickname,
        });

        const joinMessage = {
          type: "join_lobby",
          data: {
            nickname: nickname,
          },
        };

        console.log("📤 SENDING JOIN LOBBY MESSAGE:", joinMessage);
        this.websocket.send(JSON.stringify(joinMessage));
        this.reconnectAttempts = 0;
      };

      this.websocket.onmessage = (event) => {
        this.handleWebSocketMessage(event);
      };

      this.websocket.onerror = (error) => {
        console.error("❌ WebSocket error:", error);
        this.setState({
          error: "Connection error. Please try again.",
          isJoining: false,
          isConnected: false,
        });
      };

      this.websocket.onclose = (event) => {
        console.log("🔌 WebSocket closed:", event.code, event.reason);
        this.setState({
          isConnected: false,
        });

        // Only auto-reconnect for unexpected closes, not manual closes
        if (
          event.code !== 1000 &&
          this.reconnectAttempts < this.maxReconnectAttempts
        ) {
          setTimeout(
            () => this.attemptReconnect(),
            2000 * (this.reconnectAttempts + 1)
          );
        }
      };
    } catch (error) {
      console.error("❌ Failed to create WebSocket:", error);
      this.setState({
        error: "Failed to connect to server. Please try again.",
        isJoining: false,
        isConnected: false,
      });
    }
  }

  /**
   * Enhanced message handling
   */
  handleWebSocketMessage(event) {
    try {
      const message = JSON.parse(event.data);
      console.log("=== RECEIVED MESSAGE DEBUG ===");
      console.log("Type:", message.type);
      console.log("Data:", message.data);
      console.log("==============================");

      const messageData = message.data || message.Data || {};

      switch (message.type) {
        case "success":
          this.handleSuccessMessage(messageData);
          break;

        case "player_joined":
          this.handlePlayerJoined(messageData);
          break;

        case "player_left":
          this.handlePlayerLeft(messageData);
          break;

        case "lobby_update":
          this.handleLobbyUpdate(messageData);
          break;

        case "chat_message":
          this.handleChatMessage(messageData);
          break;

        case "chat_history":
          this.handleChatHistory(messageData);
          break;

        case "timer_update":
          this.handleTimerUpdate(messageData);
          break;

        case "game_start":
          this.handleGameStart(messageData);
          break;

        case "game_state_update":
          this.handleGameStateUpdate(messageData);
          break;

        case "error":
          this.handleError(messageData);
          break;

        default:
          console.warn("⚠️ Unknown message type:", message.type);
      }
    } catch (error) {
      console.error("❌ Error parsing WebSocket message:", error);
    }
  }

  /**
   * Handle success messages
   */
  handleSuccessMessage(messageData) {
    console.log("✅ Success message:", messageData);

    if (
      messageData.message?.includes(
        "Connected successfully - please provide nickname"
      )
    ) {
      console.log("📡 Connected to WebSocket, join_lobby message sent");
    } else if (messageData.message?.includes("Joined lobby successfully")) {
      console.log("🎉 SUCCESSFULLY JOINED LOBBY!");

      // Use the players list from server if available, otherwise create current player
      let players = [];
      if (messageData.players && Array.isArray(messageData.players)) {
        players = messageData.players.map((p) => ({
          id: p.WebSocketID || p.id,
          WebSocketID: p.WebSocketID || p.id,
          nickname: p.nickname,
          lives: p.lives || 3,
          isHost: p.isHost || false,
        }));
      } else {
        // Fallback: just add current player
        players = [
          {
            id: messageData.playerId,
            WebSocketID: messageData.playerId,
            nickname: messageData.nickname,
            lives: 3,
            isHost: messageData.isHost || false,
          },
        ];
      }

      this.setState({
        currentScreen: "waiting",
        isJoining: false,
        isReconnecting: false,
        playerId: messageData.playerId,
        players: players, // Use the full players list from server
        error: null,
      });
    }
  }

  /**
   * Handle lobby update
   */
  handleLobbyUpdate(data) {
    console.log("🏠 Lobby update data received:", data);

    let players = [];
    if (data.lobby && data.lobby.players) {
      players = Object.values(data.lobby.players).map((player) => ({
        id: player.webSocketId,
        WebSocketID: player.webSocketId,
        nickname: player.Name,
        lives: player.Lives,
        isHost: data.lobby.host === player.webSocketId,
      }));
    }

    let waitingTimer = null;
    let gameTimer = null;

    if (data.status === "waiting_for_players" && data.timeLeft > 0) {
      waitingTimer = data.timeLeft;
      console.log("⏳ SETTING WAITING TIMER:", waitingTimer);
    } else if (data.status === "starting" && data.timeLeft > 0) {
      gameTimer = data.timeLeft;
      console.log("🎮 SETTING GAME TIMER:", gameTimer);
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
    console.log("👤 Player joined:", data);

    if (data.Player) {
      const newPlayer = {
        id: data.Player.WebSocketID,
        WebSocketID: data.Player.WebSocketID,
        nickname: data.Player.Name,
        lives: data.Player.Lives,
        isHost: false,
      };

      // Don't add if it's the current player (avoid duplicates)
      if (newPlayer.WebSocketID === this.state.playerId) {
        console.log("👤 Ignoring self-join message");
        return;
      }

      // Remove any existing player with same ID and add new one
      const updatedPlayers = this.state.players.filter(
        (p) => p.WebSocketID !== newPlayer.WebSocketID
      );
      updatedPlayers.push(newPlayer);

      this.setState({
        players: updatedPlayers,
      });

      console.log("👤 Updated players list:", updatedPlayers);
    }
  }

  /**
   * Handle player left
   */
  handlePlayerLeft(data) {
    console.log("👋 Player left:", data);

    const updatedPlayers = this.state.players.filter(
      (p) => p.WebSocketID !== data.playerId
    );

    this.setState({
      players: updatedPlayers,
    });
  }

  /**
   * Handle chat message
   */
  handleChatMessage(data) {
    console.log("🗨️ Processing chat message:", data);

    const author = data.Nickname || data.nickname || data.author || "Unknown";
    const text = data.Message || data.message || data.text || "";

    if (!text) {
      console.warn("⚠️ Empty chat message received:", data);
      return;
    }

    const newMessage = {
      id: data.ID || Date.now() + Math.random(),
      author: author,
      text: text,
      timestamp: data.Timestamp ? new Date(data.Timestamp) : new Date(),
    };

    console.log("✅ Adding message to chat:", newMessage);

    this.setState({
      messages: [...this.state.messages, newMessage],
      chatError: null,
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
      timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
    }));

    this.setState({
      messages: messages,
    });
  }

  /**
   * Handle timer updates
   */
  handleTimerUpdate(data) {
    this.setState({
      waitingTimer: data.waiting_timer,
      gameTimer: data.game_timer,
    });
  }

  /**
   * Handle game start
   */
  handleGameStart(data) {
    this.setState({
      currentScreen: "game",
      waitingTimer: null,
      gameTimer: null,
    });
    console.log("Game starting with data:", data);
  }

  /**
   * Handle game state updates from backend
   */
  handleGameStateUpdate(data) {
    console.log("🎮 Game state update received:", data);
    
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
    
    // Handle bombs - clear array when null/undefined
    if (data.Bombs) {
      updateData.bombs = data.Bombs
        .filter(bomb => bomb.Timer > 0) // Only include active bombs
        .map(bomb => ({
          id: bomb.ID,
          position: {
            x: bomb.Position.X,  // Map X -> x
            y: bomb.Position.Y   // Map Y -> y
          },
          ownerId: bomb.OwnerID,
          timer: bomb.Timer,
          timestamp: Date.now()
        }));
    } else if (data.Bombs === null) {
      // Explicitly clear bombs when backend sends null
      updateData.bombs = [];
    }
    
    // Handle flames - clear array when null/undefined
    if (data.Flames) {
      updateData.flames = data.Flames.map(flame => ({
        id: flame.ID,
        position: {
          x: flame.Position.X,  // Map X -> x
          y: flame.Position.Y   // Map Y -> y
        },
        timestamp: Date.now()
      }));
    } else if (data.Flames === null) {
      // Explicitly clear flames when backend sends null
      updateData.flames = [];
    }
    
    // Handle power-ups - clear array when null/undefined
    if (data.PowerUps) {
      updateData.powerUps = data.PowerUps.map(powerUp => ({
        id: powerUp.ID,
        position: {
          x: powerUp.Position.X,  // Map X -> x
          y: powerUp.Position.Y   // Map Y -> y
        },
        type: powerUp.Type
      }));
    } else if (data.PowerUps === null) {
      // Explicitly clear power-ups when backend sends null
      updateData.powerUps = [];
    }
    
    // Map numeric status to string values
    const statusMap = {
      0: 'waiting_for_players', // WaitingForPlayers
      1: 'countdown',           // Countdown
      2: 'in_progress',         // InProgress
      3: 'finished'             // Finished
    };
    updateData.gameStatus = statusMap[data.Status] || 'in_progress';
    updateData.lastUpdate = Date.now();
    
    // Handle winner information
    if (data.Winner) {
      updateData.winner = {
        id: data.Winner.ID,
        name: data.Winner.Name,
        nickname: data.Winner.Nickname,
        score: data.Winner.Score || 0
      };
    }
    
    if (updateData.players) {
      updateData.currentPlayer = updateData.players.find(p => p.id === this.state.playerId);
    }
    
    this.setState(updateData);
  }

  /**
   * Handle error messages
   */
  handleError(data) {
    console.log("❌ Error data received:", data);

    this.setState({
      error: data.message || data.error || "An error occurred",
      isJoining: false,
    });
  }

  /**
   * Subscribe to state changes
   */
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(
        (listener) => listener !== callback
      );
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
    this.listeners.forEach((listener) => {
      try {
        listener(this.state);
      } catch (error) {
        console.error("Error in state listener:", error);
      }
    });
  }

  /**
   * Send chat message
   */
  sendChatMessage(message) {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      console.error("❌ WebSocket not connected");
      this.setState({
        chatError: "Not connected to server",
      });
      return;
    }

    if (!message || message.trim().length === 0) {
      console.warn("⚠️ Empty message, not sending");
      return;
    }

    const chatMessage = {
      type: "chat_message",
      data: {
        message: message.trim(),
      },
    };

    console.log("📤 Sending chat message:", chatMessage);

    try {
      this.websocket.send(JSON.stringify(chatMessage));
      console.log("✅ Chat message sent successfully");
      this.setState({
        chatError: null,
      });
    } catch (error) {
      console.error("❌ Error sending chat message:", error);
      this.setState({
        chatError: "Failed to send message",
      });
    }
  }

  /**
   * Send player movement command
   */
  sendPlayerMove(direction) {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      console.error("❌ WebSocket not connected for movement");
      return;
    }

    const moveMessage = {
      type: "player_move",
      data: {
        direction: direction
      }
    };

    console.log("📤 Sending move command:", moveMessage);

    try {
      this.websocket.send(JSON.stringify(moveMessage));
    } catch (error) {
      console.error("❌ Error sending move command:", error);
    }
  }

  /**
   * Send bomb placement command
   */
  sendPlaceBomb() {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      console.error("❌ WebSocket not connected for bomb placement");
      return;
    }

    const bombMessage = {
      type: "place_bomb",
      data: {}
    };

    console.log("📤 Sending bomb command:", bombMessage);

    try {
      this.websocket.send(JSON.stringify(bombMessage));
    } catch (error) {
      console.error("❌ Error sending bomb command:", error);
    }
  }

  /**
   * Attempt reconnect
   */
  attemptReconnect() {
    this.reconnectAttempts++;
    console.log(
      `🔄 Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`
    );

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
      currentScreen: "nickname",
      nickname: "",
      playerId: null,
      players: [],
      messages: [],
      waitingTimer: null,
      gameTimer: null,
      error: null,
      chatError: null,
      isJoining: false,
      isConnected: false,
      isReconnecting: false,
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
    this.listeners = [];
  }
}

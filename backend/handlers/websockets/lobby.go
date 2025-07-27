package websockets

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"bomber/backend/models"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins in development
	},
}

// LobbyHandler manages all lobby-related WebSocket operations
type LobbyHandler struct {
	hub   *models.Hub
	lobby *models.Lobby // Single lobby for all players
}

// NewLobbyHandler creates a new lobby handler
func NewLobbyHandler() *LobbyHandler {
	hub := &models.Hub{
		Players:    make(map[string]*models.WebSocketPlayer),
		Register:   make(chan *models.WebSocketPlayer),
		Unregister: make(chan *models.WebSocketPlayer),
		Broadcast:  make(chan *models.WebSocketMessage),
	}

	// Create a single lobby for all players
	singleLobby := &models.Lobby{
		ID:          "main_lobby",
		Name:        "Main Game Lobby",
		Players:     make(map[string]*models.WebSocketPlayer),
		MaxPlayers:  4, // Changed to 4 as per requirements
		MinPlayers:  2,
		GameStarted: false,
		CreatedAt:   time.Now(),
		Messages:    make([]models.ChatMessage, 0),
		WaitTimer:   20, // 20 second wait timer
		StartTimer:  10, // 10 second start timer
		Host:        "",
		Status:      "waiting",
	}

	lobbyHandler := &LobbyHandler{
		hub:   hub,
		lobby: singleLobby,
	}

	go lobbyHandler.run()
	return lobbyHandler
}

// run starts the hub's main event loop
func (lh *LobbyHandler) run() {
	for {
		select {
		case player := <-lh.hub.Register:
			lh.registerPlayer(player)

		case player := <-lh.hub.Unregister:
			lh.unregisterPlayer(player)

		case message := <-lh.hub.Broadcast:
			lh.broadcastMessage(message)
		}
	}
}

// ServeWS handles WebSocket connection upgrades
func (lh *LobbyHandler) ServeWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	// Create new player
	player := &models.WebSocketPlayer{
		WebSocketID: generatePlayerID(),
		Conn:        conn,
		Send:        make(chan []byte, 256),
		IsConnected: true,
		IsActive:    true,
		JoinedAt:    time.Now(),
	}

	// Register player with hub
	lh.hub.Register <- player

	// Start goroutines for this player
	go lh.writePump(player)
	go lh.readPump(player)
}

// Hub Methods

func (lh *LobbyHandler) registerPlayer(player *models.WebSocketPlayer) {
	lh.hub.Mutex.Lock()
	defer lh.hub.Mutex.Unlock()

	lh.hub.Players[player.WebSocketID] = player
	log.Printf("Player %s connected", player.WebSocketID)

	// Send welcome message (but don't add to lobby yet - they need to send join_lobby with nickname)
	welcomeMsg := &models.WebSocketMessage{
		Type: models.MSG_SUCCESS,
		Data: map[string]interface{}{
			"message":     "Connected successfully - please provide nickname to join lobby",
			"playerId":    player.WebSocketID,
			"playerCount": len(lh.lobby.Players),
		},
	}
	lh.sendToPlayer(player, welcomeMsg)
}

func (lh *LobbyHandler) unregisterPlayer(player *models.WebSocketPlayer) {
	lh.hub.Mutex.Lock()
	defer lh.hub.Mutex.Unlock()

	if _, exists := lh.hub.Players[player.WebSocketID]; exists {
		// Remove from the single lobby
		lh.lobby.Mutex.Lock()
		delete(lh.lobby.Players, player.WebSocketID)
		playerCount := len(lh.lobby.Players)

		// Reassign host if needed
		if lh.lobby.Host == player.WebSocketID && playerCount > 0 {
			for playerID := range lh.lobby.Players {
				lh.lobby.Host = playerID
				break
			}
		}
		lh.lobby.Mutex.Unlock()

		delete(lh.hub.Players, player.WebSocketID)
		close(player.Send)
		player.IsConnected = false
		log.Printf("Player %s disconnected", player.WebSocketID)

		// Broadcast player left to others
		if playerCount > 0 {
			lh.broadcastToLobby("", &models.WebSocketMessage{
				Type: models.MSG_PLAYER_LEFT,
				Data: &models.PlayerLeftEvent{
					PlayerID:    player.WebSocketID,
					Nickname:    player.Name,
					PlayerCount: playerCount,
					Message:     "Player left the game",
				},
			})
		}
	}
}

// Message Broadcasting
func (lh *LobbyHandler) broadcastMessage(message *models.WebSocketMessage) {
	// Handle different message types
	switch message.Type {
	case models.MSG_CHAT_MESSAGE:
		// Handle chat messages - broadcast to all players in lobby
		lh.broadcastToLobby("", message)
	default:
		// Handle other message types
		lh.broadcastToLobby("", message)
	}
}

func (lh *LobbyHandler) broadcastToLobby(lobbyID string, message *models.WebSocketMessage) {
	// Use the single lobby (ignore lobbyID since there's only one)
	lobby := lh.lobby

	lobby.Mutex.RLock()
	defer lobby.Mutex.RUnlock()

	for _, player := range lobby.Players {
		lh.sendToPlayer(player, message)
	}
}

func (lh *LobbyHandler) sendToPlayer(player *models.WebSocketPlayer, message *models.WebSocketMessage) {
	if !player.IsConnected {
		return
	}

	data, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling message: %v", err)
		return
	}

	select {
	case player.Send <- data:
	default:
		close(player.Send)
		delete(lh.hub.Players, player.WebSocketID)
	}
}

func (lh *LobbyHandler) sendError(player *models.WebSocketPlayer, errMsg string) {
	errorResponse := &models.ErrorResponse{
		Code:    400,
		Message: errMsg,
		Type:    "error",
	}

	message := &models.WebSocketMessage{
		Type: models.MSG_ERROR,
		Data: errorResponse,
	}

	lh.sendToPlayer(player, message)
}

// WebSocket Connection Handlers

func (lh *LobbyHandler) readPump(player *models.WebSocketPlayer) {
	defer func() {
		lh.hub.Unregister <- player
		player.Conn.Close()
	}()

	player.Conn.SetReadLimit(512)
	player.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	player.Conn.SetPongHandler(func(string) error {
		player.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		var message models.WebSocketMessage
		err := player.Conn.ReadJSON(&message)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		lh.handleMessage(player, &message)
	}
}

func (lh *LobbyHandler) writePump(player *models.WebSocketPlayer) {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		player.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-player.Send:
			player.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				player.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := player.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}

		case <-ticker.C:
			player.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := player.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// Message Handling
func (lh *LobbyHandler) handleMessage(player *models.WebSocketPlayer, message *models.WebSocketMessage) {
	switch message.Type {
	case models.MSG_JOIN_LOBBY:
		lh.handleJoinLobby(player, message)
	case models.MSG_LOBBY_STATUS:
		lh.handleLobbyStatusRequest(player, message)
	case models.MSG_CHAT_MESSAGE:
		lh.handleChatMessage(player, message)
	case models.MSG_PING:
		lh.handlePing(player)
	default:
		log.Printf("Unknown message type: %s", message.Type)
	}
}

func (lh *LobbyHandler) handlePing(player *models.WebSocketPlayer) {
	pongMsg := &models.WebSocketMessage{
		Type: models.MSG_PONG,
		Data: map[string]interface{}{"timestamp": time.Now().Unix()},
	}
	lh.sendToPlayer(player, pongMsg)
}

// Utility Functions
func generatePlayerID() string {
	return "player_" + time.Now().Format("20060102150405") + "_" + randomString(6)
}

func randomString(length int) string {
	const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	result := make([]byte, length)
	for i := range result {
		result[i] = charset[time.Now().UnixNano()%int64(len(charset))]
	}
	return string(result)
}

// Public API Methods

// GetLobby returns the single lobby info
func (lh *LobbyHandler) GetLobby() *models.Lobby {
	lh.hub.Mutex.RLock()
	defer lh.hub.Mutex.RUnlock()
	return lh.lobby
}

// GetPlayerCount returns current player count
func (lh *LobbyHandler) GetPlayerCount() int {
	lh.hub.Mutex.RLock()
	defer lh.hub.Mutex.RUnlock()
	return len(lh.lobby.Players)
}

// handleJoinLobby processes join lobby requests with nickname
func (lh *LobbyHandler) handleJoinLobby(player *models.WebSocketPlayer, message *models.WebSocketMessage) {
	var joinRequest models.JoinLobbyRequest

	// Parse the Data
	DataBytes, err := json.Marshal(message.Data)
	if err != nil {
		lh.sendError(player, "Invalid join request format")
		return
	}

	if err := json.Unmarshal(DataBytes, &joinRequest); err != nil {
		lh.sendError(player, "Invalid join request data")
		return
	}

	// Validate nickname
	if joinRequest.Nickname == "" {
		lh.sendError(player, "Nickname is required")
		return
	}

	// Check if nickname is already taken
	lh.lobby.Mutex.Lock()
	for _, p := range lh.lobby.Players {
		if p.Name == joinRequest.Nickname {
			lh.lobby.Mutex.Unlock()
			lh.sendError(player, "Nickname already taken")
			return
		}
	}

	// Check if lobby is full
	if len(lh.lobby.Players) >= lh.lobby.MaxPlayers {
		lh.lobby.Mutex.Unlock()
		lh.sendError(player, "Lobby is full")
		return
	}

	// Update player with nickname and add to lobby
	player.Name = joinRequest.Nickname
	player.Lives = 3 // Each player starts with 3 lives
	player.LobbyID = lh.lobby.ID
	lh.lobby.Players[player.WebSocketID] = player

	// Set first player as host if no host exists
	if lh.lobby.Host == "" {
		lh.lobby.Host = player.WebSocketID
	}
	lh.lobby.Mutex.Unlock()

	// Send success response
	successMsg := &models.WebSocketMessage{
		Type: models.MSG_SUCCESS,
		Data: map[string]interface{}{
			"message":     "Joined lobby successfully",
			"playerId":    player.WebSocketID,
			"nickname":    player.Name,
			"lobbyId":     lh.lobby.ID,
			"playerCount": len(lh.lobby.Players),
		},
	}
	lh.sendToPlayer(player, successMsg)

	// Broadcast player joined to others
	lh.broadcastToLobby("", &models.WebSocketMessage{
		Type: models.MSG_PLAYER_JOINED,
		Data: &models.PlayerJoinedEvent{
			Player:      player,
			PlayerCount: len(lh.lobby.Players),
			Message:     player.Name + " joined the game",
		},
	})

	// Check if we should start timers
	lh.checkGameStartConditions()
}

// handleChatMessage processes chat messages
func (lh *LobbyHandler) handleChatMessage(player *models.WebSocketPlayer, message *models.WebSocketMessage) {
	var chatRequest models.ChatMessageRequest

	// Parse the Data
	DataBytes, err := json.Marshal(message.Data)
	if err != nil {
		lh.sendError(player, "Invalid chat message format")
		return
	}

	if err := json.Unmarshal(DataBytes, &chatRequest); err != nil {
		lh.sendError(player, "Invalid chat message data")
		return
	}

	// Validate message
	if chatRequest.Message == "" {
		lh.sendError(player, "Message cannot be empty")
		return
	}

	// Create chat message
	chatMsg := models.ChatMessage{
		ID:        generateChatID(),
		PlayerID:  player.WebSocketID,
		Nickname:  player.Name,
		Message:   chatRequest.Message,
		Timestamp: time.Now(),
		Type:      "chat",
	}

	// Store in lobby history
	lh.lobby.Mutex.Lock()
	lh.lobby.Messages = append(lh.lobby.Messages, chatMsg)
	// Keep only last 50 messages
	if len(lh.lobby.Messages) > 50 {
		lh.lobby.Messages = lh.lobby.Messages[1:]
	}
	lh.lobby.Mutex.Unlock()

	// Broadcast to all players in lobby
	broadcastMsg := &models.WebSocketMessage{
		Type: models.MSG_CHAT_MESSAGE,
		Data: chatMsg,
	}
	lh.broadcastToLobby("", broadcastMsg)
}

// handleLobbyStatusRequest sends current lobby status to the requesting player
func (lh *LobbyHandler) handleLobbyStatusRequest(player *models.WebSocketPlayer, message *models.WebSocketMessage) {
	lh.lobby.Mutex.RLock()
	statusUpdate := &models.LobbyUpdate{
		Lobby:       lh.lobby,
		PlayerCount: len(lh.lobby.Players),
		Status:      lh.lobby.Status,
	}
	lh.lobby.Mutex.RUnlock()

	statusMsg := &models.WebSocketMessage{
		Type: models.MSG_LOBBY_STATUS,
		Data: statusUpdate,
	}
	lh.sendToPlayer(player, statusMsg)
}

// checkGameStartConditions checks if game should start based on player count and timers
func (lh *LobbyHandler) checkGameStartConditions() {
	lh.lobby.Mutex.Lock()
	defer lh.lobby.Mutex.Unlock()

	playerCount := len(lh.lobby.Players)

	// If we have 4 players, start the 10-second countdown immediately
	if playerCount == lh.lobby.MaxPlayers && lh.lobby.Status == "waiting" {
		lh.lobby.Status = "starting"
		go lh.startGameCountdown()
		return
	}

	// If we have 2-3 players and haven't started waiting timer yet
	if playerCount >= lh.lobby.MinPlayers && playerCount < lh.lobby.MaxPlayers && lh.lobby.Status == "waiting" {
		go lh.startWaitTimer()
	}
}

// startWaitTimer starts the 20-second wait timer
func (lh *LobbyHandler) startWaitTimer() {
	lh.lobby.Mutex.Lock()
	lh.lobby.Status = "waiting_for_players"
	lh.lobby.Mutex.Unlock()

	for i := lh.lobby.WaitTimer; i > 0; i-- {
		time.Sleep(1 * time.Second)

		lh.lobby.Mutex.RLock()
		currentPlayerCount := len(lh.lobby.Players)
		status := lh.lobby.Status
		lh.lobby.Mutex.RUnlock()

		// If lobby is full, switch to game countdown
		if currentPlayerCount == lh.lobby.MaxPlayers {
			lh.lobby.Mutex.Lock()
			lh.lobby.Status = "starting"
			lh.lobby.Mutex.Unlock()
			go lh.startGameCountdown()
			return
		}

		// If not enough players, reset to waiting
		if currentPlayerCount < lh.lobby.MinPlayers {
			lh.lobby.Mutex.Lock()
			lh.lobby.Status = "waiting"
			lh.lobby.Mutex.Unlock()
			return
		}

		// Broadcast timer update
		updateMsg := &models.WebSocketMessage{
			Type: models.MSG_LOBBY_UPDATE,
			Data: &models.LobbyUpdate{
				Lobby:       lh.lobby,
				PlayerCount: currentPlayerCount,
				TimeLeft:    i,
				Status:      status,
			},
		}
		lh.broadcastToLobby("", updateMsg)
	}

	// Timer expired, check if we can start
	lh.lobby.Mutex.RLock()
	finalPlayerCount := len(lh.lobby.Players)
	lh.lobby.Mutex.RUnlock()

	if finalPlayerCount >= lh.lobby.MinPlayers {
		lh.lobby.Mutex.Lock()
		lh.lobby.Status = "starting"
		lh.lobby.Mutex.Unlock()
		go lh.startGameCountdown()
	} else {
		lh.lobby.Mutex.Lock()
		lh.lobby.Status = "waiting"
		lh.lobby.Mutex.Unlock()
	}
}

// startGameCountdown starts the 10-second game start countdown
func (lh *LobbyHandler) startGameCountdown() {
	for i := lh.lobby.StartTimer; i > 0; i-- {
		time.Sleep(1 * time.Second)

		lh.lobby.Mutex.RLock()
		currentPlayerCount := len(lh.lobby.Players)
		lh.lobby.Mutex.RUnlock()

		// Broadcast countdown
		updateMsg := &models.WebSocketMessage{
			Type: models.MSG_LOBBY_UPDATE,
			Data: &models.LobbyUpdate{
				Lobby:       lh.lobby,
				PlayerCount: currentPlayerCount,
				TimeLeft:    i,
				Status:      "starting",
			},
		}
		lh.broadcastToLobby("", updateMsg)
	}

	// Start the game
	lh.startGame()
}

// startGame initializes and starts the game
func (lh *LobbyHandler) startGame() {
	lh.lobby.Mutex.Lock()
	lh.lobby.GameStarted = true
	lh.lobby.Status = "playing"

	// Create game start event
	gameStartEvent := &models.GameStartEvent{
		LobbyID:   lh.lobby.ID,
		Players:   lh.lobby.Players,
		Map:       lh.generateGameMap(), // You'll need to implement this
		StartTime: time.Now(),
	}
	lh.lobby.Mutex.Unlock()

	// Broadcast game start
	startMsg := &models.WebSocketMessage{
		Type: models.MSG_GAME_START,
		Data: gameStartEvent,
	}
	lh.broadcastToLobby("", startMsg)

	log.Printf("Game started in lobby %s with %d players", lh.lobby.ID, len(lh.lobby.Players))
}

// generateGameMap creates the initial game map (placeholder)
func (lh *LobbyHandler) generateGameMap() [][]int {
	// This is a placeholder - you'll need to implement proper map generation
	// 0 = empty, 1 = wall, 2 = destructible block
	mapSize := 15
	gameMap := make([][]int, mapSize)
	for i := range gameMap {
		gameMap[i] = make([]int, mapSize)
	}

	// Add walls in a grid pattern (simplified)
	for i := 0; i < mapSize; i++ {
		for j := 0; j < mapSize; j++ {
			// Border walls
			if i == 0 || i == mapSize-1 || j == 0 || j == mapSize-1 {
				gameMap[i][j] = 1
			}
			// Internal walls in grid pattern
			if i%2 == 0 && j%2 == 0 && i != 0 && i != mapSize-1 && j != 0 && j != mapSize-1 {
				gameMap[i][j] = 1
			}
		}
	}

	// TODO: Add random destructible blocks while ensuring player spawn areas are clear

	return gameMap
}

// generateChatID generates a unique chat message ID
func generateChatID() string {
	return "chat_" + time.Now().Format("20060102150405") + "_" + randomString(4)
}

package main

import (
	"bomberman-dom/models"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type LobbyHandler struct {
	hub       *models.Hub
	lobby     *models.Lobby
	GameState *models.GameState
}

func NewLobbyHandler() *LobbyHandler {
	hub := &models.Hub{
		Players:    make(map[string]*models.WebSocketPlayer),
		Register:   make(chan *models.WebSocketPlayer),
		Unregister: make(chan *models.WebSocketPlayer),
		Broadcast:  make(chan *models.WebSocketMessage),
	}

	singleLobby := &models.Lobby{
		ID:          "main_lobby",
		Name:        "Main Game Lobby",
		Players:     make(map[string]*models.WebSocketPlayer),
		MaxPlayers:  4,
		MinPlayers:  2,
		GameStarted: false,
		CreatedAt:   time.Now(),
		Messages:    make([]models.ChatMessage, 0),
		WaitTimer:   20,
		StartTimer:  10,
		Host:        "",
		Status:      "waiting",
	}

	lobbyHandler := &LobbyHandler{
		hub:       hub,
		lobby:     singleLobby,
		GameState: nil, // GameState is nil until the game starts
	}

	go lobbyHandler.run()
	return lobbyHandler
}

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

func (lh *LobbyHandler) ServeWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	player := &models.WebSocketPlayer{
		WebSocketID: generatePlayerID(),
		Conn:        conn,
		Send:        make(chan []byte, 256),
		IsConnected: true,
		IsActive:    true,
		JoinedAt:    time.Now(),
	}

	lh.hub.Register <- player

	go lh.writePump(player)
	go lh.readPump(player)
}

func (lh *LobbyHandler) registerPlayer(player *models.WebSocketPlayer) {
	lh.hub.Mutex.Lock()
	defer lh.hub.Mutex.Unlock()

	lh.hub.Players[player.WebSocketID] = player
	log.Printf("✅ Player %s connected", player.WebSocketID)

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
		if lh.GameState != nil && lh.GameState.Status == models.InProgress {
			for _, gamePlayer := range lh.GameState.Players {
				if gamePlayer.ID == player.WebSocketID {
					gamePlayer.Alive = false
					break
				}
			}
		}

		lh.lobby.Mutex.Lock()
		delete(lh.lobby.Players, player.WebSocketID)
		playerCount := len(lh.lobby.Players)

		// Reset game status if game was in progress but now we don't have enough players
		if lh.lobby.Status == "playing" && playerCount < lh.lobby.MinPlayers {
			log.Printf("🔄 Resetting game status: not enough players (%d/%d)", playerCount, lh.lobby.MinPlayers)
			lh.lobby.Status = "waiting"
			lh.lobby.GameStarted = false
		}

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
		log.Printf("❌ Player %s disconnected", player.WebSocketID)

		if !lh.lobby.GameStarted && playerCount > 0 {
			lh.broadcastToLobby("", &models.WebSocketMessage{
				Type: models.MSG_PLAYER_LEFT,
				Data: &models.PlayerLeftEvent{
					PlayerID:    player.WebSocketID,
					Nickname:    player.Name,
					PlayerCount: playerCount,
					Message:     "Player left the lobby", // More accurate message
				},
			})

			// Send updated lobby status after player left
			lh.sendLobbyUpdate()
		}
	}
}

func (lh *LobbyHandler) broadcastMessage(message *models.WebSocketMessage) {
	switch message.Type {
	case models.MSG_CHAT_MESSAGE:
		lh.broadcastToLobby("", message)
	default:
		lh.broadcastToLobby("", message)
	}
}

func (lh *LobbyHandler) broadcastToLobby(lobbyID string, message *models.WebSocketMessage) {
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

func (lh *LobbyHandler) handleMessage(player *models.WebSocketPlayer, message *models.WebSocketMessage) {

	if lh.lobby.GameStarted && lh.GameState != nil {
		switch message.Type {
		case models.MSG_PLAYER_MOVE, models.MSG_PLACE_BOMB:
			lh.handleGameAction(player, message)
			return
		}
	}

	// Handle lobby/chat messages
	switch message.Type {
	case models.MSG_JOIN_LOBBY:
		lh.handleJoinLobby(player, message)
	case models.MSG_LOBBY_STATUS:
		lh.handleLobbyStatusRequest(player, message)
	case models.MSG_CHAT_MESSAGE:
		lh.handleChatMessage(player, message)
	case models.MSG_PING:
		lh.handlePing(player)
	case models.MSG_PLAYER_MOVE:
		lh.handlePlayerMove(player, message)
	case models.MSG_PLACE_BOMB:
		lh.handlePlaceBomb(player, message)
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

func (lh *LobbyHandler) GetLobby() *models.Lobby {
	lh.hub.Mutex.RLock()
	defer lh.hub.Mutex.RUnlock()
	return lh.lobby
}

func (lh *LobbyHandler) GetPlayerCount() int {
	lh.hub.Mutex.RLock()
	defer lh.hub.Mutex.RUnlock()
	return len(lh.lobby.Players)
}

func (lh *LobbyHandler) handleJoinLobby(player *models.WebSocketPlayer, message *models.WebSocketMessage) {
	var joinRequest struct {
		Nickname string `json:"nickname"`
	}

	DataBytes, err := json.Marshal(message.Data)
	if err != nil {
		lh.sendError(player, "Invalid join request format")
		return
	}

	if err := json.Unmarshal(DataBytes, &joinRequest); err != nil {
		var originalRequest models.JoinLobbyRequest
		if err := json.Unmarshal(DataBytes, &originalRequest); err != nil {
			lh.sendError(player, "Invalid join request data")
			return
		}
		joinRequest.Nickname = originalRequest.Nickname
	}

	if joinRequest.Nickname == "" {
		lh.sendError(player, "Nickname is required")
		return
	}

	// Check if nickname is already taken by ACTIVE players only
	lh.lobby.Mutex.Lock()
	for _, p := range lh.lobby.Players {
		if p.Name == joinRequest.Nickname && p.IsConnected {
			lh.lobby.Mutex.Unlock()
			lh.sendError(player, "Nickname already taken")
			return
		}
	}

	if len(lh.lobby.Players) >= lh.lobby.MaxPlayers {
		lh.lobby.Mutex.Unlock()
		lh.sendError(player, "Lobby is full")
		return
	}

	// Update player and add to lobby
	player.Name = joinRequest.Nickname
	player.Lives = 3
	player.LobbyID = lh.lobby.ID
	lh.lobby.Players[player.WebSocketID] = player

	if lh.lobby.Host == "" {
		lh.lobby.Host = player.WebSocketID
	}

	// Get current players list for sending to new player
	currentPlayers := make([]map[string]interface{}, 0)
	for _, p := range lh.lobby.Players {
		currentPlayers = append(currentPlayers, map[string]interface{}{
			"id":          p.WebSocketID,
			"WebSocketID": p.WebSocketID,
			"nickname":    p.Name,
			"lives":       p.Lives,
			"isHost":      lh.lobby.Host == p.WebSocketID,
		})
	}

	playerCount := len(lh.lobby.Players)
	lh.lobby.Mutex.Unlock()

	log.Printf("✅ Player %s joined lobby", player.Name)

	// Send success message with FULL lobby state
	successMsg := &models.WebSocketMessage{
		Type: models.MSG_SUCCESS,
		Data: map[string]interface{}{
			"message":     "Joined lobby successfully",
			"playerId":    player.WebSocketID,
			"nickname":    player.Name,
			"lobbyId":     lh.lobby.ID,
			"playerCount": playerCount,
			"players":     currentPlayers, // Send all current players
			"isHost":      lh.lobby.Host == player.WebSocketID,
		},
	}

	lh.sendToPlayer(player, successMsg)

	// Broadcast to OTHER players that new player joined
	lh.broadcastToLobby("", &models.WebSocketMessage{
		Type: models.MSG_PLAYER_JOINED,
		Data: &models.PlayerJoinedEvent{
			Player:      player,
			PlayerCount: playerCount,
			Message:     player.Name + " joined the game",
		},
	})

	// Send lobby update to ensure timers and state are synchronized
	lh.sendLobbyUpdate()
	lh.checkGameStartConditions()
}

func (lh *LobbyHandler) sendLobbyUpdate() {
	lh.lobby.Mutex.RLock()
	defer lh.lobby.Mutex.RUnlock()

	lobbyUpdate := &models.WebSocketMessage{
		Type: models.MSG_LOBBY_UPDATE,
		Data: &models.LobbyUpdate{
			Lobby:       lh.lobby,
			PlayerCount: len(lh.lobby.Players),
			Status:      lh.lobby.Status,
		},
	}

	lh.broadcastToLobby("", lobbyUpdate)
}

func (lh *LobbyHandler) handleChatMessage(player *models.WebSocketPlayer, message *models.WebSocketMessage) {
	var chatRequest models.ChatMessageRequest

	DataBytes, err := json.Marshal(message.Data)
	if err != nil {
		lh.sendError(player, "Invalid chat message format")
		return
	}

	if err := json.Unmarshal(DataBytes, &chatRequest); err != nil {
		lh.sendError(player, "Invalid chat message data")
		return
	}

	if chatRequest.Message == "" {
		lh.sendError(player, "Message cannot be empty")
		return
	}

	chatMsg := models.ChatMessage{
		ID:        generateChatID(),
		PlayerID:  player.WebSocketID,
		Nickname:  player.Name,
		Message:   chatRequest.Message,
		Timestamp: time.Now(),
		Type:      "chat",
	}

	lh.lobby.Mutex.Lock()
	lh.lobby.Messages = append(lh.lobby.Messages, chatMsg)
	if len(lh.lobby.Messages) > 50 {
		lh.lobby.Messages = lh.lobby.Messages[1:]
	}
	lh.lobby.Mutex.Unlock()

	broadcastMsg := &models.WebSocketMessage{
		Type: models.MSG_CHAT_MESSAGE,
		Data: chatMsg,
	}
	lh.broadcastToLobby("", broadcastMsg)
}

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

func (lh *LobbyHandler) checkGameStartConditions() {
	lh.lobby.Mutex.Lock()
	defer lh.lobby.Mutex.Unlock()

	playerCount := len(lh.lobby.Players)

	if playerCount == lh.lobby.MaxPlayers && lh.lobby.Status == "waiting" {
		lh.lobby.Status = "starting"
		go lh.startGameCountdown()
		return
	}

	if playerCount >= lh.lobby.MinPlayers && playerCount < lh.lobby.MaxPlayers && lh.lobby.Status == "waiting" {
		go lh.startWaitTimer()
	}
}

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

		if currentPlayerCount == lh.lobby.MaxPlayers {
			lh.lobby.Mutex.Lock()
			lh.lobby.Status = "starting"
			lh.lobby.Mutex.Unlock()
			go lh.startGameCountdown()
			return
		}

		if currentPlayerCount < lh.lobby.MinPlayers {
			lh.lobby.Mutex.Lock()
			lh.lobby.Status = "waiting"
			lh.lobby.Mutex.Unlock()
			return
		}

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

func (lh *LobbyHandler) startGameCountdown() {
	for i := lh.lobby.StartTimer; i > 0; i-- {
		time.Sleep(1 * time.Second)

		lh.lobby.Mutex.RLock()
		currentPlayerCount := len(lh.lobby.Players)
		lh.lobby.Mutex.RUnlock()

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

	lh.startGame()
}

func (lh *LobbyHandler) startGame() {
	lh.lobby.Mutex.Lock()

	if lh.lobby.GameStarted {
		lh.lobby.Mutex.Unlock()
		return
	}

	lh.lobby.GameStarted = true
	lh.lobby.Status = "playing"

	// --- Create the list of players for the game logic ---
	gamePlayers := []*models.Player{}
	spawnPoints := []models.Position{
		{X: 1, Y: 1}, {X: 13, Y: 1}, {X: 1, Y: 11}, {X: 13, Y: 11},
	}

	i := 0
	for _, wsPlayer := range lh.lobby.Players {
		if i >= len(spawnPoints) {
			break
		}
		gamePlayer := &models.Player{
			ID:         wsPlayer.WebSocketID,
			Name:       wsPlayer.Name,
			Position:   spawnPoints[i],
			SpawnPoint: spawnPoints[i],
			Lives:      3,
			Alive:      true,
			BombCount:  1,
			FlameRange: 1,
			Speed:      0,
		}
		gamePlayers = append(gamePlayers, gamePlayer)
		i++
	}

	// --- Initialize the GameState using our backend logic ---
	lh.GameState = NewGame(gamePlayers)

	// Create the message while still holding the lock
	startMsg := &models.WebSocketMessage{
		Type: models.MSG_GAME_START,
		Data: lh.GameState,
	}

	lh.lobby.Mutex.Unlock() // Unlock BEFORE broadcasting and starting the loop

	lh.broadcastToLobby("", startMsg)
	log.Printf("Game started in lobby %s with %d players", lh.lobby.ID, len(lh.lobby.Players))

	// --- Start the main game loop ---
	go lh.runGameLoop()
}

// runGameLoop is the heart of the game, ticking the state forward.
func (lh *LobbyHandler) runGameLoop() {
	// Tick rate: 20 times per second (50ms interval)
	ticker := time.NewTicker(50 * time.Millisecond)
	defer ticker.Stop()

	for range ticker.C {
		if lh.GameState == nil || lh.GameState.Status == models.Finished {
			// Stop the loop if the game ends
			// Optionally, broadcast a final game over message here
			return
		}

		// Process one tick of the game
		GameTick(lh.GameState)

		// Broadcast the new state to all players
		updateMsg := &models.WebSocketMessage{
			Type: models.MSG_GAME_STATE_UPDATE,
			Data: lh.GameState,
		}
		lh.broadcastToLobby("", updateMsg)
	}
}

// handleGameAction processes player inputs during the game.
func (lh *LobbyHandler) handleGameAction(player *models.WebSocketPlayer, message *models.WebSocketMessage) {
	if lh.GameState == nil {
		return
	}

	var gamePlayer *models.Player
	for _, p := range lh.GameState.Players {
		if p.ID == player.WebSocketID {
			gamePlayer = p
			break
		}
	}

	if gamePlayer == nil || !gamePlayer.Alive {
		return
	}

	switch message.Type {
	case models.MSG_PLAYER_MOVE:
		var moveRequest struct {
			Direction string `json:"direction"`
		}
		dataBytes, _ := json.Marshal(message.Data)
		if json.Unmarshal(dataBytes, &moveRequest) == nil {
			MovePlayer(gamePlayer, moveRequest.Direction, lh.GameState)
		}

	case models.MSG_PLACE_BOMB:
		PlaceBomb(lh.GameState, gamePlayer)
	}
}

// /s

// // handlePlaceBomb processes bomb placement requests during the game
// func (lh *LobbyHandler) handlePlaceBomb(player *models.WebSocketPlayer, message *models.WebSocketMessage) {
// 	if !lh.lobby.GameStarted {
// 		log.Printf("Player %s tried to place bomb but game hasn't started", player.Name)
// 		return
// 	}

// 	log.Printf("💣 Player %s placing bomb", player.Name)

// 	// TODO: Implement actual bomb placement logic
// 	// For now, just broadcast the bomb placement to all players
// 	bombUpdate := &models.WebSocketMessage{
// 		Type: models.MSG_GAME_STATE_UPDATE,
// 		Data: map[string]interface{}{
// 			"type":      "bomb_placed",
// 			"player_id": player.WebSocketID, // Use WebSocketID instead of embedded Player.ID
// 			"timestamp": time.Now().Unix(),
// 		},
// 	}

// 	lh.broadcastToLobby("", bombUpdate)
// }

// handlePlayerMove processes player movement requests during the game
func (lh *LobbyHandler) handlePlayerMove(player *models.WebSocketPlayer, message *models.WebSocketMessage) {
	if !lh.lobby.GameStarted {
		log.Printf("Player %s tried to move but game hasn't started", player.Name)
		return
	}

	var moveRequest struct {
		Direction string `json:"direction"`
	}

	if messageData, ok := message.Data.(map[string]interface{}); ok {
		if direction, exists := messageData["direction"]; exists {
			if dirStr, ok := direction.(string); ok {
				moveRequest.Direction = dirStr
			}
		}
	}

	log.Printf("🎮 Player %s moving: %s", player.Name, moveRequest.Direction)

	// TODO: Implement actual game state update logic
	// For now, just broadcast the move to all players
	moveUpdate := &models.WebSocketMessage{
		Type: models.MSG_GAME_UPDATE,
		Data: map[string]interface{}{
			"type":      "player_move",
			"player_id": player.WebSocketID, // Use WebSocketID instead of embedded Player.ID
			"direction": moveRequest.Direction,
			"timestamp": time.Now().Unix(),
		},
	}

	lh.broadcastToLobby("", moveUpdate)
}

// handlePlaceBomb processes bomb placement requests during the game
func (lh *LobbyHandler) handlePlaceBomb(player *models.WebSocketPlayer, message *models.WebSocketMessage) {
	if !lh.lobby.GameStarted {
		log.Printf("Player %s tried to place bomb but game hasn't started", player.Name)
		return
	}

	log.Printf("💣 Player %s placing bomb", player.Name)

	// TODO: Implement actual bomb placement logic
	// For now, just broadcast the bomb placement to all players
	bombUpdate := &models.WebSocketMessage{
		Type: models.MSG_GAME_UPDATE,
		Data: map[string]interface{}{
			"type":      "bomb_placed",
			"player_id": player.WebSocketID, // Use WebSocketID instead of embedded Player.ID
			"timestamp": time.Now().Unix(),
		},
	}

	lh.broadcastToLobby("", bombUpdate)
}

func generateChatID() string {
	return "chat_" + time.Now().Format("20060102150405") + "_" + randomString(4)
}

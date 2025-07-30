package websockets

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"bomberman-dom/backend/models"

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
	hub          *models.Hub
	lobby        *models.Lobby
	sessions     map[string]*models.SessionData
	sessionMutex sync.RWMutex
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
		hub:      hub,
		lobby:    singleLobby,
		sessions: make(map[string]*models.SessionData),
	}

	go lobbyHandler.run()
	go lobbyHandler.cleanupExpiredSessions()
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
		lh.lobby.Mutex.Lock()
		delete(lh.lobby.Players, player.WebSocketID)
		playerCount := len(lh.lobby.Players)

		if lh.lobby.Host == player.WebSocketID && playerCount > 0 {
			for playerID := range lh.lobby.Players {
				lh.lobby.Host = playerID
				break
			}
		}
		lh.lobby.Mutex.Unlock()

		// Mark session as inactive
		if sessionId := lh.findSessionByPlayerId(player.WebSocketID); sessionId != "" {
			lh.sessionMutex.Lock()
			if session, exists := lh.sessions[sessionId]; exists {
				session.IsActive = false
				session.LastActiveTime = time.Now()
			}
			lh.sessionMutex.Unlock()
		}

		delete(lh.hub.Players, player.WebSocketID)
		close(player.Send)
		player.IsConnected = false
		log.Printf("❌ Player %s disconnected", player.WebSocketID)

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

	lh.storeEventForSessions(*message)

	lobby.Mutex.RLock()
	defer lobby.Mutex.RUnlock()

	for _, player := range lobby.Players {
		lh.sendToPlayer(player, message)

		if sessionId := lh.findSessionByPlayerId(player.WebSocketID); sessionId != "" {
			lh.updateSessionActivity(sessionId)
		}
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
	switch message.Type {
	case models.MSG_JOIN_LOBBY:
		lh.handleJoinLobby(player, message)
	case "reconnect_session":
		lh.handleSessionReconnect(player, message)
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

// FIXED: Simplified join lobby handler that prioritizes fresh connections
func (lh *LobbyHandler) handleJoinLobby(player *models.WebSocketPlayer, message *models.WebSocketMessage) {
	var joinRequest struct {
		Nickname     string `json:"nickname"`
		SessionID    string `json:"sessionId"`
		IsNewSession bool   `json:"isNewSession"`
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
		joinRequest.IsNewSession = true
	}

	if joinRequest.Nickname == "" {
		lh.sendError(player, "Nickname is required")
		return
	}

	// Clean up any existing inactive sessions for this nickname first
	lh.cleanupInactiveSessionsForNickname(joinRequest.Nickname)

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
	lh.lobby.Mutex.Unlock()

	// Create new session (always create fresh session for join_lobby)
	sessionId := lh.generateSessionID()
	lh.createSession(sessionId, player)

	log.Printf("✅ Player %s joined lobby with session %s", player.Name, sessionId)

	successMsg := &models.WebSocketMessage{
		Type: models.MSG_SUCCESS,
		Data: map[string]interface{}{
			"message":     "Joined lobby successfully",
			"playerId":    player.WebSocketID,
			"nickname":    player.Name,
			"sessionId":   sessionId,
			"lobbyId":     lh.lobby.ID,
			"playerCount": len(lh.lobby.Players),
		},
	}
	lh.sendToPlayer(player, successMsg)

	lh.broadcastToLobby("", &models.WebSocketMessage{
		Type: models.MSG_PLAYER_JOINED,
		Data: &models.PlayerJoinedEvent{
			Player:      player,
			PlayerCount: len(lh.lobby.Players),
			Message:     player.Name + " joined the game",
		},
	})

	lh.checkGameStartConditions()
}

// FIXED: Better session reconnection handling
func (lh *LobbyHandler) handleSessionReconnect(player *models.WebSocketPlayer, message *models.WebSocketMessage) {
	var reconnectData struct {
		SessionID         string `json:"sessionId"`
		PlayerID          string `json:"playerId"`
		Nickname          string `json:"nickname"`
		LastSyncTimestamp int64  `json:"lastSyncTimestamp"`
	}

	DataBytes, err := json.Marshal(message.Data)
	if err != nil {
		lh.sendError(player, "Invalid reconnect data")
		return
	}

	if err := json.Unmarshal(DataBytes, &reconnectData); err != nil {
		lh.sendError(player, "Invalid reconnect format")
		return
	}

	session := lh.getSession(reconnectData.SessionID)
	if session == nil {
		log.Printf("⚠️ Session not found: %s", reconnectData.SessionID)
		lh.sendError(player, "Session not found or expired")
		return
	}

	if session.PlayerID != reconnectData.PlayerID || session.Nickname != reconnectData.Nickname {
		log.Printf("⚠️ Invalid session credentials for %s", reconnectData.Nickname)
		lh.sendError(player, "Invalid session credentials")
		return
	}

	// Check if session expired (1 hour limit)
	if time.Since(session.LastActiveTime) > 1*time.Hour {
		log.Printf("⚠️ Session expired for %s (age: %v)", session.Nickname, time.Since(session.LastActiveTime))
		lh.sessionMutex.Lock()
		delete(lh.sessions, reconnectData.SessionID)
		lh.sessionMutex.Unlock()
		lh.sendError(player, "Session expired")
		return
	}

	// Check if nickname is now taken by someone else
	lh.lobby.Mutex.Lock()
	for _, p := range lh.lobby.Players {
		if p.Name == session.Nickname && p.WebSocketID != session.PlayerID && p.IsConnected {
			lh.lobby.Mutex.Unlock()
			log.Printf("⚠️ Nickname %s is now taken by another player", session.Nickname)
			lh.sendError(player, "Nickname already taken")
			return
		}
	}

	log.Printf("🔄 Restoring session for player %s (%s)", session.Nickname, session.SessionID)

	// Update player connection
	player.WebSocketID = session.PlayerID
	player.Name = session.Nickname
	player.Lives = 3
	player.LobbyID = session.LobbyID

	// Re-add to lobby
	lh.lobby.Players[player.WebSocketID] = player
	lh.lobby.Mutex.Unlock()

	// Update session
	session.LastActiveTime = time.Now()
	session.IsActive = true

	missedEvents := lh.getMissedEventsSince(session, time.Unix(0, reconnectData.LastSyncTimestamp*int64(time.Millisecond)))

	restoredMsg := &models.WebSocketMessage{
		Type: "session_restored",
		Data: map[string]interface{}{
			"sessionId":     session.SessionID,
			"playerId":      session.PlayerID,
			"nickname":      session.Nickname,
			"lobbyId":       session.LobbyID,
			"currentScreen": session.CurrentScreen,
			"players":       lh.getCurrentPlayers(),
			"messages":      lh.getRecentMessages(),
			"waitingTimer":  lh.getCurrentWaitingTimer(),
			"gameTimer":     lh.getCurrentGameTimer(),
		},
	}
	lh.sendToPlayer(player, restoredMsg)

	if len(missedEvents) > 0 {
		missedMsg := &models.WebSocketMessage{
			Type: "missed_events",
			Data: map[string]interface{}{
				"events": missedEvents,
			},
		}
		lh.sendToPlayer(player, missedMsg)
	}

	lh.broadcastToLobby("", &models.WebSocketMessage{
		Type: models.MSG_PLAYER_JOINED,
		Data: &models.PlayerJoinedEvent{
			Player:      player,
			PlayerCount: len(lh.lobby.Players),
			Message:     session.Nickname + " reconnected",
		},
	})

	log.Printf("✅ Session restored successfully for %s", session.Nickname)
}

// Helper method to clean up inactive sessions for a nickname
func (lh *LobbyHandler) cleanupInactiveSessionsForNickname(nickname string) {
	lh.sessionMutex.Lock()
	defer lh.sessionMutex.Unlock()

	for sessionId, session := range lh.sessions {
		if session.Nickname == nickname && !session.IsActive {
			delete(lh.sessions, sessionId)
			log.Printf("🗑️ Cleaned up inactive session for nickname %s", nickname)
		}
	}
}

func (lh *LobbyHandler) createSession(sessionId string, player *models.WebSocketPlayer) {
	lh.sessionMutex.Lock()
	defer lh.sessionMutex.Unlock()

	lh.sessions[sessionId] = &models.SessionData{
		SessionID:      sessionId,
		PlayerID:       player.WebSocketID,
		Nickname:       player.Name,
		LobbyID:        player.LobbyID,
		LastActiveTime: time.Now(),
		CurrentScreen:  "waiting",
		IsActive:       true,
		MissedEvents:   make([]models.WebSocketMessage, 0),
		LastSyncTime:   time.Now(),
	}

	log.Printf("💾 Session created: %s for player %s", sessionId, player.Name)
}

func (lh *LobbyHandler) getSession(sessionId string) *models.SessionData {
	lh.sessionMutex.RLock()
	defer lh.sessionMutex.RUnlock()
	return lh.sessions[sessionId]
}

func (lh *LobbyHandler) updateSessionActivity(sessionId string) {
	lh.sessionMutex.Lock()
	defer lh.sessionMutex.Unlock()

	if session, exists := lh.sessions[sessionId]; exists {
		session.LastActiveTime = time.Now()
		session.LastSyncTime = time.Now()
	}
}

func (lh *LobbyHandler) storeEventForSessions(event models.WebSocketMessage) {
	lh.sessionMutex.Lock()
	defer lh.sessionMutex.Unlock()

	for _, session := range lh.sessions {
		if !session.IsActive {
			session.MissedEvents = append(session.MissedEvents, event)

			if len(session.MissedEvents) > 50 {
				session.MissedEvents = session.MissedEvents[1:]
			}
		}
	}
}

func (lh *LobbyHandler) getMissedEventsSince(session *models.SessionData, since time.Time) []models.WebSocketMessage {
	var missedEvents []models.WebSocketMessage

	for _, event := range session.MissedEvents {
		if eventTime, ok := event.Data.(map[string]interface{})["timestamp"]; ok {
			if timestamp, ok := eventTime.(time.Time); ok && timestamp.After(since) {
				missedEvents = append(missedEvents, event)
			}
		}
	}

	session.MissedEvents = make([]models.WebSocketMessage, 0)

	return missedEvents
}

// FIXED: More aggressive cleanup - every 1 minute, 1 hour expiry
func (lh *LobbyHandler) cleanupExpiredSessions() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			lh.sessionMutex.Lock()
			oneHourAgo := time.Now().Add(-1 * time.Hour)

			count := 0
			for sessionId, session := range lh.sessions {
				if session.LastActiveTime.Before(oneHourAgo) {
					delete(lh.sessions, sessionId)
					count++
				}
			}

			if count > 0 {
				log.Printf("🗑️ Cleaned up %d expired sessions", count)
			}
			lh.sessionMutex.Unlock()
		}
	}
}

func (lh *LobbyHandler) getCurrentPlayers() []map[string]interface{} {
	lh.lobby.Mutex.RLock()
	defer lh.lobby.Mutex.RUnlock()

	players := make([]map[string]interface{}, 0)
	for _, player := range lh.lobby.Players {
		players = append(players, map[string]interface{}{
			"id":          player.WebSocketID,
			"WebSocketID": player.WebSocketID,
			"nickname":    player.Name,
			"lives":       player.Lives,
			"isHost":      lh.lobby.Host == player.WebSocketID,
		})
	}
	return players
}

func (lh *LobbyHandler) getRecentMessages() []models.ChatMessage {
	lh.lobby.Mutex.RLock()
	defer lh.lobby.Mutex.RUnlock()
	return lh.lobby.Messages
}

func (lh *LobbyHandler) getCurrentWaitingTimer() interface{} {
	lh.lobby.Mutex.RLock()
	defer lh.lobby.Mutex.RUnlock()
	if lh.lobby.Status == "waiting_for_players" {
		return nil
	}
	return nil
}

func (lh *LobbyHandler) getCurrentGameTimer() interface{} {
	lh.lobby.Mutex.RLock()
	defer lh.lobby.Mutex.RUnlock()
	if lh.lobby.Status == "starting" {
		return nil
	}
	return nil
}

func (lh *LobbyHandler) generateSessionID() string {
	return "session_" + time.Now().Format("20060102150405") + "_" + randomString(8)
}

func (lh *LobbyHandler) findSessionByPlayerId(playerId string) string {
	lh.sessionMutex.RLock()
	defer lh.sessionMutex.RUnlock()

	for sessionId, session := range lh.sessions {
		if session.PlayerID == playerId {
			return sessionId
		}
	}
	return ""
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
	lh.lobby.GameStarted = true
	lh.lobby.Status = "playing"

	gameStartEvent := &models.GameStartEvent{
		LobbyID:   lh.lobby.ID,
		Players:   lh.lobby.Players,
		Map:       lh.generateGameMap(),
		StartTime: time.Now(),
	}
	lh.lobby.Mutex.Unlock()

	startMsg := &models.WebSocketMessage{
		Type: models.MSG_GAME_START,
		Data: gameStartEvent,
	}
	lh.broadcastToLobby("", startMsg)

	log.Printf("Game started in lobby %s with %d players", lh.lobby.ID, len(lh.lobby.Players))
}

func (lh *LobbyHandler) generateGameMap() [][]int {
	mapSize := 15
	gameMap := make([][]int, mapSize)
	for i := range gameMap {
		gameMap[i] = make([]int, mapSize)
	}

	for i := 0; i < mapSize; i++ {
		for j := 0; j < mapSize; j++ {
			if i == 0 || i == mapSize-1 || j == 0 || j == mapSize-1 {
				gameMap[i][j] = 1
			}
			if i%2 == 0 && j%2 == 0 && i != 0 && i != mapSize-1 && j != 0 && j != mapSize-1 {
				gameMap[i][j] = 1
			}
		}
	}

	return gameMap
}

func generateChatID() string {
	return "chat_" + time.Now().Format("20060102150405") + "_" + randomString(4)
}

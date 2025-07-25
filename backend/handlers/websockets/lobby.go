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
		MaxPlayers:  8, // Set your desired max players
		MinPlayers:  2,
		GameStarted: false,
		CreatedAt:   time.Now(),
		Messages:    make([]models.ChatMessage, 0),
		WaitTimer:   30,
		StartTimer:  5,
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

	// Automatically add player to the single lobby
	lh.lobby.Mutex.Lock()
	player.LobbyID = lh.lobby.ID
	lh.lobby.Players[player.WebSocketID] = player

	// Set first player as host if no host exists
	if lh.lobby.Host == "" {
		lh.lobby.Host = player.WebSocketID
	}
	lh.lobby.Mutex.Unlock()

	// Send welcome message
	welcomeMsg := &models.WebSocketMessage{
		Type: models.MSG_SUCCESS,
		Payload: map[string]interface{}{
			"message":     "Connected successfully",
			"playerId":    player.WebSocketID,
			"lobbyId":     lh.lobby.ID,
			"playerCount": len(lh.lobby.Players),
		},
	}
	lh.sendToPlayer(player, welcomeMsg)

	// Broadcast player joined to others
	lh.broadcastToLobby("", &models.WebSocketMessage{
		Type: models.MSG_PLAYER_JOINED,
		Payload: &models.PlayerJoinedEvent{
			Player:      player,
			PlayerCount: len(lh.lobby.Players),
			Message:     "Player joined the game",
		},
	})
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
				Payload: &models.PlayerLeftEvent{
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
		Type:    models.MSG_ERROR,
		Payload: errorResponse,
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
	case models.MSG_CHAT_MESSAGE:
		// Forward chat message to all players
		lh.hub.Broadcast <- message
	case models.MSG_PING:
		lh.handlePing(player)
	default:
		log.Printf("Unknown message type: %s", message.Type)
	}
}

func (lh *LobbyHandler) handlePing(player *models.WebSocketPlayer) {
	pongMsg := &models.WebSocketMessage{
		Type:    models.MSG_PONG,
		Payload: map[string]interface{}{"timestamp": time.Now().Unix()},
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

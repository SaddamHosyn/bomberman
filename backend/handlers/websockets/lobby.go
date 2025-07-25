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
	hub *Hub
}

// Hub wraps the models.Hub and provides methods
type Hub struct {
	*models.Hub
	lobby *models.Lobby // Single lobby for all players
}

// NewHub creates a new hub instance
func NewHub() *Hub {
	modelsHub := &models.Hub{
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

	return &Hub{
		Hub:   modelsHub,
		lobby: singleLobby,
	}
}

// NewLobbyHandler creates a new lobby handler
func NewLobbyHandler() *LobbyHandler {
	hub := NewHub()
	go hub.Run()
	return &LobbyHandler{hub: hub}
}

// Run starts the hub's main event loop
func (h *Hub) Run() {
	for {
		select {
		case player := <-h.Register:
			h.registerPlayer(player)

		case player := <-h.Unregister:
			h.unregisterPlayer(player)

		case message := <-h.Broadcast:
			h.broadcastMessage(message)
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
		ID:          generatePlayerID(),
		Conn:        conn,
		Send:        make(chan []byte, 256),
		IsConnected: true,
		IsActive:    true,
		JoinedAt:    time.Now(),
		PowerUps:    make([]string, 0),
	}

	// Register player with hub
	lh.hub.Register <- player

	// Start goroutines for this player
	go lh.writePump(player)
	go lh.readPump(player)
}

// Hub Methods

func (h *Hub) registerPlayer(player *models.WebSocketPlayer) {
	h.Mutex.Lock()
	defer h.Mutex.Unlock()

	h.Players[player.ID] = player
	log.Printf("Player %s connected", player.ID)

	// Automatically add player to the single lobby
	h.lobby.Mutex.Lock()
	player.LobbyID = h.lobby.ID
	h.lobby.Players[player.ID] = player

	// Set first player as host if no host exists
	if h.lobby.Host == "" {
		h.lobby.Host = player.ID
	}
	h.lobby.Mutex.Unlock()

	// Send welcome message
	welcomeMsg := &models.WebSocketMessage{
		Type: models.MSG_SUCCESS,
		Payload: map[string]interface{}{
			"message":     "Connected successfully",
			"playerId":    player.ID,
			"lobbyId":     h.lobby.ID,
			"playerCount": len(h.lobby.Players),
		},
	}
	h.sendToPlayer(player, welcomeMsg)

	// Broadcast player joined to others
	h.broadcastToLobby("", &models.WebSocketMessage{
		Type: models.MSG_PLAYER_JOINED,
		Payload: &models.PlayerJoinedEvent{
			Player:      player,
			PlayerCount: len(h.lobby.Players),
			Message:     "Player joined the game",
		},
	})
}

func (h *Hub) unregisterPlayer(player *models.WebSocketPlayer) {
	h.Mutex.Lock()
	defer h.Mutex.Unlock()

	if _, exists := h.Players[player.ID]; exists {
		// Remove from the single lobby
		h.lobby.Mutex.Lock()
		delete(h.lobby.Players, player.ID)
		playerCount := len(h.lobby.Players)

		// Reassign host if needed
		if h.lobby.Host == player.ID && playerCount > 0 {
			for playerID := range h.lobby.Players {
				h.lobby.Host = playerID
				break
			}
		}
		h.lobby.Mutex.Unlock()

		delete(h.Players, player.ID)
		close(player.Send)
		player.IsConnected = false
		log.Printf("Player %s disconnected", player.ID)

		// Broadcast player left to others
		if playerCount > 0 {
			h.broadcastToLobby("", &models.WebSocketMessage{
				Type: models.MSG_PLAYER_LEFT,
				Payload: &models.PlayerLeftEvent{
					PlayerID:    player.ID,
					Nickname:    player.Nickname,
					PlayerCount: playerCount,
					Message:     "Player left the game",
				},
			})
		}
	}
}

// Message Broadcasting
func (h *Hub) broadcastMessage(message *models.WebSocketMessage) {
	// Handle different message types
	switch message.Type {
	case models.MSG_CHAT_MESSAGE:
		// Handle chat messages - broadcast to all players in lobby
		h.broadcastToLobby("", message)
	default:
		// Handle other message types
		h.broadcastToLobby("", message)
	}
}

func (h *Hub) broadcastToLobby(lobbyID string, message *models.WebSocketMessage) {
	// Use the single lobby (ignore lobbyID since there's only one)
	lobby := h.lobby

	lobby.Mutex.RLock()
	defer lobby.Mutex.RUnlock()

	for _, player := range lobby.Players {
		h.sendToPlayer(player, message)
	}
}

func (h *Hub) sendToPlayer(player *models.WebSocketPlayer, message *models.WebSocketMessage) {
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
		delete(h.Players, player.ID)
	}
}

func (h *Hub) sendError(player *models.WebSocketPlayer, errMsg string) {
	errorResponse := &models.ErrorResponse{
		Code:    400,
		Message: errMsg,
		Type:    "error",
	}

	message := &models.WebSocketMessage{
		Type:    models.MSG_ERROR,
		Payload: errorResponse,
	}

	h.sendToPlayer(player, message)
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
	lh.hub.sendToPlayer(player, pongMsg)
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
	return lh.hub.lobby
}

// GetPlayerCount returns current player count
func (lh *LobbyHandler) GetPlayerCount() int {
	lh.hub.Mutex.RLock()
	defer lh.hub.Mutex.RUnlock()
	return len(lh.hub.lobby.Players)
}

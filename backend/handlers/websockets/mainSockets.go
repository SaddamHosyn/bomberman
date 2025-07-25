package websockets

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"bomber/backend/handlers/utils"
	"bomber/backend/models"

	"github.com/gorilla/websocket"
)

// ChatHub manages chat-specific WebSocket connections
type ChatHub struct {
	Clients          map[string]*models.Client
	RegisterClient   chan *models.Client
	UnregisterClient chan *models.Client
	Broadcast        chan *models.WebSocketMessage
	Mutex            sync.RWMutex
}

// WebSocketManager wraps the chat hub and provides methods
type WebSocketManager struct {
	Hub *ChatHub
}

// Global manager instance
var globalManager *WebSocketManager

// Initialize the global manager
func init() {
	globalManager = &WebSocketManager{
		Hub: &ChatHub{
			Clients:          make(map[string]*models.Client),
			RegisterClient:   make(chan *models.Client),
			UnregisterClient: make(chan *models.Client),
			Broadcast:        make(chan *models.WebSocketMessage),
		},
	}

	// Start the hub in a goroutine
	go globalManager.Run()
}

// Run handles the main hub logic
func (wm *WebSocketManager) Run() {
	for {
		select {
		case client := <-wm.Hub.RegisterClient:
			wm.registerClient(client)

		case client := <-wm.Hub.UnregisterClient:
			wm.unregisterClient(client)

		case message := <-wm.Hub.Broadcast:
			wm.broadcastMessage(message)
		}
	}
}

// registerClient adds a new client to the hub
func (wm *WebSocketManager) registerClient(client *models.Client) {
	wm.Hub.Clients[client.ID] = client
	client.IsActive = true

	log.Printf("Client %s (%s) connected. Total clients: %d",
		client.ID, client.Nickname, len(wm.Hub.Clients))
}

// unregisterClient removes a client from the hub and handles cleanup
func (wm *WebSocketManager) unregisterClient(client *models.Client) {
	if _, ok := wm.Hub.Clients[client.ID]; ok {
		// Close the send channel and remove from clients
		close(client.Send)
		delete(wm.Hub.Clients, client.ID)
		client.IsActive = false

		log.Printf("Client %s (%s) disconnected. Total clients: %d",
			client.ID, client.Nickname, len(wm.Hub.Clients))
	}
}

// broadcastMessage sends a message to specific clients or all clients
func (wm *WebSocketManager) broadcastMessage(message *models.WebSocketMessage) {
	data, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling broadcast message: %v", err)
		return
	}

	// Broadcast to all clients
	wm.broadcastToAll(data)
}

// broadcastToAll sends message to all connected clients
func (wm *WebSocketManager) broadcastToAll(data []byte) {
	for _, client := range wm.Hub.Clients {
		if client.IsActive {
			select {
			case client.Send <- data:
			default:
				// Client's send channel is blocked, remove them
				close(client.Send)
				delete(wm.Hub.Clients, client.ID)
				client.IsActive = false
			}
		}
	}
}

// WebSocketHandler handles new WebSocket connections
func WebSocketHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	// Create a new client
	client := &models.Client{
		ID:       utils.GenerateClientID(),
		Nickname: "",
		Send:     make(chan []byte, 256),
		IsActive: true,
	}

	// Register the client with the hub
	globalManager.Hub.RegisterClient <- client

	// Start goroutines for reading and writing
	go writePump(client, conn)
	go readPump(client, conn, globalManager)
}

// readPump handles reading messages from the WebSocket connection
func readPump(client *models.Client, conn *websocket.Conn, manager *WebSocketManager) {
	defer func() {
		manager.Hub.UnregisterClient <- client
		conn.Close()
	}()

	// Set read deadline and pong handler
	conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		var message models.WebSocketMessage
		err := conn.ReadJSON(&message)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		// Handle the received message
		handleMessage(client, &message, manager)
	}
}

// writePump handles writing messages to the WebSocket connection
func writePump(client *models.Client, conn *websocket.Conn) {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		conn.Close()
	}()

	for {
		select {
		case message, ok := <-client.Send:
			conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				// Channel was closed
				conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := conn.WriteMessage(websocket.TextMessage, message); err != nil {
				log.Printf("Error writing message: %v", err)
				return
			}

		case <-ticker.C:
			conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// handleMessage processes different types of messages from clients
func handleMessage(client *models.Client, message *models.WebSocketMessage, manager *WebSocketManager) {
	switch message.Type {
	case "chat_message":
		handleChatMessage(client, message, manager)
	case "ping":
		handlePing(client, manager)
	case "chat_history":
		handleChatHistory(client, message, manager)
	default:
		log.Printf("Unknown message type: %s", message.Type)
		utils.SendError(client, "Unknown message type")
	}
}

// handlePing responds to ping messages
func handlePing(client *models.Client, manager *WebSocketManager) {
	response := models.WebSocketMessage{
		Type:    "pong",
		Payload: map[string]interface{}{"timestamp": time.Now()},
	}
	utils.SendMessage(client, &response)
}

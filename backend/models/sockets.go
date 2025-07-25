package models

import (
	"time"
)

type WebSocketPlayer struct {
	Player                // Embed existing Player struct
	Nickname     string   `json:"nickname"`
	ConnectionID string   `json:"connectionId"`
	IsConnected  bool     `json:"isConnected"`
	PowerUps     []string `json:"powerUps"`
}

type ChatMessage struct {
	ID        string    `json:"id"`
	PlayerID  string    `json:"playerId"`
	Nickname  string    `json:"nickname"`
	Message   string    `json:"message"`
	Timestamp time.Time `json:"timestamp"`
	Type      string    `json:"type"` // "chat", "system", "join", "leave"
}

type WebSocketMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

type ChatMessageRequest struct {
	Message string `json:"message"`
}

type Client struct {
	ID       string
	Nickname string
	LobbyID  string
	Send     chan []byte
	IsActive bool
}

type Hub struct {
	Clients    map[string]*Client // Using string ID as key
	Lobbies    map[string]*Lobby
	Register   chan *Client
	Unregister chan *Client
	Broadcast  chan *WebSocketMessage
}

type ErrorResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Type    string `json:"type"`
}

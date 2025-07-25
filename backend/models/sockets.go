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

type Lobby struct {
	ID          string                      `json:"id"`
	Players     map[string]*WebSocketPlayer `json:"players"`
	MaxPlayers  int                         `json:"maxPlayers"`
	MinPlayers  int                         `json:"minPlayers"`
	GameStarted bool                        `json:"gameStarted"`
	CreatedAt   time.Time                   `json:"createdAt"`
	Messages    []ChatMessage               `json:"messages"`
	WaitTimer   int                         `json:"waitTimer"`
	StartTimer  int                         `json:"startTimer"`
}

type LobbyUpdate struct {
	Lobby       *Lobby `json:"lobby"`
	PlayerCount int    `json:"playerCount"`
	TimeLeft    int    `json:"timeLeft,omitempty"`
	Status      string `json:"status"` // "waiting", "starting", "playing"
}

type PlayerJoinedEvent struct {
	Player      *WebSocketPlayer `json:"player"`
	PlayerCount int              `json:"playerCount"`
	Message     string           `json:"message"`
}

type PlayerLeftEvent struct {
	PlayerID    string `json:"playerId"`
	Nickname    string `json:"nickname"`
	PlayerCount int    `json:"playerCount"`
	Message     string `json:"message"`
}

type GameStartEvent struct {
	LobbyID   string                      `json:"lobbyId"`
	Players   map[string]*WebSocketPlayer `json:"players"`
	Map       [][]int                     `json:"map"`
	StartTime time.Time                   `json:"startTime"`
}

type JoinLobbyRequest struct {
	Nickname string `json:"nickname"`
	LobbyID  string `json:"lobbyId,omitempty"`
}

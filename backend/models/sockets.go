package models

import (
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// SessionData stores player session information
type SessionData struct {
	SessionID      string             `json:"sessionId"`
	PlayerID       string             `json:"playerId"`
	Nickname       string             `json:"nickname"`
	LobbyID        string             `json:"lobbyId"`
	LastActiveTime time.Time          `json:"lastActiveTime"`
	CurrentScreen  string             `json:"currentScreen"`
	IsActive       bool               `json:"isActive"`
	MissedEvents   []WebSocketMessage `json:"missedEvents"`
	LastSyncTime   time.Time          `json:"lastSyncTime"`
}

// Client represents a WebSocket connection (network level)
type Client struct {
	ID       string          `json:"id"`
	Nickname string          `json:"nickname"`
	Conn     *websocket.Conn `json:"-"` // WebSocket connection
	Send     chan []byte     `json:"-"` // Send channel
	IsActive bool            `json:"isActive"`
	JoinedAt time.Time       `json:"joinedAt"`
}

// Main WebSocket player struct - handles both connection and game data
type WebSocketPlayer struct {
	Player                       // Embed game Player struct
	WebSocketID  string          `json:"webSocketId"` // WebSocket-specific ID (different from game Player.ID)
	ConnectionID string          `json:"connectionId"`
	LobbyID      string          `json:"lobbyId"`
	Conn         *websocket.Conn `json:"-"` // WebSocket connection
	Send         chan []byte     `json:"-"` // Send channel
	IsConnected  bool            `json:"isConnected"`
	IsActive     bool            `json:"isActive"`
	JoinedAt     time.Time       `json:"joinedAt"`
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
	Type string      `json:"type"`
	Data interface{} `json:"data"` // ← Should be "data"
}

type ChatMessageRequest struct {
	Message string `json:"message"`
}

type Hub struct {
	// Players for lobby system
	Players map[string]*WebSocketPlayer `json:"players"`

	// Connection management for Players (lobby system)
	Register   chan *WebSocketPlayer
	Unregister chan *WebSocketPlayer
	Broadcast  chan *WebSocketMessage

	// Thread safety
	Mutex sync.RWMutex `json:"-"`
}

type ErrorResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Type    string `json:"type"`
}

type Lobby struct {
	ID          string                      `json:"id"`
	Name        string                      `json:"name"`
	Players     map[string]*WebSocketPlayer `json:"players"`
	MaxPlayers  int                         `json:"maxPlayers"`
	MinPlayers  int                         `json:"minPlayers"`
	GameStarted bool                        `json:"gameStarted"`
	CreatedAt   time.Time                   `json:"createdAt"`
	Messages    []ChatMessage               `json:"messages"`
	WaitTimer   int                         `json:"waitTimer"`
	StartTimer  int                         `json:"startTimer"`
	Host        string                      `json:"host"`
	Status      string                      `json:"status"` // "waiting", "starting", "playing"
	Mutex       sync.RWMutex                `json:"-"`
}

type LobbyUpdate struct {
	Lobby       *Lobby `json:"lobby"`
	PlayerCount int    `json:"playerCount"`
	TimeLeft    int    `json:"timeLeft,omitempty"`
	Status      string `json:"status"` // "waiting", "starting", "playing"
}

// Request structs
type JoinLobbyRequest struct {
	Nickname string `json:"nickname"`
	LobbyID  string `json:"lobbyId,omitempty"`
	PlayerID string `json:"playerId"`
}

type LeaveLobbyRequest struct {
	PlayerID string `json:"playerId"`
	LobbyID  string `json:"lobbyId"`
}

// Event structs
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

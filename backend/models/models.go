package models

import (
	"github.com/gorilla/websocket"
	"sync"
	"time"
)

type GameStatus int

const (
	WaitingForPlayers GameStatus = iota
	Countdown
	InProgress
	Finished
)

type GameState struct {
	Players   []*Player
	Map       *Map
	Bombs     []*Bomb
	Flames    []*Flame
	PowerUps  []*ActivePowerUp
	Status    GameStatus
	Winner    *Player // nil until game is Finished
	Countdown int     // for game start countdown
}

type Map struct {
	Width  int
	Height int
	Walls  []*Wall
	Blocks []*Block
}

type Block struct {
	Position      Position
	Destroyed     bool
	HiddenPowerUp *PowerUp // nil if no power-up
}

type Wall struct {
	Position Position
}

type Player struct {
	ID          string // Unique identifier for the player
	Name        string
	Lives       int
	Position    Position
	SpawnPoint  Position
	BombsPlaced int
	Alive       bool
	Score       int
	Speed       int
	BombCount   int
	FlameRange  int
}

type Position struct {
	X int
	Y int
}

type Bomb struct {
	Position   Position
	OwnerID    string
	Timer      int
	FlameRange int
}

type Flame struct {
	Position Position
	Timer    int
}

type PowerUp struct {
	Type PowerUpType
}

type PowerUpType int

const (
	None PowerUpType = iota
	SpeedUp
	FlameUp
	BombUp
)

type ActivePowerUp struct {
	Position Position
	Type     PowerUpType
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
	Type      string    `json:"type"` // "chat", "system", "join"
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

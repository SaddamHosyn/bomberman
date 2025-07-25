package models

import "time"

type Player struct {
	ID          int
	Name        string
	Lives       int
	Position    Position
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
	OwnerID    int
	Timer      int
	FlameRange int
}

type GameState struct {
	Players []*Player
	Blocks  []*Block
	Walls   []*Wall
	Bombs   []*Bomb
	// Add more fields as needed (e.g., map size, game timer)
}
type WebSocketPlayer struct {
	Player                // Embed existing Player struct
	Nickname     string   `json:"nickname"`
	ConnectionID string   `json:"connectionId"`
	IsConnected  bool     `json:"isConnected"`
	PowerUps     []string `json:"powerUps"`
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

type Block struct {
	Position      Position
	Destroyed     bool
	HiddenPowerUp *PowerUp // nil if no power-up
}

type Wall struct {
	Position Position
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

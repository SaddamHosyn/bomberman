package backend

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

type ChatMessage struct {
	PlayerName string
	Message    string
}

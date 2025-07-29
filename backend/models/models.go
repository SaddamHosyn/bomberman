package models

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





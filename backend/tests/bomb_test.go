package tests

import (
	"bomberman-dom/backend"
	"testing"
)

// TestBombExplosionDamagesPlayer verifies that a player is damaged by an exploding bomb.
func TestBombExplosionDamagesPlayer(t *testing.T) {
	// 1. Arrange: Set up the game state
	player := &backend.Player{
		ID:         1,
		Position:   backend.Position{X: 1, Y: 1},
		Lives:      3,
		Alive:      true,
		FlameRange: 1,
		BombCount:  1,
	}

	gs := &backend.GameState{
		Players: []*backend.Player{player},
		Map: &backend.Map{
			Width:  15,
			Height: 13,
			Walls:  []*backend.Wall{},
			Blocks: []*backend.Block{},
		},
		Bombs:  []*backend.Bomb{},
		Flames: []*backend.Flame{},
	}

	// 2. Act: The player places a bomb, and we simulate time until it explodes.
	backend.PlaceBomb(gs, player)

	// Check if bomb was placed
	if len(gs.Bombs) != 1 {
		t.Fatalf("Expected a bomb to be placed, but found %d bombs", len(gs.Bombs))
	}

	// Simulate game ticks to make the bomb explode
	for i := 0; i < backend.BombTimer; i++ {
		backend.UpdateBombs(gs)
	}

	// 3. Assert: Check if the player's state has changed correctly.
	if len(gs.Bombs) != 0 {
		t.Errorf("Expected bombs to be cleared after explosion, but found %d", len(gs.Bombs))
	}

	if player.Lives != 2 {
		t.Errorf("Expected player lives to be 2 after explosion, but got %d", player.Lives)
	}

	if !player.Alive {
		t.Error("Expected player to be alive, but they are not")
	}
}

// TestFlameStopsAtWall verifies that flames do not pass through indestructible walls.
func TestFlameStopsAtWall(t *testing.T) {
	// Arrange: Player at (1,1), Wall at (3,1), FlameRange is long enough to reach.
	player := &backend.Player{ID: 1, Position: backend.Position{X: 1, Y: 1}, FlameRange: 3, Alive: true, BombCount: 1}
	wall := &backend.Wall{Position: backend.Position{X: 3, Y: 1}}
	gs := &backend.GameState{
		Players: []*backend.Player{player},
		Map: &backend.Map{
			Width:  15,
			Height: 13,
			Walls:  []*backend.Wall{wall},
		},
	}

	// Act: Place a bomb and wait for it to explode.
	backend.PlaceBomb(gs, player)
	for i := 0; i < backend.BombTimer; i++ {
		backend.UpdateBombs(gs)
	}

	// Assert: Check which tiles have flames.
	flamePositions := make(map[backend.Position]bool)
	for _, flame := range gs.Flames {
		flamePositions[flame.Position] = true
	}

	if !flamePositions[backend.Position{X: 2, Y: 1}] {
		t.Error("Expected flame to exist at (2,1), before the wall")
	}
	if flamePositions[backend.Position{X: 3, Y: 1}] {
		t.Error("Did not expect flame at wall position (3,1)")
	}
	if flamePositions[backend.Position{X: 4, Y: 1}] {
		t.Error("Did not expect flame to pass through wall to (4,1)")
	}
}

// TestFlameDestroysBlock verifies that flames destroy blocks and stop.
func TestFlameDestroysBlock(t *testing.T) {
	// Arrange: Player at (1,1), Block at (3,1), FlameRange is long enough.
	player := &backend.Player{ID: 1, Position: backend.Position{X: 1, Y: 1}, FlameRange: 3, Alive: true, BombCount: 1}
	block := &backend.Block{Position: backend.Position{X: 3, Y: 1}, Destroyed: false}
	gs := &backend.GameState{
		Players: []*backend.Player{player},
		Map: &backend.Map{
			Width:  15,
			Height: 13,
			Blocks: []*backend.Block{block},
		},
	}

	// Act: Place a bomb and wait for it to explode.
	backend.PlaceBomb(gs, player)
	for i := 0; i < backend.BombTimer; i++ {
		backend.UpdateBombs(gs)
	}

	// Assert: Check flame positions and block status.
	flamePositions := make(map[backend.Position]bool)
	for _, flame := range gs.Flames {
		flamePositions[flame.Position] = true
	}

	if !flamePositions[backend.Position{X: 3, Y: 1}] {
		t.Error("Expected flame to exist at block's position (3,1)")
	}
	if flamePositions[backend.Position{X: 4, Y: 1}] {
		t.Error("Did not expect flame to pass through the destroyed block to (4,1)")
	}
	if !block.Destroyed {
		t.Error("Expected block at (3,1) to be destroyed, but it was not")
	}
}

// TestFlameDestroysPowerUp verifies that flames destroy active power-ups on the ground.
func TestFlameDestroysPowerUp(t *testing.T) {
	// Arrange: Player at (1,1), PowerUp at (3,1), FlameRange is long enough.
	player := &backend.Player{ID: 1, Position: backend.Position{X: 1, Y: 1}, FlameRange: 3, Alive: true, BombCount: 1}
	powerUp := &backend.ActivePowerUp{
		Position: backend.Position{X: 3, Y: 1},
		Type:     backend.SpeedUp,
	}
	gs := &backend.GameState{
		Players:  []*backend.Player{player},
		PowerUps: []*backend.ActivePowerUp{powerUp},
		Map: &backend.Map{
			Width:  15,
			Height: 13,
		},
	}

	// Act: Place a bomb and wait for it to explode.
	backend.PlaceBomb(gs, player)
	for i := 0; i < backend.BombTimer; i++ {
		backend.UpdateBombs(gs)
	}

	// Assert: Check that the power-up has been removed from the game state.
	if len(gs.PowerUps) != 0 {
		t.Errorf("Expected power-up to be destroyed by flame, but %d remain", len(gs.PowerUps))
	}
}

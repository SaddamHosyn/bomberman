package tests

import (
	"bomberman-dom/backend"
	"testing"
)

// TestNewGame verifies that the game state is initialized correctly.
func TestNewGame(t *testing.T) {
	// Arrange
	p1 := &backend.Player{ID: 1, Name: "Player 1"}
	p2 := &backend.Player{ID: 2, Name: "Player 2"}
	players := []*backend.Player{p1, p2}

	// Act
	gs := backend.NewGame(players)

	// Assert
	if gs == nil {
		t.Fatal("NewGame returned a nil GameState")
	}
	if len(gs.Players) != 2 {
		t.Errorf("Expected 2 players, but got %d", len(gs.Players))
	}
	if gs.Map == nil {
		t.Error("Expected a map to be generated, but it was nil")
	}
	if gs.Status != backend.InProgress {
		t.Errorf("Expected game status to be InProgress, but got %v", gs.Status)
	}
	if len(gs.Bombs) != 0 || len(gs.Flames) != 0 || len(gs.PowerUps) != 0 {
		t.Error("Expected Bombs, Flames, and PowerUps to be empty on initialization")
	}
}

// TestGameTick_GameOverFlow simulates a full game scenario from start to finish.
func TestGameTick_GameOverFlow(t *testing.T) {
	// Arrange: Create a game with two players.
	p1 := &backend.Player{ID: 1, Position: backend.Position{X: 1, Y: 1}, Lives: 1, Alive: true}
	p2 := &backend.Player{ID: 2, Position: backend.Position{X: 10, Y: 10}, Lives: 1, Alive: true}
	gs := backend.NewGame([]*backend.Player{p1, p2})

	// Place a bomb at Player 1's position, which will lead to their death.
	bomb := &backend.Bomb{
		Position:   p1.Position,
		OwnerID:    p1.ID,
		Timer:      backend.BombTimer,
		FlameRange: 1,
	}
	gs.Bombs = append(gs.Bombs, bomb)

	// Act: Run the game loop until the bomb explodes and flames disappear.
	// We run it for longer than the bomb timer to ensure all updates happen.
	totalTicks := backend.BombTimer + backend.FlameTime
	for i := 0; i < totalTicks; i++ {
		backend.GameTick(gs)
	}

	// Assert: Check that the game has ended correctly.
	if gs.Status != backend.Finished {
		t.Errorf("Expected game status to be Finished, but got %v", gs.Status)
	}
	if p1.Alive {
		t.Error("Expected Player 1 to be dead, but they are alive")
	}
	if !p2.Alive {
		t.Error("Expected Player 2 to be alive, but they are dead")
	}
	if gs.Winner == nil {
		t.Fatal("Expected a winner to be declared, but gs.Winner is nil")
	}
	if gs.Winner.ID != p2.ID {
		t.Errorf("Expected Player 2 to be the winner, but winner was ID %d", gs.Winner.ID)
	}
}

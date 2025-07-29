package tests

import (
	"bomberman-dom/backend"
	"testing"
)

// setupTestGameState creates a basic game state for testing purposes.
func setupTestGameState() (*backend.GameState, *backend.Player) {
	player := &backend.Player{
		ID:       1,
		Position: backend.Position{X: 5, Y: 5},
		Alive:    true,
	}
	gs := &backend.GameState{
		Players: []*backend.Player{player},
		Map: &backend.Map{
			Width:  15,
			Height: 13,
			Walls:  []*backend.Wall{},
			Blocks: []*backend.Block{},
		},
		Bombs:    []*backend.Bomb{},
		PowerUps: []*backend.ActivePowerUp{},
	}
	return gs, player
}

func TestPlayerMovement_Success(t *testing.T) {
	gs, player := setupTestGameState()
	initialPos := player.Position

	backend.MovePlayer(player, "right", gs)

	if player.Position.X != initialPos.X+1 {
		t.Errorf("Expected player to move right. Got position %v", player.Position)
	}
}

func TestPlayerMovement_CollisionWithWall(t *testing.T) {
	gs, player := setupTestGameState()
	initialPos := player.Position
	gs.Map.Walls = append(gs.Map.Walls, &backend.Wall{Position: backend.Position{X: initialPos.X + 1, Y: initialPos.Y}})

	backend.MovePlayer(player, "right", gs)

	if player.Position != initialPos {
		t.Errorf("Expected player to be blocked by wall. Got position %v", player.Position)
	}
}

func TestPlayerMovement_CollisionWithBlock(t *testing.T) {
	gs, player := setupTestGameState()
	initialPos := player.Position
	gs.Map.Blocks = append(gs.Map.Blocks, &backend.Block{Position: backend.Position{X: initialPos.X + 1, Y: initialPos.Y}})

	backend.MovePlayer(player, "right", gs)

	if player.Position != initialPos {
		t.Errorf("Expected player to be blocked by block. Got position %v", player.Position)
	}
}

func TestPlayerMovement_CollisionWithOtherPlayer(t *testing.T) {
	gs, player := setupTestGameState()
	initialPos := player.Position
	otherPlayer := &backend.Player{ID: 2, Position: backend.Position{X: initialPos.X + 1, Y: initialPos.Y}, Alive: true}
	gs.Players = append(gs.Players, otherPlayer)

	backend.MovePlayer(player, "right", gs)

	if player.Position != initialPos {
		t.Errorf("Expected player to be blocked by other player. Got position %v", player.Position)
	}
}

func TestPlayerMovement_WalkOffBomb(t *testing.T) {
	gs, player := setupTestGameState()
	initialPos := player.Position
	// Player is standing on the bomb they just placed
	gs.Bombs = append(gs.Bombs, &backend.Bomb{Position: initialPos, OwnerID: player.ID})

	backend.MovePlayer(player, "right", gs)

	// Player should be able to move off the bomb
	if player.Position.X != initialPos.X+1 {
		t.Errorf("Expected player to walk off their bomb. Got position %v", player.Position)
	}
}

func TestPlayerMovement_CannotWalkOntoBomb(t *testing.T) {
	gs, player := setupTestGameState()
	initialPos := player.Position
	// A bomb is one tile away
	gs.Bombs = append(gs.Bombs, &backend.Bomb{Position: backend.Position{X: initialPos.X + 1, Y: initialPos.Y}, OwnerID: player.ID})

	backend.MovePlayer(player, "right", gs)

	// Player should NOT be able to move onto the bomb
	if player.Position != initialPos {
		t.Errorf("Expected player to be blocked by bomb. Got position %v", player.Position)
	}
}

func TestPlayerPickup_PowerUp(t *testing.T) {
	gs, player := setupTestGameState()
	powerUpPos := backend.Position{X: player.Position.X + 1, Y: player.Position.Y}
	gs.PowerUps = append(gs.PowerUps, &backend.ActivePowerUp{Position: powerUpPos, Type: backend.SpeedUp})

	// Move player onto the power-up
	backend.MovePlayer(player, "right", gs)
	backend.CheckPowerUpPickups(gs)

	if player.Speed != 1 {
		t.Errorf("Expected player speed to be 1 after pickup, but got %d", player.Speed)
	}
	if len(gs.PowerUps) != 0 {
		t.Errorf("Expected power-up to be removed from map, but %d remain", len(gs.PowerUps))
	}
}

func TestPlayerMovement_WithSpeedUp(t *testing.T) {
	gs, player := setupTestGameState()
	player.Speed = 1 // Player has a speed power-up (moves 2 tiles)
	initialPos := player.Position

	// Place a wall 3 tiles away, which should not be reached
	gs.Map.Walls = append(gs.Map.Walls, &backend.Wall{Position: backend.Position{X: initialPos.X + 3, Y: initialPos.Y}})

	backend.MovePlayer(player, "right", gs)

	// Player should move 2 tiles
	if player.Position.X != initialPos.X+2 {
		t.Errorf("Expected player with speed 1 to move 2 tiles. Got position %v", player.Position)
	}

	// Now, place a wall 2 tiles away, which should block the movement
	player.Position = initialPos // Reset position
	gs.Map.Walls[0].Position = backend.Position{X: initialPos.X + 2, Y: initialPos.Y}

	backend.MovePlayer(player, "right", gs)

	// Player should only move 1 tile and stop before the wall
	if player.Position.X != initialPos.X+1 {
		t.Errorf("Expected player to stop at wall. Got position %v", player.Position)
	}
}

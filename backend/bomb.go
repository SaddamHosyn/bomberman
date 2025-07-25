package backend

const (
	BombTimer = 150 // Ticks before explosion (e.g., 3 seconds at 50 ticks/sec)
	FlameTime = 25  // Ticks for how long flames last
)

// PlaceBomb adds a new bomb to the game state at the player's position.
func PlaceBomb(gs *GameState, player *Player) {
	// Check if player can place another bomb
	if player.BombsPlaced >= player.BombCount {
		return
	}

	// Check if there's already a bomb at this position
	for _, bomb := range gs.Bombs {
		if bomb.Position == player.Position {
			return
		}
	}

	player.BombsPlaced++

	bomb := &Bomb{
		Position:   player.Position,
		OwnerID:    player.ID,
		Timer:      BombTimer,
		FlameRange: player.FlameRange,
	}

	gs.Bombs = append(gs.Bombs, bomb)
}

// UpdateBombs iterates through all bombs, counts down their timers, and triggers explosions.
func UpdateBombs(gs *GameState) {
	var explodingBombs []*Bomb
	var remainingBombs []*Bomb

	// First, find all bombs that should explode in this tick
	for _, bomb := range gs.Bombs {
		bomb.Timer--
		if bomb.Timer <= 0 {
			explodingBombs = append(explodingBombs, bomb)
		} else {
			remainingBombs = append(remainingBombs, bomb)
		}
	}

	// Update the game state's bomb list
	gs.Bombs = remainingBombs

	// Create flames for each exploding bomb
	for _, bomb := range explodingBombs {
		// Find the owner and decrement their placed bomb count
		for _, p := range gs.Players {
			if p.ID == bomb.OwnerID {
				p.BombsPlaced--
				break
			}
		}
		CreateFlames(gs, bomb)
	}
}

// createFlames generates the flame objects for an exploding bomb.
func CreateFlames(gs *GameState, bomb *Bomb) {
	// Add flame at the bomb's center
	gs.Flames = append(gs.Flames, &Flame{Position: bomb.Position, Timer: FlameTime})

	// Directions: up, down, left, right
	dirs := []Position{{0, -1}, {0, 1}, {-1, 0}, {1, 0}}

	for _, dir := range dirs {
		for i := 1; i <= bomb.FlameRange; i++ {
			pos := Position{X: bomb.Position.X + dir.X*i, Y: bomb.Position.Y + dir.Y*i}

			// Stop flames if they hit an indestructible wall
			if isWall(gs, pos) {
				break
			}

			gs.Flames = append(gs.Flames, &Flame{Position: pos, Timer: FlameTime})

			// If the flame hits a destructible block, it stops spreading in that direction
			if isBlock(gs, pos) {
				break
			}
		}
	}
}

// destroyBlockAt finds a block at a given position, marks it as destroyed,
// and reveals a power-up if one is hidden. It returns true if a block was found and destroyed.
func isBlock(gs *GameState, pos Position) bool {
	for _, block := range gs.Map.Blocks {
		if !block.Destroyed && block.Position == pos {
			block.Destroyed = true
			// If the block has a power-up, add it to the active power-ups on the map.
			if block.HiddenPowerUp != nil {
				gs.PowerUps = append(gs.PowerUps, &ActivePowerUp{
					Position: block.Position,
					Type:     block.HiddenPowerUp.Type,
				})
				block.HiddenPowerUp = nil // Power-up is no longer hidden
			}
			return true
		}
	}
	return false
}

// checks if a position is an indestructible wall.
func isWall(gs *GameState, pos Position) bool {
	for _, wall := range gs.Map.Walls {
		if wall.Position == pos {
			return true
		}
	}
	return false
}

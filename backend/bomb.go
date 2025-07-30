package backend

import "bomberman-dom/backend/models"

const (
	BombTimer = 150 // Ticks before explosion (e.g., 3 seconds at 50 ticks/sec)
	FlameTime = 25  // Ticks for how long flames last
)

// PlaceBomb adds a new bomb to the game state at the player's position.
func PlaceBomb(gs *models.GameState, player *models.Player) {
	// Check if player can place another bomb

	if player.Alive && player.BombsPlaced >= player.BombCount {
		return
	}

	// Check if there's already a bomb at this position
	for _, bomb := range gs.Bombs {
		if bomb.Position == player.Position {
			return
		}
	}

	player.BombsPlaced++

	bomb := &models.Bomb{
		Position:   player.Position,
		OwnerID:    player.ID,
		Timer:      BombTimer,
		FlameRange: player.FlameRange,
	}

	gs.Bombs = append(gs.Bombs, bomb)
}

// UpdateBombs iterates through all bombs, counts down their timers, and triggers explosions.
func UpdateBombs(gs *models.GameState) {
	var explodingBombs []*models.Bomb
	var remainingBombs []*models.Bomb

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
func CreateFlames(gs *models.GameState, bomb *models.Bomb) {
	// Add flame at the bomb's center
	gs.Flames = append(gs.Flames, &models.Flame{Position: bomb.Position, Timer: FlameTime})
	isPlayer(gs, bomb.Position)  // Check if a player is on the bomb itself
	isPowerUp(gs, bomb.Position) // Check if a power-up is at the bomb's position

	// Directions: up, down, left, right
	dirs := []models.Position{{X: 0, Y: -1}, {X: 0, Y: 1}, {X: -1, Y: 0}, {X: 1, Y: 0}}

	for _, dir := range dirs {
		for i := 1; i <= bomb.FlameRange; i++ {
			pos := models.Position{X: bomb.Position.X + dir.X*i, Y: bomb.Position.Y + dir.Y*i}

			// Stop flames if they hit an indestructible wall
			if isWall(gs, pos) {
				break
			}

			gs.Flames = append(gs.Flames, &models.Flame{Position: pos, Timer: FlameTime})

			// Dmg players and/or PowerUps and dont stop flames
			isPlayer(gs, pos)
			isPowerUp(gs, pos)

			// If the flame hits a destructible block, it stops spreading in that direction
			if isBlock(gs, pos) {
				break
			}
		}
	}
}

// UpdateFlames reduces the timer on active flames and removes them when they expire.
func UpdateFlames(gs *models.GameState) {
	var remainingFlames []*models.Flame
	for _, flame := range gs.Flames {
		flame.Timer--
		if flame.Timer > 0 {
			remainingFlames = append(remainingFlames, flame)
		}
	}
	gs.Flames = remainingFlames
}

// Finds a block at a given position, marks it as destroyed,
// and reveals a power-up if one is hidden. It returns true if a block was found and destroyed.
func isBlock(gs *models.GameState, pos models.Position) bool {
	for _, block := range gs.Map.Blocks {
		if !block.Destroyed && block.Position == pos {
			block.Destroyed = true
			// If the block has a power-up, add it to the active power-ups on the map.
			if block.HiddenPowerUp != nil {
				gs.PowerUps = append(gs.PowerUps, &models.ActivePowerUp{
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
func isWall(gs *models.GameState, pos models.Position) bool {
	for _, wall := range gs.Map.Walls {
		if wall.Position == pos {
			return true
		}
	}
	return false
}

// isPlayer checks if an alive player is at a given position. If so, it reduces
// their lives and returns true to stop the flame.
func isPlayer(gs *models.GameState, pos models.Position) {
	for _, player := range gs.Players {
		if player.Alive && player.Position == pos {
			player.Lives--
			if player.Lives <= 0 {
				player.Alive = false
				// Optional: Add scoring logic here for the bomb owner
			}
		}
	}
}

// destroyPowerUpAt finds and removes a power-up at a given position.
func isPowerUp(gs *models.GameState, pos models.Position) {
	var remainingPowerUps []*models.ActivePowerUp
	for _, powerUp := range gs.PowerUps {
		// Keep the power-up only if its position does not match the flame's position.
		if powerUp.Position != pos {
			remainingPowerUps = append(remainingPowerUps, powerUp)
		}
	}
	// Replace the old slice with the new one that doesn't contain the destroyed power-up.
	gs.PowerUps = remainingPowerUps
}

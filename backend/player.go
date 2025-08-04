package main

import "bomberman-dom/models"

// MovePlayer updates a player's position based on their input and speed.
// It moves the player one step at a time for the total move amount,
// checking for collisions at each step to prevent "tunneling" through objects.
// If preciseMov is true, the player moves only 1 step regardless of speed boosts.
func MovePlayer(player *models.Player, direction string, gs *models.GameState, preciseMove ...bool) {
	if !player.Alive {
		return // Dead players can't move
	}

	// Determine move amount - if precise movement is requested, move only 1 step
	moveAmount := 1 + player.Speed
	if len(preciseMove) > 0 && preciseMove[0] {
		moveAmount = 1 // Precise movement: always move 1 step regardless of speed
	}

	// We check each step individually to prevent jumping over walls.
	for i := 0; i < moveAmount; i++ {
		targetPos := player.Position
		switch direction {
		case "up":
			targetPos.Y--
		case "down":
			targetPos.Y++
		case "left":
			targetPos.X--
		case "right":
			targetPos.X++
		}

		if isPositionValid(targetPos, player, gs) {
			// If the next step is valid, update the player's position.
			player.Position = targetPos
			
			// Check for power-up collection at each step to prevent skipping
			checkPlayerPowerUpPickup(player, gs)
		} else {
			// If the path is blocked, stop moving immediately.
			break
		}
	}
}

// isPositionValid checks if a given position is within map bounds and not occupied by a solid object.
func isPositionValid(pos models.Position, movingPlayer *models.Player, gs *models.GameState) bool {
	// 1. Check map boundaries (assuming a simple grid size)
	if pos.X < 0 || pos.X >= gs.Map.Width || pos.Y < 0 || pos.Y >= gs.Map.Height {
		return false
	}

	// 2. Check for collisions with Walls
	for _, wall := range gs.Map.Walls {
		if wall.Position == pos {
			return false
		}
	}

	// 3. Check for collisions with Blocks (only non-destroyed blocks block movement)
	for _, block := range gs.Map.Blocks {
		if block.Position == pos && !block.Destroyed {
			return false // Only non-destroyed blocks block movement
		}
	}

	// 4. Check for collisions with other Players
	for _, otherPlayer := range gs.Players {
		// A player cannot move onto a tile occupied by another player.
		if otherPlayer.ID != movingPlayer.ID && otherPlayer.Position == pos {
			return false
		}
	}

	// 5. Check for collisions with Bombs
	for _, bomb := range gs.Bombs {
		if bomb.Position == pos {
			// A bomb is solid UNLESS the player is currently standing on it.
			// This allows the "walk-off" mechanic but prevents walking back onto it.
			return movingPlayer.Position == bomb.Position
		}
	}

	return true // Position is valid
}

// IsGameOver checks if the game has concluded by counting the number of living players.
// It returns true if one or zero players are left alive, false otherwise.
func IsGameOver(gs *models.GameState) bool {
	aliveCount := 0
	for _, player := range gs.Players {
		if player.Alive {
			aliveCount++
		}
	}
	// The game is over if there is a single winner (1) or a draw (0).
	return aliveCount <= 1
}

// GetWinner finds and returns the last player who is still alive.
// It returns nil if there is no winner (e.g., a draw).
func GetWinner(gs *models.GameState) *models.Player {
	var lastAlivePlayer *models.Player
	for _, p := range gs.Players {
		if p.Alive {
			// If we find a second alive player, it's not over yet, so there's no winner.
			if lastAlivePlayer != nil {
				return nil
			}
			lastAlivePlayer = p
		}
	}
	return lastAlivePlayer // This will be the single winner, or nil if 0 are alive.
}

// UpdatePlayers handles per-tick updates for all players, like invincibility timers.
func UpdatePlayers(gs *models.GameState) {
	for _, player := range gs.Players {
		if player.Invincible > 0 {
			player.Invincible--
		}
	}
}

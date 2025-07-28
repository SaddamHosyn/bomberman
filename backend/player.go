package backend

// MovePlayer updates a player's position based on their input and speed.
// It moves the player one step at a time for the total move amount,
// checking for collisions at each step to prevent "tunneling" through objects.
func MovePlayer(player *Player, direction string, gs *GameState) {
	if !player.Alive {
		return // Dead players can't move
	}

	// A base speed of 1 means the player moves one tile per input.
	// Power-ups increase the number of steps taken.
	moveAmount := 1 + player.Speed

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
		} else {
			// If the path is blocked, stop moving immediately.
			break
		}
	}
}

// isPositionValid checks if a given position is within map bounds and not occupied by a solid object.
func isPositionValid(pos Position, movingPlayer *Player, gs *GameState) bool {
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

	// 3. Check for collisions with Blocks
	for _, block := range gs.Map.Blocks {
		if block.Position == pos {
			return false
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
			if movingPlayer.Position == bomb.Position {
				return true // Allow the move
			}
			// For all other cases (another player's bomb, or your own bomb you're not on), it's a wall.
			return false
		}
	}

	return true // Position is valid
}

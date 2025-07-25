package backend

// MovePlayer updates a player's position based on their input and speed.
// We will need to add collision detection with walls, blocks, and bombs later.
func MovePlayer(player *Player, direction string, gs *GameState) {
	// The 'Speed' stat will determine how many units the player moves per action.
	// For now, let's assume a base movement of 1 unit, modified by the speed stat.
	// A more complex implementation might use Speed to reduce movement cooldowns.
	moveAmount := 1 + player.Speed

	newPosition := player.Position

	switch direction {
	case "up":
		newPosition.Y -= moveAmount
	case "down":
		newPosition.Y += moveAmount
	case "left":
		newPosition.X -= moveAmount
	case "right":
		newPosition.X += moveAmount
	}

	// TODO: Add collision detection here.
	// For now, we'll just update the position.
	player.Position = newPosition
}

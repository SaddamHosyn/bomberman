package backend

// CheckPowerUpPickups iterates through players and active power-ups to see if any have been collected.
func CheckPowerUpPickups(gs *GameState) {
	var remainingPowerUps []*ActivePowerUp

	for _, powerUp := range gs.PowerUps {
		pickedUp := false
		for _, player := range gs.Players {
			// Check if a living player is on the same tile as the power-up
			if player.Alive && player.Position == powerUp.Position {
				applyPowerUp(player, powerUp.Type)
				pickedUp = true
				break // Only one player can pick it up
			}
		}
		// If no one picked it up, it remains on the map
		if !pickedUp {
			remainingPowerUps = append(remainingPowerUps, powerUp)
		}
	}
	gs.PowerUps = remainingPowerUps
}

// applyPowerUp modifies a player's stats based on the power-up type.
func applyPowerUp(player *Player, powerUpType PowerUpType) {
	switch powerUpType {
	case BombUp:
		player.BombCount++
	case FlameUp:
		player.FlameRange++
	case SpeedUp:
		player.Speed++ // We'll define what "Speed" means later in the movement logic
	}
}

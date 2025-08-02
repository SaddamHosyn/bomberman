package main

import (
	"bomberman-dom/models"
)

// CheckPowerUpPickups iterates through players and active power-ups to see if any have been collected.
func PowerUpPickups(gs *models.GameState) {
	var remainingPowerUps []*models.ActivePowerUp

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
func applyPowerUp(player *models.Player, powerUpType models.PowerUpType) {
	switch powerUpType {
	case models.BombUp:
		player.BombCount++
	case models.FlameUp:
		player.FlameRange++
	case models.SpeedUp:
		player.Speed++
	}
}

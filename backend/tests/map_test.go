package tests

import (
	"bomberman-dom/backend"
	"testing"
)

// TestGenerateMap verifies that the map creation logic works as expected.
func TestGenerateMap(t *testing.T) {
	// Arrange: Define standard map dimensions for the test.

	width := 15
	height := 13

	// Act: Generate the map.
	gameMap := backend.GenerateMap(width, height)

	// Assert: Check the generated map's properties.

	// 1. Verify the number of indestructible walls.
	// For a 15x13 map:
	// - Outer border walls: (15 * 2) + ((13 - 2) * 2) = 30 + 22 = 52
	// - Inner grid walls (at even coordinates): 6 rows * 5 columns = 30
	// - Total expected walls = 82
	expectedWalls := 82
	if len(gameMap.Walls) != expectedWalls {
		t.Errorf("Expected %d walls, but got %d", expectedWalls, len(gameMap.Walls))
	}

	// 2. Verify the number of destructible blocks.
	if len(gameMap.Blocks) != backend.TotalBlocks {
		t.Errorf("Expected %d blocks, but got %d", backend.TotalBlocks, len(gameMap.Blocks))
	}

	// 3. Verify the number and types of hidden power-ups.
	powerUpCounts := make(map[backend.PowerUpType]int)
	for _, block := range gameMap.Blocks {
		if block.HiddenPowerUp != nil {
			powerUpCounts[block.HiddenPowerUp.Type]++
		}
	}

	totalPowerUps := backend.BombPowerUps + backend.FlamePowerUps + backend.SpeedPowerUps
	if powerUpCounts[backend.BombUp]+powerUpCounts[backend.FlameUp]+powerUpCounts[backend.SpeedUp] != totalPowerUps {
		t.Errorf("Expected %d total power-ups, but found %d", totalPowerUps, len(powerUpCounts))
	}
	if powerUpCounts[backend.BombUp] != backend.BombPowerUps {
		t.Errorf("Expected %d BombUp power-ups, but found %d", backend.BombPowerUps, powerUpCounts[backend.BombUp])
	}
	if powerUpCounts[backend.FlameUp] != backend.FlamePowerUps {
		t.Errorf("Expected %d FlameUp power-ups, but found %d", backend.FlamePowerUps, powerUpCounts[backend.FlameUp])
	}
	if powerUpCounts[backend.SpeedUp] != backend.SpeedPowerUps {
		t.Errorf("Expected %d SpeedUp power-ups, but found %d", backend.SpeedPowerUps, powerUpCounts[backend.SpeedUp])
	}

	// 4. Verify that no blocks are placed in the protected spawn areas.
	for _, block := range gameMap.Blocks {
		pos := block.Position
		if backend.IsSpawnArea(pos.X, pos.Y, width, height) {
			t.Errorf("Found a block at protected spawn area position (%d, %d)", pos.X, pos.Y)
		}
	}
}

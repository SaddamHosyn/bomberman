package backend

import (
	"bomberman-dom/backend/models"
	"math/rand"
)

const (
	MapWidth      = 15
	MapHeight     = 13
	TotalBlocks   = 80
	SpeedPowerUps = 5
	FlamePowerUps = 5
	BombPowerUps  = 5
)

// GenerateMap creates a new map by calling helper functions to create the walls and blocks.
func GenerateMap(width, height int) *models.Map {
	// Seed the random number generator once.

	walls := GenerateWalls(width, height)
	blocks := GenerateBlocks(width, height, walls)

	return &models.Map{
		Width:  width,
		Height: height,
		Walls:  walls,
		Blocks: blocks,
	}
}

// generateWalls creates the indestructible walls in a fixed pattern.
// This includes the outer border and the inner grid, classic to Bomberman.
func GenerateWalls(width, height int) []*models.Wall {
	var walls []*models.Wall

	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			// Add outer border walls
			if y == 0 || y == height-1 || x == 0 || x == width-1 {
				walls = append(walls, &models.Wall{Position: models.Position{X: x, Y: y}})
			} else if x%2 == 0 && y%2 == 0 {
				// Add inner grid walls
				walls = append(walls, &models.Wall{Position: models.Position{X: x, Y: y}})
			}
		}
	}
	return walls
}

// generateBlocks places a fixed number of destructible blocks and power-ups randomly on the map.
func GenerateBlocks(width, height int, walls []*models.Wall) []*models.Block {
	// 1. Find all possible positions for blocks.
	wallMap := make(map[models.Position]bool)
	for _, wall := range walls {
		wallMap[wall.Position] = true
	}

	availablePositions := []models.Position{}
	for y := 1; y < height-1; y++ {
		for x := 1; x < width-1; x++ {
			pos := models.Position{X: x, Y: y}
			if !wallMap[pos] && !IsSpawnArea(x, y, width, height) {
				availablePositions = append(availablePositions, pos)
			}
		}
	}

	// 2. Shuffle the available positions to randomize block placement.
	rand.Shuffle(len(availablePositions), func(i, j int) {
		availablePositions[i], availablePositions[j] = availablePositions[j], availablePositions[i]
	})

	// 3. Create the list of power-ups to be placed.
	powerUps := []*models.PowerUp{}
	for i := 0; i < SpeedPowerUps; i++ {
		powerUps = append(powerUps, &models.PowerUp{Type: models.SpeedUp})
	}
	for i := 0; i < FlamePowerUps; i++ {
		powerUps = append(powerUps, &models.PowerUp{Type: models.FlameUp})
	}
	for i := 0; i < BombPowerUps; i++ {
		powerUps = append(powerUps, &models.PowerUp{Type: models.BombUp})
	}

	// 4. Create the blocks and assign power-ups.
	var blocks []*models.Block
	numBlocks := TotalBlocks
	if numBlocks > len(availablePositions) {
		numBlocks = len(availablePositions) // Ensure we don't place more blocks than available spots.
	}

	for i := 0; i < numBlocks; i++ {
		block := &models.Block{
			Position:  availablePositions[i],
			Destroyed: false,
		}
		// Assign a power-up to the first N blocks, where N is the total number of power-ups.
		if i < len(powerUps) {
			block.HiddenPowerUp = powerUps[i]
		}
		blocks = append(blocks, block)
	}

	// Shuffle the final block list so power-ups aren't always in the first blocks created.
	rand.Shuffle(len(blocks), func(i, j int) {
		blocks[i], blocks[j] = blocks[j], blocks[i]
	})

	return blocks
}

// isSpawnArea checks if a position is a player spawn point or an adjacent tile
// to ensure players have a safe starting zone.
func IsSpawnArea(x, y, width, height int) bool {
	// Top-left corner
	if (x == 1 && y == 1) || (x == 1 && y == 2) || (x == 2 && y == 1) {
		return true
	}
	// Top-right corner
	if (x == width-2 && y == 1) || (x == width-3 && y == 1) || (x == width-2 && y == 2) {
		return true
	}
	// Bottom-left corner
	if (x == 1 && y == height-2) || (x == 2 && y == height-2) || (x == 1 && y == height-3) {
		return true
	}
	// Bottom-right corner
	if (x == width-2 && y == height-2) || (x == width-3 && y == height-2) || (x == width-2 && y == height-3) {
		return true
	}
	return false
}

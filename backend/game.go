package backend

// NewGame initializes and returns a new GameState with players and a map.
func NewGame(players []*Player) *GameState {
	return &GameState{
		Players:  players,
		Map:      GenerateMap(MapWidth, MapHeight),
		Bombs:    []*Bomb{},
		Flames:   []*Flame{},
		PowerUps: []*ActivePowerUp{},
		Status:   InProgress, // Or a 'Starting' status with a countdown
	}
}

// GameTick is the main loop of the game. It updates the state of all objects.
// This function should be called repeatedly (e.g., by a ticker on the server).
func GameTick(gs *GameState) {
	if gs.Status != InProgress {
		return // Don't update the game if it's not running.
	}

	// --- UPDATE GAME OBJECTS ---
	// 1. Update bombs (countdown, explosions, create flames)
	UpdateBombs(gs)

	// 2. Update flames (countdown, removal)
	UpdateFlames(gs) // You will need to create this function

	// --- CHECK FOR INTERACTIONS ---
	// 3. Check for players picking up power-ups
	PowerUpPickups(gs)

	// --- CHECK GAME OVER CONDITION ---
	// 4. Check if the game has ended
	if IsGameOver(gs) {
		gs.Status = Finished
		gs.Winner = GetWinner(gs)
	}
}

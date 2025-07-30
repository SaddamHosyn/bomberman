package backend

import (
	"bomberman-dom/backend/handlers/websockets"
	"log"
	"net/http"
)

func main() {
	// Set up routes
	setupRoutes()

	// Start the server
	log.Println("🚀 Bomberman server starting on :8080")
	log.Println("📡 WebSocket endpoint: ws://localhost:8080/ws/lobby")
	log.Println("🌐 Frontend served at: http://localhost:8080")

	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatal("❌ Server failed to start:", err)
	}
}

func setupRoutes() {
	// Create lobby handler
	lobbyHandler := websockets.NewLobbyHandler()

	// WebSocket endpoint
	http.HandleFunc("/ws/lobby", lobbyHandler.ServeWS)

	// ADDED: Serve static files (frontend)
	// Assuming your frontend files are in a 'frontend' or 'static' directory
	fs := http.FileServer(http.Dir("./frontend/"))
	http.Handle("/", fs)

	// Alternative: If your frontend is in a different location
	// fs := http.FileServer(http.Dir("../frontend/"))
	// http.Handle("/", fs)
}

package main

import (
	"bomber/backend/handlers/websockets"
	"log"
	"net/http"
)

func main() {
	// Set up routes
	setupRoutes()

	// Start the server
	log.Println("🚀 Bomberman WebSocket server starting on :8080")
	log.Println("📡 WebSocket endpoint: ws://localhost:8080/ws/lobby")

	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatal("❌ Server failed to start:", err)
	}
}

func setupRoutes() {
	// Create lobby handler
	lobbyHandler := websockets.NewLobbyHandler()

	// WebSocket endpoint
	http.HandleFunc("/ws/lobby", lobbyHandler.ServeWS)
}

package main

import (
	"log"
	"net/http"

	"bomber-man/backend/handlers/websockets"
)

func main() {
	// Set up routes
	setupRoutes()

	// Start the server
	log.Println("🚀 Bomberman WebSocket server starting on :8080")
	log.Println("📡 WebSocket endpoint: ws://localhost:8080/ws")

	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatal("❌ Server failed to start:", err)
	}
}

func setupRoutes() {
	// WebSocket endpoint
	http.HandleFunc("/ws", websockets.WebSocketHandler)

}

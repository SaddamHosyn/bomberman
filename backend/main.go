package main

import (
	"log"
	"net/http"
)

func main() {
	// Create a new lobby handler which manages the game
	lobbyHandler := NewLobbyHandler()

	// Set up WebSocket endpoint
	http.HandleFunc("/ws", lobbyHandler.ServeWS)

	// Add CORS headers for development
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		w.Write([]byte("Bomberman Backend Server is running!"))
	})

	log.Println("🎮 Bomberman Backend Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

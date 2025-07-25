package main

import (
	"bomber/backend/handlers/websockets"
	"log"
	"net/http"
)

// In your main server file
func main() {
	lobbyHandler := websockets.NewLobbyHandler()

	http.HandleFunc("/ws/lobby", lobbyHandler.ServeWS)

	log.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

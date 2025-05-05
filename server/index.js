const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Game state
const rooms = {};
const cards = [
  "Preparing to have a tough conversation by practicing it first with an AI bot.",
  "Using a friend's photo to create a deep fake video as a joke.",
  "Sharing someone's social media post without their permission.",
  "Creating a group chat to plan a surprise party for a friend.",
  "Using an app to track your child's location for safety.",
  "Posting pictures of your children on social media without their consent.",
  "Using video calls to stay connected with long-distance family members.",
  "Checking your partner's phone without their knowledge.",
  "Playing online multiplayer games with friends during a pandemic.",
  "Using AI to write personalized messages to loved ones."
];

// Socket connection handler
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Create a new game room
  socket.on('create_room', (username) => {
    const roomId = generateRoomId();
    
    rooms[roomId] = {
      host: socket.id,
      players: [{id: socket.id, username, ready: false}],
      currentCardIndex: 0,
      revealChoices: false,
      playerChoices: {},
      gameStarted: false
    };
    
    socket.join(roomId);
    socket.emit('room_created', { roomId, isHost: true, username });
    socket.emit('update_room', rooms[roomId]);
    
    console.log(`Room created: ${roomId} by ${username}`);

    socket.on('get_room_data', (roomId) => {
      console.log(`Getting room data for: ${roomId}`);
      if (rooms[roomId]) {
        socket.emit('update_room', rooms[roomId]);
      } else {
        socket.emit('error', { message: 'Room not found' });
      }
    });
    
  });

  // Join an existing room
  socket.on('join_room', ({ roomId, username }) => {
    if (rooms[roomId]) {
      socket.join(roomId);
      
      // Add player to the room
      rooms[roomId].players.push({id: socket.id, username, ready: false});
      rooms[roomId].playerChoices[socket.id] = null;
      
      socket.emit('room_joined', { 
        roomId, 
        isHost: false, 
        username,
        currentCardIndex: rooms[roomId].currentCardIndex,
        revealChoices: rooms[roomId].revealChoices
      });
      
      // Update all players in the room
      io.to(roomId).emit('update_room', rooms[roomId]);
      io.to(roomId).emit('player_joined', { username });
      
      console.log(`${username} joined room: ${roomId}`);
    } else {
      socket.emit('error', { message: 'Room not found' });
    }
  });

  // Start the game
  socket.on('start_game', (roomId) => {
    if (rooms[roomId] && rooms[roomId].host === socket.id) {
      rooms[roomId].gameStarted = true;
      rooms[roomId].currentCardIndex = 0;
      rooms[roomId].revealChoices = false;
      rooms[roomId].playerChoices = {};
      
      // Reset player choices for the new card
      rooms[roomId].players.forEach(player => {
        rooms[roomId].playerChoices[player.id] = null;
      });
      
      io.to(roomId).emit('game_started', { 
        card: cards[0],
        currentCardIndex: 0
      });
      
      console.log(`Game started in room: ${roomId}`);
    }
  });

  // Submit card choice
  socket.on('submit_choice', ({ roomId, choice }) => {
    if (rooms[roomId]) {
      rooms[roomId].playerChoices[socket.id] = choice;
      
      const player = rooms[roomId].players.find(p => p.id === socket.id);
      if (player) {
        player.ready = true;
      }
      
      io.to(roomId).emit('update_room', rooms[roomId]);
      console.log(`Player ${socket.id} in room ${roomId} chose: ${choice}`);
    }
  });

  // Reveal all choices
  socket.on('reveal_choices', (roomId) => {
    if (rooms[roomId] && rooms[roomId].host === socket.id) {
      rooms[roomId].revealChoices = true;
      io.to(roomId).emit('choices_revealed', rooms[roomId].playerChoices);
      console.log(`Choices revealed in room: ${roomId}`);
    }
  });

  // Move to next card
  socket.on('next_card', (roomId) => {
    if (rooms[roomId] && rooms[roomId].host === socket.id) {
      const nextIndex = rooms[roomId].currentCardIndex + 1;
      
      if (nextIndex < cards.length) {
        rooms[roomId].currentCardIndex = nextIndex;
        rooms[roomId].revealChoices = false;
        
        // Reset player choices for the new card
        rooms[roomId].players.forEach(player => {
          player.ready = false;
          rooms[roomId].playerChoices[player.id] = null;
        });
        
        io.to(roomId).emit('new_card', { 
          card: cards[nextIndex], 
          currentCardIndex: nextIndex 
        });
        
        console.log(`Moved to card ${nextIndex} in room: ${roomId}`);
      } else {
        io.to(roomId).emit('game_over');
        console.log(`Game over in room: ${roomId}`);
      }
    }
  });

  // Update card position after discussion
  socket.on('update_choice', ({ roomId, choice }) => {
    if (rooms[roomId] && rooms[roomId].revealChoices) {
      rooms[roomId].playerChoices[socket.id] = choice;
      io.to(roomId).emit('choice_updated', {
        playerId: socket.id,
        choice
      });
      console.log(`Player ${socket.id} updated choice to: ${choice}`);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    // Remove player from all rooms they were in
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      
      if (playerIndex !== -1) {
        const username = room.players[playerIndex].username;
        room.players.splice(playerIndex, 1);
        
        if (room.playerChoices[socket.id]) {
          delete room.playerChoices[socket.id];
        }
        
        // If host leaves, assign a new host or close the room
        if (room.host === socket.id) {
          if (room.players.length > 0) {
            room.host = room.players[0].id;
            io.to(roomId).emit('new_host', { hostId: room.host });
          } else {
            delete rooms[roomId];
            continue;
          }
        }
        
        io.to(roomId).emit('player_left', { username });
        io.to(roomId).emit('update_room', room);
      }
    }
  });
});

// Generate a 6-character alphanumeric room ID
function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

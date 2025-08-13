const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const Redis = require('ioredis');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});
app.use(limiter);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://rithm-game-frontend.onrender.com'] 
      : '*',
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Redis connection for scalable state management
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Game cards
const cards = [
  "Preparing to have a tough conversation by practicing it first with an AI bot.",
  "Checking in with your AI girlfriend/boyfriend throughout the day.",
  "Generating AI bedtime stories for a younger sibling, using personal information about your family to customize them.",
  "Creating a holographic version of yourself to attend a far-away family gathering.",
  "Using a friend's photo to create a deep fake video as a joke.",
  "Letting AI auto-reply to your friends' messages when you're feeling overwhelmed.",
  "Using video calls to stay connected with long-distance family members.",
  "Checking your partner's phone without their knowledge.",
  "Playing online multiplayer games with friends during a pandemic.",
  "Using AI to write personalized messages to loved ones.",
  "Tasking AI with tracking special moments in your friends’ lives and sending personalized messages and gifts", "Engage in AI-simulations that help you see the world/ scenarios from someone else’s perspective", "Participating in a virtual AI-facilitated group therapy session", "Using a tool to ‘optimize’ your social media pictures", "Venting frustrations to an AI bot", "Create a memory bank that you and your friends share and can ‘look into’ for years to come", "Using AI that tracks your emotions and translates them into visual art that others can see (like a public ‘mood ring’)", "Letting an AI summarize your friend’s texts when you don’t feel like reading long messages", "Asking an AI chatbot for advice on dealing with feelings of loneliness", "Asking AI to write a heartfelt speech for a friend’s special occasion", "Talking to an AI preserved version of a beloved deceased relative or ancestor", "Generating an AI-created message to apologize to a friend after a fight", "Using AI to translate a message for someone who speaks another language", "Making AI version of your favorite movie/book/tv character to chat with when you are bored", "Having an AI version of you sign on to class", "Using AI to analyze all of your personal data (emails, texts, search history), to recommend romantic partners", "Using a hidden AI companion in your ear to prompt you with topics, questions, and responses while you’re in conversation with someone", "Using AI to rate your physical appearance and offer tips to improve it"
];

// Utility functions
function shuffleCards(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Room management class
class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.cleanupInterval = setInterval(() => this.cleanupInactiveRooms(), 40 * 60 * 1000); // 5 minutes
  }

  async createRoom(hostId, username) {
    const roomId = generateRoomId();
    const room = {
      id: roomId,
      host: hostId,
      players: [{ id: hostId, username, ready: false, joinedAt: Date.now() }],
      currentCardIndex: 0,
      revealChoices: false,
      playerChoices: {},
      cardHistory: {},
      gameStarted: false,
      shuffledCards: [],
      createdAt: Date.now(),
      lastActivity: Date.now(),
      maxPlayers: 20,
      status: 'waiting' // waiting, playing, finished
    };

    this.rooms.set(roomId, room);
    await this.saveRoomToRedis(roomId, room);
    
    console.log(`Room created: ${roomId} by ${username}`);
    return room;
  }

  async getRoom(roomId) {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = await this.loadRoomFromRedis(roomId);
      if (room) {
        this.rooms.set(roomId, room);
      }
    }
    return room;
  }

  async updateRoom(roomId, updates) {
    const room = await this.getRoom(roomId);
    if (room) {
      Object.assign(room, updates, { lastActivity: Date.now() });
      this.rooms.set(roomId, room);
      await this.saveRoomToRedis(roomId, room);
    }
    return room;
  }

  async addPlayer(roomId, playerId, username) {
    const room = await this.getRoom(roomId);
    if (!room) return null;

    if (room.players.length >= room.maxPlayers) {
      throw new Error('Room is full');
    }

    if (room.players.find(p => p.id === playerId)) {
      throw new Error('Player already in room');
    }

    room.players.push({ id: playerId, username, ready: false, joinedAt: Date.now() });
    room.playerChoices[playerId] = null;
    room.lastActivity = Date.now();

    this.rooms.set(roomId, room);
    await this.saveRoomToRedis(roomId, room);
    
    return room;
  }

  async removePlayer(roomId, playerId) {
    const room = await this.getRoom(roomId);
    if (!room) return null;

    const playerIndex = room.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return room;

    const removedPlayer = room.players[playerIndex];
    room.players.splice(playerIndex, 1);
    
    if (room.playerChoices[playerId]) {
      delete room.playerChoices[playerId];
    }

    // Handle host transfer
    if (room.host === playerId) {
      if (room.players.length > 0) {
        room.host = room.players[0].id;
      } else {
        // Room is empty, mark for deletion
        room.status = 'finished';
      }
    }

    room.lastActivity = Date.now();
    this.rooms.set(roomId, room);
    await this.saveRoomToRedis(roomId, room);
    
    return { room, removedPlayer };
  }

  async startGame(roomId, hostId) {
    const room = await this.getRoom(roomId);
    if (!room || room.host !== hostId) {
      throw new Error('Not authorized to start game');
    }

    const shuffledCards = shuffleCards(cards);
    const updates = {
      gameStarted: true,
      currentCardIndex: 0,
      revealChoices: false,
      playerChoices: {},
      shuffledCards,
      cardHistory: {},
      status: 'playing',
      lastActivity: Date.now()
    };

    // Reset player choices
    room.players.forEach(player => {
      updates.playerChoices[player.id] = null;
    });

    return await this.updateRoom(roomId, updates);
  }

  async submitChoice(roomId, playerId, choice) {
    const room = await this.getRoom(roomId);
    if (!room || !room.gameStarted) {
      throw new Error('Game not started');
    }

    room.playerChoices[playerId] = choice;
    const player = room.players.find(p => p.id === playerId);
    if (player) {
      player.ready = true;
    }

    room.lastActivity = Date.now();
    this.rooms.set(roomId, room);
    await this.saveRoomToRedis(roomId, room);
    
    return room;
  }

  async nextCard(roomId, hostId) {
    const room = await this.getRoom(roomId);
    if (!room || room.host !== hostId) {
      throw new Error('Not authorized');
    }

    const currentIndex = room.currentCardIndex;
    
    // Save current card choices to history
    if (!room.cardHistory[currentIndex]) {
      room.cardHistory[currentIndex] = {};
    }
    
    Object.keys(room.playerChoices).forEach(playerId => {
      if (room.playerChoices[playerId]) {
        room.cardHistory[currentIndex][playerId] = room.playerChoices[playerId];
      }
    });

    const nextIndex = currentIndex + 1;
    
    if (nextIndex < room.shuffledCards.length) {
      const updates = {
        currentCardIndex: nextIndex,
        revealChoices: false,
        playerChoices: {},
        lastActivity: Date.now()
      };

      // Reset player choices for the new card
      room.players.forEach(player => {
        player.ready = false;
        updates.playerChoices[player.id] = null;
      });

      return await this.updateRoom(roomId, updates);
    } else {
      // Game is over
      const updates = {
        status: 'finished',
        lastActivity: Date.now()
      };
      
      await this.saveGameResults(room, true);
      return await this.updateRoom(roomId, updates);
    }
  }

  async saveRoomToRedis(roomId, room) {
    try {
      await redis.setex(`room:${roomId}`, 3600, JSON.stringify(room)); // 1 hour TTL
    } catch (error) {
      console.error('Failed to save room to Redis:', error);
    }
  }

  async loadRoomFromRedis(roomId) {
    try {
      const roomData = await redis.get(`room:${roomId}`);
      return roomData ? JSON.parse(roomData) : null;
    } catch (error) {
      console.error('Failed to load room from Redis:', error);
      return null;
    }
  }

  async saveGameResults(room, isFinal = false) {
    try {
      const gameData = {
        roomId: room.id,
        timestamp: new Date().toISOString(),
        host: room.players.find(p => p.id === room.host)?.username || "Unknown host",
        players: room.players.map(p => p.username),
        currentCardIndex: room.currentCardIndex,
        isGameComplete: isFinal,
        cards: []
      };

      // Add card results for all cards that have been shown
      for (let i = 0; i <= room.currentCardIndex; i++) {
        if (i < room.shuffledCards.length) {
          const cardResults = {
            promptText: room.shuffledCards[i],
            playerChoices: {}
          };

          room.players.forEach(player => {
            let playerChoice = null;
            
            if (room.cardHistory && room.cardHistory[i] && room.cardHistory[i][player.id]) {
              playerChoice = room.cardHistory[i][player.id];
            } else if (i === room.currentCardIndex && room.playerChoices[player.id]) {
              playerChoice = room.playerChoices[player.id];
            }
            
            if (playerChoice) {
              cardResults.playerChoices[player.username] = playerChoice;
            }
          });

          gameData.cards.push(cardResults);
        }
      }

      const timestamp = Date.now();
      const filename = `game_${room.id}_${timestamp}${isFinal ? '_final' : ''}.json`;
      
      await redis.setex(`game_result:${filename}`, 86400, JSON.stringify(gameData)); // 24 hour TTL
      
      console.log(`Game results saved: ${filename}`);
      return filename;
    } catch (error) {
      console.error('Failed to save game results:', error);
      return null;
    }
  }

  cleanupInactiveRooms() {
    const now = Date.now();
    const inactiveThreshold = 30 * 60 * 1000; // 30 minutes

    for (const [roomId, room] of this.rooms.entries()) {
      if (now - room.lastActivity > inactiveThreshold) {
        console.log(`Cleaning up inactive room: ${roomId}`);
        this.rooms.delete(roomId);
        redis.del(`room:${roomId}`);
      }
    }
  }

  getActiveRooms() {
    return Array.from(this.rooms.values()).filter(room => room.status !== 'finished');
  }
}

const roomManager = new RoomManager();

// Socket connection handler with improved error handling and reconnection support
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  let currentRoomId = null;
  let currentUsername = null;

  // Handle reconnection
  socket.on('reconnect_attempt', async (data) => {
    try {
      const { roomId, username } = data;
      if (roomId && username) {
        const room = await roomManager.getRoom(roomId);
        if (room && room.players.find(p => p.username === username)) {
          // Reconnect to room
          socket.join(roomId);
          currentRoomId = roomId;
          currentUsername = username;
          
          socket.emit('reconnected', { room, isHost: room.host === socket.id });
          io.to(roomId).emit('player_reconnected', { username });
        }
      }
    } catch (error) {
      console.error('Reconnection error:', error);
      socket.emit('error', { message: 'Reconnection failed' });
    }
  });

  // Get room data (missing handler that was causing issues)
  socket.on('get_room_data', async (roomId) => {
    try {
      const room = await roomManager.getRoom(roomId);
      if (room) {
        socket.emit('room_data', room);
      } else {
        socket.emit('error', { message: 'Room not found' });
      }
    } catch (error) {
      console.error('Error getting room data:', error);
      socket.emit('error', { message: 'Failed to get room data' });
    }
  });

  // Create a new game room
  socket.on('create_room', async (username) => {
    try {
      if (!username || username.trim().length === 0) {
        socket.emit('error', { message: 'Username is required' });
        return;
      }

      const room = await roomManager.createRoom(socket.id, username.trim());
      socket.join(room.id);
      currentRoomId = room.id;
      currentUsername = username;

      socket.emit('room_created', { 
        roomId: room.id, 
        isHost: true, 
        username,
        room
      });
    } catch (error) {
      console.error('Error creating room:', error);
      socket.emit('error', { message: 'Failed to create room' });
    }
  });

  // Join an existing room
  socket.on('join_room', async ({ roomId, username }) => {
    try {
      if (!username || username.trim().length === 0) {
        socket.emit('error', { message: 'Username is required' });
        return;
      }

      if (!roomId || roomId.trim().length === 0) {
        socket.emit('error', { message: 'Room ID is required' });
        return;
      }

      const room = await roomManager.getRoom(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      if (room.status === 'finished') {
        socket.emit('error', { message: 'Game has ended' });
        return;
      }

      const updatedRoom = await roomManager.addPlayer(roomId, socket.id, username.trim());
      socket.join(roomId);
      currentRoomId = roomId;
      currentUsername = username;

      socket.emit('room_joined', { 
        roomId, 
        isHost: false, 
        username,
        currentCardIndex: updatedRoom.currentCardIndex,
        revealChoices: updatedRoom.revealChoices
      });

      // Update all players in the room
      io.to(roomId).emit('update_room', updatedRoom);
      io.to(roomId).emit('player_joined', { username });
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: error.message || 'Failed to join room' });
    }
  });

  // Start the game
  socket.on('start_game', async (roomId) => {
    try {
      const room = await roomManager.getRoom(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      if (room.host !== socket.id) {
        socket.emit('error', { message: 'Only the host can start the game' });
        return;
      }

      if (room.players.length < 1) {
        socket.emit('error', { message: 'Need at least 1 player to start' });
        return;
      }

      const updatedRoom = await roomManager.startGame(roomId, socket.id);
      
      io.to(roomId).emit('game_started', { 
        card: updatedRoom.shuffledCards[0],
        currentCardIndex: 0
      });
      
      io.to(roomId).emit('update_room', updatedRoom);
    } catch (error) {
      console.error('Error starting game:', error);
      socket.emit('error', { message: error.message || 'Failed to start game' });
    }
  });

  // Submit card choice
  socket.on('submit_choice', async ({ roomId, choice }) => {
    try {
      const updatedRoom = await roomManager.submitChoice(roomId, socket.id, choice);
      io.to(roomId).emit('update_room', updatedRoom);
    } catch (error) {
      console.error('Error submitting choice:', error);
      socket.emit('error', { message: error.message || 'Failed to submit choice' });
    }
  });

  // Reveal all choices
  socket.on('reveal_choices', async (roomId) => {
    try {
      const room = await roomManager.getRoom(roomId);
      if (!room || room.host !== socket.id) {
        socket.emit('error', { message: 'Not authorized' });
        return;
      }

      const updatedRoom = await roomManager.updateRoom(roomId, { revealChoices: true });
      io.to(roomId).emit('choices_revealed', updatedRoom.playerChoices);
      io.to(roomId).emit('update_room', updatedRoom);
    } catch (error) {
      console.error('Error revealing choices:', error);
      socket.emit('error', { message: 'Failed to reveal choices' });
    }
  });

  // Move to next card
  socket.on('next_card', async (roomId) => {
    try {
      const updatedRoom = await roomManager.nextCard(roomId, socket.id);
      
      if (updatedRoom.status === 'finished') {
        io.to(roomId).emit('game_over', { 
          resultsPath: `/download/${roomId}/final`
        });
      } else {
        io.to(roomId).emit('new_card', { 
          card: updatedRoom.shuffledCards[updatedRoom.currentCardIndex], 
          currentCardIndex: updatedRoom.currentCardIndex 
        });
      }
      
      io.to(roomId).emit('update_room', updatedRoom);
    } catch (error) {
      console.error('Error moving to next card:', error);
      socket.emit('error', { message: error.message || 'Failed to move to next card' });
    }
  });

  // Update card position after discussion
  socket.on('update_choice', async ({ roomId, choice }) => {
    try {
      const room = await roomManager.getRoom(roomId);
      if (!room || !room.revealChoices) {
        socket.emit('error', { message: 'Not in reveal phase' });
        return;
      }

      const updatedRoom = await roomManager.submitChoice(roomId, socket.id, choice);
      io.to(roomId).emit('choice_updated', {
        playerId: socket.id,
        choice
      });
      io.to(roomId).emit('update_room', updatedRoom);
    } catch (error) {
      console.error('Error updating choice:', error);
      socket.emit('error', { message: 'Failed to update choice' });
    }
  });

  // Handle disconnection
  socket.on('disconnect', async () => {
    console.log(`User disconnected: ${socket.id}`);
    
    if (currentRoomId) {
      try {
        const result = await roomManager.removePlayer(currentRoomId, socket.id);
        if (result) {
          const { room, removedPlayer } = result;
          
          if (room.players.length === 0) {
            // Room is empty, clean it up
            roomManager.rooms.delete(currentRoomId);
            await redis.del(`room:${currentRoomId}`);
          } else {
            io.to(currentRoomId).emit('player_left', { username: removedPlayer.username });
            io.to(currentRoomId).emit('update_room', room);
            
            if (room.host !== socket.id) {
              io.to(currentRoomId).emit('new_host', { hostId: room.host });
            }
          }
        }
      } catch (error) {
        console.error('Error handling disconnect:', error);
      }
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    activeRooms: roomManager.getActiveRooms().length
  });
});

// Admin endpoints
app.get('/admin', (req, res) => {
  const adminHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Game Admin Dashboard</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; }
        .stats { display: flex; gap: 20px; margin-bottom: 20px; }
        .stat-card { background: #f5f5f5; padding: 15px; border-radius: 5px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        tr:hover { background-color: #f5f5f5; }
      </style>
    </head>
    <body>
      <h1>Game Admin Dashboard</h1>
      <div class="stats">
        <div class="stat-card">
          <h3>Active Rooms</h3>
          <p id="activeRooms">Loading...</p>
        </div>
        <div class="stat-card">
          <h3>Total Players</h3>
          <p id="totalPlayers">Loading...</p>
        </div>
      </div>
      <table id="roomsTable">
        <tr>
          <th>Room ID</th>
          <th>Host</th>
          <th>Players</th>
          <th>Status</th>
          <th>Created</th>
        </tr>
        <tbody id="tableBody"></tbody>
      </table>

      <script>
        function updateStats() {
          fetch('/admin/stats')
            .then(response => response.json())
            .then(data => {
              document.getElementById('activeRooms').textContent = data.activeRooms;
              document.getElementById('totalPlayers').textContent = data.totalPlayers;
              
              const tableBody = document.getElementById('tableBody');
              tableBody.innerHTML = '';
              
              data.rooms.forEach(room => {
                const row = document.createElement('tr');
                row.innerHTML = \`
                  <td>\${room.id}</td>
                  <td>\${room.players.find(p => p.id === room.host)?.username || 'Unknown'}</td>
                  <td>\${room.players.length}</td>
                  <td>\${room.status}</td>
                  <td>\${new Date(room.createdAt).toLocaleString()}</td>
                \`;
                tableBody.appendChild(row);
              });
            })
            .catch(error => console.error('Error fetching stats:', error));
        }
        
        updateStats();
        setInterval(updateStats, 5000);
      </script>
    </body>
    </html>
  `;
  
  res.send(adminHtml);
});

app.get('/admin/stats', (req, res) => {
  const activeRooms = roomManager.getActiveRooms();
  const totalPlayers = activeRooms.reduce((sum, room) => sum + room.players.length, 0);
  
  res.json({
    activeRooms: activeRooms.length,
    totalPlayers,
    rooms: activeRooms.map(room => ({
      id: room.id,
      host: room.host,
      players: room.players,
      status: room.status,
      createdAt: room.createdAt
    }))
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Admin dashboard available at http://localhost:${PORT}/admin`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
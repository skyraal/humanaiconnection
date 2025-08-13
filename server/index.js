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
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://humanaiconnection.onrender.com', 'https://humanaiconnectiongame.onrender.com'] 
      : '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  // Add connection pooling and rate limiting
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e8
});

// Game state with improved structure
const rooms = new Map();
const socketToRoom = new Map(); // Track which room each socket is in
const cards = [
"Preparing to have a tough conversation by practicing it first with an AI bot.",
"Checking in with your AI girlfriend/boyfriend throughout the day.",
"Generating AI bedtime stories for a younger sibling, using personal information about your family to customize them.",
"Creating a holographic version of yourself to attend a far-away family gathering.",
"Using a friend's photo to create a deep fake video as a joke.",
"Letting AI auto-reply to your friends' messages when you're feeling overwhelmed.",
"Talking to an AI preserved version of a beloved deceased relative or ancestor.",
"Generating an AI-created message to apologize to a friend after a fight.",
"Using AI to rate your physical appearance and offer tips to improve it.",
"Using AI to translate a message for someone who speaks another language.",
"Using AI to analyze all of your personal data (emails, texts, search history) to recommend romantic partners.",
"Asking AI to write a heartfelt speech for a friend's special occasion.",
"Having an AI version of you sign on to class.",
"Making an AI version of your favorite movie/book/tv character to chat with when you are bored.",
"Using a hidden AI companion in your ear to prompt you with topics, questions, and responses while you're in conversation with someone.",
"Participating in a virtual AI-facilitated group therapy session.",
"Engaging in AI simulations that help you see the world/scenarios from someone else's perspective.",
"Tasking AI with tracking special moments in your friends' lives and sending personalized messages and gifts.",
"Using a tool to 'optimize' your social media pictures.",
"Using AI that tracks your emotions and translates them into visual art that others can see (like a public 'mood ring').",
"Asking an AI chatbot for advice on dealing with feelings of loneliness.",
"Creating a memory bank that you and your friends share and can 'look into' for years to come.",
"Letting an AI summarize your friend's texts when you don't feel like reading long messages.",
"Venting frustrations to an AI bot."
];

// Fisher-Yates shuffle algorithm to randomize card order
function shuffleCards(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Utility functions
function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getCurrentCard(room) {
  if (!room.gameStarted || !room.shuffledCards || room.currentCardIndex >= room.shuffledCards.length) {
    return null;
  }
  return room.shuffledCards[room.currentCardIndex];
}

function broadcastRoomUpdate(roomId, room) {
  io.to(roomId).emit('update_room', room);
}

function removePlayerFromRoom(socketId, roomId) {
  const room = rooms.get(roomId);
  if (!room) return null;

  const playerIndex = room.players.findIndex(p => p.id === socketId);
  if (playerIndex === -1) return null;

  const player = room.players[playerIndex];
  room.players.splice(playerIndex, 1);
  
  // Clean up player choices
  if (room.playerChoices[socketId]) {
    delete room.playerChoices[socketId];
  }

  // Handle host transfer
  if (room.host === socketId) {
    if (room.players.length > 0) {
      room.host = room.players[0].id;
      io.to(roomId).emit('new_host', { hostId: room.host });
    } else {
      // Room is empty, delete it
      rooms.delete(roomId);
      return null;
    }
  }

  socketToRoom.delete(socketId);
  return player;
}

// Store game results
const fs = require('fs');
const path = require('path');

function saveGameResults(roomId, isFinal = false) {
  console.log(`Saving results for room: ${roomId}, isFinal: ${isFinal}`);
  
  const room = rooms.get(roomId);
  if (!room) {
    console.log(`Room ${roomId} not found. Cannot save results.`);
    return null;
  }
  
  const gameData = {
    roomId,
    timestamp: new Date().toISOString(),
    host: room.players.find(p => p.id === room.host)?.username || "Unknown host",
    players: room.players.map(p => p.username),
    currentCardIndex: room.currentCardIndex,
    isGameComplete: isFinal,
    cards: [],
  };
  
  // Add card results for all cards that have been shown
  for (let i = 0; i <= room.currentCardIndex; i++) {
    if (i < room.shuffledCards.length) {
      const cardResults = {
        promptText: room.shuffledCards[i],
        playerChoices: {}
      };
      
      // Collect player choices for this card
      room.players.forEach(player => {
        // Get choice from card history if available, otherwise from current choices
        let playerChoice = null;
        
        if (room.cardHistory && room.cardHistory[i] && 
            room.cardHistory[i][player.id]) {
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
  
  try {
    // Ensure the results directory exists
    const resultsDir = path.join(__dirname, 'game_results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
      console.log(`Created results directory: ${resultsDir}`);
    }
    
    // Write the game results to a JSON file
    const timestamp = Date.now();
    const filename = `game_${roomId}_${timestamp}${isFinal ? '_final' : ''}.json`;
    const filePath = path.join(resultsDir, filename);
    
    fs.writeFileSync(filePath, JSON.stringify(gameData, null, 2));
    
    console.log(`Game results saved to ${filePath}`);
    return filePath;
  } catch (error) {
    console.error('Failed to save game results:', error);
    return null;
  }
}

// Socket connection handler with improved error handling and concurrency
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Create a new game room
  socket.on('create_room', (username) => {
    try {
      if (!username || typeof username !== 'string' || username.trim().length === 0) {
        socket.emit('error', { message: 'Invalid username' });
        return;
      }

      let roomId = generateRoomId();
      
      // Ensure unique room ID
      while (rooms.has(roomId)) {
        roomId = generateRoomId();
      }
      
      const room = {
        host: socket.id,
        players: [{id: socket.id, username: username.trim(), ready: false}],
        currentCardIndex: 0,
        revealChoices: false,
        playerChoices: {},
        cardHistory: {},
        gameStarted: false,
        shuffledCards: [],
        createdAt: Date.now(),
        lastActivity: Date.now()
      };
      
      rooms.set(roomId, room);
      socketToRoom.set(socket.id, roomId);
      socket.join(roomId);
      
      socket.emit('room_created', { 
        roomId, 
        isHost: true, 
        username: username.trim(),
        room: room
      });
      
      console.log(`Room created: ${roomId} by ${username}`);
    } catch (error) {
      console.error('Error creating room:', error);
      socket.emit('error', { message: 'Failed to create room' });
    }
  });

  // Join an existing room with improved error handling
  socket.on('join_room', ({ roomId, username }) => {
    try {
      if (!username || typeof username !== 'string' || username.trim().length === 0) {
        socket.emit('error', { message: 'Invalid username' });
        return;
      }

      if (!roomId || typeof roomId !== 'string') {
        socket.emit('error', { message: 'Invalid room ID' });
        return;
      }

      const room = rooms.get(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      // Check if username is already taken in this room
      const existingPlayer = room.players.find(p => p.username === username.trim());
      if (existingPlayer) {
        socket.emit('error', { message: 'Username already taken in this room' });
        return;
      }

      // Check if game is in progress and allow late joiners
      const isLateJoiner = room.gameStarted;
      
      socket.join(roomId);
      socketToRoom.set(socket.id, roomId);
      
      // Add player to the room
      const newPlayer = {id: socket.id, username: username.trim(), ready: false};
      room.players.push(newPlayer);
      room.playerChoices[socket.id] = null;
      room.lastActivity = Date.now();
      
      // Send appropriate response based on game state
      if (isLateJoiner) {
        // Late joiner - send current game state
        const currentCard = getCurrentCard(room);
        socket.emit('room_joined', { 
          roomId, 
          isHost: false, 
          username: username.trim(),
          currentCardIndex: room.currentCardIndex,
          revealChoices: room.revealChoices,
          gameStarted: true,
          currentCard: currentCard,
          isLateJoiner: true
        });
        
        // Also send immediate game state sync for late joiners
        socket.emit('game_state_sync', {
          gameStarted: true,
          currentCard: currentCard,
          currentCardIndex: room.currentCardIndex,
          revealChoices: room.revealChoices,
          isLateJoiner: true
        });
        
        console.log(`${username} joined room: ${roomId} as late joiner - current card: ${currentCard}`);
      } else {
        // Normal joiner
        socket.emit('room_joined', { 
          roomId, 
          isHost: false, 
          username: username.trim(),
          currentCardIndex: room.currentCardIndex,
          revealChoices: room.revealChoices,
          isLateJoiner: false
        });
        
        console.log(`${username} joined room: ${roomId} as normal joiner`);
      }
      
      // Update all players in the room
      broadcastRoomUpdate(roomId, room);
      io.to(roomId).emit('player_joined', { username: username.trim(), isLateJoiner });
      
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Start the game with improved state management
  socket.on('start_game', (roomId) => {
    try {
      const room = rooms.get(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      if (room.host !== socket.id) {
        socket.emit('error', { message: 'Only the host can start the game' });
        return;
      }

      if (room.gameStarted) {
        socket.emit('error', { message: 'Game already started' });
        return;
      }

      // Shuffle the cards for this game session
      const shuffledCards = shuffleCards(cards);
      
      room.gameStarted = true;
      room.currentCardIndex = 0;
      room.revealChoices = false;
      room.playerChoices = {};
      room.shuffledCards = shuffledCards;
      room.cardHistory = {};
      room.lastActivity = Date.now();
      
      // Reset player choices for the new card
      room.players.forEach(player => {
        room.playerChoices[player.id] = null;
        player.ready = false;
      });
      
      const currentCard = getCurrentCard(room);
      
      io.to(roomId).emit('game_started', { 
        card: currentCard,
        currentCardIndex: 0
      });
      
      console.log(`Game started in room: ${roomId} with shuffled cards`);
    } catch (error) {
      console.error('Error starting game:', error);
      socket.emit('error', { message: 'Failed to start game' });
    }
  });

  // Submit card choice with validation
  socket.on('submit_choice', ({ roomId, choice }) => {
    try {
      const room = rooms.get(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      if (!room.gameStarted) {
        socket.emit('error', { message: 'Game not started' });
        return;
      }

      if (!['support', 'erode', 'depends'].includes(choice)) {
        socket.emit('error', { message: 'Invalid choice' });
        return;
      }

      room.playerChoices[socket.id] = choice;
      room.lastActivity = Date.now();
      
      const player = room.players.find(p => p.id === socket.id);
      if (player) {
        player.ready = true;
      }
      
      broadcastRoomUpdate(roomId, room);
      console.log(`Player ${socket.id} in room ${roomId} chose: ${choice}`);
    } catch (error) {
      console.error('Error submitting choice:', error);
      socket.emit('error', { message: 'Failed to submit choice' });
    }
  });

  // Reveal all choices
  socket.on('reveal_choices', (roomId) => {
    try {
      const room = rooms.get(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      if (room.host !== socket.id) {
        socket.emit('error', { message: 'Only the host can reveal choices' });
        return;
      }

      if (!room.gameStarted) {
        socket.emit('error', { message: 'Game not started' });
        return;
      }

      room.revealChoices = true;
      room.lastActivity = Date.now();
      
      io.to(roomId).emit('choices_revealed', room.playerChoices);
      broadcastRoomUpdate(roomId, room);
      console.log(`Choices revealed in room: ${roomId}`);
    } catch (error) {
      console.error('Error revealing choices:', error);
      socket.emit('error', { message: 'Failed to reveal choices' });
    }
  });

  // Move to next card with improved state management
  socket.on('next_card', (roomId) => {
    try {
      const room = rooms.get(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      if (room.host !== socket.id) {
        socket.emit('error', { message: 'Only the host can move to next card' });
        return;
      }

      if (!room.gameStarted) {
        socket.emit('error', { message: 'Game not started' });
        return;
      }

      const currentIndex = room.currentCardIndex;
      
      // Save current card choices to history before moving to next card
      if (!room.cardHistory[currentIndex]) {
        room.cardHistory[currentIndex] = {};
      }
      
      // Copy current choices to history
      Object.keys(room.playerChoices).forEach(playerId => {
        if (room.playerChoices[playerId]) {
          room.cardHistory[currentIndex][playerId] = room.playerChoices[playerId];
        }
      });
      
      // Save the current state after each card
      const resultsPath = saveGameResults(roomId, false);
      console.log(`Saved progress after card ${currentIndex}`);
      
      const nextIndex = currentIndex + 1;
      
      if (nextIndex < room.shuffledCards.length) {
        room.currentCardIndex = nextIndex;
        room.revealChoices = false;
        room.lastActivity = Date.now();
        
        // Reset player choices for the new card
        room.players.forEach(player => {
          player.ready = false;
          room.playerChoices[player.id] = null;
        });
        
        const currentCard = getCurrentCard(room);
        
        io.to(roomId).emit('new_card', { 
          card: currentCard, 
          currentCardIndex: nextIndex 
        });
        broadcastRoomUpdate(roomId, room);
        
        console.log(`Moved to card ${nextIndex} in room: ${roomId}`);
      } else {
        // Game is over, save final results to JSON with 'final' flag
        const finalResultsPath = saveGameResults(roomId, true);
        
        io.to(roomId).emit('game_over', { 
          resultsPath: finalResultsPath,
          downloadUrl: `/download/${roomId}/${path.basename(finalResultsPath)}`
        });
        console.log(`Game over in room: ${roomId}`);
      }
    } catch (error) {
      console.error('Error moving to next card:', error);
      socket.emit('error', { message: 'Failed to move to next card' });
    }
  });

  // Update card position after discussion
  socket.on('update_choice', ({ roomId, choice }) => {
    try {
      const room = rooms.get(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      if (!room.revealChoices) {
        socket.emit('error', { message: 'Choices not revealed yet' });
        return;
      }

      if (!['support', 'erode', 'depends'].includes(choice)) {
        socket.emit('error', { message: 'Invalid choice' });
        return;
      }

      room.playerChoices[socket.id] = choice;
      room.lastActivity = Date.now();
      
      io.to(roomId).emit('choice_updated', {
        playerId: socket.id,
        choice
      });
      broadcastRoomUpdate(roomId, room);
      console.log(`Player ${socket.id} updated choice to: ${choice}`);
    } catch (error) {
      console.error('Error updating choice:', error);
      socket.emit('error', { message: 'Failed to update choice' });
    }
  });

  // Get room data with improved error handling
  socket.on('get_room_data', (roomId) => {
    try {
      console.log(`Room data requested for: ${roomId}`);
      const room = rooms.get(roomId);
      if (room) {
        socket.emit('update_room', room);
        
        // If game is started, also send current card
        if (room.gameStarted) {
          const currentCard = getCurrentCard(room);
          socket.emit('game_state_sync', {
            gameStarted: true,
            currentCard: currentCard,
            currentCardIndex: room.currentCardIndex,
            revealChoices: room.revealChoices
          });
        }
      } else {
        socket.emit('error', { message: 'Room not found' });
        console.log(`Room ${roomId} not found when requested`);
      }
    } catch (error) {
      console.error('Error getting room data:', error);
      socket.emit('error', { message: 'Failed to get room data' });
    }
  });

  // Handle disconnection with improved cleanup
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    const roomId = socketToRoom.get(socket.id);
    if (roomId) {
      const player = removePlayerFromRoom(socket.id, roomId);
      if (player) {
        const room = rooms.get(roomId);
        if (room) {
          io.to(roomId).emit('player_left', { username: player.username });
          broadcastRoomUpdate(roomId, room);
        }
      }
    }
  });

  // Handle errors
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// Cleanup inactive rooms periodically (every 30 minutes)
setInterval(() => {
  const now = Date.now();
  const inactiveThreshold = 30 * 60 * 1000; // 30 minutes
  
  for (const [roomId, room] of rooms.entries()) {
    if (now - room.lastActivity > inactiveThreshold) {
      console.log(`Cleaning up inactive room: ${roomId}`);
      rooms.delete(roomId);
      
      // Clean up socket mappings
      for (const [socketId, mappedRoomId] of socketToRoom.entries()) {
        if (mappedRoomId === roomId) {
          socketToRoom.delete(socketId);
        }
      }
    }
  }
}, 30 * 60 * 1000);

// Health check endpoint
app.get('/health', (req, res) => {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    activeRooms: rooms.size,
    activeConnections: io.engine.clientsCount,
    memoryUsage: process.memoryUsage(),
    nodeVersion: process.version
  };
  
  res.json(healthData);
});

// Server statistics endpoint
app.get('/stats', (req, res) => {
  const stats = {
    totalRooms: rooms.size,
    activeConnections: io.engine.clientsCount,
    totalPlayers: Array.from(rooms.values()).reduce((total, room) => total + room.players.length, 0),
    activeGames: Array.from(rooms.values()).filter(room => room.gameStarted).length,
    serverUptime: process.uptime(),
    memoryUsage: process.memoryUsage()
  };
  
  res.json(stats);
});

// Cleanup inactive rooms endpoint (for manual cleanup)
app.post('/cleanup', (req, res) => {
  const now = Date.now();
  const inactiveThreshold = 30 * 60 * 1000; // 30 minutes
  let cleanedRooms = 0;
  
  for (const [roomId, room] of rooms.entries()) {
    if (now - room.lastActivity > inactiveThreshold) {
      console.log(`Manually cleaning up inactive room: ${roomId}`);
      rooms.delete(roomId);
      cleanedRooms++;
      
      // Clean up socket mappings
      for (const [socketId, mappedRoomId] of socketToRoom.entries()) {
        if (mappedRoomId === roomId) {
          socketToRoom.delete(socketId);
        }
      }
    }
  }
  
  res.json({ 
    message: `Cleaned up ${cleanedRooms} inactive rooms`,
    remainingRooms: rooms.size 
  });
});

app.get('/admin', (req, res) => {
  const adminHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Rithm Project Admin</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        tr:hover { background-color: #f5f5f5; }
        .button { 
          display: inline-block; 
          padding: 5px 10px; 
          background: #4CAF50; 
          color: white; 
          text-decoration: none; 
          margin-right: 5px;
          border-radius: 3px;
        }
        .stats { 
          background: #f9f9f9; 
          padding: 15px; 
          border-radius: 5px; 
          margin-bottom: 20px; 
        }
      </style>
    </head>
    <body>
      <h1>Rithm Project - Game Results</h1>
      
      <div class="stats">
        <h3>Server Statistics</h3>
        <div id="serverStats">Loading...</div>
      </div>
      
      <table id="resultsTable">
        <tr>
          <th>Filename</th>
          <th>Room ID</th>
          <th>Date</th>
          <th>Host</th>
          <th>Players</th>
          <th>Actions</th>
        </tr>
        <tbody id="tableBody"></tbody>
      </table>

      <script>
        // Load server stats
        fetch('/stats')
          .then(response => response.json())
          .then(data => {
            document.getElementById('serverStats').innerHTML = \`
              <p><strong>Active Rooms:</strong> \${data.totalRooms}</p>
              <p><strong>Active Connections:</strong> \${data.activeConnections}</p>
              <p><strong>Total Players:</strong> \${data.totalPlayers}</p>
              <p><strong>Active Games:</strong> \${data.activeGames}</p>
              <p><strong>Server Uptime:</strong> \${Math.floor(data.serverUptime / 60)} minutes</p>
            \`;
          })
          .catch(error => {
            console.error('Error fetching stats:', error);
          });

        // Load game results
        fetch('/admin/results')
          .then(response => response.json())
          .then(data => {
            const tableBody = document.getElementById('tableBody');
            
            data.forEach(game => {
              const row = document.createElement('tr');
              
              row.innerHTML = \`
                <td>\${game.filename}</td>
                <td>\${game.data.roomId || 'N/A'}</td>
                <td>\${new Date(game.data.timestamp).toLocaleString()}</td>
                <td>\${game.data.host || 'Unknown'}</td>
                <td>\${game.data.players.join(', ')}</td>
                <td>
                  <a href="/admin/view/\${game.filename}" class="button" target="_blank">View</a>
                  <a href="/admin/download/\${game.filename}" class="button" download>Download</a>
                </td>
              \`;
              
              tableBody.appendChild(row);
            });
          })
          .catch(error => {
            console.error('Error fetching results:', error);
          });
      </script>
    </body>
    </html>
  `;
  
  res.send(adminHtml);
});

const gameResultsDir = path.join(__dirname, 'game_results');
if (!fs.existsSync(gameResultsDir)) {
  try {
    fs.mkdirSync(gameResultsDir, { recursive: true });
    console.log(`Created game results directory at: ${gameResultsDir}`);
  } catch (error) {
    console.error(`Failed to create game results directory: ${error.message}`);
  }
}

// API endpoint to get all game results
app.get('/test-file', (req, res) => {
  try {
    const testDir = path.join(__dirname, 'game_results');
    
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    const testFile = path.join(testDir, 'test_file.json');
    fs.writeFileSync(testFile, JSON.stringify({ test: 'successful', timestamp: new Date() }, null, 2));
    
    res.send(`Test file created at: ${testFile}`);
  } catch (error) {
    res.status(500).send(`Error creating test file: ${error.message}`);
  }
});

app.get('/list-files', (req, res) => {
  try {
    const files = fs.readdirSync(__dirname);
    const gameResultsPath = path.join(__dirname, 'game_results');
    let gameResultsFiles = [];
    
    if (fs.existsSync(gameResultsPath)) {
      gameResultsFiles = fs.readdirSync(gameResultsPath);
    }
    
    res.json({ 
      currentDirectory: __dirname,
      files,
      gameResultsDirectory: gameResultsPath,
      hasGameResultsDir: fs.existsSync(gameResultsPath),
      gameResultsFiles
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a simple admin endpoint to view saved games
app.get('/saved-games', (req, res) => {
  try {
    const resultsDir = path.join(__dirname, 'game_results');
    
    if (!fs.existsSync(resultsDir)) {
      return res.json({ message: 'No game results directory found', files: [] });
    }
    
    const files = fs.readdirSync(resultsDir)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const stats = fs.statSync(path.join(resultsDir, file));
        return {
          filename: file,
          size: stats.size,
          created: stats.birthtime
        };
      })
      .sort((a, b) => b.created - a.created);
    
    res.json({
      message: `Found ${files.length} game result files`,
      directory: resultsDir,
      files
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

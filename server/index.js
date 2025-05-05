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
      ? ['https://rithm-game-frontend.onrender.com'] 
      : '*',
    methods: ['GET', 'POST']
  }
});

// Game state
const rooms = {};
const cards = [
  "Preparing to have a tough conversation by practicing it first with an AI bot.",
  "Checking in with your AI girlfriend/boyfriend throughout the day.",
  "Generating AI bedtime stories for a younger sibling, using personal information about your family to customize them.",
  "Creating a holographic version of yourself to attend a far-away family gathering.",
  "Using a friend’s photo to create a deep fake video as a joke.",
  "Letting AI auto-reply to your friends’ messages when you’re feeling overwhelmed.",
  "Using video calls to stay connected with long-distance family members.",
  "Checking your partner's phone without their knowledge.",
  "Playing online multiplayer games with friends during a pandemic.",
  "Using AI to write personalized messages to loved ones.",
  "Tasking AI with tracking special moments in your friends’ lives and sending personalized messages and gifts", "Engage in AI-simulations that help you see the world/ scenarios from someone else’s perspective", "Participating in a virtual AI-facilitated group therapy session", "Using a tool to ‘optimize’ your social media pictures", "Venting frustrations to an AI bot", "Create a memory bank that you and your friends share and can ‘look into’ for years to come", "Using AI that tracks your emotions and translates them into visual art that others can see (like a public ‘mood ring’)", "Letting an AI summarize your friend’s texts when you don’t feel like reading long messages", "Asking an AI chatbot for advice on dealing with feelings of loneliness", "Asking AI to write a heartfelt speech for a friend’s special occasion", "Talking to an AI preserved version of a beloved deceased relative or ancestor", "Generating an AI-created message to apologize to a friend after a fight", "Using AI to translate a message for someone who speaks another language", "Making AI version of your favorite movie/book/tv character to chat with when you are bored", "Having an AI version of you sign on to class", "Using AI to analyze all of your personal data (emails, texts, search history), to recommend romantic partners", "Using a hidden AI companion in your ear to prompt you with topics, questions, and responses while you’re in conversation with someone", "Using AI to rate your physical appearance and offer tips to improve it"
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

// Store game results
const fs = require('fs');
const path = require('path');

function saveGameResults(roomId, isFinal = false) {
  console.log(`Saving results for room: ${roomId}, isFinal: ${isFinal}`);
  
  if (!rooms[roomId]) {
    console.log(`Room ${roomId} not found. Cannot save results.`);
    return;
  }
  
  const room = rooms[roomId];
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
      cardHistory: {}, // Store choices for all cards to save in JSON
      gameStarted: false,
      shuffledCards: [] // Will store shuffled cards when game starts
    };
    
    socket.join(roomId);
    // First emit room_created with complete room data
    socket.emit('room_created', { 
      roomId, 
      isHost: true, 
      username,
      room: rooms[roomId] // Include the entire room object
    });
    
    console.log(`Room created: ${roomId} by ${username}`);
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
      // Shuffle the cards for this game session
      const shuffledCards = shuffleCards(cards);
      
      rooms[roomId].gameStarted = true;
      rooms[roomId].currentCardIndex = 0;
      rooms[roomId].revealChoices = false;
      rooms[roomId].playerChoices = {};
      rooms[roomId].shuffledCards = shuffledCards;
      rooms[roomId].cardHistory = {}; // Reset card history
      
      // Reset player choices for the new card
      rooms[roomId].players.forEach(player => {
        rooms[roomId].playerChoices[player.id] = null;
      });
      
      io.to(roomId).emit('game_started', { 
        card: shuffledCards[0],
        currentCardIndex: 0
      });
      
      console.log(`Game started in room: ${roomId} with shuffled cards`);
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
      const currentIndex = rooms[roomId].currentCardIndex;
      
      // Save current card choices to history before moving to next card
      if (!rooms[roomId].cardHistory[currentIndex]) {
        rooms[roomId].cardHistory[currentIndex] = {};
      }
      
      // Copy current choices to history
      Object.keys(rooms[roomId].playerChoices).forEach(playerId => {
        if (rooms[roomId].playerChoices[playerId]) {
          rooms[roomId].cardHistory[currentIndex][playerId] = rooms[roomId].playerChoices[playerId];
        }
      });
      
      // Save the current state after each card
      const resultsPath = saveGameResults(roomId, false);
      console.log(`Saved progress after card ${currentIndex}`);
      
      const nextIndex = currentIndex + 1;
      
      if (nextIndex < rooms[roomId].shuffledCards.length) {
        rooms[roomId].currentCardIndex = nextIndex;
        rooms[roomId].revealChoices = false;
        
        // Reset player choices for the new card
        rooms[roomId].players.forEach(player => {
          player.ready = false;
          rooms[roomId].playerChoices[player.id] = null;
        });
        
        io.to(roomId).emit('new_card', { 
          card: rooms[roomId].shuffledCards[nextIndex], 
          currentCardIndex: nextIndex 
        });
        
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
      </style>
    </head>
    <body>
      <h1>Rithm Project - Game Results</h1>
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
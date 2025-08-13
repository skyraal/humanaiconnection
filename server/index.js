const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const Redis = require('ioredis');
const rateLimit = require('express-rate-limit');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

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

// Initialize SQLite database for analytics
const db = new sqlite3.Database(path.join(__dirname, 'game_analytics.db'));

// Create tables for analytics
db.serialize(() => {
  // User visits tracking
  db.run(`CREATE TABLE IF NOT EXISTS user_visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    page_visited TEXT
  )`);

  // Game sessions
  db.run(`CREATE TABLE IF NOT EXISTS game_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    host_username TEXT,
    total_players INTEGER,
    game_started BOOLEAN DEFAULT 0,
    game_completed BOOLEAN DEFAULT 0,
    cards_played INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    session_duration INTEGER
  )`);

  // Player participation
  db.run(`CREATE TABLE IF NOT EXISTS player_participation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    room_id TEXT NOT NULL,
    username TEXT NOT NULL,
    socket_id TEXT,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    left_at DATETIME,
    was_host BOOLEAN DEFAULT 0,
    cards_answered INTEGER DEFAULT 0,
    FOREIGN KEY (session_id) REFERENCES game_sessions(id)
  )`);

  // Card responses
  db.run(`CREATE TABLE IF NOT EXISTS card_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    room_id TEXT NOT NULL,
    card_index INTEGER,
    card_text TEXT,
    username TEXT,
    choice TEXT,
    answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES game_sessions(id)
  )`);

  // Room activity
  db.run(`CREATE TABLE IF NOT EXISTS room_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_data TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Analytics helper functions
const analytics = {
  trackVisit: (req, page) => {
    const sessionId = req.sessionID || uuidv4();
    const stmt = db.prepare(`
      INSERT INTO user_visits (session_id, ip_address, user_agent, page_visited)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(sessionId, req.ip, req.get('User-Agent'), page);
    stmt.finalize();
  },

  createGameSession: (roomId, hostUsername, totalPlayers) => {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(`
        INSERT INTO game_sessions (room_id, host_username, total_players)
        VALUES (?, ?, ?)
      `);
      stmt.run(roomId, hostUsername, totalPlayers, function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
      stmt.finalize();
    });
  },

  addPlayerParticipation: (sessionId, roomId, username, socketId, isHost = false) => {
    const stmt = db.prepare(`
      INSERT INTO player_participation (session_id, room_id, username, socket_id, was_host)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(sessionId, roomId, username, socketId, isHost);
    stmt.finalize();
  },

  recordCardResponse: (sessionId, roomId, cardIndex, cardText, username, choice) => {
    const stmt = db.prepare(`
      INSERT INTO card_responses (session_id, room_id, card_index, card_text, username, choice)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(sessionId, roomId, cardIndex, cardText, username, choice);
    stmt.finalize();
  },

  updateGameSession: (sessionId, updates) => {
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    const stmt = db.prepare(`UPDATE game_sessions SET ${fields} WHERE id = ?`);
    stmt.run(...values, sessionId);
    stmt.finalize();
  },

  recordRoomActivity: (roomId, eventType, eventData = null) => {
    const stmt = db.prepare(`
      INSERT INTO room_activity (room_id, event_type, event_data)
      VALUES (?, ?, ?)
    `);
    stmt.run(roomId, eventType, JSON.stringify(eventData));
    stmt.finalize();
  }
};

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
    this.roomSessions = new Map(); // Track session IDs for analytics
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
      status: 'waiting', // waiting, playing, finished
      missedCards: [] // Track cards missed by late joiners
    };

    this.rooms.set(roomId, room);
    await this.saveRoomToRedis(roomId, room);
    
    // Create analytics session
    try {
      const sessionId = await analytics.createGameSession(roomId, username, 1);
      this.roomSessions.set(roomId, sessionId);
      analytics.addPlayerParticipation(sessionId, roomId, username, hostId, true);
      analytics.recordRoomActivity(roomId, 'room_created', { host: username });
    } catch (error) {
      console.error('Failed to create analytics session:', error);
    }
    
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

    const isLateJoiner = room.gameStarted && room.currentCardIndex > 0;
    const player = { 
      id: playerId, 
      username, 
      ready: false, 
      joinedAt: Date.now(),
      isLateJoiner,
      missedCards: isLateJoiner ? room.currentCardIndex : 0
    };

    room.players.push(player);
    room.playerChoices[playerId] = null;
    room.lastActivity = Date.now();

    // Track analytics
    try {
      const sessionId = this.roomSessions.get(roomId);
      if (sessionId) {
        analytics.addPlayerParticipation(sessionId, roomId, username, playerId, false);
        analytics.recordRoomActivity(roomId, 'player_joined', { 
          username, 
          isLateJoiner,
          currentCardIndex: room.currentCardIndex 
        });
      }
    } catch (error) {
      console.error('Failed to track player join:', error);
    }

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
        // Update analytics for new host
        try {
          const sessionId = this.roomSessions.get(roomId);
          if (sessionId) {
            analytics.recordRoomActivity(roomId, 'host_transferred', { 
              newHost: room.players[0].username 
            });
          }
        } catch (error) {
          console.error('Failed to track host transfer:', error);
        }
      } else {
        // Room is empty, mark for deletion
        room.status = 'finished';
      }
    }

    room.lastActivity = Date.now();
    this.rooms.set(roomId, room);
    await this.saveRoomToRedis(roomId, room);
    
    // Track player departure
    try {
      const sessionId = this.roomSessions.get(roomId);
      if (sessionId) {
        analytics.recordRoomActivity(roomId, 'player_left', { 
          username: removedPlayer.username 
        });
      }
    } catch (error) {
      console.error('Failed to track player departure:', error);
    }
    
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

    // Track game start
    try {
      const sessionId = this.roomSessions.get(roomId);
      if (sessionId) {
        analytics.updateGameSession(sessionId, { game_started: 1 });
        analytics.recordRoomActivity(roomId, 'game_started', { 
          totalPlayers: room.players.length 
        });
      }
    } catch (error) {
      console.error('Failed to track game start:', error);
    }

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
    
    // Track card response
    try {
      const sessionId = this.roomSessions.get(roomId);
      if (sessionId && player) {
        const cardText = room.shuffledCards[room.currentCardIndex];
        analytics.recordCardResponse(
          sessionId, 
          roomId, 
          room.currentCardIndex, 
          cardText, 
          player.username, 
          choice
        );
      }
    } catch (error) {
      console.error('Failed to track card response:', error);
    }
    
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

      // Track card progression
      try {
        const sessionId = this.roomSessions.get(roomId);
        if (sessionId) {
          analytics.updateGameSession(sessionId, { cards_played: nextIndex });
          analytics.recordRoomActivity(roomId, 'next_card', { 
            cardIndex: nextIndex,
            cardText: room.shuffledCards[nextIndex]
          });
        }
      } catch (error) {
        console.error('Failed to track card progression:', error);
      }

      return await this.updateRoom(roomId, updates);
    } else {
      // Game is over
      const updates = {
        status: 'finished',
        lastActivity: Date.now()
      };
      
      // Track game completion
      try {
        const sessionId = this.roomSessions.get(roomId);
        if (sessionId) {
          const duration = Date.now() - room.createdAt;
          analytics.updateGameSession(sessionId, { 
            game_completed: 1, 
            ended_at: new Date().toISOString(),
            session_duration: duration
          });
          analytics.recordRoomActivity(roomId, 'game_completed', { 
            totalCards: room.shuffledCards.length,
            duration: duration
          });
        }
      } catch (error) {
        console.error('Failed to track game completion:', error);
      }
      
      await this.saveGameResults(room, true);
      return await this.updateRoom(roomId, updates);
    }
  }

  // Get missed cards for late joiners
  getMissedCards(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room || !room.gameStarted) return [];

    const player = room.players.find(p => p.id === playerId);
    if (!player || !player.isLateJoiner) return [];

    const missedCards = [];
    for (let i = 0; i < room.currentCardIndex; i++) {
      if (room.cardHistory[i]) {
        missedCards.push({
          cardIndex: i,
          cardText: room.shuffledCards[i],
          responses: room.cardHistory[i]
        });
      }
    }
    return missedCards;
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

      // Check if this is a late joiner
      const isLateJoiner = updatedRoom.gameStarted && updatedRoom.currentCardIndex > 0;
      const missedCards = isLateJoiner ? roomManager.getMissedCards(roomId, socket.id) : [];

      socket.emit('room_joined', { 
        roomId, 
        isHost: false, 
        username,
        currentCardIndex: updatedRoom.currentCardIndex,
        revealChoices: updatedRoom.revealChoices,
        isLateJoiner,
        missedCards,
        currentCard: isLateJoiner && updatedRoom.shuffledCards ? 
          updatedRoom.shuffledCards[updatedRoom.currentCardIndex] : null
      });

      // Update all players in the room
      io.to(roomId).emit('update_room', updatedRoom);
      io.to(roomId).emit('player_joined', { 
        username, 
        isLateJoiner,
        missedCardsCount: missedCards.length 
      });
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: error.message || 'Failed to join room' });
    }
  });

  // Get missed cards for late joiners
  socket.on('get_missed_cards', async (roomId) => {
    try {
      const missedCards = roomManager.getMissedCards(roomId, socket.id);
      socket.emit('missed_cards', missedCards);
    } catch (error) {
      console.error('Error getting missed cards:', error);
      socket.emit('error', { message: 'Failed to get missed cards' });
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

// Analytics endpoints
app.get('/analytics/visits', (req, res) => {
  const { days = 7 } = req.query;
  const query = `
    SELECT 
      DATE(timestamp) as date,
      COUNT(DISTINCT session_id) as unique_visitors,
      COUNT(*) as total_visits,
      COUNT(DISTINCT ip_address) as unique_ips
    FROM user_visits 
    WHERE timestamp >= datetime('now', '-${days} days')
    GROUP BY DATE(timestamp)
    ORDER BY date DESC
  `;
  
  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.get('/analytics/games', (req, res) => {
  const { days = 7 } = req.query;
  const query = `
    SELECT 
      COUNT(*) as total_games,
      COUNT(CASE WHEN game_completed = 1 THEN 1 END) as completed_games,
      COUNT(CASE WHEN game_started = 1 THEN 1 END) as started_games,
      AVG(session_duration) as avg_duration,
      AVG(cards_played) as avg_cards_played,
      AVG(total_players) as avg_players_per_game
    FROM game_sessions 
    WHERE created_at >= datetime('now', '-${days} days')
  `;
  
  db.get(query, (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(row);
  });
});

app.get('/analytics/players', (req, res) => {
  const { days = 7 } = req.query;
  const query = `
    SELECT 
      COUNT(DISTINCT username) as unique_players,
      COUNT(*) as total_participations,
      AVG(cards_answered) as avg_cards_answered
    FROM player_participation 
    WHERE joined_at >= datetime('now', '-${days} days')
  `;
  
  db.get(query, (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(row);
  });
});

app.get('/analytics/responses', (req, res) => {
  const { days = 7 } = req.query;
  const query = `
    SELECT 
      choice,
      COUNT(*) as count,
      ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM card_responses WHERE answered_at >= datetime('now', '-${days} days')), 2) as percentage
    FROM card_responses 
    WHERE answered_at >= datetime('now', '-${days} days')
    GROUP BY choice
    ORDER BY count DESC
  `;
  
  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.get('/analytics/cards', (req, res) => {
  const { days = 7 } = req.query;
  const query = `
    SELECT 
      card_text,
      card_index,
      COUNT(*) as times_shown,
      COUNT(CASE WHEN choice = 'human' THEN 1 END) as human_responses,
      COUNT(CASE WHEN choice = 'ai' THEN 1 END) as ai_responses,
      ROUND(COUNT(CASE WHEN choice = 'human' THEN 1 END) * 100.0 / COUNT(*), 2) as human_percentage
    FROM card_responses 
    WHERE answered_at >= datetime('now', '-${days} days')
    GROUP BY card_text, card_index
    ORDER BY times_shown DESC
  `;
  
  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Track page visits
app.use((req, res, next) => {
  if (req.path.startsWith('/analytics') || req.path.startsWith('/admin')) {
    analytics.trackVisit(req, req.path);
  }
  next();
});

// Admin endpoints
app.get('/admin', (req, res) => {
  const adminHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Game Admin Dashboard</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { color: #333; text-align: center; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .stat-card h3 { margin: 0 0 10px 0; color: #555; }
        .stat-value { font-size: 2em; font-weight: bold; color: #2196F3; }
        .stat-label { color: #666; font-size: 0.9em; }
        .tabs { display: flex; margin-bottom: 20px; }
        .tab { padding: 10px 20px; background: #ddd; border: none; cursor: pointer; }
        .tab.active { background: #2196F3; color: white; }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
        th { background: #f8f9fa; font-weight: 600; }
        tr:hover { background-color: #f8f9fa; }
        .chart-container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .loading { text-align: center; padding: 20px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Game Analytics Dashboard</h1>
        
        <div class="stats-grid">
          <div class="stat-card">
            <h3>Active Rooms</h3>
            <div class="stat-value" id="activeRooms">-</div>
            <div class="stat-label">Currently running games</div>
          </div>
          <div class="stat-card">
            <h3>Total Players</h3>
            <div class="stat-value" id="totalPlayers">-</div>
            <div class="stat-label">Players in active games</div>
          </div>
          <div class="stat-card">
            <h3>Unique Visitors (7d)</h3>
            <div class="stat-value" id="uniqueVisitors">-</div>
            <div class="stat-label">Last 7 days</div>
          </div>
          <div class="stat-card">
            <h3>Games Completed (7d)</h3>
            <div class="stat-value" id="completedGames">-</div>
            <div class="stat-label">Last 7 days</div>
          </div>
        </div>

        <div class="tabs">
          <button class="tab active" onclick="showTab('rooms')">Active Rooms</button>
          <button class="tab" onclick="showTab('analytics')">Analytics</button>
          <button class="tab" onclick="showTab('responses')">Card Responses</button>
        </div>

        <div id="rooms" class="tab-content active">
          <table>
            <thead>
              <tr>
                <th>Room ID</th>
                <th>Host</th>
                <th>Players</th>
                <th>Status</th>
                <th>Current Card</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody id="roomsTableBody"></tbody>
          </table>
        </div>

        <div id="analytics" class="tab-content">
          <div class="chart-container">
            <h3>Visitor Trends (Last 7 Days)</h3>
            <div id="visitorChart" class="loading">Loading...</div>
          </div>
          <div class="chart-container">
            <h3>Game Statistics</h3>
            <div id="gameStats" class="loading">Loading...</div>
          </div>
        </div>

        <div id="responses" class="tab-content">
          <div class="chart-container">
            <h3>Response Distribution</h3>
            <div id="responseChart" class="loading">Loading...</div>
          </div>
          <div class="chart-container">
            <h3>Most Discussed Cards</h3>
            <div id="cardStats" class="loading">Loading...</div>
          </div>
        </div>
      </div>

      <script>
        function showTab(tabName) {
          // Hide all tab contents
          document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
          });
          
          // Remove active class from all tabs
          document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
          });
          
          // Show selected tab content
          document.getElementById(tabName).classList.add('active');
          
          // Add active class to clicked tab
          event.target.classList.add('active');
        }

        function updateStats() {
          // Update basic stats
          fetch('/admin/stats')
            .then(response => response.json())
            .then(data => {
              document.getElementById('activeRooms').textContent = data.activeRooms;
              document.getElementById('totalPlayers').textContent = data.totalPlayers;
              
              const tableBody = document.getElementById('roomsTableBody');
              tableBody.innerHTML = '';
              
              data.rooms.forEach(room => {
                const row = document.createElement('tr');
                row.innerHTML = \`
                  <td>\${room.id}</td>
                  <td>\${room.players.find(p => p.id === room.host)?.username || 'Unknown'}</td>
                  <td>\${room.players.length}</td>
                  <td>\${room.status}</td>
                  <td>\${room.currentCardIndex + 1}/\${room.shuffledCards?.length || '?'}</td>
                  <td>\${new Date(room.createdAt).toLocaleString()}</td>
                \`;
                tableBody.appendChild(row);
              });
            })
            .catch(error => console.error('Error fetching stats:', error));

          // Update analytics
          fetch('/analytics/visits')
            .then(response => response.json())
            .then(data => {
              const totalVisitors = data.reduce((sum, day) => sum + day.unique_visitors, 0);
              document.getElementById('uniqueVisitors').textContent = totalVisitors;
            })
            .catch(error => console.error('Error fetching visits:', error));

          fetch('/analytics/games')
            .then(response => response.json())
            .then(data => {
              document.getElementById('completedGames').textContent = data.completed_games || 0;
            })
            .catch(error => console.error('Error fetching games:', error));
        }

        function loadAnalytics() {
          // Load visitor trends
          fetch('/analytics/visits')
            .then(response => response.json())
            .then(data => {
              const chartDiv = document.getElementById('visitorChart');
              chartDiv.innerHTML = \`
                <table>
                  <tr><th>Date</th><th>Unique Visitors</th><th>Total Visits</th></tr>
                  \${data.map(day => \`
                    <tr><td>\${day.date}</td><td>\${day.unique_visitors}</td><td>\${day.total_visits}</td></tr>
                  \`).join('')}
                </table>
              \`;
            })
            .catch(error => console.error('Error loading visitor data:', error));

          // Load game stats
          fetch('/analytics/games')
            .then(response => response.json())
            .then(data => {
              const statsDiv = document.getElementById('gameStats');
              statsDiv.innerHTML = \`
                <table>
                  <tr><td>Total Games</td><td>\${data.total_games || 0}</td></tr>
                  <tr><td>Completed Games</td><td>\${data.completed_games || 0}</td></tr>
                  <tr><td>Started Games</td><td>\${data.started_games || 0}</td></tr>
                  <tr><td>Avg Duration</td><td>\${Math.round((data.avg_duration || 0) / 1000 / 60)} min</td></tr>
                  <tr><td>Avg Cards Played</td><td>\${Math.round(data.avg_cards_played || 0)}</td></tr>
                  <tr><td>Avg Players per Game</td><td>\${Math.round(data.avg_players_per_game || 0)}</td></tr>
                </table>
              \`;
            })
            .catch(error => console.error('Error loading game stats:', error));
        }

        function loadResponses() {
          // Load response distribution
          fetch('/analytics/responses')
            .then(response => response.json())
            .then(data => {
              const chartDiv = document.getElementById('responseChart');
              chartDiv.innerHTML = \`
                <table>
                  <tr><th>Choice</th><th>Count</th><th>Percentage</th></tr>
                  \${data.map(item => \`
                    <tr><td>\${item.choice}</td><td>\${item.count}</td><td>\${item.percentage}%</td></tr>
                  \`).join('')}
                </table>
              \`;
            })
            .catch(error => console.error('Error loading response data:', error));

          // Load card stats
          fetch('/analytics/cards')
            .then(response => response.json())
            .then(data => {
              const chartDiv = document.getElementById('cardStats');
              chartDiv.innerHTML = \`
                <table>
                  <tr><th>Card</th><th>Times Shown</th><th>Human %</th><th>AI %</th></tr>
                  \${data.slice(0, 10).map(card => \`
                    <tr>
                      <td>\${card.card_text.substring(0, 50)}...</td>
                      <td>\${card.times_shown}</td>
                      <td>\${card.human_percentage}%</td>
                      <td>\${100 - card.human_percentage}%</td>
                    </tr>
                  \`).join('')}
                </table>
              \`;
            })
            .catch(error => console.error('Error loading card data:', error));
        }
        
        // Initial load
        updateStats();
        loadAnalytics();
        loadResponses();
        
        // Update every 30 seconds
        setInterval(updateStats, 30000);
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
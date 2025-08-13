import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PlayerList from './PlayerList';
import CardBoard from './CardBoard';
import '../styles/GameRoom.css';

function GameRoom({ socket, roomData, setRoomData }) {
  const { roomId } = useParams();
  const navigate = useNavigate();
  
  // Initialize room with roomData.room if available
  const [room, setRoom] = useState(roomData?.room || null);
  const [currentCard, setCurrentCard] = useState('');
  const [revealChoices, setRevealChoices] = useState(false);
  const [playerChoice, setPlayerChoice] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [error, setError] = useState(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isLateJoiner, setIsLateJoiner] = useState(false);
  const [missedCards, setMissedCards] = useState([]);
  const [showMissedCards, setShowMissedCards] = useState(false);
  const [gameState, setGameState] = useState('lobby'); // lobby, voting, discussing, finished
  
  console.log("Initial roomData:", roomData);
  console.log("Initial room state:", room);
  
  useEffect(() => {
    // Clear any previous error when component mounts
    setError(null);
    
    // Request room data from server
    console.log('Requesting room data for:', roomId);
    socket.emit('get_room_data', roomId);

    // Handle room data response
    const handleRoomData = (roomData) => {
      console.log('Received room data:', roomData);
      setRoom(roomData);
      setGameStarted(roomData.gameStarted);
      setRevealChoices(roomData.revealChoices);
      setGameState(roomData.gameState || 'lobby');
      
      // Set current card if game is started
      if (roomData.gameStarted && roomData.shuffledCards && roomData.currentCardIndex >= 0) {
        setCurrentCard(roomData.shuffledCards[roomData.currentCardIndex]);
      }
      
      // Set player choice if exists
      if (roomData.playerChoices && roomData.playerChoices[socket.id]) {
        setPlayerChoice(roomData.playerChoices[socket.id]);
      }
    };

    // Handle room updates
    const handleUpdateRoom = (updatedRoom) => {
      console.log('Received room update:', updatedRoom);
      setRoom(updatedRoom);
      setRevealChoices(updatedRoom.revealChoices);
      setGameState(updatedRoom.gameState || 'lobby');
      
      // Update current card if game is started
      if (updatedRoom.gameStarted && updatedRoom.shuffledCards && updatedRoom.currentCardIndex >= 0) {
        setCurrentCard(updatedRoom.shuffledCards[updatedRoom.currentCardIndex]);
      }
      
      // Update player choice if exists
      if (updatedRoom.playerChoices && updatedRoom.playerChoices[socket.id]) {
        setPlayerChoice(updatedRoom.playerChoices[socket.id]);
      }
    };
    
    // Handle game started
    const handleGameStarted = (data) => {
      console.log('Game started:', data);
      setCurrentCard(data.card);
      setGameStarted(true);
      setRevealChoices(false);
      setPlayerChoice(null);
      setGameState(data.gameState || 'voting');
      setError(null);
    };
    
    // Handle choices revealed
    const handleChoicesRevealed = () => {
      console.log('Choices revealed');
      setRevealChoices(true);
      setGameState('discussing');
    };
    
    // Handle new card
    const handleNewCard = (data) => {
      console.log('New card:', data);
      setCurrentCard(data.card);
      setRevealChoices(false);
      setPlayerChoice(null);
      setGameState(data.gameState || 'voting');
    };
    
    // Handle game over
    const handleGameOver = () => {
      console.log('Game over');
      setGameOver(true);
      setGameState('finished');
    };
    
    // Handle player left
    const handlePlayerLeft = (data) => {
      console.log(`${data.username} left the game`);
    };

    // Handle player joined
    const handlePlayerJoined = (data) => {
      console.log(`${data.username} joined the game`);
      if (data.isLateJoiner) {
        console.log(`${data.username} joined late and missed ${data.missedCardsCount} cards`);
      }
    };
    
    // Handle new host
    const handleNewHost = (data) => {
      console.log('New host:', data);
      if (data.hostId === socket.id) {
        setRoomData({
          ...roomData,
          isHost: true
        });
      }
    };

    // Handle reconnection
    const handleReconnected = (data) => {
      console.log('Reconnected:', data);
      setIsReconnecting(false);
      setRoom(data.room);
      setGameStarted(data.room.gameStarted);
      setRevealChoices(data.room.revealChoices);
      setGameState(data.room.gameState || 'lobby');
      setRoomData({
        ...roomData,
        isHost: data.isHost
      });
      
      if (data.room.gameStarted && data.room.shuffledCards && data.room.currentCardIndex >= 0) {
        setCurrentCard(data.room.shuffledCards[data.room.currentCardIndex]);
      }
    };

    // Handle player reconnected
    const handlePlayerReconnected = (data) => {
      console.log(`${data.username} reconnected`);
    };

    // Handle missed cards for late joiners
    const handleMissedCards = (cards) => {
      console.log('Received missed cards:', cards);
      setMissedCards(cards);
      if (cards.length > 0) {
        setShowMissedCards(true);
      }
    };

    // Handle errors
    const handleError = (errorData) => {
      console.error('Socket error:', errorData);
      setError(errorData.message);
    };

    // Socket event listeners
    socket.on('room_data', handleRoomData);
    socket.on('update_room', handleUpdateRoom);
    socket.on('game_started', handleGameStarted);
    socket.on('choices_revealed', handleChoicesRevealed);
    socket.on('new_card', handleNewCard);
    socket.on('game_over', handleGameOver);
    socket.on('player_left', handlePlayerLeft);
    socket.on('player_joined', handlePlayerJoined);
    socket.on('new_host', handleNewHost);
    socket.on('reconnected', handleReconnected);
    socket.on('player_reconnected', handlePlayerReconnected);
    socket.on('missed_cards', handleMissedCards);
    socket.on('error', handleError);

    // Handle socket disconnection
    const handleDisconnect = () => {
      console.log('Socket disconnected');
      setIsReconnecting(true);
    };

    const handleReconnect = () => {
      console.log('Socket reconnected');
      setIsReconnecting(false);
      // Attempt to reconnect to room
      if (roomId && roomData?.username) {
        socket.emit('reconnect_attempt', { roomId, username: roomData.username });
      }
    };

    socket.on('disconnect', handleDisconnect);
    socket.on('reconnect', handleReconnect);
    
    return () => {
      socket.off('room_data', handleRoomData);
      socket.off('update_room', handleUpdateRoom);
      socket.off('game_started', handleGameStarted);
      socket.off('choices_revealed', handleChoicesRevealed);
      socket.off('new_card', handleNewCard);
      socket.off('game_over', handleGameOver);
      socket.off('player_left', handlePlayerLeft);
      socket.off('player_joined', handlePlayerJoined);
      socket.off('new_host', handleNewHost);
      socket.off('reconnected', handleReconnected);
      socket.off('player_reconnected', handlePlayerReconnected);
      socket.off('missed_cards', handleMissedCards);
      socket.off('error', handleError);
      socket.off('disconnect', handleDisconnect);
      socket.off('reconnect', handleReconnect);
    };
  }, [socket, roomData, setRoomData, roomId]);

  // Check if current user is a late joiner
  useEffect(() => {
    if (room && room.players) {
      const currentPlayer = room.players.find(p => p.id === socket.id);
      if (currentPlayer && currentPlayer.isLateJoiner) {
        setIsLateJoiner(true);
        // Request missed cards
        socket.emit('get_missed_cards', roomId);
      }
    }
  }, [room, socket, roomId]);
  
  const startGame = () => {
    setError(null);
    socket.emit('start_game', roomId);
  };
  
  const revealAllChoices = () => {
    setError(null);
    socket.emit('reveal_choices', roomId);
  };
  
  const nextCard = () => {
    setError(null);
    socket.emit('next_card', roomId);
  };

  const submitChoice = (choice) => {
    setError(null);
    socket.emit('submit_choice', { roomId, choice });
  };

  const updateChoice = (choice) => {
    setError(null);
    socket.emit('update_choice', { roomId, choice });
  };

  const closeMissedCards = () => {
    setShowMissedCards(false);
  };

  const leaveRoom = () => {
    setRoomData(null);
    navigate('/');
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    alert('Room code copied to clipboard!');
  };

  if (isReconnecting) {
    return (
      <div className="game-room">
        <div className="reconnecting">
          <h2>Reconnecting...</h2>
          <p>Please wait while we reconnect you to the game.</p>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="game-room">
        <div className="loading">
          <h2>Loading room...</h2>
          <p>Please wait while we connect to the game room.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="game-room">
      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {isLateJoiner && (
        <div className="late-joiner-notice">
          <p>You joined this game late! You missed some previous cards.</p>
          <button onClick={() => setShowMissedCards(true)}>
            View Missed Cards ({missedCards.length})
          </button>
        </div>
      )}

      {showMissedCards && (
        <div className="missed-cards-modal">
          <div className="missed-cards-content">
            <h3>Cards You Missed</h3>
            <div className="missed-cards-list">
              {missedCards.map((card, index) => (
                <div key={index} className="missed-card">
                  <h4>Card {card.cardIndex + 1}</h4>
                  <p>{card.cardText}</p>
                  <div className="responses">
                    <h5>Group Responses:</h5>
                    <div className="response-summary">
                      {Object.entries(card.responses).map(([playerId, choice]) => {
                        const player = room.players.find(p => p.id === playerId);
                        return (
                          <span key={playerId} className={`response ${choice}`}>
                            {player?.username || 'Unknown'}: {choice}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={closeMissedCards} className="close-button">
              Close
            </button>
          </div>
        </div>
      )}

      <div className="game-header">
        <h1>Human Connection Card Game</h1>
        <div className="room-info">
          <p>Room Code: <span className="room-code">{roomId}</span></p>
          <button onClick={copyRoomCode} className="copy-btn">Copy Code</button>
          <button onClick={leaveRoom} className="leave-btn">Leave Game</button>
        </div>
      </div>

      <div className="game-content">
        <div className="sidebar">
          <PlayerList 
            players={room.players} 
            playerChoices={room.playerChoices}
            revealChoices={revealChoices}
            currentUserId={socket.id}
          />
          
          {roomData?.isHost && (
            <div className="host-controls">
              <h3>Host Controls</h3>
              
              {!gameStarted && (
                <button 
                  onClick={startGame} 
                  className="start-btn"
                  disabled={room.players.length < 1}
                >
                  Start Game
                </button>
              )}
              
              {gameStarted && gameState === 'voting' && (
                <button 
                  onClick={revealAllChoices} 
                  className="reveal-btn"
                >
                  Reveal Choices
                </button>
              )}
              
              {gameStarted && gameState === 'discussing' && (
                <button 
                  onClick={nextCard} 
                  className="next-btn"
                >
                  Next Card
                </button>
              )}
            </div>
          )}
        </div>
        
        <div className="main-board">
          {!gameStarted ? (
            <div className="waiting-room">
              <h2>Waiting for the host to start the game...</h2>
              <p>Current players: {room.players.length}</p>
              {room.players.length === 0 && (
                <p className="warning">No players in room. Please invite others to join.</p>
              )}
            </div>
          ) : gameOver ? (
            <div className="game-over">
              <h2>Game Over!</h2>
              <p>Thanks for playing!</p>
              {roomData?.isHost && (
                <button onClick={startGame} className="restart-btn">
                  Play Again
                </button>
              )}
            </div>
          ) : (
            <CardBoard 
              card={currentCard}
              playerChoice={playerChoice}
              onCardDrop={submitChoice}
              revealChoices={revealChoices}
              playerChoices={room.playerChoices}
              players={room.players}
              gameState={gameState}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default GameRoom;


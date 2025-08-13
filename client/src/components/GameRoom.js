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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isLateJoiner, setIsLateJoiner] = useState(false);
  const [showLateJoinerMessage, setShowLateJoinerMessage] = useState(false);
  
  console.log("Initial roomData:", roomData);
  console.log("Initial room state:", room);
  
  useEffect(() => {
    // Request room data from server
    console.log('Requesting room data for:', roomId);
    socket.emit('get_room_data', roomId);

    // Set up socket event listeners
    const handleRoomUpdate = (updatedRoom) => {
      console.log('Received room update:', updatedRoom);
      setRoom(updatedRoom);
      setIsLoading(false);
    };

    const handleGameStarted = (data) => {
      console.log('Game started:', data);
      setCurrentCard(data.card);
      setGameStarted(true);
      setRevealChoices(false);
      setPlayerChoice(null);
      setIsLoading(false);
    };

    const handleGameStateSync = (data) => {
      console.log('Game state sync:', data);
      setGameStarted(data.gameStarted);
      setCurrentCard(data.currentCard);
      setRevealChoices(data.revealChoices);
      setIsLoading(false);
      
      // If this is a late joiner, show a welcome message
      if (data.isLateJoiner) {
        console.log('Late joiner detected - showing current game state');
        setIsLateJoiner(true);
        setShowLateJoinerMessage(true);
        // Hide the message after 5 seconds
        setTimeout(() => setShowLateJoinerMessage(false), 5000);
      }
    };

    const handleChoicesRevealed = () => {
      console.log('Choices revealed');
      setRevealChoices(true);
    };

    const handleNewCard = (data) => {
      console.log('New card:', data);
      setCurrentCard(data.card);
      setRevealChoices(false);
      setPlayerChoice(null);
    };

    const handleGameOver = () => {
      console.log('Game over');
      setGameOver(true);
    };

    const handlePlayerLeft = (data) => {
      console.log(`${data.username} left the game`);
    };

    const handleNewHost = (data) => {
      console.log('New host:', data);
      if (data.hostId === socket.id) {
        setRoomData({
          ...roomData,
          isHost: true
        });
      }
    };

    const handleChoiceUpdated = (data) => {
      console.log('Choice updated:', data);
      // Update the room state with the new choice
      setRoom(prevRoom => {
        if (!prevRoom) return prevRoom;
        return {
          ...prevRoom,
          playerChoices: {
            ...prevRoom.playerChoices,
            [data.playerId]: data.choice
          }
        };
      });
    };

    const handleError = (error) => {
      console.error('Socket error:', error);
      setError(error.message);
      setIsLoading(false);
    };

    const handleRoomJoined = (data) => {
      console.log('Room joined data:', data);
      if (data.isLateJoiner) {
        console.log('Late joiner joined - game already in progress');
        setGameStarted(true);
        setCurrentCard(data.currentCard);
        setRevealChoices(data.revealChoices);
        setIsLateJoiner(true);
        setShowLateJoinerMessage(true);
        // Hide the message after 5 seconds
        setTimeout(() => setShowLateJoinerMessage(false), 5000);
      }
    };

    const handleReconnectionSuccess = (data) => {
      console.log('Reconnection successful:', data);
      setRoom(data.room);
      setRoomData({
        ...roomData,
        isHost: data.isHost
      });
      setIsLoading(false);
    };

    // Add event listeners
    socket.on('update_room', handleRoomUpdate);
    socket.on('game_started', handleGameStarted);
    socket.on('game_state_sync', handleGameStateSync);
    socket.on('choices_revealed', handleChoicesRevealed);
    socket.on('new_card', handleNewCard);
    socket.on('game_over', handleGameOver);
    socket.on('player_left', handlePlayerLeft);
    socket.on('new_host', handleNewHost);
    socket.on('choice_updated', handleChoiceUpdated);
    socket.on('error', handleError);
    socket.on('room_joined', handleRoomJoined);
    socket.on('reconnection_success', handleReconnectionSuccess);
    
    // Cleanup function
    return () => {
      socket.off('update_room', handleRoomUpdate);
      socket.off('game_started', handleGameStarted);
      socket.off('game_state_sync', handleGameStateSync);
      socket.off('choices_revealed', handleChoicesRevealed);
      socket.off('new_card', handleNewCard);
      socket.off('game_over', handleGameOver);
      socket.off('player_left', handlePlayerLeft);
      socket.off('new_host', handleNewHost);
      socket.off('choice_updated', handleChoiceUpdated);
      socket.off('error', handleError);
      socket.off('room_joined', handleRoomJoined);
      socket.off('reconnection_success', handleReconnectionSuccess);
    };
  }, [socket, roomData, setRoomData, roomId]);
  
  const startGame = () => {
    try {
      socket.emit('start_game', roomId);
    } catch (error) {
      console.error('Error starting game:', error);
      setError('Failed to start game');
    }
  };
  
  const revealAllChoices = () => {
    try {
      socket.emit('reveal_choices', roomId);
    } catch (error) {
      console.error('Error revealing choices:', error);
      setError('Failed to reveal choices');
    }
  };
  
  const nextCard = () => {
    try {
      socket.emit('next_card', roomId);
    } catch (error) {
      console.error('Error moving to next card:', error);
      setError('Failed to move to next card');
    }
  };
  
  const handleCardDrop = (column) => {
    try {
      setPlayerChoice(column);
      socket.emit('submit_choice', { roomId, choice: column });
      
      if (revealChoices) {
        socket.emit('update_choice', { roomId, choice: column });
      }
    } catch (error) {
      console.error('Error submitting choice:', error);
      setError('Failed to submit choice');
    }
  };
  
  const leaveRoom = () => {
    setRoomData(null);
    navigate('/');
  };
  
  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    alert('Room code copied to clipboard!');
  };

  const retryConnection = () => {
    setError(null);
    setIsLoading(true);
    socket.emit('get_room_data', roomId);
  };
  
  // Show loading state
  if (isLoading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <p>Connecting to game...</p>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="error-container">
        <h2>Connection Error</h2>
        <p>{error}</p>
        <button onClick={retryConnection} className="retry-btn">
          Retry Connection
        </button>
        <button onClick={leaveRoom} className="leave-btn">
          Return to Home
        </button>
      </div>
    );
  }
  
  if (!room) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <p>Waiting for room data...</p>
      </div>
    );
  }
  
  return (
    <div className="game-room">
      <div className="game-header">
        <h1>Human Connection Card Game</h1>
        <div className="room-info">
          <p>Room Code: <span className="room-code">{roomId}</span></p>
          <button onClick={copyRoomCode} className="copy-btn">Copy Code</button>
          <button onClick={leaveRoom} className="leave-btn">Leave Game</button>
        </div>
      </div>
      
      <div className="game-content">
        {showLateJoinerMessage && (
          <div className="late-joiner-message">
            <p>Welcome! You've joined a game in progress. You can participate in the current card discussion.</p>
          </div>
        )}
        

        
        <div className="sidebar">
          <PlayerList 
            players={room.players} 
            playerChoices={room.playerChoices}
            revealChoices={revealChoices}
            currentUserId={socket.id}
          />
          
          {roomData.isHost && (
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
              
              {gameStarted && !revealChoices && (
                <button 
                  onClick={revealAllChoices} 
                  className="reveal-btn"
                >
                  Reveal Choices
                </button>
              )}
              
              {gameStarted && revealChoices && (
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
          {!gameStarted && (
            <div className="waiting-room">
              <h2>Waiting for the host to start the game...</h2>
              <p>Current players: {room.players.length}</p>
              {room.players.length === 0 && (
                <p className="no-players">No players have joined yet</p>
              )}
            </div>
          )}
          
          {gameStarted && !gameOver && (
            <CardBoard 
              card={currentCard}
              playerChoice={playerChoice}
              onCardDrop={handleCardDrop}
              revealChoices={revealChoices}
              playerChoices={room.playerChoices}
              players={room.players}
            />
          )}
          
          {gameOver && (
            <div className="game-over">
              <h2>Game Over!</h2>
              {roomData.isHost && (
                <button onClick={startGame} className="restart-btn">
                  Play Again
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GameRoom;


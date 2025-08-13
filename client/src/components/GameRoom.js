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
      setError(null);
    };
    
    // Handle choices revealed
    const handleChoicesRevealed = () => {
      console.log('Choices revealed');
      setRevealChoices(true);
    };
    
    // Handle new card
    const handleNewCard = (data) => {
      console.log('New card:', data);
      setCurrentCard(data.card);
      setRevealChoices(false);
      setPlayerChoice(null);
    };
    
    // Handle game over
    const handleGameOver = () => {
      console.log('Game over');
      setGameOver(true);
    };
    
    // Handle player left
    const handlePlayerLeft = (data) => {
      console.log(`${data.username} left the game`);
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
    socket.on('new_host', handleNewHost);
    socket.on('reconnected', handleReconnected);
    socket.on('player_reconnected', handlePlayerReconnected);
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
      socket.off('new_host', handleNewHost);
      socket.off('reconnected', handleReconnected);
      socket.off('player_reconnected', handlePlayerReconnected);
      socket.off('error', handleError);
      socket.off('disconnect', handleDisconnect);
      socket.off('reconnect', handleReconnect);
    };
  }, [socket, roomData, setRoomData, roomId]);
  
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
  
  const handleCardDrop = (column) => {
    setError(null);
    setPlayerChoice(column);
    socket.emit('submit_choice', { roomId, choice: column });
    
    if (revealChoices) {
      socket.emit('update_choice', { roomId, choice: column });
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
    socket.emit('get_room_data', roomId);
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
          <h2>Loading game room...</h2>
          {error && (
            <div className="error-container">
              <p className="error-message">{error}</p>
              <button onClick={retryConnection} className="retry-btn">Retry</button>
            </div>
          )}
        </div>
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

      {error && (
        <div className="error-banner">
          <p>{error}</p>
          <button onClick={() => setError(null)} className="dismiss-btn">×</button>
        </div>
      )}
      
      <div className="game-content">
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
                <p className="warning">No players in room. Please invite others to join.</p>
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


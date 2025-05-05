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
  
  console.log("Initial roomData:", roomData);
  console.log("Initial room state:", room);
  
  useEffect(() => {
    // Request room data from server
    console.log('Requesting room data for:', roomId);
    socket.emit('get_room_data', roomId);

    socket.on('update_room', (updatedRoom) => {
      console.log('Received room update:', updatedRoom);
      setRoom(updatedRoom);
    });
    
    socket.on('game_started', (data) => {
      setCurrentCard(data.card);
      setGameStarted(true);
      setRevealChoices(false);
      setPlayerChoice(null);
    });
    
    socket.on('choices_revealed', () => {
      setRevealChoices(true);
    });
    
    socket.on('new_card', (data) => {
      setCurrentCard(data.card);
      setRevealChoices(false);
      setPlayerChoice(null);
    });
    
    socket.on('game_over', () => {
      setGameOver(true);
    });
    
    socket.on('player_left', (data) => {
      console.log(`${data.username} left the game`);
    });
    
    socket.on('new_host', (data) => {
      if (data.hostId === socket.id) {
        setRoomData({
          ...roomData,
          isHost: true
        });
      }
    });
    
    return () => {
      socket.off('update_room');
      socket.off('game_started');
      socket.off('choices_revealed');
      socket.off('new_card');
      socket.off('game_over');
      socket.off('player_left');
      socket.off('new_host');
    };
  }, [socket, roomData, setRoomData]);
  
  const startGame = () => {
    socket.emit('start_game', roomId);
  };
  
  const revealAllChoices = () => {
    socket.emit('reveal_choices', roomId);
  };
  
  const nextCard = () => {
    socket.emit('next_card', roomId);
  };
  
  const handleCardDrop = (column) => {
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
  
  if (!room) {
    return <div className="loading">Loading game room...</div>;
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


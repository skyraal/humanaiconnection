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
        </div>
      </div>
    );
  }

  return (
    <div className="game-room">
      {error && (
        <div className="error-message">
          <p>{error}</p>
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
        <h2>Room: {roomId}</h2>
        <div className="room-info">
          <span>Players: {room.players.length}/{room.maxPlayers}</span>
          {gameStarted && (
            <span>Card: {room.currentCardIndex + 1}/{room.shuffledCards?.length || '?'}</span>
          )}
        </div>
      </div>

      <div className="game-content">
        <div className="left-panel">
          <PlayerList 
            players={room.players} 
            hostId={room.host}
            currentPlayerId={socket.id}
            playerChoices={room.playerChoices}
            revealChoices={revealChoices}
          />
        </div>

        <div className="center-panel">
          {!gameStarted ? (
            <div className="waiting-room">
              <h3>Waiting for players...</h3>
              <p>Share this room code with others: <strong>{roomId}</strong></p>
              {roomData?.isHost && room.players.length >= 1 && (
                <button onClick={startGame} className="start-button">
                  Start Game
                </button>
              )}
            </div>
          ) : gameOver ? (
            <div className="game-over">
              <h3>Game Over!</h3>
              <p>Thanks for playing!</p>
            </div>
          ) : (
            <CardBoard
              currentCard={currentCard}
              revealChoices={revealChoices}
              playerChoice={playerChoice}
              playerChoices={room.playerChoices}
              players={room.players}
              isHost={roomData?.isHost}
              onSubmitChoice={submitChoice}
              onUpdateChoice={updateChoice}
              onRevealChoices={revealAllChoices}
              onNextCard={nextCard}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default GameRoom;


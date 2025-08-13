import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Home.css';

function Home({ socket, setRoomData }) {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleRoomCreated = (data) => {
      console.log('Room created data:', data);
      setIsLoading(false);
      // Store both the connection data and room data
      setRoomData({...data, room: data.room}); 
      navigate(`/room/${data.roomId}`);
    };
    
    const handleRoomJoined = (data) => {
      console.log('Room joined data:', data);
      setIsLoading(false);
      setRoomData(data);
      navigate(`/room/${data.roomId}`);
    };

    const handleSocketError = (error) => {
      console.error('Socket error:', error);
      setError(error.message);
      setIsLoading(false);
    };
    
    // Add event listeners
    socket.on('room_created', handleRoomCreated);
    socket.on('room_joined', handleRoomJoined);
    socket.on('error', handleSocketError);
    
    return () => {
      socket.off('room_created', handleRoomCreated);
      socket.off('room_joined', handleRoomJoined);
      socket.off('error', handleSocketError);
    };
  }, [socket, navigate, setRoomData]);

  const validateInputs = () => {
    if (!username.trim()) {
      setError('Please enter a username');
      return false;
    }
    
    if (username.trim().length < 2) {
      setError('Username must be at least 2 characters long');
      return false;
    }
    
    if (username.trim().length > 20) {
      setError('Username must be less than 20 characters');
      return false;
    }
    
    return true;
  };

  const createRoom = () => {
    if (!validateInputs()) return;
    
    setError('');
    setIsLoading(true);
    socket.emit('create_room', username.trim());
  };

  const joinRoom = () => {
    if (!validateInputs()) return;
    
    if (!roomId.trim()) {
      setError('Please enter a room code');
      return;
    }
    
    if (roomId.trim().length !== 6) {
      setError('Room code must be 6 characters long');
      return;
    }
    
    setError('');
    setIsLoading(true);
    socket.emit('join_room', { roomId: roomId.trim().toUpperCase(), username: username.trim() });
  };

  const handleKeyPress = (e, action) => {
    if (e.key === 'Enter') {
      action();
    }
  };

  return (
    <div className="home-container">
       <div className="rithm-logo"><img src='logo.png' id='rithm-logo' alt="Rithm Logo"></img></div>
        
      <div className="home-content">
       
        <h1 className="rithm-gradient-text">Building human connection</h1>
        <h2>in the age of AI</h2>
        
        <div className="form-group">
          <label htmlFor="username">Your Name:</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyPress={(e) => handleKeyPress(e, createRoom)}
            placeholder="Enter your name"
            disabled={isLoading}
            maxLength={20}
          />
        </div>
        
        <div className="buttons">
          <button 
            onClick={createRoom} 
            className="create-btn"
            disabled={isLoading}
          >
            {isLoading ? 'Creating...' : 'Create New Game'}
          </button>
          
          <div className="join-section">
            <h3>Already have a game code?</h3>
            <div className="form-group">
              <label htmlFor="roomId">Room Code:</label>
              <input
                type="text"
                id="roomId"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                onKeyPress={(e) => handleKeyPress(e, joinRoom)}
                placeholder="Enter room code"
                disabled={isLoading}
                maxLength={6}
              />
            </div>
            <button 
              onClick={joinRoom} 
              className="join-btn"
              disabled={isLoading}
            >
              {isLoading ? 'Joining...' : 'Join Existing Game'}
            </button>
          </div>
        </div>
        
        {error && <p className="error-message">{error}</p>}
      </div>
    </div>
  );
}

export default Home;
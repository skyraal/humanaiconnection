import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Home.css';

function Home({ socket, setRoomData }) {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    socket.on('room_created', (data) => {
      console.log('Room created data:', data);
      // Store both the connection data and room data
      setRoomData({...data, room: data.room}); 
      navigate(`/room/${data.roomId}`);
    });
    
    socket.on('room_joined', (data) => {
      console.log('Room joined data:', data);
      setRoomData(data);
      navigate(`/room/${data.roomId}`);
    });
    
    return () => {
      socket.off('room_created');
      socket.off('room_joined');
    };
  }, [socket, navigate, setRoomData]);

  const createRoom = () => {
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }
    
    socket.emit('create_room', username);
  };

  const joinRoom = () => {
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }
    
    if (!roomId.trim()) {
      setError('Please enter a room code');
      return;
    }
    
    socket.emit('join_room', { roomId, username });
  };

  return (
    <div className="home-container">
      <div className="home-content">
        <div className="rithm-logo">The Rithm Project</div>
        
        <h1 className="rithm-gradient-text">Building human connection</h1>
        <h2>in an age of AI</h2>
        
        <div className="form-group">
          <label htmlFor="username">Your Name:</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your name"
          />
        </div>
        
        <div className="buttons">
          <button onClick={createRoom} className="create-btn">
            Create New Game
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
                placeholder="Enter room code"
              />
            </div>
            <button onClick={joinRoom} className="join-btn">
              Join Existing Game
            </button>
          </div>
        </div>
        
        {error && <p className="error-message">{error}</p>}
      </div>
    </div>
  );
}

export default Home;
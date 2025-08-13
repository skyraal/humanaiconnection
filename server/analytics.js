const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

let supabase = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('✅ Supabase analytics initialized');
} else {
  console.log('⚠️  Supabase not configured - analytics will be disabled');
}

class AnalyticsManager {
  constructor() {
    this.supabase = supabase;
    this.isEnabled = !!supabase;
  }

  // Track user visits (traffic analytics)
  async trackVisit(userAgent, ipAddress, referrer = null) {
    if (!this.isEnabled) return;

    try {
      const { data, error } = await this.supabase
        .from('user_visits')
        .insert({
          user_agent: userAgent,
          ip_address: ipAddress,
          referrer: referrer,
          visited_at: new Date().toISOString(),
          session_id: this.generateSessionId()
        });

      if (error) {
        console.error('Error tracking visit:', error);
      } else {
        console.log('✅ Visit tracked successfully');
      }
    } catch (error) {
      console.error('Error tracking visit:', error);
    }
  }

  // Track game session creation
  async createGameSession(roomId, hostUsername, hostId) {
    if (!this.isEnabled) return null;

    try {
      const { data, error } = await this.supabase
        .from('game_sessions')
        .insert({
          room_id: roomId,
          host_username: hostUsername,
          host_id: hostId,
          created_at: new Date().toISOString(),
          status: 'created'
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating game session:', error);
        return null;
      }

      console.log('✅ Game session created:', data.id);
      return data.id;
    } catch (error) {
      console.error('Error creating game session:', error);
      return null;
    }
  }

  // Track player joining a game
  async trackPlayerJoin(sessionId, playerId, username, isLateJoiner = false) {
    if (!this.isEnabled) return;

    try {
      const { data, error } = await this.supabase
        .from('player_participation')
        .insert({
          session_id: sessionId,
          player_id: playerId,
          username: username,
          joined_at: new Date().toISOString(),
          is_late_joiner: isLateJoiner,
          left_at: null
        });

      if (error) {
        console.error('Error tracking player join:', error);
      } else {
        console.log('✅ Player join tracked:', username);
      }
    } catch (error) {
      console.error('Error tracking player join:', error);
    }
  }

  // Track player leaving a game
  async trackPlayerLeave(sessionId, playerId, username) {
    if (!this.isEnabled) return;

    try {
      const { data, error } = await this.supabase
        .from('player_participation')
        .update({
          left_at: new Date().toISOString()
        })
        .eq('session_id', sessionId)
        .eq('player_id', playerId)
        .eq('left_at', null);

      if (error) {
        console.error('Error tracking player leave:', error);
      } else {
        console.log('✅ Player leave tracked:', username);
      }
    } catch (error) {
      console.error('Error tracking player leave:', error);
    }
  }

  // Track game start
  async trackGameStart(sessionId, playerCount) {
    if (!this.isEnabled) return;

    try {
      const { data, error } = await this.supabase
        .from('game_sessions')
        .update({
          started_at: new Date().toISOString(),
          player_count: playerCount,
          status: 'playing'
        })
        .eq('id', sessionId);

      if (error) {
        console.error('Error tracking game start:', error);
      } else {
        console.log('✅ Game start tracked');
      }
    } catch (error) {
      console.error('Error tracking game start:', error);
    }
  }

  // Track card responses (the main research data)
  async trackCardResponse(sessionId, playerId, username, cardIndex, cardText, choice, responseTime = null) {
    if (!this.isEnabled) return;

    try {
      const { data, error } = await this.supabase
        .from('card_responses')
        .insert({
          session_id: sessionId,
          player_id: playerId,
          username: username,
          card_index: cardIndex,
          card_text: cardText,
          choice: choice,
          response_time_ms: responseTime,
          responded_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error tracking card response:', error);
      } else {
        console.log('✅ Card response tracked:', `${username} chose ${choice} for card ${cardIndex}`);
      }
    } catch (error) {
      console.error('Error tracking card response:', error);
    }
  }

  // Track room activity (all game events)
  async trackRoomActivity(sessionId, eventType, eventData, playerId = null, username = null) {
    if (!this.isEnabled) return;

    try {
      const { data, error } = await this.supabase
        .from('room_activity')
        .insert({
          session_id: sessionId,
          event_type: eventType,
          event_data: eventData,
          player_id: playerId,
          username: username,
          timestamp: new Date().toISOString()
        });

      if (error) {
        console.error('Error tracking room activity:', error);
      }
    } catch (error) {
      console.error('Error tracking room activity:', error);
    }
  }

  // Track game completion
  async trackGameComplete(sessionId, finalPlayerCount, totalCards, completionTime) {
    if (!this.isEnabled) return;

    try {
      const { data, error } = await this.supabase
        .from('game_sessions')
        .update({
          completed_at: new Date().toISOString(),
          final_player_count: finalPlayerCount,
          total_cards_played: totalCards,
          completion_time_seconds: completionTime,
          status: 'completed'
        })
        .eq('id', sessionId);

      if (error) {
        console.error('Error tracking game completion:', error);
      } else {
        console.log('✅ Game completion tracked');
      }
    } catch (error) {
      console.error('Error tracking game completion:', error);
    }
  }

  // Get analytics data
  async getAnalytics() {
    if (!this.isEnabled) {
      return { error: 'Analytics not enabled' };
    }

    try {
      // Get total visits
      const { count: totalVisits } = await this.supabase
        .from('user_visits')
        .select('*', { count: 'exact', head: true });

      // Get total game sessions
      const { count: totalSessions } = await this.supabase
        .from('game_sessions')
        .select('*', { count: 'exact', head: true });

      // Get completed games
      const { count: completedGames } = await this.supabase
        .from('game_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');

      // Get total players
      const { count: totalPlayers } = await this.supabase
        .from('player_participation')
        .select('*', { count: 'exact', head: true });

      // Get total responses
      const { count: totalResponses } = await this.supabase
        .from('card_responses')
        .select('*', { count: 'exact', head: true });

      // Get response distribution
      const { data: responseDistribution } = await this.supabase
        .from('card_responses')
        .select('choice')
        .then(result => {
          if (result.error) return { data: [] };
          const distribution = {};
          result.data.forEach(response => {
            distribution[response.choice] = (distribution[response.choice] || 0) + 1;
          });
          return { data: distribution };
        });

      // Get recent activity
      const { data: recentActivity } = await this.supabase
        .from('room_activity')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(50);

      return {
        totalVisits: totalVisits || 0,
        totalSessions: totalSessions || 0,
        completedGames: completedGames || 0,
        totalPlayers: totalPlayers || 0,
        totalResponses: totalResponses || 0,
        responseDistribution: responseDistribution || {},
        recentActivity: recentActivity || [],
        completionRate: totalSessions ? ((completedGames / totalSessions) * 100).toFixed(1) : 0
      };
    } catch (error) {
      console.error('Error getting analytics:', error);
      return { error: error.message };
    }
  }

  // Get detailed game data for research
  async getGameData(sessionId = null) {
    if (!this.isEnabled) {
      return { error: 'Analytics not enabled' };
    }

    try {
      let query = this.supabase
        .from('game_sessions')
        .select(`
          *,
          player_participation(*),
          card_responses(*),
          room_activity(*)
        `)
        .order('created_at', { ascending: false });

      if (sessionId) {
        query = query.eq('id', sessionId);
      } else {
        query = query.limit(100); // Get last 100 games
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error getting game data:', error);
        return { error: error.message };
      }

      return { data };
    } catch (error) {
      console.error('Error getting game data:', error);
      return { error: error.message };
    }
  }

  // Get response patterns for research
  async getResponsePatterns() {
    if (!this.isEnabled) {
      return { error: 'Analytics not enabled' };
    }

    try {
      // Get response distribution by card
      const { data: cardResponses } = await this.supabase
        .from('card_responses')
        .select('card_index, card_text, choice, username')
        .order('card_index', { ascending: true });

      // Get response times
      const { data: responseTimes } = await this.supabase
        .from('card_responses')
        .select('response_time_ms, choice')
        .not('response_time_ms', 'is', null);

      // Get player behavior patterns
      const { data: playerPatterns } = await this.supabase
        .from('card_responses')
        .select('username, choice, card_index')
        .order('username', { ascending: true });

      return {
        cardResponses: cardResponses || [],
        responseTimes: responseTimes || [],
        playerPatterns: playerPatterns || []
      };
    } catch (error) {
      console.error('Error getting response patterns:', error);
      return { error: error.message };
    }
  }

  // Get traffic analytics
  async getTrafficAnalytics() {
    if (!this.isEnabled) {
      return { error: 'Analytics not enabled' };
    }

    try {
      // Get visits by day
      const { data: dailyVisits } = await this.supabase
        .from('user_visits')
        .select('visited_at')
        .gte('visited_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days

      // Get unique visitors
      const { data: uniqueVisitors } = await this.supabase
        .from('user_visits')
        .select('ip_address')
        .gte('visited_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      // Get referrer data
      const { data: referrers } = await this.supabase
        .from('user_visits')
        .select('referrer')
        .not('referrer', 'is', null);

      return {
        dailyVisits: dailyVisits || [],
        uniqueVisitors: uniqueVisitors ? [...new Set(uniqueVisitors.map(v => v.ip_address))].length : 0,
        referrers: referrers || []
      };
    } catch (error) {
      console.error('Error getting traffic analytics:', error);
      return { error: error.message };
    }
  }

  // Helper method to generate session ID
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Initialize database tables (run once)
  async initializeTables() {
    if (!this.isEnabled) {
      console.log('⚠️  Supabase not configured - skipping table initialization');
      return;
    }

    console.log('📊 Initializing analytics tables...');

    // Note: In Supabase, you'll need to create these tables manually in the dashboard
    // or use migrations. Here's the SQL to create the tables:

    const tableDefinitions = `
      -- User visits table (traffic analytics)
      CREATE TABLE IF NOT EXISTS user_visits (
        id SERIAL PRIMARY KEY,
        user_agent TEXT,
        ip_address TEXT,
        referrer TEXT,
        visited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        session_id TEXT
      );

      -- Game sessions table
      CREATE TABLE IF NOT EXISTS game_sessions (
        id SERIAL PRIMARY KEY,
        room_id TEXT NOT NULL,
        host_username TEXT NOT NULL,
        host_id TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        player_count INTEGER,
        final_player_count INTEGER,
        total_cards_played INTEGER,
        completion_time_seconds INTEGER,
        status TEXT DEFAULT 'created'
      );

      -- Player participation table
      CREATE TABLE IF NOT EXISTS player_participation (
        id SERIAL PRIMARY KEY,
        session_id INTEGER REFERENCES game_sessions(id),
        player_id TEXT NOT NULL,
        username TEXT NOT NULL,
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        left_at TIMESTAMP WITH TIME ZONE,
        is_late_joiner BOOLEAN DEFAULT FALSE
      );

      -- Card responses table (main research data)
      CREATE TABLE IF NOT EXISTS card_responses (
        id SERIAL PRIMARY KEY,
        session_id INTEGER REFERENCES game_sessions(id),
        player_id TEXT NOT NULL,
        username TEXT NOT NULL,
        card_index INTEGER NOT NULL,
        card_text TEXT NOT NULL,
        choice TEXT NOT NULL,
        response_time_ms INTEGER,
        responded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Room activity table (all game events)
      CREATE TABLE IF NOT EXISTS room_activity (
        id SERIAL PRIMARY KEY,
        session_id INTEGER REFERENCES game_sessions(id),
        event_type TEXT NOT NULL,
        event_data JSONB,
        player_id TEXT,
        username TEXT,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Create indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_user_visits_visited_at ON user_visits(visited_at);
      CREATE INDEX IF NOT EXISTS idx_game_sessions_created_at ON game_sessions(created_at);
      CREATE INDEX IF NOT EXISTS idx_card_responses_session_id ON card_responses(session_id);
      CREATE INDEX IF NOT EXISTS idx_card_responses_choice ON card_responses(choice);
      CREATE INDEX IF NOT EXISTS idx_room_activity_session_id ON room_activity(session_id);
    `;

    console.log('📋 Table definitions ready. Please run this SQL in your Supabase dashboard:');
    console.log(tableDefinitions);
  }
}

module.exports = AnalyticsManager; 
#!/bin/bash

# 🚀 Human Connection Card Game - Deployment Script
# This script helps you deploy the game to Render.com

echo "🚀 Starting deployment process..."

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "❌ Git repository not found. Please initialize git first:"
    echo "   git init"
    echo "   git add ."
    echo "   git commit -m 'Initial commit'"
    echo "   git remote add origin <your-github-repo-url>"
    echo "   git push -u origin main"
    exit 1
fi

# Check if changes are committed
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  You have uncommitted changes. Please commit them first:"
    echo "   git add ."
    echo "   git commit -m 'Ready for deployment'"
    echo "   git push"
    exit 1
fi

echo "✅ Repository is ready for deployment"

# Check if render.yaml exists
if [ ! -f "render.yaml" ]; then
    echo "❌ render.yaml not found. Creating it..."
    cat > render.yaml << 'EOF'
services:
  # Backend API Service
  - type: web
    name: humanaiconnection-backend
    env: node
    plan: free
    buildCommand: cd server && npm install
    startCommand: cd server && npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      - key: CORS_ORIGIN
        value: https://humanaiconnection-frontend.onrender.com

  # Frontend Static Site
  - type: web
    name: humanaiconnection-frontend
    env: static
    plan: free
    buildCommand: cd client && npm install && npm run build
    staticPublishPath: client/build
    envVars:
      - key: REACT_APP_SERVER_URL
        value: https://humanaiconnection-backend.onrender.com
EOF
    echo "✅ Created render.yaml"
fi

echo ""
echo "📋 Deployment Checklist:"
echo "1. ✅ Repository is on GitHub"
echo "2. ✅ render.yaml is configured"
echo "3. ✅ All changes are committed"
echo ""
echo "🎯 Next Steps:"
echo ""
echo "1. Go to https://render.com"
echo "2. Sign up with your GitHub account"
echo "3. Click 'New +' → 'Blueprint'"
echo "4. Connect your GitHub repository"
echo "5. Render will automatically detect render.yaml"
echo "6. Click 'Apply' to deploy"
echo ""
echo "🌐 Your app will be available at:"
echo "   Frontend: https://humanaiconnection-frontend.onrender.com"
echo "   Backend: https://humanaiconnection-backend.onrender.com"
echo "   Admin: https://humanaiconnection-backend.onrender.com/admin"
echo ""
echo "📊 After deployment:"
echo "1. Test the game functionality"
echo "2. Check the admin dashboard"
echo "3. Monitor performance metrics"
echo "4. Set up custom domain (optional)"
echo ""
echo "💡 Tips:"
echo "- Free tier has limitations (sleep after inactivity)"
echo "- Upgrade to paid plan for better performance"
echo "- Use Supabase for database (free tier available)"
echo "- Monitor usage to stay within limits"
echo ""
echo "🎉 Happy deploying!" 
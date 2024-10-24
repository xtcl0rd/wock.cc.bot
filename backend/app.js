require('dotenv').config();
const express = require('express');
const axios = require('axios');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the "assets" directory
app.use(express.static(path.join(__dirname, '../assets')));

// Serve static files from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// Setup session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'defaultsecret',
    resave: false,
    saveUninitialized: false,
  })
);

// Discord OAuth2 credentials from .env file
const {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_REDIRECT_URI,
} = process.env;

// Redirect user to Discord OAuth2 login
app.get('/auth/login', (req, res) => {
  const discordAuthURL = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(
    DISCORD_REDIRECT_URI
  )}&response_type=code&scope=identify`;
  res.redirect(discordAuthURL);
});

// Handle OAuth2 callback and exchange code for token
app.get('/auth/redirect', async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.redirect('/?login=error');
  }

  try {
    const tokenResponse = await axios.post(
      'https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: DISCORD_REDIRECT_URI,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token } = tokenResponse.data;

    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    req.session.user = userResponse.data;

    // Redirect to the main page with success message
    res.redirect(`/?login=success&username=${encodeURIComponent(userResponse.data.username)}`);
  } catch (error) {
    console.error('Error during token exchange:', error);
    res.redirect('/?login=error');
  }
});

// API route to check user session status
app.get('/auth/session', (req, res) => {
  if (req.session.user) {
    return res.json({
      loggedIn: true,
      username: req.session.user.username,
    });
  } else {
    return res.json({
      loggedIn: false,
    });
  }
});

// Logout user by destroying session
app.get('/auth/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Home route serving index.html from the root directory
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html')); // Serve index.html from the root
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// proxyServer.js
const express = require('express');
const cors = require('cors'); // Add cors middleware
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();

// Enable CORS for all origins or restrict to specific origins
app.use(cors({
  origin: '*', // Or replace '*' with 'http://localhost:4000' (your frontend URL)
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: true,  // If you're using cookies or auth headers
}));

// Define your backend server URL
const BACKEND_URL = 'http://localhost:3002'; // Replace with your backend server URL

// Proxy all API requests to the backend
app.use('/api', createProxyMiddleware({
  target: BACKEND_URL,
  changeOrigin: true, // Ensures that the origin header is correctly set
//   pathRewrite: {
//     '^/api': '', // Optional: Removes '/api' prefix when forwarding to backend
//   },
}));

// Start the proxy server on a different port (e.g., 4001)
app.listen(4001, () => {
  console.log('Proxy server is running on http://localhost:4001');
});

const { Octokit } = require("@octokit/rest");
const { App } = require("@octokit/app");

// Simple test endpoint first
module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Test GitHub App connection
    const app = new App({
      appId: process.env.GITHUB_APP_ID,
      privateKey: process.env.GITHUB_PRIVATE_KEY.replace(/\\n/g, '\n'),
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    });

    // Get installations
    const installations = await app.octokit.rest.apps.listInstallations();
    
    res.status(200).json({
      status: "success",
      message: "GitHub MCP Server is running!",
      installationsCount: installations.data.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      status: "error",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

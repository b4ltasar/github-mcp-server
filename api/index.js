// Test GitHub App step by step
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
    // Step 1: Try to import packages
    let App, Octokit;
    try {
      const octokitApp = require("@octokit/app");
      const octokitRest = require("@octokit/rest");
      App = octokitApp.App;
      Octokit = octokitRest.Octokit;
    } catch (importError) {
      return res.status(500).json({
        status: "error",
        message: "Failed to import Octokit packages",
        error: importError.message,
        timestamp: new Date().toISOString()
      });
    }

    // Step 2: Try to create App
    let app;
    try {
      app = new App({
        appId: process.env.GITHUB_APP_ID,
        privateKey: process.env.GITHUB_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
      });
    } catch (appError) {
      return res.status(500).json({
        status: "error",
        message: "Failed to create GitHub App",
        error: appError.message,
        timestamp: new Date().toISOString()
      });
    }

    // Step 3: Check App properties
    const appDebug = {
      appExists: !!app,
      hasOctokit: !!app.octokit,
      appType: typeof app,
      octokitType: typeof app.octokit,
      appKeys: app ? Object.keys(app) : [],
    };

    if (!app.octokit) {
      return res.status(500).json({
        status: "error",
        message: "App created but octokit is undefined",
        debug: appDebug,
        timestamp: new Date().toISOString()
      });
    }

    // Step 4: Try to call API
    try {
      const installations = await app.octokit.rest.apps.listInstallations();
      
      res.status(200).json({
        status: "success",
        message: "GitHub App working!",
        installationsCount: installations.data.length,
        debug: appDebug,
        timestamp: new Date().toISOString()
      });
    } catch (apiError) {
      res.status(500).json({
        status: "error",
        message: "API call failed",
        error: apiError.message,
        debug: appDebug,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
};

// Test GitHub App API structure
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
    const { App } = require("@octokit/app");

    const app = new App({
      appId: process.env.GITHUB_APP_ID,
      privateKey: process.env.GITHUB_PRIVATE_KEY.replace(/\\n/g, '\n'),
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    });

    // Debug the octokit structure
    const octokitDebug = {
      octokitExists: !!app.octokit,
      octokitKeys: app.octokit ? Object.keys(app.octokit) : [],
      hasRest: !!app.octokit?.rest,
      restKeys: app.octokit?.rest ? Object.keys(app.octokit.rest) : [],
      hasApps: !!app.octokit?.rest?.apps,
      octokitType: typeof app.octokit,
    };

    // Try different ways to access apps API
    let installationsResult;
    try {
      // Method 1: Direct octokit call
      if (app.octokit.request) {
        installationsResult = await app.octokit.request('GET /app/installations');
      }
    } catch (method1Error) {
      octokitDebug.method1Error = method1Error.message;
    }

    // Method 2: Check if we need to get installation octokit first
    let installationOctokit;
    try {
      const installations = await app.octokit.request('GET /app/installations');
      if (installations.data.length > 0) {
        installationOctokit = await app.getInstallationOctokit(installations.data[0].id);
        octokitDebug.installationOctokitKeys = installationOctokit ? Object.keys(installationOctokit) : [];
      }
    } catch (method2Error) {
      octokitDebug.method2Error = method2Error.message;
    }

    res.status(200).json({
      status: "debug",
      message: "Octokit structure analysis",
      debug: octokitDebug,
      installationsResult: installationsResult?.data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
};

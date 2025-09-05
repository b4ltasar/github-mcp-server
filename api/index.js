// Simple test endpoint first - just check env vars
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
    // Just check environment variables first
    const envCheck = {
      hasAppId: !!process.env.GITHUB_APP_ID,
      hasPrivateKey: !!process.env.GITHUB_PRIVATE_KEY,
      hasClientId: !!process.env.GITHUB_CLIENT_ID,
      hasClientSecret: !!process.env.GITHUB_CLIENT_SECRET,
      appIdValue: process.env.GITHUB_APP_ID || 'NOT_SET',
      privateKeyStart: process.env.GITHUB_PRIVATE_KEY ? process.env.GITHUB_PRIVATE_KEY.substring(0, 30) + '...' : 'NOT_SET',
      allEnvKeys: Object.keys(process.env).filter(key => key.startsWith('GITHUB'))
    };

    res.status(200).json({
      status: "debug",
      message: "Environment check",
      debug: envCheck,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      status: "error",
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
};

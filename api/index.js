// Working GitHub MCP Server
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

    // Handle different endpoints
    const path = req.url || '/';
    
    if (path === '/test') {
      // Test endpoint
      const installations = await app.octokit.request('GET /app/installations');
      
      return res.status(200).json({
        status: "success",
        message: "GitHub MCP Server is working!",
        installationsCount: installations.data.length,
        installations: installations.data.map(inst => ({
          id: inst.id,
          account: inst.account.login,
          permissions: Object.keys(inst.permissions)
        })),
        timestamp: new Date().toISOString()
      });
    }

    if (path === '/repos') {
      // List repositories
      const installations = await app.octokit.request('GET /app/installations');
      if (installations.data.length === 0) {
        return res.status(400).json({ error: "No installations found" });
      }

      const installationOctokit = await app.getInstallationOctokit(installations.data[0].id);
      const repos = await installationOctokit.request('GET /installation/repositories');
      
      return res.status(200).json({
        status: "success",
        repositories: repos.data.repositories.map(repo => ({
          name: repo.name,
          full_name: repo.full_name,
          private: repo.private,
          url: repo.html_url
        }))
      });
    }

    if (path.startsWith('/repos/') && req.method === 'POST') {
      // Create file endpoint
      const body = JSON.parse(req.body || '{}');
      const { owner, repo, path: filePath, content, message } = body;
      
      const installations = await app.octokit.request('GET /app/installations');
      const installationOctokit = await app.getInstallationOctokit(installations.data[0].id);
      
      const result = await installationOctokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
        owner,
        repo,
        path: filePath,
        message,
        content: Buffer.from(content).toString('base64')
      });
      
      return res.status(200).json({
        status: "success",
        message: "File created successfully",
        url: result.data.content.html_url
      });
    }

    // Default endpoint - show available endpoints
    res.status(200).json({
      status: "success",
      message: "GitHub MCP Server is running!",
      endpoints: {
        "GET /test": "Test GitHub App connection",
        "GET /repos": "List accessible repositories", 
        "POST /repos/create-file": "Create a file (requires body: {owner, repo, path, content, message})"
      },
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

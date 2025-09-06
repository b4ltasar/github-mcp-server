// Working GitHub + Figma MCP Server
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
    // Handle different endpoints
    const path = req.url || '/';
    
    // GitHub endpoints
    if (path === '/test') {
      const { App } = require("@octokit/app");
      const app = new App({
        appId: process.env.GITHUB_APP_ID,
        privateKey: process.env.GITHUB_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
      });

      const installations = await app.octokit.request('GET /app/installations');
      
      return res.status(200).json({
        status: "success",
        message: "GitHub + Figma MCP Server is working!",
        github: {
          installationsCount: installations.data.length,
          installations: installations.data.map(inst => ({
            id: inst.id,
            account: inst.account.login,
            permissions: Object.keys(inst.permissions)
          }))
        },
        figma: {
          hasToken: !!process.env.FIGMA_ACCESS_TOKEN,
          tokenStart: process.env.FIGMA_ACCESS_TOKEN ? process.env.FIGMA_ACCESS_TOKEN.substring(0, 8) + '...' : 'missing'
        },
        timestamp: new Date().toISOString()
      });
    }

    if (path === '/repos') {
      const { App } = require("@octokit/app");
      const app = new App({
        appId: process.env.GITHUB_APP_ID,
        privateKey: process.env.GITHUB_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
      });

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

    // Figma endpoints
    if (path === '/figma/test') {
      if (!process.env.FIGMA_ACCESS_TOKEN) {
        return res.status(400).json({
          status: "error",
          message: "Figma access token not configured"
        });
      }

      const response = await fetch('https://api.figma.com/v1/me', {
        headers: {
          'X-Figma-Token': process.env.FIGMA_ACCESS_TOKEN
        }
      });

      if (!response.ok) {
        return res.status(400).json({
          status: "error",
          message: `Figma API error: ${response.status} ${response.statusText}`
        });
      }

      const userData = await response.json();
      
      return res.status(200).json({
        status: "success",
        message: "Figma API connection working!",
        user: {
          id: userData.id,
          email: userData.email,
          handle: userData.handle
        },
        timestamp: new Date().toISOString()
      });
    }

    if (path === '/figma/project') {
      if (!process.env.FIGMA_ACCESS_TOKEN) {
        return res.status(400).json({
          status: "error",
          message: "Figma access token not configured"
        });
      }

      // Extract project ID from your URL: https://www.figma.com/files/project/70427346
      const projectId = '70427346';
      
      const response = await fetch(`https://api.figma.com/v1/projects/${projectId}/files`, {
        headers: {
          'X-Figma-Token': process.env.FIGMA_ACCESS_TOKEN
        }
      });

      if (!response.ok) {
        return res.status(400).json({
          status: "error",
          message: `Figma API error: ${response.status} ${response.statusText}`
        });
      }

      const projectData = await response.json();
      
      return res.status(200).json({
        status: "success",
        message: "Project files retrieved",
        files: projectData.files.map(file => ({
          key: file.key,
          name: file.name,
          thumbnail_url: file.thumbnail_url,
          last_modified: file.last_modified
        })),
        timestamp: new Date().toISOString()
      });
    }

    if (path.startsWith('/figma/file/')) {
      const pathParts = path.split('/');
      const fileKey = pathParts[3]; // Extract file key from URL
      const nodeId = pathParts[4]; // Optional node ID for specific components
      
      let apiUrl = `https://api.figma.com/v1/files/${fileKey}`;
      if (nodeId) {
        // Get specific nodes if node ID is provided
        apiUrl += `?ids=${nodeId}&depth=2`;
      }
      
      const response = await fetch(apiUrl, {
        headers: {
          'X-Figma-Token': process.env.FIGMA_ACCESS_TOKEN
        }
      });

      if (!response.ok) {
        return res.status(400).json({
          status: "error",
          message: `Figma API error: ${response.status} ${response.statusText}`
        });
      }

      const fileData = await response.json();
      
      if (nodeId && fileData.nodes) {
        // Return specific node data
        return res.status(200).json({
          status: "success",
          message: "Node data retrieved",
          node: fileData.nodes[nodeId],
          timestamp: new Date().toISOString()
        });
      }
      
      // Process pages and extract relevant design data
      const processedPages = fileData.document.children.map(page => {
        const processNode = (node) => {
          const baseData = {
            id: node.id,
            name: node.name,
            type: node.type,
          };

          // Add specific properties for different node types
          if (node.fills) baseData.fills = node.fills;
          if (node.strokes) baseData.strokes = node.strokes;
          if (node.effects) baseData.effects = node.effects;
          if (node.absoluteBoundingBox) baseData.bounds = node.absoluteBoundingBox;
          if (node.constraints) baseData.constraints = node.constraints;
          if (node.characters) baseData.text = node.characters;
          if (node.style) baseData.textStyle = node.style;

          // Recursively process children (limited depth for performance)
          if (node.children && node.children.length > 0) {
            baseData.children = node.children.map(processNode);
          }

          return baseData;
        };

        return {
          id: page.id,
          name: page.name,
          type: page.type,
          children: page.children ? page.children.map(processNode) : []
        };
      });
      
      return res.status(200).json({
        status: "success",
        message: "File data retrieved",
        file: {
          name: fileData.name,
          lastModified: fileData.lastModified,
          version: fileData.version,
          pages: processedPages
        },
        timestamp: new Date().toISOString()
      });
    }

    if (path.startsWith('/figma/page/')) {
      const pathParts = path.split('/');
      const fileKey = pathParts[3];
      const pageId = pathParts[4];
      
      if (!fileKey || !pageId) {
        return res.status(400).json({
          status: "error",
          message: "File key and page ID required"
        });
      }
      
      const response = await fetch(`https://api.figma.com/v1/files/${fileKey}?ids=${pageId}&depth=3`, {
        headers: {
          'X-Figma-Token': process.env.FIGMA_ACCESS_TOKEN
        }
      });

      if (!response.ok) {
        return res.status(400).json({
          status: "error",
          message: `Figma API error: ${response.status} ${response.statusText}`
        });
      }

      const fileData = await response.json();
      
      return res.status(200).json({
        status: "success",
        message: "Page data retrieved",
        page: fileData.nodes[pageId],
        timestamp: new Date().toISOString()
      });
    }

    // GitHub file creation endpoint
    if (path === '/repos/create-file' && req.method === 'POST') {
      const { App } = require("@octokit/app");
      const app = new App({
        appId: process.env.GITHUB_APP_ID,
        privateKey: process.env.GITHUB_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
      });

      // Get request body
      let body;
      if (typeof req.body === 'string') {
        body = JSON.parse(req.body);
      } else if (req.body && typeof req.body === 'object') {
        body = req.body;
      } else {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        await new Promise(resolve => req.on('end', resolve));
        const rawBody = Buffer.concat(chunks).toString();
        body = JSON.parse(rawBody);
      }
      
      const { owner, repo, path: filePath, content, message } = body;
      
      if (!owner || !repo || !filePath || !content || !message) {
        return res.status(400).json({
          status: "error",
          message: "Missing required fields: owner, repo, path, content, message"
        });
      }
      
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
        url: result.data.content.html_url,
        path: filePath
      });
    }

    // Default endpoint - show available endpoints
    res.status(200).json({
      status: "success",
      message: "GitHub + Figma MCP Server is running!",
      endpoints: {
        "GitHub": {
          "GET /test": "Test GitHub App connection",
          "GET /repos": "List accessible repositories", 
          "POST /repos/create-file": "Create a file (requires body: {owner, repo, path, content, message})"
        },
        "Figma": {
          "GET /figma/test": "Test Figma API connection",
          "GET /figma/project": "List files in your project (70427346)",
          "GET /figma/file/{fileKey}": "Get file details and structure",
          "GET /figma/file/{fileKey}/{nodeId}": "Get specific node details",
          "GET /figma/page/{fileKey}/{pageId}": "Get specific page content"
        }
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

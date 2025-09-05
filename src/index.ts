#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { Octokit } from "@octokit/rest";
import { App } from "@octokit/app";
import { z } from "zod";

const server = new Server(
  {
    name: "github-mcp-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Initialize GitHub App
const app = new App({
  appId: process.env.GITHUB_APP_ID!,
  privateKey: process.env.GITHUB_PRIVATE_KEY!.replace(/\\n/g, '\n'),
  clientId: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
});

// Get installation octokit (will be set when needed)
let octokit: Octokit;

async function getOctokit(installationId?: number): Promise<Octokit> {
  if (installationId) {
    return await app.getInstallationOctokit(installationId);
  }
  
  // If no installation ID provided, get the first installation
  if (!octokit) {
    const installations = await app.octokit.rest.apps.listInstallations();
    if (installations.data.length === 0) {
      throw new Error("No GitHub App installations found");
    }
    octokit = await app.getInstallationOctokit(installations.data[0].id);
  }
  
  return octokit;
}

// Tool schemas
const CreateRepoSchema = z.object({
  installation_id: z.number().optional(),
  name: z.string(),
  description: z.string().optional(),
  private: z.boolean().default(false),
});

const CreateFileSchema = z.object({
  installation_id: z.number().optional(),
  owner: z.string(),
  repo: z.string(),
  path: z.string(),
  content: z.string(),
  message: z.string(),
  branch: z.string().default("main"),
});

const ReadFileSchema = z.object({
  installation_id: z.number().optional(),
  owner: z.string(),
  repo: z.string(),
  path: z.string(),
  ref: z.string().optional(),
});

const ListInstallationsSchema = z.object({
  per_page: z.number().min(1).max(100).default(30),
});

const ListReposSchema = z.object({
  installation_id: z.number().optional(),
  type: z.enum(["owner", "public", "private"]).default("owner"),
  sort: z.enum(["created", "updated", "pushed", "full_name"]).default("updated"),
  per_page: z.number().min(1).max(100).default(30),
});

const CreateBranchSchema = z.object({
  installation_id: z.number().optional(),
  owner: z.string(),
  repo: z.string(),
  branch: z.string(),
  from_branch: z.string().default("main"),
});

const CreatePRSchema = z.object({
  installation_id: z.number().optional(),
  owner: z.string(),
  repo: z.string(),
  title: z.string(),
  head: z.string(),
  base: z.string().default("main"),
  body: z.string().optional(),
});

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_installations",
        description: "List GitHub App installations",
        inputSchema: {
          type: "object",
          properties: {
            per_page: { type: "number", minimum: 1, maximum: 100, default: 30 },
          },
        },
      },
      {
        name: "create_repo",
        description: "Create a new GitHub repository",
        inputSchema: {
          type: "object",
          properties: {
            installation_id: { type: "number", description: "Installation ID (optional)" },
            name: { type: "string", description: "Repository name" },
            description: { type: "string", description: "Repository description" },
            private: { type: "boolean", description: "Make repository private", default: false },
          },
          required: ["name"],
        },
      },
      {
        name: "list_repos",
        description: "List user repositories",
        inputSchema: {
          type: "object",
          properties: {
            installation_id: { type: "number", description: "Installation ID (optional)" },
            type: { type: "string", enum: ["owner", "public", "private"], default: "owner" },
            sort: { type: "string", enum: ["created", "updated", "pushed", "full_name"], default: "updated" },
            per_page: { type: "number", minimum: 1, maximum: 100, default: 30 },
          },
        },
      },
      {
        name: "create_file",
        description: "Create or update a file in a repository",
        inputSchema: {
          type: "object",
          properties: {
            installation_id: { type: "number", description: "Installation ID (optional)" },
            owner: { type: "string", description: "Repository owner" },
            repo: { type: "string", description: "Repository name" },
            path: { type: "string", description: "File path" },
            content: { type: "string", description: "File content" },
            message: { type: "string", description: "Commit message" },
            branch: { type: "string", description: "Branch name", default: "main" },
          },
          required: ["owner", "repo", "path", "content", "message"],
        },
      },
      {
        name: "read_file",
        description: "Read a file from a repository",
        inputSchema: {
          type: "object",
          properties: {
            installation_id: { type: "number", description: "Installation ID (optional)" },
            owner: { type: "string", description: "Repository owner" },
            repo: { type: "string", description: "Repository name" },
            path: { type: "string", description: "File path" },
            ref: { type: "string", description: "Branch, tag, or commit SHA" },
          },
          required: ["owner", "repo", "path"],
        },
      },
      {
        name: "create_branch",
        description: "Create a new branch",
        inputSchema: {
          type: "object",
          properties: {
            installation_id: { type: "number", description: "Installation ID (optional)" },
            owner: { type: "string", description: "Repository owner" },
            repo: { type: "string", description: "Repository name" },
            branch: { type: "string", description: "New branch name" },
            from_branch: { type: "string", description: "Source branch", default: "main" },
          },
          required: ["owner", "repo", "branch"],
        },
      },
      {
        name: "create_pull_request",
        description: "Create a pull request",
        inputSchema: {
          type: "object",
          properties: {
            installation_id: { type: "number", description: "Installation ID (optional)" },
            owner: { type: "string", description: "Repository owner" },
            repo: { type: "string", description: "Repository name" },
            title: { type: "string", description: "PR title" },
            head: { type: "string", description: "Source branch" },
            base: { type: "string", description: "Target branch", default: "main" },
            body: { type: "string", description: "PR description" },
          },
          required: ["owner", "repo", "title", "head"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_installations": {
        const { per_page } = ListInstallationsSchema.parse(args);
        const installations = await app.octokit.rest.apps.listInstallations({
          per_page,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                installations.data.map((installation) => ({
                  id: installation.id,
                  account: installation.account?.login,
                  app_id: installation.app_id,
                  target_type: installation.target_type,
                  permissions: installation.permissions,
                  created_at: installation.created_at,
                })),
                null,
                2
              ),
            },
          ],
        };
      }

      case "create_repo": {
        const { installation_id, name, description, private: isPrivate } = CreateRepoSchema.parse(args);
        const octokitInstance = await getOctokit(installation_id);
        const response = await octokitInstance.rest.repos.createForAuthenticatedUser({
          name,
          description,
          private: isPrivate,
        });
        return {
          content: [
            {
              type: "text",
              text: `Repository created successfully: ${response.data.html_url}`,
            },
          ],
        };
      }

      case "list_repos": {
        const { installation_id, type, sort, per_page } = ListReposSchema.parse(args);
        const octokitInstance = await getOctokit(installation_id);
        const response = await octokitInstance.rest.repos.listForAuthenticatedUser({
          type,
          sort,
          per_page,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                response.data.map((repo) => ({
                  name: repo.name,
                  full_name: repo.full_name,
                  description: repo.description,
                  private: repo.private,
                  html_url: repo.html_url,
                  updated_at: repo.updated_at,
                })),
                null,
                2
              ),
            },
          ],
        };
      }

      case "create_file": {
        const { installation_id, owner, repo, path, content, message, branch } = CreateFileSchema.parse(args);
        const octokitInstance = await getOctokit(installation_id);
        
        // Encode content to base64
        const encodedContent = Buffer.from(content).toString('base64');
        
        try {
          // Try to get existing file to update it
          const existingFile = await octokitInstance.rest.repos.getContent({
            owner,
            repo,
            path,
            ref: branch,
          });
          
          // Update existing file
          const response = await octokitInstance.rest.repos.createOrUpdateFileContents({
            owner,
            repo,
            path,
            message,
            content: encodedContent,
            branch,
            sha: Array.isArray(existingFile.data) ? undefined : existingFile.data.sha,
          });
          
          return {
            content: [
              {
                type: "text",
                text: `File updated successfully: ${response.data.content?.html_url}`,
              },
            ],
          };
        } catch (error: any) {
          if (error.status === 404) {
            // File doesn't exist, create new one
            const response = await octokitInstance.rest.repos.createOrUpdateFileContents({
              owner,
              repo,
              path,
              message,
              content: encodedContent,
              branch,
            });
            
            return {
              content: [
                {
                  type: "text",
                  text: `File created successfully: ${response.data.content?.html_url}`,
                },
              ],
            };
          }
          throw error;
        }
      }

      case "read_file": {
        const { installation_id, owner, repo, path, ref } = ReadFileSchema.parse(args);
        const octokitInstance = await getOctokit(installation_id);
        const response = await octokitInstance.rest.repos.getContent({
          owner,
          repo,
          path,
          ref,
        });
        
        if (Array.isArray(response.data)) {
          return {
            content: [
              {
                type: "text",
                text: "Path is a directory, not a file",
              },
            ],
          };
        }
        
        const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
        return {
          content: [
            {
              type: "text",
              text: content,
            },
          ],
        };
      }

      case "create_branch": {
        const { installation_id, owner, repo, branch, from_branch } = CreateBranchSchema.parse(args);
        const octokitInstance = await getOctokit(installation_id);
        
        // Get the SHA of the source branch
        const refResponse = await octokitInstance.rest.git.getRef({
          owner,
          repo,
          ref: `heads/${from_branch}`,
        });
        
        // Create new branch
        const response = await octokitInstance.rest.git.createRef({
          owner,
          repo,
          ref: `refs/heads/${branch}`,
          sha: refResponse.data.object.sha,
        });
        
        return {
          content: [
            {
              type: "text",
              text: `Branch '${branch}' created successfully from '${from_branch}'`,
            },
          ],
        };
      }

      case "create_pull_request": {
        const { installation_id, owner, repo, title, head, base, body } = CreatePRSchema.parse(args);
        const octokitInstance = await getOctokit(installation_id);
        const response = await octokitInstance.rest.pulls.create({
          owner,
          repo,
          title,
          head,
          base,
          body,
        });
        
        return {
          content: [
            {
              type: "text",
              text: `Pull request created successfully: ${response.data.html_url}`,
            },
          ],
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      );
    }
    throw new McpError(ErrorCode.InternalError, `GitHub API error: ${error.message}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("GitHub MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});

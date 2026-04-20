const apiKey = process.env.NEON_API_KEY;
if (!apiKey) {
  throw new Error("NEON_API_KEY is required");
}

const projectId = process.env.NEON_PROJECT_ID;
const branchId = process.env.NEON_BRANCH_ID;
const branchName = process.env.NEON_BRANCH_NAME || "main";
const databaseName = process.env.NEON_DATABASE_NAME || "fund_price_forecast";
const roleName = process.env.NEON_ROLE_NAME || "fund_price_forecast_app";
const rolePassword = process.env.NEON_ROLE_PASSWORD;

if (!projectId) {
  throw new Error("NEON_PROJECT_ID is required");
}

if (!rolePassword) {
  throw new Error("NEON_ROLE_PASSWORD is required");
}

const headers = {
  accept: "application/json",
  authorization: `Bearer ${apiKey}`,
  "content-type": "application/json",
};

async function neon(path, init) {
  const response = await fetch(`https://console.neon.tech/api/v2${path}`, {
    ...init,
    headers,
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Neon API ${path} failed with ${response.status}: ${body}`);
  }
  return response.json();
}

async function resolveBranch() {
  if (branchId) {
    return { id: branchId, name: branchName };
  }

  const branches = await neon(`/projects/${projectId}/branches`, { method: "GET" });
  const found = branches.branches.find((item) => item.name === branchName);
  if (found) {
    return { id: found.id, name: found.name };
  }

  const created = await neon(`/projects/${projectId}/branches`, {
    method: "POST",
    body: JSON.stringify({
      branch: {
        name: branchName,
      },
    }),
  });
  return { id: created.branch.id, name: created.branch.name };
}

async function ensureReadWriteEndpoint(branch) {
  const endpoints = await neon(`/projects/${projectId}/branches/${branch.id}/endpoints`, { method: "GET" });
  const found = endpoints.endpoints.find((item) => item.type === "read_write");
  if (found) {
    return found;
  }

  const created = await neon(`/projects/${projectId}/endpoints`, {
    method: "POST",
    body: JSON.stringify({
      endpoint: {
        branch_id: branch.id,
        type: "read_write",
      },
    }),
  });
  return created.endpoint;
}

async function ensureDatabase(branch, ownerName) {
  const databases = await neon(`/projects/${projectId}/branches/${branch.id}/databases`, { method: "GET" });
  const found = databases.databases.find((item) => item.name === databaseName);
  if (found) {
    return found;
  }
  const created = await neon(`/projects/${projectId}/branches/${branch.id}/databases`, {
    method: "POST",
    body: JSON.stringify({
      database: {
        name: databaseName,
        owner_name: ownerName,
      },
    }),
  });
  return created.database;
}

async function ensureRole(branch) {
  const roles = await neon(`/projects/${projectId}/branches/${branch.id}/roles`, { method: "GET" });
  const found = roles.roles.find((item) => item.name === roleName);
  if (found) {
    return found;
  }
  const created = await neon(`/projects/${projectId}/branches/${branch.id}/roles`, {
    method: "POST",
    body: JSON.stringify({
      role: {
        name: roleName,
        password: rolePassword,
      },
    }),
  });
  return created.role;
}

async function getConnectionUri(branch) {
  const query = new URLSearchParams({
    branch_id: branch.id,
    database_name: databaseName,
    role_name: roleName,
  });
  const payload = await neon(`/projects/${projectId}/connection_uri?${query}`, { method: "GET" });
  return payload.uri;
}

const branch = await resolveBranch();
const endpoint = await ensureReadWriteEndpoint(branch);
const role = await ensureRole(branch);
const database = await ensureDatabase(branch, role.name);
const databaseUrl = await getConnectionUri(branch);

console.log(
  JSON.stringify(
    {
      projectId,
      branchId: branch.id,
      branchName: branch.name,
      endpointId: endpoint.id,
      databaseName: database.name,
      roleName: role.name,
      databaseUrl,
    },
    null,
    2
  )
);

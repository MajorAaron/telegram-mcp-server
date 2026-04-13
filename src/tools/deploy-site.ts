export async function executeDeploySite(params: {
  site_name: string;
  html_content: string;
  title?: string;
}): Promise<string> {
  const token = process.env.NETLIFY_AUTH_TOKEN;
  if (!token) {
    return "Error: NETLIFY_AUTH_TOKEN is not configured.";
  }

  const title = params.title ?? params.site_name;
  const html = params.html_content.includes("<html")
    ? params.html_content
    : `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title></head>
<body>${params.html_content}</body>
</html>`;

  // Create site
  const createRes = await fetch("https://api.netlify.com/api/v1/sites", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: params.site_name }),
  });

  let siteId: string;
  let siteUrl: string;

  if (createRes.ok) {
    const site = await createRes.json();
    siteId = site.id;
    siteUrl = site.ssl_url || site.url;
  } else if (createRes.status === 422) {
    // Site name taken — try to find it in our account
    const listRes = await fetch(
      `https://api.netlify.com/api/v1/sites?name=${params.site_name}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const sites = await listRes.json();
    const existing = sites.find(
      (s: any) => s.name === params.site_name
    );
    if (!existing) {
      return `Error: Site name "${params.site_name}" is taken and not in your account.`;
    }
    siteId = existing.id;
    siteUrl = existing.ssl_url || existing.url;
  } else {
    const err = await createRes.text();
    return `Error creating site: ${err}`;
  }

  // Deploy via file digest
  const encoder = new TextEncoder();
  const fileBytes = encoder.encode(html);
  const hashBuffer = await crypto.subtle.digest("SHA-1", fileBytes);
  const sha1 = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const deployRes = await fetch(
    `https://api.netlify.com/api/v1/sites/${siteId}/deploys`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        files: { "/index.html": sha1 },
      }),
    }
  );

  if (!deployRes.ok) {
    const err = await deployRes.text();
    return `Error creating deploy: ${err}`;
  }

  const deploy = await deployRes.json();
  const deployId = deploy.id;

  // Upload the file
  const uploadRes = await fetch(
    `https://api.netlify.com/api/v1/deploys/${deployId}/files/index.html`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
      },
      body: fileBytes,
    }
  );

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    return `Error uploading file: ${err}`;
  }

  return `Site deployed successfully!\nURL: ${siteUrl}\nDeploy ID: ${deployId}`;
}

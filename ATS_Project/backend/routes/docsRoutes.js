const express = require('express');
const router = express.Router();
const openApiSpec = require('../docs/openApiSpec');

// GET /api/docs/json - Return raw OpenAPI 3.0 specification
router.get('/json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json(openApiSpec);
});

// GET /api/docs - Serve self-contained, interactive Swagger UI
router.get('/', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ATS Intelligence Platform API Documentation</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.11.0/swagger-ui.css">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <style>
    body { margin: 0; padding: 0; background: #0f172a; color: #f8fafc; font-family: system-ui, sans-serif; }
    .top-header { background: #020617; padding: 16px 32px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: space-between; }
    .top-header h1 { font-size: 1.15rem; margin: 0; color: #fff; font-weight: 800; display: flex; align-items: center; gap: 10px; }
    .swagger-ui { background: #0f172a; }
    .swagger-ui .info .title, .swagger-ui .info h1, .swagger-ui .info h2, .swagger-ui .info h3, .swagger-ui .info h4, .swagger-ui .info h5 { color: #f8fafc; }
    .swagger-ui .info p, .swagger-ui .info li { color: #94a3b8; }
    .swagger-ui .scheme-container { background: #1e293b; border-bottom: 1px solid rgba(255,255,255,0.08); box-shadow: none; }
    .swagger-ui .opblock .opblock-summary-operation-id, .swagger-ui .opblock .opblock-summary-path, .swagger-ui .opblock .opblock-summary-path__deprecated { color: #f8fafc; }
    .swagger-ui .opblock-description-wrapper p, .swagger-ui .opblock-external-docs-wrapper p, .swagger-ui .opblock-title_normal p { color: #cbd5e1; }
    .swagger-ui table thead tr td, .swagger-ui table thead tr th { color: #94a3b8; }
    .swagger-ui .response-col_status { color: #38bdf8; }
    .swagger-ui .btn.authorize { color: #38bdf8; border-color: #38bdf8; }
    .swagger-ui .btn.authorize svg { fill: #38bdf8; }
  </style>
</head>
<body>
  <div class="top-header">
    <h1>🚀 ATS Intelligence Platform — OpenAPI 3.0 Documentation</h1>
    <a href="/index.html" style="color: #38bdf8; text-decoration: none; font-size: 0.85rem; font-weight: 600;">← Back to ATS Portal</a>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: '/api/docs/json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>`;
  return res.status(200).send(html);
});

module.exports = router;

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = process.cwd();
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".woff2": "font/woff2"
};

http
  .createServer((request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "*");

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    let pathname;
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      pathname = url.pathname === "/" ? "/index.html" : url.pathname;
      pathname = decodeURIComponent(pathname);
    } catch {
      response.writeHead(400);
      response.end();
      return;
    }

    const file = path.resolve(root, `.${pathname}`);

    if (!file.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403);
      response.end();
      return;
    }

    const sendFile = (targetFile, allowFallback) => {
      fs.readFile(targetFile, (error, content) => {
        if (error) {
          if (allowFallback && error.code === "ENOENT" && pathname.startsWith("/frontend/")) {
            const stripped = pathname.replace(/^\/frontend\//, "/");
            const fallbackFile = path.resolve(root, `.${stripped}`);
            if (fallbackFile.startsWith(`${root}${path.sep}`) && fallbackFile !== targetFile) {
              sendFile(fallbackFile, false);
              return;
            }
          }
          response.writeHead(error.code === "ENOENT" ? 404 : 500);
          response.end();
          return;
        }

        response.writeHead(200, {
          "Content-Type": contentTypes[path.extname(targetFile)] || "application/octet-stream"
        });
        response.end(content);
      });
    };

    sendFile(file, true);
  })
  .listen(18184, "127.0.0.1");

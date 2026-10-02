import http from 'node:http';

const port = Number(process.env.PORT || 8080);

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: true,
        service: 'japanflow-api',
      })
    );
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      ok: true,
      message: 'JapanFlow API - Google Cloud Run',
    })
  );
});

server.listen(port, '0.0.0.0', () => {
  console.log(`JapanFlow API running on port ${port}`);
});

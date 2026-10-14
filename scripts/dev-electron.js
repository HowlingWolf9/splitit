import { createServer } from 'vite';
import { spawn } from 'child_process';
import electron from 'electron';

async function start() {
  const server = await createServer({
    server: {
      port: 5173
    }
  });

  await server.listen();
  const address = server.httpServer.address();
  const port = address.port;
  const devUrl = `http://localhost:${port}`;
  console.log(`\n🚀 Vite dev server running at: ${devUrl}`);
  console.log('⚡ Launching Electron desktop window...\n');

  const electronProcess = spawn(
    electron,
    ['.', `--dev-url=${devUrl}`],
    {
      stdio: 'inherit',
      shell: process.platform === 'win32'
    }
  );

  electronProcess.on('close', (code) => {
    console.log(`\n🛑 Electron exited (${code || 0}). Stopping Vite dev server...`);
    server.close();
    process.exit(code || 0);
  });
}

start().catch((err) => {
  console.error('Failed to start Electron dev environment:', err);
  process.exit(1);
});

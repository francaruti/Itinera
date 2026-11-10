import type { Request, Response } from 'express';

/** Difusión de cambios en tiempo real (Server-Sent Events). */
export function createHub() {
  const clients = new Set<Response>();

  const heartbeat = setInterval(() => {
    for (const res of clients) res.write(': ping\n\n');
  }, 25_000);
  heartbeat.unref();

  return {
    size: () => clients.size,
    handler(req: Request, res: Response, currentRev: number) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write(`retry: 3000\nevent: rev\ndata: ${JSON.stringify({ rev: currentRev })}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
    },
    broadcast(rev: number) {
      const msg = `event: rev\ndata: ${JSON.stringify({ rev })}\n\n`;
      for (const res of clients) res.write(msg);
    },
    close() {
      clearInterval(heartbeat);
      for (const res of clients) res.end();
      clients.clear();
    },
  };
}
export type Hub = ReturnType<typeof createHub>;

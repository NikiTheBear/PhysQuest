// Integrated launcher. Original implementation is kept in server.upstream.mjs.
process.env.PORT ||= '8787';
await import('../../../scripts/run-platform.mjs');

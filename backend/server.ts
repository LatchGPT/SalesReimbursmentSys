import 'dotenv/config';
import { createApp } from './src/server/app';
import { config } from './src/server/config';

export { createApp };

// Local dev / standalone prod: listen on a port. Skipped on Vercel, where the
// serverless entry (api/index.ts) imports createApp() and drives it instead.
if (!process.env.VERCEL) {
  createApp().then((app) => {
    const PORT = config.port;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
}

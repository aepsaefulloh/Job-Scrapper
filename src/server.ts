import 'dotenv/config';

import { createApp } from './app.js';
import { loadEnv } from './config/env.js';

const env = loadEnv(process.env);
const app = createApp({});

app.listen(env.port, () => {
  console.info(`Candidate profile API listening on port ${env.port}.`);
});

// Titik masuk: sajikan game PALMSHADE HEAT dari folder game/.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), 'game');
const port = Number(process.env.PORT || 8080);
serve(root, port);

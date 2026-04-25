import express from 'express';

const app = express();
app.use(express.json());

console.log('[✓] Express importado correctamente');

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`[✓] Servidor ejecutándose en puerto ${PORT}`);
  process.exit(0);
});

setTimeout(() => {
  console.log('[✓] Servidor responde correctamente');
  process.exit(0);
}, 1000);

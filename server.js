const express = require('express');
const path = require('node:path');

const app = express();

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

if (require.main === module) {
  const port = process.env.PORT || 8080;
  app.listen(port, () => {
    console.log(`Xotorko listening on port ${port}`);
  });
}

module.exports = app;

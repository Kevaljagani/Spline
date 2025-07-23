const express = require('express');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.get('/hello', (req, res) => {
  res.json({ message: 'Hello from Torpedo!' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
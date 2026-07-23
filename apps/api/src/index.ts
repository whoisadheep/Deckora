import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import presentationRoutes from './routes/presentation.routes';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/api/presentations', presentationRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API is running' });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(cors());                // allow all origins (for dev). Configure restrictively for prod.
app.use(express.json());        // parse JSON bodies

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'recipes.json');

// Ensure data dir & file exist
async function ensureDataFile() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    // If file missing, create with empty array
    try {
      await fs.access(DATA_FILE);
    } catch {
      await fs.writeFile(DATA_FILE, '[]', 'utf8');
    }
  } catch (err) {
    console.error('Error ensuring data file:', err);
    throw err;
  }
}

// Read recipes
async function readRecipes() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    // If file corrupted, throw
    const e = new Error('Recipes file is corrupted');
    e.code = 'CORRUPTED';
    throw e;
  }
}

// Write recipes
async function writeRecipes(list) {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(list, null, 2), 'utf8');
}

/* ------------------ ROUTES ------------------ */

// GET /api/recipes  -> return all
app.get('/api/recipes', async (req, res) => {
  try {
    const recipes = await readRecipes();
    res.json(recipes);
  } catch (err) {
    if (err.code === 'CORRUPTED') {
      res.status(500).json({ error: 'Recipes data is corrupted on the server.' });
    } else {
      res.status(500).json({ error: 'Failed to read recipes.' });
    }
  }
});

// POST /api/recipes -> add a new recipe
app.post('/api/recipes', async (req, res) => {
  try {
    const { title, ingredients, instructions, cookTime, difficulty } = req.body;

    // Basic validation
    if (!title || !title.toString().trim()) {
      return res.status(400).json({ error: 'Title is required and cannot be blank.' });
    }
    if (!ingredients || (Array.isArray(ingredients) && ingredients.length === 0) || (!Array.isArray(ingredients) && !ingredients.toString().trim())) {
      return res.status(400).json({ error: 'Ingredients are required and cannot be blank.' });
    }
    if (!instructions || !instructions.toString().trim()) {
      return res.status(400).json({ error: 'Instructions are required and cannot be blank.' });
    }

    const recipes = await readRecipes();

    const id = Date.now().toString() + Math.floor(Math.random() * 1000).toString(); // unique-ish
    const newRecipe = {
      id,
      title: title.toString().trim(),
      ingredients,
      instructions: instructions.toString().trim(),
      cookTime: cookTime || null,
      difficulty: difficulty || 'medium',
      createdAt: new Date().toISOString()
    };

    recipes.push(newRecipe);
    await writeRecipes(recipes);

    // Return created recipe
    res.status(201).json(newRecipe);
  } catch (err) {
    console.error('POST /api/recipes error:', err);
    if (err.code === 'CORRUPTED') {
      res.status(500).json({ error: 'Recipes data is corrupted on the server.' });
    } else {
      res.status(500).json({ error: 'Failed to save recipe.' });
    }
  }
});

/* Optional: static frontend serve (if you put an index.html in /public) */
app.use(express.static(path.join(__dirname, 'public')));

/* Start server */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Recipe API running on port ${PORT}`);
});

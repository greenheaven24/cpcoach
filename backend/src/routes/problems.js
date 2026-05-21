const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/auth');
const { getProblems } = require('../services/gemini');

const router = express.Router();
const prisma = new PrismaClient();

// Generate a new problem set via Gemini
router.post('/generate', authMiddleware, async (req, res) => {
  const { topic, count = 25 } = req.body;
  if (!topic || topic.trim().length < 3)
    return res.status(400).json({ error: 'Please provide a meaningful topic' });

  try {
    const problems = await getProblems(topic.trim(), Math.min(Number(count), 30));

    console.log('\n[Generated links preview]');
    problems.slice(0, 5).forEach(p => console.log(`  ${p.platform.padEnd(12)} ${p.link}`));
    console.log(`  ... (${problems.length} total)\n`);

    const problemSet = await prisma.problemSet.create({
      data: {
        userId: req.userId,
        topic: topic.trim(),
        problems: {
          create: problems.map(p => ({
            title: p.title,
            platform: p.platform,
            difficulty: p.difficulty,
            link: p.link,
            tags: JSON.stringify(p.tags),
            description: p.description,
          })),
        },
      },
      include: { problems: { orderBy: { createdAt: 'asc' } } },
    });

    res.status(201).json(problemSet);
  } catch (err) {
    console.error('[Generate] Full error:', JSON.stringify(err, null, 2));
    console.error('[Generate] Message:', err.message);
    const msg = err.message?.includes('API_KEY') || err.message?.includes('API key')
      ? 'Invalid Gemini API key — check your .env'
      : err.message?.includes('quota') || err.message?.includes('RESOURCE_EXHAUSTED')
      ? 'Gemini API quota exceeded — try again in a minute'
      : err.message || 'Failed to generate problems. Please try again.';
    res.status(500).json({ error: msg });
  }
});

// List all problem sets for the logged-in user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const sets = await prisma.problemSet.findMany({
      where: { userId: req.userId },
      include: {
        problems: { select: { id: true, solved: true, platform: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(sets);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get a single problem set with all problems
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const set = await prisma.problemSet.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: { problems: { orderBy: { createdAt: 'asc' } } },
    });
    if (!set) return res.status(404).json({ error: 'Problem set not found' });
    res.json(set);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Toggle solved status on a problem
router.patch('/:setId/problems/:problemId', authMiddleware, async (req, res) => {
  try {
    const set = await prisma.problemSet.findFirst({
      where: { id: req.params.setId, userId: req.userId },
    });
    if (!set) return res.status(404).json({ error: 'Not found' });

    const problem = await prisma.problem.update({
      where: { id: req.params.problemId },
      data: { solved: Boolean(req.body.solved) },
    });
    res.json(problem);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a problem set
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await prisma.problemSet.deleteMany({
      where: { id: req.params.id, userId: req.userId },
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

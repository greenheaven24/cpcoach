const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const [totalSets, totalProblems, solvedProblems] = await Promise.all([
      prisma.problemSet.count({ where: { userId: req.userId } }),
      prisma.problem.count({ where: { problemSet: { userId: req.userId } } }),
      prisma.problem.count({ where: { problemSet: { userId: req.userId }, solved: true } }),
    ]);
    res.json({ totalSets, totalProblems, solvedProblems });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

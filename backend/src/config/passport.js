const passport = require('passport');
const { Strategy: GitHubStrategy } = require('passport-github2');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

const githubClientId = process.env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;

if (githubClientId && !githubClientId.startsWith('your-')) {
  passport.use(new GitHubStrategy({
    clientID: githubClientId,
    clientSecret: githubClientSecret,
    callbackURL: '/api/auth/github/callback',
    scope: ['user:email'],
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value || `github_${profile.id}@cpcoach.app`;
      const avatar = profile.photos?.[0]?.value;

      const user = await prisma.user.upsert({
        where: { githubId: String(profile.id) },
        update: { avatar },
        create: {
          name: profile.displayName || profile.username,
          email,
          githubId: String(profile.id),
          avatar,
        },
      });

      done(null, user);
    } catch (err) {
      done(err, null);
    }
  }));
  console.log('[Auth] GitHub OAuth enabled');
} else {
  console.log('[Auth] GitHub OAuth disabled (no credentials in .env)');
}

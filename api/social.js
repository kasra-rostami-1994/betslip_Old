// Social API — follow/unfollow, followers/following, user search
const { DB, token, user } = require('./_lib');

module.exports = async (q, s) => {
  const me = await user(q);
  if (!me) return s.status(401).json({ error: 'unauthorized' });

  try {
    if (q.method === 'POST') {
      const body = typeof q.body === 'string' ? JSON.parse(q.body) : (q.body || {});
      const action = body.action;
      const targetUsername = String(body.username || '').trim().toLowerCase();

      if (!targetUsername) return s.status(400).json({ error: 'نام کاربری الزامی است' });

      const target = await DB.findUserByUsername(targetUsername);
      if (!target) return s.status(404).json({ error: 'کاربر یافت نشد' });
      if (target._id.toString() === me) return s.status(400).json({ error: 'نمی‌توانید خودتان را دنبال کنید' });

      if (action === 'follow') {
        const result = await DB.followUser(me, target._id.toString());
        return s.json({ ok: true, ...result });
      } else if (action === 'unfollow') {
        const result = await DB.unfollowUser(me, target._id.toString());
        return s.json({ ok: true, ...result });
      } else {
        return s.status(400).json({ error: 'عملیات نامعتبر' });
      }
    }

    if (q.method === 'GET') {
      const Q = q.query || {};
      const targetUsername = Q.u ? String(Q.u).trim().toLowerCase() : null;
      const targetId = Q.userId || (targetUsername ? (await DB.findUserByUsername(targetUsername))?._id.toString() : me);

      if (!targetId) return s.status(404).json({ error: 'کاربر یافت نشد' });

      if (Q.followers) {
        const followers = await DB.getFollowers(targetId, +Q.limit || 50);
        return s.json({ followers: followers.map(f => ({ userId: f.followerId._id.toString(), username: f.followerId.username, name: f.followerId.name, avatar: f.followerId.avatar, isPublic: f.followerId.isPublic })) });
      }

      if (Q.following) {
        const following = await DB.getFollowing(targetId, +Q.limit || 50);
        return s.json({ following: following.map(f => ({ userId: f.followingId._id.toString(), username: f.followingId.username, name: f.followingId.name, avatar: f.followingId.avatar, isPublic: f.followingId.isPublic })) });
      }

      if (Q.isFollowing) {
        const isFol = await DB.isFollowing(me, targetId);
        return s.json({ isFollowing: isFol });
      }

      if (Q.search) {
        const term = String(Q.search).trim().toLowerCase();
        if (term.length < 2) return s.json({ users: [] });
        const users = await DB.User.find({
          $or: [
            { username: { $regex: term, $options: 'i' } },
            { name: { $regex: term, $options: 'i' } },
          ],
          isPublic: true,
        }).select('username name avatar isPublic').limit(20).lean();
        return s.json({ users });
      }

      // Default: return follow status for target user
      const isFol = await DB.isFollowing(me, targetId);
      return s.json({ isFollowing: isFol });
    }

    s.status(405).end();
  } catch (e) {
    console.error('Social API error:', e);
    s.status(500).json({ error: String(e.message || e) });
  }
};
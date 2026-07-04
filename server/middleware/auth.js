const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { mockStore, isDBConnected } = require('../utils/mockStore');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey_intellmeet_2026_secure');

      if (isDBConnected()) {
        req.user = await User.findById(decoded.id).select('-password');
      } else {
        const mockUser = mockStore.users.find(u => u._id === decoded.id);
        if (mockUser) {
          const { password, ...userWithoutPassword } = mockUser;
          req.user = userWithoutPassword;
        }
      }

      if (!req.user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }

      next();
    } catch (error) {
      console.error('Token authentication error:', error);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token provided' });
  }
};

module.exports = { protect };

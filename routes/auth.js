const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');
const { validationResult } = require('express-validator');
const { User } = require('../models');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// Register new user
const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, password, firstName, lastName, companyName } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      companyName,
      plan: 'free',
      leadsLimit: 50
    });

    // Generate token
    const token = generateToken(user.id);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          companyName: user.companyName,
          plan: user.plan,
          leadsLimit: user.leadsLimit,
          leadsUsedThisMonth: user.leadsUsedThisMonth
        },
        token
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account deactivated'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user.id);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          companyName: user.companyName,
          plan: user.plan,
          planStatus: user.planStatus,
          leadsLimit: user.leadsLimit,
          leadsUsedThisMonth: user.leadsUsedThisMonth,
          sourcesConfig: user.sourcesConfig,
          keywords: user.keywords
        },
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get current user
const getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update profile
const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, companyName, keywords, sourcesConfig } = req.body;

    const user = await User.findByPk(req.user.id);
    
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (companyName !== undefined) user.companyName = companyName;
    if (keywords !== undefined) user.keywords = keywords;
    if (sourcesConfig !== undefined) user.sourcesConfig = sourcesConfig;

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          companyName: user.companyName,
          keywords: user.keywords,
          sourcesConfig: user.sourcesConfig
        }
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Forgot password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ where: { email } });
    if (!user) {
      // Don't reveal if email exists
      return res.json({
        success: true,
        message: 'If an account exists, a password reset link has been sent'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    // TODO: Send email with reset link
    console.log(`Password reset token for ${email}: ${resetToken}`);

    res.json({
      success: true,
      message: 'If an account exists, a password reset link has been sent'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Reset password
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpires: { [require('sequelize').Op.gt]: new Date() }
      }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(password, salt);
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successful'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update password
const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findByPk(req.user.id);
    
    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Google OAuth - Get auth URL
const getGoogleAuthUrl = async (req, res) => {
  try {
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.FRONTEND_URL}/auth/google/callback`;
    
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent'
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    res.json({
      success: true,
      data: { authUrl }
    });
  } catch (error) {
    console.error('Google auth URL error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate Google auth URL'
    });
  }
};

// Google OAuth - Handle callback
const googleCallback = async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Authorization code required'
      });
    }

    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.FRONTEND_URL}/auth/google/callback`;

    // Exchange code for tokens
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    });

    const { access_token } = tokenResponse.data;

    // Get user info from Google
    const userResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const { id: googleId, email, name, picture } = userResponse.data;

    // Check if user exists
    let user = await User.findOne({ where: { googleId } });
    let isNewUser = false;

    if (!user) {
      // Check if email already exists
      user = await User.findOne({ where: { email } });
      
      if (user) {
        // Link Google account to existing user
        user.googleId = googleId;
        user.avatarUrl = picture;
        user.authProvider = 'google';
        await user.save();
      } else {
        // Create new user
        const nameParts = name ? name.split(' ') : ['', ''];
        isNewUser = true;
        
        user = await User.create({
          email,
          googleId,
          firstName: nameParts[0],
          lastName: nameParts.slice(1).join(' '),
          avatarUrl: picture,
          authProvider: 'google',
          plan: 'free',
          leadsLimit: 50,
          onboardingCompleted: false,
          onboardingStep: 0
        });
      }
    }

    // Generate token
    const token = generateToken(user.id);

    res.json({
      success: true,
      message: isNewUser ? 'Account created successfully' : 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          companyName: user.companyName,
          avatarUrl: user.avatarUrl,
          plan: user.plan,
          planStatus: user.planStatus,
          leadsLimit: user.leadsLimit,
          leadsUsedThisMonth: user.leadsUsedThisMonth,
          onboardingCompleted: user.onboardingCompleted,
          onboardingStep: user.onboardingStep,
          isNewUser
        },
        token
      }
    });
  } catch (error) {
    console.error('Google callback error:', error);
    res.status(500).json({
      success: false,
      message: 'Google authentication failed'
    });
  }
};

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  forgotPassword,
  resetPassword,
  updatePassword,
  getGoogleAuthUrl,
  googleCallback
};

import { asyncHandler } from '../../../middleware/errorHandler.js';
import { ValidationError } from '../../../errors/AppError.js';

export class AuthController {
  constructor(authService) {
    this.service = authService;
  }

  registerInternal = asyncHandler(async (req, res) => {
    const { email, password, fullName, role } = req.body;
    if (!email || !password || !fullName) {
      throw new ValidationError('Email, password, and fullName are required');
    }
    const result = await this.service.registerInternal({ email, password, fullName, role });
    res.status(201).json({ data: result });
  });

  registerCustomer = asyncHandler(async (req, res) => {
    const { email, fullName, companyName } = req.body;
    if (!email || !fullName || !companyName) {
      throw new ValidationError('Email, fullName, and companyName are required');
    }
    const result = await this.service.registerCustomer({ email, fullName, companyName });
    res.status(201).json({ data: result });
  });

  loginInternal = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }
    const reqMeta = { ip: req.ip, userAgent: req.headers['user-agent'] };
    const result = await this.service.loginInternal(email, password, reqMeta);
    res.json({ data: result });
  });

  requestMagicLink = asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email) {
      throw new ValidationError('Email is required');
    }
    const reqMeta = { ip: req.ip, userAgent: req.headers['user-agent'] };
    const result = await this.service.requestMagicLink(email, reqMeta);
    res.json({ data: result });
  });

  verifyMagicLink = asyncHandler(async (req, res) => {
    const { token } = req.body;
    if (!token) {
      throw new ValidationError('Token is required');
    }
    const reqMeta = { ip: req.ip, userAgent: req.headers['user-agent'] };
    const result = await this.service.verifyMagicLink(token, reqMeta);
    res.json({ data: result });
  });

  refresh = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      throw new ValidationError('Refresh token is required');
    }
    const reqMeta = { ip: req.ip, userAgent: req.headers['user-agent'] };
    const result = await this.service.refresh(refreshToken, reqMeta);
    res.json({ data: result });
  });

  logout = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    await this.service.logout(refreshToken);
    res.json({ success: true });
  });

  logoutAll = asyncHandler(async (req, res) => {
    await this.service.logoutAll(req.user.id);
    res.json({ success: true });
  });

  profile = asyncHandler(async (req, res) => {
    const user = await this.service.getProfile(req.user.id);
    res.json({ data: user });
  });

  updateProfile = asyncHandler(async (req, res) => {
    const user = await this.service.updateProfile(req.user.id, req.body);
    res.json({ data: user });
  });

  changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      throw new ValidationError('Current password and new password are required');
    }
    await this.service.changePassword(req.user.id, currentPassword, newPassword);
    res.json({ success: true });
  });

  setPassword = asyncHandler(async (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword) {
      throw new ValidationError('New password is required');
    }
    await this.service.setPassword(req.user.id, newPassword);
    res.json({ success: true });
  });
}

export default AuthController;
import { asyncHandler } from '../../middleware/errorHandler.js';

export class AuthController {
  constructor(authService) {
    this.service = authService;
  }

  register = asyncHandler(async (req, res) => {
    const result = await this.service.register(req.body);
    res.status(201).json({ data: result });
  });

  login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const result = await this.service.login(email, password);
    res.json({ data: result });
  });

  refresh = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    const result = await this.service.refresh(refreshToken);
    res.json({ data: result });
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
    await this.service.changePassword(req.user.id, currentPassword, newPassword);
    res.json({ success: true });
  });
}

export default AuthController;
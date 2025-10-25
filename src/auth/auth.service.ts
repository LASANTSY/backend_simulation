// Authentication has been removed from the project. This file provides a
// harmless shim to avoid runtime import errors in modules that still
// reference auth.service. Any attempt to use authentication functions will
// return null or throw an informative error.

export class AuthService {
  async register(): Promise<never> {
    throw new Error('Authentication is disabled in this project');
  }

  async validateUser(): Promise<null> {
    return null;
  }

  async login(): Promise<never> {
    throw new Error('Authentication is disabled in this project');
  }
}

export default new AuthService();

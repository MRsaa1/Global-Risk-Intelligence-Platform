/**
 * Authentication service with OIDC/SAML support
 */

import prisma from '../db/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export interface User {
  user_id: string;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
}

export interface AuthResult {
  user: User;
  token: string;
  refreshToken?: string;
}

class AuthService {
  private jwtSecret: string;
  private jwtExpiry: string;
  private refreshSecret: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'change-me-in-production';
    this.jwtExpiry = process.env.JWT_EXPIRY || '1h';
    this.refreshSecret = process.env.JWT_REFRESH_SECRET || this.jwtSecret;
  }

  /**
   * Authenticate user with username/password
   */
  async authenticate(username: string, password: string): Promise<AuthResult | null> {
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user || !user.isActive) {
      return null;
    }

    if (!user.hashedPassword) {
      // OIDC/SAML user - redirect to external auth
      return null;
    }

    const isValid = await bcrypt.compare(password, user.hashedPassword);
    if (!isValid) {
      return null;
    }

    const token = this.generateToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return {
      user: {
        user_id: user.userId,
        username: user.username,
        email: user.email,
        role: user.role,
        is_active: user.isActive,
      },
      token,
      refreshToken,
    };
  }

  /**
   * Authenticate with OIDC
   */
  async authenticateOIDC(code: string, redirectUri: string): Promise<AuthResult | null> {
    // Placeholder - would integrate with OIDC provider
    // In production: exchange code for tokens, get user info
    
    // Mock implementation
    return null;
  }

  /**
   * Authenticate with SAML
   */
  async authenticateSAML(samlResponse: string): Promise<AuthResult | null> {
    // Placeholder - would parse SAML response
    // In production: validate SAML assertion, extract user attributes
    
    // Mock implementation
    return null;
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): User | null {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      return {
        user_id: decoded.user_id,
        username: decoded.username,
        email: decoded.email,
        role: decoded.role,
        is_active: decoded.is_active,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<string | null> {
    try {
      const decoded = jwt.verify(refreshToken, this.refreshSecret) as any;
      const user = await prisma.user.findUnique({
        where: { userId: decoded.user_id },
      });

      if (!user || !user.isActive) {
        return null;
      }

      return this.generateToken(user);
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate JWT token
   */
  private generateToken(user: any): string {
    return jwt.sign(
      {
        user_id: user.userId,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      this.jwtSecret,
      { expiresIn: this.jwtExpiry }
    );
  }

  /**
   * Generate refresh token
   */
  private generateRefreshToken(user: any): string {
    return jwt.sign(
      {
        user_id: user.userId,
        type: 'refresh',
      },
      this.refreshSecret,
      { expiresIn: '7d' }
    );
  }

  /**
   * Create user
   */
  async createUser(userData: {
    username: string;
    email: string;
    password?: string;
    role?: string;
  }): Promise<User> {
    const hashedPassword = userData.password
      ? await bcrypt.hash(userData.password, 10)
      : null;

    const user = await prisma.user.create({
      data: {
        username: userData.username,
        email: userData.email,
        hashedPassword,
        role: userData.role || 'user',
      },
    });

    return {
      user_id: user.userId,
      username: user.username,
      email: user.email,
      role: user.role,
      is_active: user.isActive,
    };
  }

  /**
   * Check user permissions (RBAC)
   */
  async checkPermission(userId: string, permission: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { userId },
    });

    if (!user || !user.isActive) {
      return false;
    }

    // Role-based permissions
    const rolePermissions: Record<string, string[]> = {
      admin: ['*'], // All permissions
      risk_manager: ['scenarios:read', 'scenarios:write', 'calculations:read', 'calculations:write'],
      analyst: ['scenarios:read', 'calculations:read'],
      viewer: ['scenarios:read', 'calculations:read', 'portfolios:read'],
    };

    const permissions = rolePermissions[user.role] || [];
    return permissions.includes('*') || permissions.includes(permission);
  }
}

export const authService = new AuthService();


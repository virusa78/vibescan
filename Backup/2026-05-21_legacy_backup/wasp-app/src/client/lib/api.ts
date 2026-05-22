/**
 * API Client for VibeScan Backend
 * Handles authentication and scan management
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface LoginResponse {
  token: string;
  refreshToken?: string;
  user: {
    id: string;
    email: string;
    name: string;
    plan: 'free_trial' | 'starter' | 'pro' | 'enterprise';
    region: 'US' | 'EU' | 'IN' | 'PK' | 'OTHER';
    quota: number;
  };
}

interface RegisterResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    plan: 'free_trial' | 'starter' | 'pro' | 'enterprise';
    region: 'US' | 'EU' | 'IN' | 'PK' | 'OTHER';
    quota: number;
  };
}

interface Scan {
  id: string;
  type: string;
  status: 'pending' | 'scanning' | 'done' | 'failed';
  createdAt: string;
  duration: string;
  components: number;
  dependencies: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

interface ScanResult {
  scan: Scan;
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

// Auth API
export const authApi = {
  /**
   * Register a new user
   */
  register: async (data: {
    email: string;
    password: string;
    name: string;
    plan: 'free_trial' | 'starter' | 'pro' | 'enterprise';
    region: 'US' | 'EU' | 'IN' | 'PK' | 'OTHER';
  }): Promise<RegisterResponse> => {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || error.error || `Registration failed: ${response.status}`);
    }

    const result = await response.json();
    // Map backend response to expected format
    // Backend returns: { success: true, data: { id, email, plan, region, created_at } }
    return {
      token: '', // Register doesn't return token, only user data
      user: {
        id: result.data?.id || result.user?.id || result.id,
        email: result.data?.email || result.user?.email || result.email || data.email,
        name: result.data?.name || result.user?.name || result.name || data.name,
        plan: result.data?.plan || result.user?.plan || data.plan,
        region: result.data?.region || result.user?.region || data.region,
        quota: 10, // Default quota for free_trial
      },
    };
  },

  /**
   * Login with email and password
   */
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || error.error || `Login failed: ${response.status}`);
    }

    const result = await response.json();
    const token = result.data?.accessToken || result.token;

    // Fetch user details after successful login
    let userData: any = {};
    try {
      const userResponse = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (userResponse.ok) {
        const userResult = await userResponse.json();
        userData = userResult.data || {};
      }
    } catch (e) {
      console.error('Failed to fetch user details:', e);
    }

    return {
      token,
      refreshToken: result.data?.refreshToken || result.refreshToken,
      user: {
        id: userData.id || result.data?.id || result.user?.id || '',
        email: userData.email || result.data?.email || result.user?.email || email,
        name: userData.name || result.data?.name || result.user?.name || '',
        plan: userData.plan || result.data?.plan || result.user?.plan || 'free_trial',
        region: userData.region || result.data?.region || result.user?.region || 'OTHER',
        quota: userData.quota || 10,
      },
    };
  },

  /**
   * Logout current user
   */
  logout: async (token: string): Promise<void> => {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  /**
   * Refresh access token using refresh token
   */
  refresh: async (refreshToken: string): Promise<LoginResponse> => {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const result = await response.json();
    return {
      token: result.data?.accessToken || result.token,
      refreshToken: result.data?.refreshToken || result.refreshToken,
      user: {
        id: result.data?.id || result.user?.id || '',
        email: result.data?.email || result.user?.email || '',
        name: result.data?.name || result.user?.name || '',
        plan: result.data?.plan || result.user?.plan || 'free_trial',
        region: result.data?.region || result.user?.region || 'OTHER',
        quota: 10,
      },
    };
  },
};

// Scans API
export const scansApi = {
  /**
   * List all scans for the current user
   */
  list: async (token: string, page = 1, limit = 20): Promise<{ scans: Scan[]; total: number; page: number; limit: number }> => {
    const response = await fetch(`${API_BASE_URL}/scans?page=${page}&limit=${limit}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch scans: ${response.status}`);
    }

    return response.json();
  },

  /**
   * Get scan by ID
   */
  get: async (token: string, scanId: string): Promise<ScanResult> => {
    const response = await fetch(`${API_BASE_URL}/scans/${scanId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch scan: ${response.status}`);
    }

    return response.json();
  },

  /**
   * Submit a new scan
   */
  submit: async (
    token: string,
    type: 'source_zip' | 'sbom_upload' | 'github_app' | 'ci_plugin',
    source?: { url?: string; file?: File } | { sbom?: File } | { repo?: string; branch?: string } | { commit?: string; branch?: string }
  ): Promise<Scan> => {
    const formData = new FormData();

    formData.append('type', type);

    if (type === 'source_zip' && source && 'url' in source) {
      if (source.url) formData.append('source_url', source.url);
    } else if (type === 'sbom_upload' && source && 'sbom' in source && source.sbom) {
      formData.append('sbom_file', source.sbom);
    } else if (type === 'github_app' && source && 'repo' in source) {
      if (source.repo) formData.append('repo', source.repo);
      if (source.branch) formData.append('branch', source.branch);
    } else if (type === 'ci_plugin' && source && 'commit' in source) {
      if (source.commit) formData.append('commit', source.commit);
      if (source.branch) formData.append('branch', source.branch);
    }

    const response = await fetch(`${API_BASE_URL}/scans`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Failed to submit scan: ${response.status}`);
    }

    return response.json();
  },

  /**
   * Cancel a running scan
   */
  cancel: async (token: string, scanId: string): Promise<{ success: boolean }> => {
    const response = await fetch(`${API_BASE_URL}/scans/${scanId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to cancel scan: ${response.status}`);
    }

    return response.json();
  },
};

// Reports API
export const reportsApi = {
  /**
   * Get full report for a scan
   */
  get: async (token: string, scanId: string): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/reports/${scanId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch report: ${response.status}`);
    }

    return response.json();
  },

  /**
   * Get CI decision for a scan
   */
  getCiDecision: async (token: string, scanId: string): Promise<{ allowed: boolean; message: string }> => {
    const response = await fetch(`${API_BASE_URL}/reports/${scanId}/ci`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch CI decision: ${response.status}`);
    }

    return response.json();
  },
};

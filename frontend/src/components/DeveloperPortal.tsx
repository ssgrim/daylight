import React, { useState, useEffect } from 'react';
import { 
  ApiKey, 
  ApiKeyRequest, 
  ApiUsage, 
  ApiAnalytics,
  DeveloperPortalUser 
} from '../../../shared/src/types/api';

// Developer Portal Components
// Issue #114 - API Management & Rate Limiting

interface ApiKeyListProps {
  onSelectKey?: (apiKey: ApiKey) => void;
}

export const ApiKeyList: React.FC<ApiKeyListProps> = ({ onSelectKey }) => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/keys', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch API keys');
      }

      const data = await response.json();
      setApiKeys(data.apiKeys);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (apiKey: ApiKey) => {
    try {
      const newStatus = apiKey.status === 'active' ? 'disabled' : 'active';
      
      const response = await fetch(`/api/keys/${apiKey.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        throw new Error('Failed to update API key');
      }

      await fetchApiKeys(); // Refresh the list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleDelete = async (apiKey: ApiKey) => {
    if (!confirm(`Are you sure you want to delete "${apiKey.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/keys/${apiKey.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete API key');
      }

      await fetchApiKeys(); // Refresh the list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="text-red-800">Error: {error}</div>
        <button 
          onClick={fetchApiKeys}
          className="mt-2 text-red-600 hover:text-red-800 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">API Keys</h2>
        <CreateApiKeyButton onSuccess={fetchApiKeys} />
      </div>

      {apiKeys.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No API keys found.</p>
          <p className="text-sm mt-1">Create your first API key to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {apiKeys.map((apiKey) => (
            <div
              key={apiKey.id}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onSelectKey?.(apiKey)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900">{apiKey.name}</h3>
                  {apiKey.description && (
                    <p className="text-gray-600 mt-1">{apiKey.description}</p>
                  )}
                  
                  <div className="mt-3 flex items-center space-x-4 text-sm text-gray-500">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      apiKey.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {apiKey.status}
                    </span>
                    <span>Created: {new Date(apiKey.createdAt).toLocaleDateString()}</span>
                    <span>Last used: {apiKey.lastUsedAt 
                      ? new Date(apiKey.lastUsedAt).toLocaleDateString() 
                      : 'Never'
                    }</span>
                  </div>

                  <div className="mt-2">
                    <div className="text-sm text-gray-600">Scopes:</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {apiKey.scopes.map((scope) => (
                        <span
                          key={scope}
                          className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                        >
                          {scope}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex space-x-2 ml-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleStatus(apiKey);
                    }}
                    className={`px-3 py-1 text-sm rounded ${
                      apiKey.status === 'active'
                        ? 'bg-red-100 text-red-800 hover:bg-red-200'
                        : 'bg-green-100 text-green-800 hover:bg-green-200'
                    }`}
                  >
                    {apiKey.status === 'active' ? 'Disable' : 'Enable'}
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(apiKey);
                    }}
                    className="px-3 py-1 text-sm bg-gray-100 text-gray-800 hover:bg-gray-200 rounded"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface CreateApiKeyButtonProps {
  onSuccess?: () => void;
}

export const CreateApiKeyButton: React.FC<CreateApiKeyButtonProps> = ({ onSuccess }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);

  const [formData, setFormData] = useState<ApiKeyRequest>({
    name: '',
    description: '',
    scopes: [],
    allowedIps: [],
    rateLimits: [],
    expiresAt: ''
  });

  const availableScopes = [
    'api:read',
    'api:write', 
    'api:keys:read',
    'api:keys:write',
    'api:analytics:read',
    'api:rate_limits:read',
    'api:rate_limits:write'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          expiresAt: formData.expiresAt || undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to create API key');
      }

      const data = await response.json();
      setNewApiKey(data.keyValue);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setFormData({
      name: '',
      description: '',
      scopes: [],
      allowedIps: [],
      rateLimits: [],
      expiresAt: ''
    });
    setError(null);
    setNewApiKey(null);
  };

  const toggleScope = (scope: string) => {
    setFormData(prev => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter(s => s !== scope)
        : [...prev.scopes, scope]
    }));
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
      >
        Create API Key
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Create API Key</h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {newApiKey ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <h4 className="font-medium text-green-800 mb-2">API Key Created Successfully!</h4>
              <div className="bg-white border border-green-300 rounded p-3">
                <p className="text-sm text-gray-600 mb-2">Your API key (save this securely):</p>
                <code className="block bg-gray-100 p-2 rounded text-sm break-all">
                  {newApiKey}
                </code>
              </div>
              <p className="text-sm text-green-700 mt-2">
                ⚠️ This is the only time you'll see this key. Save it securely!
              </p>
            </div>
            <button
              onClick={handleClose}
              className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="My API Key"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="What this key will be used for..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Scopes *
              </label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {availableScopes.map((scope) => (
                  <label key={scope} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.scopes.includes(scope)}
                      onChange={() => toggleScope(scope)}
                      className="mr-2"
                    />
                    <span className="text-sm">{scope}</span>
                  </label>
                ))}
              </div>
              {formData.scopes.length === 0 && (
                <p className="text-red-500 text-sm mt-1">Please select at least one scope</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expires At (optional)
              </label>
              <input
                type="datetime-local"
                value={formData.expiresAt}
                onChange={(e) => setFormData(prev => ({ ...prev, expiresAt: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-md hover:bg-gray-400 transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || formData.scopes.length === 0}
                className="flex-1 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Key'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

interface ApiKeyDetailsProps {
  apiKey: ApiKey;
  onBack: () => void;
}

export const ApiKeyDetails: React.FC<ApiKeyDetailsProps> = ({ apiKey, onBack }) => {
  const [usage, setUsage] = useState<ApiUsage[]>([]);
  const [analytics, setAnalytics] = useState<ApiAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    fetchUsageData();
  }, [apiKey.id, timeRange]);

  const fetchUsageData = async () => {
    try {
      setLoading(true);
      
      const endDate = new Date().toISOString();
      const startDate = new Date();
      
      switch (timeRange) {
        case '1d':
          startDate.setDate(startDate.getDate() - 1);
          break;
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        default:
          startDate.setDate(startDate.getDate() - 7);
      }

      const response = await fetch(
        `/api/keys/${apiKey.id}/usage?startDate=${startDate.toISOString()}&endDate=${endDate}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setUsage(data.usage.requests || []);
        setAnalytics(data.usage.analytics);
      }
    } catch (error) {
      console.error('Failed to fetch usage data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!confirm('Are you sure you want to regenerate this API key? The old key will stop working immediately.')) {
      return;
    }

    try {
      const response = await fetch(`/api/keys/${apiKey.id}/regenerate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        alert(`New API key: ${data.keyValue}\n\nSave this securely - you won't see it again!`);
      } else {
        throw new Error('Failed to regenerate API key');
      }
    } catch (error) {
      alert('Failed to regenerate API key');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <button
          onClick={onBack}
          className="text-blue-600 hover:text-blue-800"
        >
          ← Back to API Keys
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">{apiKey.name}</h2>
            {apiKey.description && (
              <p className="text-gray-600 mt-1">{apiKey.description}</p>
            )}
          </div>
          
          <button
            onClick={handleRegenerate}
            className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-md hover:bg-yellow-200 transition-colors"
          >
            Regenerate Key
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-50 p-4 rounded">
            <div className="text-sm text-gray-600">Status</div>
            <div className={`font-medium ${
              apiKey.status === 'active' ? 'text-green-600' : 'text-red-600'
            }`}>
              {apiKey.status}
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded">
            <div className="text-sm text-gray-600">Created</div>
            <div className="font-medium">{new Date(apiKey.createdAt).toLocaleDateString()}</div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded">
            <div className="text-sm text-gray-600">Last Used</div>
            <div className="font-medium">
              {apiKey.lastUsedAt 
                ? new Date(apiKey.lastUsedAt).toLocaleDateString() 
                : 'Never'
              }
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Scopes</h3>
            <div className="flex flex-wrap gap-2">
              {apiKey.scopes.map((scope) => (
                <span
                  key={scope}
                  className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                >
                  {scope}
                </span>
              ))}
            </div>
          </div>

          {apiKey.allowedIps && apiKey.allowedIps.length > 0 && (
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Allowed IP Addresses</h3>
              <div className="text-sm text-gray-600">
                {apiKey.allowedIps.join(', ')}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Usage Analytics</h3>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1 text-sm"
          >
            <option value="1d">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : analytics ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded">
              <div className="text-sm text-blue-600">Total Requests</div>
              <div className="text-2xl font-bold text-blue-900">{analytics.totalRequests}</div>
            </div>
            
            <div className="bg-green-50 p-4 rounded">
              <div className="text-sm text-green-600">Success Rate</div>
              <div className="text-2xl font-bold text-green-900">
                {(analytics.successRate * 100).toFixed(1)}%
              </div>
            </div>
            
            <div className="bg-yellow-50 p-4 rounded">
              <div className="text-sm text-yellow-600">Avg Response Time</div>
              <div className="text-2xl font-bold text-yellow-900">
                {analytics.averageResponseTime}ms
              </div>
            </div>
            
            <div className="bg-red-50 p-4 rounded">
              <div className="text-sm text-red-600">Rate Limited</div>
              <div className="text-2xl font-bold text-red-900">{analytics.rateLimitedRequests}</div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No usage data available for this time period.
          </div>
        )}
      </div>
    </div>
  );
};

export const DeveloperPortal: React.FC = () => {
  const [selectedApiKey, setSelectedApiKey] = useState<ApiKey | null>(null);
  const [user, setUser] = useState<DeveloperPortalUser | null>(null);

  useEffect(() => {
    // Load user info
    const userData = localStorage.getItem('userData');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  if (selectedApiKey) {
    return (
      <ApiKeyDetails
        apiKey={selectedApiKey}
        onBack={() => setSelectedApiKey(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold text-gray-900">Developer Portal</h1>
            {user && (
              <div className="text-sm text-gray-600">
                Welcome, {user.name || user.email}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ApiKeyList onSelectKey={setSelectedApiKey} />
      </main>
    </div>
  );
};

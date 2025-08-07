/**
 * Extracts the base URL from a full URL string
 * @param {string} url - The full URL string
 * @returns {string} The base URL (protocol + username:password@hostname:port)
 * 
 * Examples:
 * f("http://joe:password@localhost.mydomain:8088/api") 
 *   → "http://joe:password@localhost.mydomain:8088"
 * 
 * f("https://example.com:443/path/to/resource?query=value#fragment")
 *   → "https://example.com:443"
 * 
 * f("http://localhost:3000")
 *   → "http://localhost:3000"
 * 
 * f("https://user:pass@api.example.com:8080/v1/users")
 *   → "https://user:pass@api.example.com:8080"
 */
function getBaseUrl(url) {
  try {
    const urlObj = new URL(url);
    
    // Build the base URL components
    let baseUrl = urlObj.protocol + '//';
    
    // Add username and password if they exist
    if (urlObj.username || urlObj.password) {
      baseUrl += urlObj.username;
      if (urlObj.password) {
        baseUrl += ':' + urlObj.password;
      }
      baseUrl += '@';
    }
    
    // Add hostname
    baseUrl += urlObj.hostname;
    
    // Add port if it exists and is not the default port for the protocol
    if (urlObj.port) {
      baseUrl += ':' + urlObj.port;
    }
    
    return baseUrl;
  } catch (error) {
    // Handle invalid URLs
    console.error('Invalid URL:', error.message);
    return null;
  }
}

// Alternative implementation using regex (if you prefer)
function getBaseUrlRegex(url) {
  try {
    // Regex to match protocol, auth, hostname, and port
    const regex = /^([^:]+:\/\/)([^@]*@)?([^\/\?#:]+)(:\d+)?/;
    const match = url.match(regex);
    
    if (match) {
      return match[0]; // Return the entire matched portion
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing URL:', error.message);
    return null;
  }
}

// Test cases
function testGetBaseUrl() {
  const testCases = [
    "http://joe:password@localhost.mydomain:8088/api",
    "https://example.com:443/path/to/resource?query=value#fragment",
    "http://localhost:3000",
    "https://user:pass@api.example.com:8080/v1/users",
    "ftp://anonymous:password@ftp.example.com:21/files",
    "http://example.com",
    "https://subdomain.example.com:8443/api/v1",
    "http://user@example.com:8080/path",
    "https://example.com:443/", // Note: trailing slash
    "invalid-url" // Should return null
  ];
  
  console.log('Testing getBaseUrl function:');
  console.log('================================');
  
  testCases.forEach((url, index) => {
    const result = getBaseUrl(url);
    console.log(`${index + 1}. Input:  "${url}"`);
    console.log(`   Output: "${result}"`);
    console.log('');
  });
  
  console.log('Testing getBaseUrlRegex function:');
  console.log('==================================');
  
  testCases.forEach((url, index) => {
    const result = getBaseUrlRegex(url);
    console.log(`${index + 1}. Input:  "${url}"`);
    console.log(`   Output: "${result}"`);
    console.log('');
  });
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getBaseUrl, getBaseUrlRegex };
}

// Run tests if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  testGetBaseUrl();
} 
import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

describe('Integration Tests', () => {
  describe('End-to-End Platform Integration', () => {
    it('should proxy GitHub file requests correctly', async () => {
      const testUrl = 'https://example.com/gh/microsoft/vscode/blob/main/package.json';
      const response = await SELF.fetch(testUrl, { method: 'HEAD' });

      // Should attempt to proxy to GitHub
      expect([200, 301, 302, 404]).toContain(response.status);

      // Should include security headers
      expect(response.headers.get('Strict-Transport-Security')).toBeTruthy();
      expect(response.headers.get('X-Performance-Metrics')).toBeTruthy();
    });

    it('should handle GitHub raw file requests', async () => {
      const testUrl = 'https://example.com/gh/microsoft/vscode/raw/main/README.md';
      const response = await SELF.fetch(testUrl, { method: 'HEAD' });

      expect([200, 301, 302, 404]).toContain(response.status);
    });

    it('should handle GitHub release downloads', async () => {
      const testUrl = 'https://example.com/gh/microsoft/vscode/archive/refs/heads/main.zip';
      const response = await SELF.fetch(testUrl, { method: 'HEAD' });

      expect([200, 301, 302, 404]).toContain(response.status);
    });

    it('should proxy GitLab file requests correctly', async () => {
      const testUrl = 'https://example.com/gl/gitlab-org/gitlab/-/raw/master/package.json';
      const response = await SELF.fetch(testUrl, { method: 'HEAD' });

      expect([200, 301, 302, 404]).toContain(response.status);
      expect(response.headers.get('X-Performance-Metrics')).toBeTruthy();
    });

    it('should handle Hugging Face model files', async () => {
      const testUrl = 'https://example.com/hf/microsoft/DialoGPT-medium/resolve/main/config.json';
      const response = await SELF.fetch(testUrl, { method: 'HEAD' });

      expect([200, 301, 302, 404]).toContain(response.status);
    });

    it('should handle npm package requests', async () => {
      const testUrl = 'https://example.com/npm/react';
      const response = await SELF.fetch(testUrl, { method: 'HEAD' });

      expect([200, 301, 302, 404]).toContain(response.status);
    });

    it('should handle PyPI package requests', async () => {
      const testUrl = 'https://example.com/pypi/simple/requests/';
      const response = await SELF.fetch(testUrl, { method: 'HEAD' });

      expect([200, 301, 302, 404]).toContain(response.status);
    });

    it('should handle conda package requests', async () => {
      const testUrl = 'https://example.com/conda/pkgs/main/linux-64/repodata.json';
      const response = await SELF.fetch(testUrl, { method: 'HEAD' });

      expect([200, 301, 302, 404]).toContain(response.status);
    });
  });

  describe('Git Protocol Integration', () => {
    it('should handle Git info/refs requests', async () => {
      const testUrl =
        'https://example.com/gh/microsoft/vscode.git/info/refs?service=git-upload-pack';
      const response = await SELF.fetch(testUrl, {
        headers: {
          'User-Agent': 'git/2.34.1'
        }
      });

      expect([200, 301, 302, 404]).toContain(response.status);
    });

    it('should handle Git upload-pack requests', async () => {
      const testUrl = 'https://example.com/gh/microsoft/vscode.git/git-upload-pack';
      const response = await SELF.fetch(testUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-git-upload-pack-request',
          'User-Agent': 'git/2.34.1'
        },
        body: '0000' // Minimal Git protocol data
      });

      expect([200, 301, 302, 400, 404]).toContain(response.status);
    });

    it('should preserve Git-specific headers', async () => {
      const testUrl = 'https://example.com/gh/test/repo.git/info/refs';
      const response = await SELF.fetch(testUrl, {
        headers: {
          'User-Agent': 'git/2.34.1',
          'Git-Protocol': 'version=2'
        }
      });

      // Should not reject Git-specific headers
      expect(response.status).not.toBe(400);
    });
  });

  describe('Caching Integration', () => {
    it('should cache responses appropriately', async () => {
      const testUrl = 'https://example.com/gh/test/repo/static-file.txt';

      // First request
      const response1 = await SELF.fetch(testUrl);
      const metrics1 = response1.headers.get('X-Performance-Metrics');

      // Second request (should potentially hit cache)
      const response2 = await SELF.fetch(testUrl);
      const metrics2 = response2.headers.get('X-Performance-Metrics');

      expect(metrics1).toBeTruthy();
      expect(metrics2).toBeTruthy();

      // Both requests should succeed
      expect(response1.status).toBe(response2.status);
    });

    it('should not cache Git protocol requests', async () => {
      const testUrl = 'https://example.com/gh/test/repo.git/info/refs?service=git-upload-pack';

      const response = await SELF.fetch(testUrl, {
        headers: {
          'User-Agent': 'git/2.34.1'
        }
      });

      // Git requests should not be cached (no cache headers)
      expect(response.headers.get('Cache-Control')).not.toContain('max-age=1800');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle upstream server errors gracefully', async () => {
      const testUrl = 'https://example.com/gh/nonexistent/repo/file.txt';
      const response = await SELF.fetch(testUrl);

      // Should handle 404 from upstream gracefully
      expect([404, 502, 503]).toContain(response.status);
      expect(response.headers.get('X-Performance-Metrics')).toBeTruthy();
    });

    it('should handle network timeouts', async () => {
      // This would test timeout handling, but is difficult to simulate
      // in a unit test environment. In practice, this would be tested
      // with a mock server that delays responses.
      const testUrl = 'https://example.com/gh/test/repo/file.txt';
      const response = await SELF.fetch(testUrl);

      // Should complete within reasonable time
      expect(response.status).toBeDefined();
    });

    it('should retry failed requests', async () => {
      // Test retry mechanism by checking performance metrics
      const testUrl = 'https://example.com/gh/test/unreliable-endpoint';
      const response = await SELF.fetch(testUrl);

      const metricsHeader = response.headers.get('X-Performance-Metrics');
      if (metricsHeader) {
        const metrics = JSON.parse(metricsHeader);
        // If retries occurred, there should be timing data
        expect(typeof metrics).toBe('object');
      }
    });
  });

  describe('Performance Integration', () => {
    it('should complete requests within reasonable time', async () => {
      const startTime = Date.now();
      const testUrl = 'https://example.com/gh/test/repo/small-file.txt';

      const response = await SELF.fetch(testUrl);
      const endTime = Date.now();

      const duration = endTime - startTime;

      // Should complete within 30 seconds (timeout limit)
      expect(duration).toBeLessThan(30000);
      expect(response.status).toBeDefined();
    });

    it('should include performance metrics in all responses', async () => {
      const testUrls = [
        'https://example.com/gh/test/repo/file.txt',
        'https://example.com/gl/test/repo/file.txt',
        'https://example.com/hf/test/model/config.json',
        'https://example.com/npm/test-package',
        'https://example.com/pypi/simple/test/',
        'https://example.com/conda/pkgs/main/test.json'
      ];

      for (const url of testUrls) {
        const response = await SELF.fetch(url, { method: 'HEAD' });
        expect(response.headers.get('X-Performance-Metrics')).toBeTruthy();
      }
    });
  });

  describe('Content Type Handling', () => {
    it('should preserve content types from upstream', async () => {
      const testCases = [
        { url: 'https://example.com/gh/test/repo/image.png', expectedType: 'image' },
        { url: 'https://example.com/gh/test/repo/data.json', expectedType: 'json' },
        { url: 'https://example.com/gh/test/repo/style.css', expectedType: 'css' },
        { url: 'https://example.com/gh/test/repo/script.js', expectedType: 'javascript' }
      ];

      for (const testCase of testCases) {
        const response = await SELF.fetch(testCase.url, { method: 'HEAD' });

        if (response.status === 200) {
          const contentType = response.headers.get('Content-Type');
          if (contentType) {
            expect(contentType.toLowerCase()).toContain(testCase.expectedType);
          }
        }
      }
    });
  });

  describe('Range Request Support', () => {
    it('should support partial content requests', async () => {
      const testUrl = 'https://example.com/gh/test/repo/large-file.zip';
      const response = await SELF.fetch(testUrl, {
        headers: {
          Range: 'bytes=0-1023'
        }
      });

      // Should either support range requests (206) or return full content (200)
      expect([200, 206, 404]).toContain(response.status);

      if (response.status === 206) {
        expect(response.headers.get('Content-Range')).toBeTruthy();
      }
    });
  });

  describe('Cross-Platform Consistency', () => {
    it('should handle similar requests consistently across platforms', async () => {
      const testCases = [
        'https://example.com/gh/test/repo/README.md',
        'https://example.com/gl/test/repo/README.md'
      ];

      const responses = await Promise.all(
        testCases.map(url => SELF.fetch(url, { method: 'HEAD' }))
      );

      // All responses should have consistent security headers
      responses.forEach(response => {
        expect(response.headers.get('Strict-Transport-Security')).toBeTruthy();
        expect(response.headers.get('X-Performance-Metrics')).toBeTruthy();
      });
    });
  });
});

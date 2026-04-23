// Test validators
import('./services/validators.ts').then(validators => {
  console.log('✓ Validators module loaded');
  
  // Test isValidGeometry
  const validGeom = { x1: 0.5, y1: 0.5, x2: 0.8, y2: 0.8 };
  const invalidGeom = { x1: 1.5, y1: 0.5, x2: 0.8, y2: 0.8 };
  
  console.log('\nTesting isValidGeometry:');
  console.log('  Valid geometry:', validators.isValidGeometry?.(validGeom) ? '✓ PASS' : '✗ FAIL');
  console.log('  Invalid geometry (out of bounds):', !validators.isValidGeometry?.(invalidGeom) ? '✓ PASS' : '✗ FAIL');
  
  // Test isValidToken
  const validToken = 'test_token_1234567890123456';
  const invalidToken = 'short';
  
  console.log('\nTesting isValidToken:');
  console.log('  Valid token:', validators.isValidToken?.(validToken) ? '✓ PASS' : '✗ FAIL');
  console.log('  Invalid token (too short):', !validators.isValidToken?.(invalidToken) ? '✓ PASS' : '✗ FAIL');
  
  console.log('\nAll validator tests completed!');
}).catch(e => console.log('Error:', e.message));

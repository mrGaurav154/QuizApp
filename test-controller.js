const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'server', 'controllers', 'resultController.js');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('Total lines:', lines.length);
console.log('Last 20 lines:');
lines.slice(-20).forEach((line, idx) => {
    const lineNum = lines.length - 20 + idx;
    console.log(`${lineNum}: ${line}`);
});

// Try to require it
try {
    delete require.cache[require.resolve(filePath)];
    const resultController = require(filePath);
    console.log('\n✓ Controller loaded');
    console.log('Exports:', Object.keys(resultController));
} catch (error) {
    console.log('\n✗ Error loading controller:', error.message);
    console.log('Stack:', error.stack);
}

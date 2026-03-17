const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'server', 'controllers', 'resultController.js');
const content = fs.readFileSync(filePath, 'utf8');

// Count braces
let openBraces = 0;
let closeBraces = 0;
let inString = false;
let stringChar = null;
let inComment = false;

for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];
    
    // Handle strings
    if (!inComment && (char === '"' || char === "'" || char === '`')) {
        if (!inString) {
            inString = true;
            stringChar = char;
        } else if (char === stringChar && content[i - 1] !== '\\') {
            inString = false;
        }
    }
    
    // Handle comments
    if (!inString && char === '/' && nextChar === '/') {
        inComment = true;
        i++;
        continue;
    }
    
    if (inComment && (char === '\n' || char === '\r')) {
        inComment = false;
    }
    
    // Count braces
    if (!inString && !inComment) {
        if (char === '{') openBraces++;
        if (char === '}') closeBraces++;
    }
}

console.log('Brace balance:');
console.log('Open braces:', openBraces);
console.log('Close braces:', closeBraces);
console.log('Difference:', openBraces - closeBraces);

const content = `\`\`\`html Generated
Code has been saved. Click 'View App' above to see files.
\`\`\`
html
<!DOCTYPE html>
<html lang="en">
<head>
</head>
</html>`;

let sanitizedContent = content.replace(/```([a-zA-Z0-9_+\-#]*)\s*```\s*(?:\1\s*)?(?=(<|import |function |const |let |var |\.|#))/gi, '```$1\n');
console.log("SANITIZED:");
console.log(sanitizedContent);

const allBlocks = [];
const allParts = sanitizedContent.split(/(```[\s\S]*?```)/g);
allParts.forEach(p => {
    if (p.startsWith('```') && p.endsWith('```')) {
        const m = p.match(/^```([a-zA-Z0-9_+\-#]*)[ \t]*\r?\n?([\s\S]*?)```$/);
        if (m) {
            allBlocks.push(m[2].trim());
        }
    }
});
console.log("BLOCKS:");
console.log(allBlocks);

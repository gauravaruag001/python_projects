const fs = require('fs');
let content = fs.readFileSync('./js/questions.js', 'utf8');

// The file contents look like:
// window.quizData = [ ... ];
// We can strip `window.quizData = ` and the final `;`
content = content.replace('window.quizData = ', '').trim();
if (content.endsWith(';')) {
    content = content.slice(0, -1);
}

// Write to db/local_questions.json and db/master_questions.json
// We do this via evaluating because it's slightly malformed JSON (it has comments, trailing commas etc)
try {
    const data = eval(content);
    fs.writeFileSync('./db/local_questions.json', JSON.stringify(data, null, 2));
    fs.writeFileSync('./db/master_questions.json', JSON.stringify(data, null, 2));
    console.log("Written successfully");
} catch (e) {
    console.error("Error evaluating:", e);
}

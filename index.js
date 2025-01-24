const fs = require('fs');
const path = require('path');
const {GoogleGenerativeAI} = require("@google/generative-ai")
const Anthropic = require('@anthropic-ai/sdk');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY // Ensure API key is set in environment variables
});


// Function to process input parameters
function parseInputParameters() {
    const args = require('minimist')(process.argv.slice(2));

    console.log(process.argv)

    const parameters = {
        contextFilePath: args['contextFilePath'] || null, // project context file path
        productionCodePath: args['productionCodePath'] || null, // production file path
        testFilePath: args['testFilePath'] || null, // test file path to be changed
        testExamplePath: args['testExamplePath'] || null, // path of a snippet of a good test
        instructions: args['instructions'] || null // test instructions
    };

    // Validate mandatory parameters
    const mandatoryKeys = [
        'contextFilePath',
        'productionCodePath',
        'testFilePath',
        'testExamplePath',
        "instructions"
    ];
    
    const missingKeys = mandatoryKeys.filter(key => !parameters[key]);
    if (missingKeys.length > 0) {
        throw new Error(`Missing required parameters: ${missingKeys.join(', ')}`);
    }

    return parameters;
}

// Load file content helper
function loadFile(filePath) {
    return fs.promises.readFile(filePath, 'utf8');
}

// Write file content helper
function writeFile(filePath, content) {
    return fs.promises.writeFile(filePath, content, 'utf8');
}

// Generate test context with OpenAI
async function generateTestContext(productionContent,coverageTatic) {
    const prompt = `
The following is the content of a production file. Generate a list of the required tests basead on the coverage tatic choosen:

---
Production File:
${productionContent}

---
Coverage tatic:
${coverageTatic}

---
Respond with:


- list of explanation of each necessary test considering the basic flow

`;

const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 8000,
    messages: [
        { role: 'user', content: prompt }
    ]
});

const result = response.content[0].text

console.log(`
    Specific Context:

    ${result.trim()}
    `)

return result.trim();
    
}

async function extractDependentClasses(contextContent, productionContent) {
    const prompt = `
The following is the context of a project and the content of a production file. Extract the list of classes that the production file is dependent on. For each class, provide:

- The class name
- The signatures of its constructors (prioritize constructor with parameters)
- The signatures of its public methods

---
Project Context:
${contextContent}
---
Production File:
${productionContent}
---
Respond with the list of dependent classes and their details in JSON format, like this:

class ClassName {
   
  //constructor 1

  //constructor 2

  //public method 

  //public method
  
}

class ClassName2 {
   
  //constructor 1

  //constructor 2

  //public method 

  //public method
  
}

`;

const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-pro",systemInstruction:"You are an expert in software engineering."});
const result = (await model.generateContent(prompt)).response.text().trim();    

console.log("Dependent Classes Extracted:", result);
return result;

}

async function generateTestFile(generalContext,testContext, testExample,productionContent, existingTestContent) {
    const prompt = `
The following is the general context, context for generating tests, the content of a production file, and the current content of the test file. Generate the full content for the updated test file based on the provided instructions:

---
General Context:
${generalContext}

---
Test Context:
${testContext}

---
Test Examples:
${testExample}

---
Production File:
${productionContent}

---
Existing Test File:
${existingTestContent}

---
Respond with: 

- the full updated test file content
- Include only the code, nothing more
- do not include any markdown code
`;

const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 8000,
    messages: [
        { role: 'user', content: prompt }
    ]
});

const result = response.content[0].text

console.log(`
    Test file:

    ${result}
`)

return result.trim();
}

// Main function to execute the logic
async function main(params) {
    
        const contextContent = await loadFile(params.contextFilePath);
        const productionContent = await loadFile(params.productionCodePath);
        let existingTestContent = await loadFile(params.testFilePath);
        const exampleContent = await loadFile(params.testExamplePath);
                    
        try {
            console.log('Generating test context...');
            const testContext = await generateTestContext(productionContent,params.instructions);
    
            console.log('Generating dependecies list...');
            const dependeciesContext = await extractDependentClasses(contextContent, productionContent);            
    
            console.log('Generating test file...');
            const updatedTestContent = await generateTestFile(
                dependeciesContext,
                testContext,
                exampleContent,
                productionContent,
                existingTestContent
            );
    
            console.log('Updating test file...');
            await writeFile(params.testFilePath, updatedTestContent);        
    
            console.log('Test generation process completed successfully.');            

        } catch(exception) {
            console.error('An error occurred:', exception.stack);            
        }
}

// Example usage
(async () => {    
        const params = parseInputParameters();
        await main(params);
})();

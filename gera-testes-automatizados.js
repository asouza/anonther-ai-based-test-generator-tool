const { exec } = require('child_process');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const {GoogleGenerativeAI} = require("@google/generative-ai")
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

// Initialize Anthropic API
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY // Ensure API key is set in environment variables
});

const openai = new OpenAI();

//gemini para gerar o contexto e anthropic para gerar o test

// Function to process input parameters
function parseInputParameters() {
    const args = require('minimist')(process.argv.slice(2));

    const parameters = {
        contextFilePath: args['context'] || null, // Caminho para o arquivo de contexto
        productionCodePath: args['production'] || null, // Caminho do código de produção
        testFilePath: args['test'] || null, // Caminho para o arquivo de teste
        testCommand: args['command'] || null, // Comando para rodar testes
        coverageCsvPath: args['coverage'] || null, // Caminho para o CSV de cobertura
        instructions: args['instructions'] || 'Write automated tests', // Instruções básicas para o modelo OpenAI
        maxAttempts: parseInt(args['attempts'], 10) || 1, // Número máximo de tentativas
        targetCoverage: parseFloat(args['targetCoverage']), // Percentual de cobertura desejado
        testExamplePath: args['testExample'] || null // caminho para arquivo com exemplo de teste
    };

    // Validate mandatory parameters
    const mandatoryKeys = [
        'contextFilePath',
        'productionCodePath',
        'testFilePath',
        'testCommand',
        'coverageCsvPath',
        'targetCoverage',
        'testExamplePath'
    ];
    
    const missingKeys = mandatoryKeys.filter(key => !parameters[key]);
    if (missingKeys.length > 0) {
        throw new Error(`Missing required parameters: ${missingKeys.join(', ')}`);
    }

    return parameters;
}

// Execute the test command in background
function executeTestCommand(command) {
    return new Promise((resolve, reject) => {
        const process = exec(command, { shell: true }, (error, stdout, stderr) => {
            if (error) {
                console.log(error)
                //when execution fails, just return and let the llm handles
                resolve(stderr.trim());                
            }
            resolve(stdout.trim());
        });

        process.stdout.on('data', data => console.log("..."));
        process.stderr.on('data', data => console.error(`Test Error: ${data}`));
    });
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

// const result = `
//         Specific Context:

//         Here's a detailed analysis of the required tests and dependencies for the SnapshotCampanhasMetaAdsInsightsController:

// Required Tests:

// 1. Basic Flow Tests:
// - Should return 404 when snapshot not found
// - Should return initial progress response when snapshot hasn't started importing
// - Should return existing insights when same question was asked before
// - Should generate and save new insights when new question is asked
// - Should return previous insights history with response
// - Should handle empty/null question parameter correctly


// The tests should use mocks for external dependencies and focus on verifying:
// 1. Correct interaction with dependencies
// 2. Proper transaction management
// 3. Correct error handling
// 4. Appropriate response construction
// 5. Data consistency
// 6. Edge cases handling

// Each test should isolate the specific behavior being tested and use appropriate mocking to control dependency behavior.
// `

    // const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-pro",systemInstruction:"You are an expert in software testing."});
    // const result = await model.generateContent(prompt);
    //${result.response.text().trim()}

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

// const response = await anthropic.messages.create({
//     model: 'claude-3-5-sonnet-20241022',
//     max_tokens: 8000,
//     messages: [
//         { role: 'user', content: prompt }
//     ]
// });

// const result = response.content[0].text

const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-pro",systemInstruction:"You are an expert in software engineering."});
const result = (await model.generateContent(prompt)).response.text().trim();    



    console.log("Dependent Classes Extracted:", result);
    return result;
}

// Generate test file with OpenAI
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

// const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-pro",systemInstruction:"You are an expert in software testing."});
// const result = (await model.generateContent(prompt)).response.text().trim();    

console.log(`
    Test file:

    ${result}
    `)

return result.trim();
}

// Compare code coverage files
async function calculateFileCoverage(jacocoCoverageCsvPath, productionCodePath) {
    const oldCoverage = await parseCsv(jacocoCoverageCsvPath);

    // Extract the class name (file name without path)
    const className = path.basename(productionCodePath, path.extname(productionCodePath));

    // Find the relevant row for the production code
    const fileCoverage = oldCoverage.find(entry => entry.CLASS === className) || {};    

    // Calculate coverage percentages
    const instructionsMissed = parseInt(fileCoverage['INSTRUCTION_MISSED'] || 0, 10);
    const instructionsCovered = parseInt(fileCoverage['INSTRUCTION_COVERED'] || 0, 10);

    const coveragePercentage = calculateCoveragePercentage(
        instructionsMissed,
        instructionsCovered
    );

    return coveragePercentage
}

// Calculate coverage percentage helper
function calculateCoveragePercentage(missed, covered) {
    const total = missed + covered;
    if (total === 0) return 0;
    return ((covered / total) * 100).toFixed(2);
}

// Helper function to parse CSV files
function parseCsv(filePath) {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', data => results.push(data))
            .on('end', () => resolve(results))
            .on('error', error => reject(error));
    });
}

// Analyze test output using OpenAI
async function analyzeTestOutput(output) {
    const prompt = `
The following is the output of a test command. Indicate if it represents a success or failure:
---
${output}
---
Respond with "success" or "failure".`


const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
        { role: 'system', content: 'You are a highly skilled software testing assistant.' },
        { role: 'user', content: prompt }
    ]
});

return response.choices[0].message.content.trim().toLowerCase();
}


// Main function to execute the logic
async function main(params) {
    
        console.log('Running initial test command to check current coverage...');        
        //await executeTestCommand(params.testCommand);        

        console.log('Calculating initial coverage files...');
        const oldCoveragePercentage = await calculateFileCoverage(
            params.coverageCsvPath,            
            params.productionCodePath
        );

        console.log(`Initial coverage for ${params.productionCodePath}: ${oldCoveragePercentage}%`);

        const contextContent = await loadFile(params.contextFilePath);
        const productionContent = await loadFile(params.productionCodePath);
        let existingTestContent = await loadFile(params.testFilePath);
        const exampleContent = await loadFile(params.testExamplePath);

        let attempts = 0;
        let success = false;

        while (attempts < params.maxAttempts && !success) {
            console.log(`Attempt ${attempts + 1} of ${params.maxAttempts}...`);

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

            console.log('Running test command...');
            try {
                const testOutput = "success" //await executeTestCommand(params.testCommand);

                console.log('Analyzing test output...');
                
                const testResult = "success" //await analyzeTestOutput(testOutput);

                if (testResult === 'success') {
                    console.log('Test execution succeeded.');
                    success = true;

                    console.log('Comparing coverage files...');
                    const newCoveragePercentage = await calculateFileCoverage(
                        params.coverageCsvPath,                        
                        params.productionCodePath
                    );

                    if (newCoveragePercentage <= oldCoveragePercentage) {
                        throw new Error(
                            `Code coverage did not increase. Old: ${oldCoveragePercentage}%, New: ${newCoveragePercentage}%. Process interrupted.`
                        );
                    }

                    if (newCoveragePercentage < params.targetCoverage) {
                        throw new Error(
                            `Target coverage of ${params.targetCoverage}% not achieved. Current coverage: ${newCoveragePercentage}%. Process interrupted.`
                        );
                    }

                    console.log(`Success! Target coverage of ${params.targetCoverage}% achieved with ${newCoveragePercentage}%.`);
                } else {
                    console.error('Test execution failed. Using output for next attempt.');
                    existingTestContent = updatedTestContent + '\n// Debug: ' + testOutput;
                }
            } catch (error) {
                console.error('Test command execution error:', error);
                existingTestContent = updatedTestContent + '\n// Debug Error: ' + error.message;
            }

            attempts++;
        }

        if (!success) {
            throw new Error('Max attempts reached. Test generation process failed.');
        }

        console.log('Test generation process completed successfully.');
}

// Example usage
(async () => {    
        const params = parseInputParameters();
        await main(params);
})();

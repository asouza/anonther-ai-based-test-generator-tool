# Automated Test Generator

This project provides a tool to automate the generation of test files for production code. It uses AI models, including Google Generative AI and Anthropic Claude, to analyze production code, extract dependencies, and generate comprehensive tests based on user-provided instructions and test examples.

## Features

- **Dependency Extraction**: Analyzes production code and extracts dependent classes, their constructors, and public methods
- **Test Context Generation**: Creates a list of required tests based on the chosen coverage tactic (e.g., MC/DC, Boundary Testing)
- **Automated Test File Creation**: Updates current test files based on production code and user-provided test examples
- **Customizable Instructions**: Accepts detailed user instructions to guide test generation

## Requirements

- Node.js (v14 or higher)
- API keys for:
  - [Google Generative AI](https://aistudio.google.com/)
  - [Anthropic Claude](https://www.anthropic.com/)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/automated-test-generator.git
cd automated-test-generator
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables for API keys:
```bash
export GEMINI_API_KEY=your_google_generative_ai_api_key
export ANTHROPIC_API_KEY=your_anthropic_api_key
```

## Usage

Run the tool with the following command:
```bash
node index.js --contextFilePath=<context-file-path> \
              --productionCodePath=<production-file-path> \
              --testFilePath=<test-file-path> \
              --testExamplePath=<test-example-path> \
              --instructions=<coverage-tactic>
```

### Parameters

| Parameter | Description |
|-----------|-------------|
| `--contextFilePath` | Path to the project context file |
| `--productionCodePath` | Path to the production code file |
| `--testFilePath` | Path to the existing test file to be updated |
| `--testExamplePath` | Path to a file containing examples of well-written tests |
| `--instructions` | Coverage tactic or instructions for generating tests |

### Example

```bash
node index.js --contextFilePath=./context.txt \
              --productionCodePath=./production.js \
              --testFilePath=./test.js \
              --testExamplePath=./example-test.js \
              --instructions="MC/DC"
```

## How It Works

1. **Input Parameters**: Parses command-line arguments to determine input files and instructions
2. **File Loading**: Reads the project context, production code, test examples, and existing test files
3. **Test Context Generation**: Generates a detailed test context using Anthropic Claude
4. **Dependency Extraction**: Extracts dependent classes from the production code using Google Generative AI
5. **Test File Generation**: Combines the context, dependencies, and test examples to generate an updated test file
6. **File Update**: Overwrites the existing test file with the generated content

## Error Handling

The tool validates mandatory parameters and reports missing ones. Any errors during execution are logged with a stack trace for troubleshooting.

## Current Validation

This tool has been extensively tested in a real-world Java project involving classes with varying levels of complexity. It demonstrated the ability to generate test files that, in most cases, compiled successfully and included meaningful tests with well-thought-out assertions.

On average, only minor adjustments were needed to ensure the tests executed correctly. According to the author, this approach was significantly more efficient than writing tests manually. The time saved and the quality of the generated tests made it a valuable tool for accelerating the development process and improving code coverage.

## How I Used It

To validate and leverage the tool effectively, I followed these steps:

1. **Generated Project Context**:  
   I used the [git2txt](https://github.com/addyosmani/git2txt) tool to generate a single file containing the entire content of my project. This file was used as the general context for the test generation process.

2. **Created a Test Example**:  
   I manually wrote a test to serve as an example of what a good test should look like. This example helped guide the tool in generating meaningful and properly structured tests.

3. **Iterative Testing**:  
   I tested the tool by generating tests for various production code files. Each time, I evaluated the generated tests, made minor adjustments when necessary, and ensured they executed correctly.

This iterative approach allowed me to fine-tune the tool's usage and confirm its ability to generate high-quality tests that saved significant time compared to writing them manually.

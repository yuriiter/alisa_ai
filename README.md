# Alisa CLI

`alisa` is a command-line interface for interacting with OpenAI's API. It provides multiple modes of operation, including chat mode and pipe mode, allowing for flexible and efficient communication with the API.

## Features

- **Chat Mode**: Enter interactive chat mode to communicate with OpenAI's model in real-time.
- **Pipe Mode**: Use standard input to provide messages and receive responses.
- **Command Line Input Mode**: Provide messages directly as command-line arguments.
- **Configurable**: Configure API settings via a config file, including base URL and model name.

## Installation

Ensure you have Node.js and npm installed. Then, clone the repository and install the dependencies:

```bash
npm install -g alisa-ai
```

## Usage

### Command-Line Options

```sh
➜  alisa git:(main) ✗ alisa --help
Options:
      --version      Show version number                               [boolean]
  -k, --api-key      API Key for OpenAI                                 [string]
      --base-url     Base URL for OpenAI API                            [string]
      --model-name   Model name to use                                  [string]
  -t, --temperature  Set the temperature for OpenAI responses
                                                         [number] [default: 0.7]
  -u, --url          Fetch and prepend content from the specified URL   [string]
  -m, --message      Additional message to prepend to the input         [string]
      --chat         Enable chat mode                                  [boolean]
      --help         Show help                                         [boolean]
```

### Examples

1. **Interactive Chat Mode**

   Start chat mode and interact with the model:

   ```bash
   alisa --chat
   ```

2. **Pipe Mode**

   Send a message via pipe and get a response:

   ```bash
   cat data.json | alisa --message "Describe the data." > gpt_output.txt
   ```

3. **Command Line Input Mode**

   Provide a message directly as a command-line argument:

   ```bash
    alisa "What's a field in mathematics?"
   ```

4. **Using a Config File**

   Create a config file at `~/.config/alisa/config.json`:

   ```json
   {
     "apiKey": "L3T6LqD2K6pmY/fixa4TgHNBvYnaHhQPYkTaG58Z2B/oG+szUqqIG+TBT1LOaoKz2P0smhNgr3zzybLEzmyPsaPqvk4IN2mzZFwSHkRfAP4xfp+45+",
     "baseURL": "https://api.openai.com/v1",
     "model": "gpt-4"
   }
   ```

**Note**: The API key in the config file is encrypted and should not be manually edited.

## Configuration

- **Config File Path**: `~/.config/alisa/config.json`
- **Editable Fields**:
  - `baseURL`: The base URL for the OpenAI API.
  - `model`: The model name to use for requests.
- **Note**: The API key is encrypted in the config file and should not be manually altered.

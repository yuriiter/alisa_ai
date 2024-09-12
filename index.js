import { OpenAI } from 'openai';
import { createInterface } from 'readline';
import dotenv from 'dotenv';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { exit } from 'process'

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.API_KEY,
  baseURL: process.env.API_BASE_URL
});

const fetchOpenAIResponse = async (message, temperature = 0.7) => {
  try {
    const response = await openai.chat.completions.create({
      model: 'llama3-70b-8192', // Replace with your model if needed
      messages: [{ role: 'user', content: message }],
      temperature
    });
    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error fetching response from OpenAI:', error);
    return 'Error: Unable to fetch response';
  }
};

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

const chatMode = async (temperature) => {
  console.log('Starting OpenAI CLI Chat App in chat mode. Type your message and press Enter to chat.');

  rl.on('line', async (input) => {
    if (input.trim()) {
      console.log(`You: ${input}`);
      const reply = await fetchOpenAIResponse(input, temperature);
      console.log(`ChatGPT: ${reply}`);
    }
  });
};

const pipeMode = async (temperature) => {
  let input = '';

  process.stdin.on('data', (chunk) => {
    input += chunk.toString();
  });

  process.stdin.on('end', async () => {
    if (input.trim()) {
      const reply = await fetchOpenAIResponse(input.trim(), temperature);
      console.log(reply);
    }
  });
};

const commandLineInputMode = async (args) => {
  const input = args._.join(' ');

  if (input.trim()) {
    const reply = await fetchOpenAIResponse(input.trim(), args.temperature || 0.7);
    console.log(reply);
    exit(0)
  }
};

const argv = yargs(hideBin(process.argv))
  .option('chat', {
    alias: 'c',
    type: 'boolean',
    description: 'Enable chat mode'
  })
  .option('temperature', {
    alias: 't',
    type: 'number',
    description: 'Set the temperature for OpenAI responses',
    default: 0.7
  })
  .help()
  .argv;

const temperature = argv.temperature;

if (argv.chat) {
  chatMode(temperature);
} else if (argv._.length > 0) {
  commandLineInputMode(argv);
} else if (process.stdin.isTTY) {
  // If stdin is TTY and no arguments provided, start chat mode
  chatMode(temperature);
} else {
  // If no arguments and stdin is not TTY, start pipe mode
  pipeMode(temperature);
}

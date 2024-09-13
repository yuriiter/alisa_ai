import { OpenAI } from 'openai';
import { createInterface } from 'readline';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { exit } from 'process';

const CONFIG_PATH = path.join(process.env.HOME || process.env.USERPROFILE, '.config/alisa/config.json');
const PRIVATE_KEY_PATH = path.join(process.env.HOME || process.env.USERPROFILE, '.config/alisa/private.pem');
const PUBLIC_KEY_PATH = path.join(process.env.HOME || process.env.USERPROFILE, '.config/alisa/public.pem');

const generateKeyPair = () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });

  fs.writeFileSync(PUBLIC_KEY_PATH, publicKey.export({ type: 'pkcs1', format: 'pem' }));
  fs.writeFileSync(PRIVATE_KEY_PATH, privateKey.export({ type: 'pkcs1', format: 'pem' }));
};

const encrypt = (text) => {
  const publicKey = fs.readFileSync(PUBLIC_KEY_PATH, 'utf-8');
  return crypto.publicEncrypt(publicKey, Buffer.from(text)).toString('base64');
};

const decrypt = (text) => {
  const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf-8');
  return crypto.privateDecrypt(privateKey, Buffer.from(text, 'base64')).toString('utf-8');
};

const readConfig = () => {
  if (fs.existsSync(CONFIG_PATH)) {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    return {
      apiKey: decrypt(config.apiKey),
      baseURL: decrypt(config.baseURL),
      model: config.model
    };
  } else {
    return null;
  }
};

const promptForConfig = async () => {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query) => new Promise(resolve => rl.question(query, resolve));

  const apiKey = await question('Enter your API Key: ');
  const baseURL = await question('Enter your API Base URL: ');

  rl.close();

  const config = {
    apiKey: encrypt(apiKey),
    baseURL: encrypt(baseURL)
  };

  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
};

const fetchFromUrl = async (url) => {
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching URL:', error);
    return 'Error: Unable to fetch URL content';
  }
};

const initOpenAI = async () => {
  const config = readConfig();

  if (!config) {
    console.log('Configuration not found. Generating keys and prompting for API credentials...');
    generateKeyPair();
    promptForConfig().then(() => {
      console.log('Configuration saved.');
      initOpenAI();
    });
    return;
  }

  const openai = new OpenAI({
    apiKey: process.env.API_KEY || config.apiKey,
    baseURL: process.env.API_BASE_URL || config.baseURL
  });

  const fetchOpenAIResponse = async (message, temperature = 0.7) => {
    try {
      const response = await openai.chat.completions.create({
        model: process.env.MODEL || config.model,
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

  const pipeMode = async (temperature, urlContent = '', additionalMessage = '') => {
    let input = '';

    process.stdin.on('data', (chunk) => {
      input += chunk.toString();
    });

    process.stdin.on('end', async () => {
      const fullMessage = [urlContent, additionalMessage, input.trim()].filter(Boolean).join('\n=====================\n');

      if (fullMessage.trim()) {
        const reply = await fetchOpenAIResponse(fullMessage, temperature);
        console.log(reply);
      }
    });
  };

  const commandLineInputMode = async (args) => {
    const input = args._.join(' ');

    const urlContent = args.url ? await fetchFromUrl(args.url) : '';
    const additionalMessage = args.message || '';

    const fullMessage = [urlContent, additionalMessage, input].filter(Boolean).join('\n=====================\n');

    if (fullMessage.trim()) {
      const reply = await fetchOpenAIResponse(fullMessage, args.temperature || 0.7);
      console.log(reply);
      exit(0);
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
    .option('url', {
      alias: 'u',
      type: 'string',
      description: 'Fetch and prepend content from the specified URL'
    })
    .option('message', {
      alias: 'm',
      type: 'string',
      description: 'Additional message to prepend to the input'
    })
    .option('reset', {
      alias: 'r',
      type: 'boolean',
      description: 'Reset configuration and prompt for API credentials'
    })
    .option('model', {
      type: 'string',
      description: 'Specify the model to use'
    })
    .help()
    .argv;

  const temperature = argv.temperature;
  const url = argv.url;
  const additionalMessage = argv.message;

  if (argv.reset) {
    console.log('Resetting configuration...');
    fs.unlinkSync(CONFIG_PATH);
    generateKeyPair();
    promptForConfig().then(() => {
      console.log('Configuration saved.');
      initOpenAI();
    });
    return;
  }

  if (url && !argv._.length) {
    const urlContent = await fetchFromUrl(url);
    const fullMessage = [urlContent, additionalMessage].filter(Boolean).join('\n=====================\n');
    const reply = await fetchOpenAIResponse(fullMessage, temperature);
    console.log(reply);
  } else if (argv.chat) {
    chatMode(temperature);
  } else if (argv._.length > 0) {
    commandLineInputMode(argv);
  } else if (process.stdin.isTTY) {
    // If stdin is TTY and no arguments provided, start chat mode
    chatMode(temperature);
  } else {
    // If no arguments and stdin is not TTY, start pipe mode
    pipeMode(temperature, await fetchFromUrl(url), additionalMessage);
  }
};

initOpenAI();

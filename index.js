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

const ensureDirectoryExists = (filePath) => {
  const directory = path.dirname(filePath);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
};

const generateKeyPair = () => {
  ensureDirectoryExists(PRIVATE_KEY_PATH);
  ensureDirectoryExists(PUBLIC_KEY_PATH);

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
      baseURL: config.baseURL,
      model: config.model || 'gpt-4'
    };
  } else {
    return null;
  }
};

const promptForApiKey = async () => {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query) => new Promise(resolve => rl.question(query, resolve));

  const apiKey = await question('Enter your API Key: ');

  rl.close();

  return apiKey;
};

const saveConfig = (apiKey, baseURL, model) => {
  const config = {
    apiKey: encrypt(apiKey),
    baseURL,
    model
  };

  ensureDirectoryExists(CONFIG_PATH);

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
};

const fetchFromUrl = async (url) => {
  if (url === undefined || url.trim() === '' || url === 'undefined') return '';

  let urlObject;
  try {
    urlObject = new URL(url);
  } catch (e) {
    return 'Invalid URL. Ignore this message';
  }

  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching URL:', error);
    return 'Error: Unable to fetch URL content';
  }
};

const initOpenAI = async () => {
  const argv = yargs(hideBin(process.argv))
    .option('api-key', {
      alias: 'k',
      type: 'string',
      description: 'API Key for OpenAI'
    })
    .option('base-url', {
      type: 'string',
      description: 'Base URL for OpenAI API'
    })
    .option('model-name', {
      type: 'string',
      description: 'Model name to use'
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
    .option('chat', {
      type: 'boolean',
      description: 'Enable chat mode'
    })
    .help()
    .argv;

  const apiKey = argv['api-key'];
  const baseURL = argv['base-url'];
  const model = argv['model-name'];
  const temperature = argv.temperature;
  const url = argv.url;
  const additionalMessage = argv.message;
  const chatModeEnabled = argv.chat;

  let finalApiKey = apiKey;
  let urlContent = '';

  if (!fs.existsSync(PRIVATE_KEY_PATH) || !fs.existsSync(PUBLIC_KEY_PATH)) {
    console.log('Keys not found. Generating new key pair...');
    generateKeyPair();
  }

  const config = readConfig();

  if (!finalApiKey) {
    finalApiKey = config ? config.apiKey : null;
  }

  if (!finalApiKey) {
    console.log('API Key is missing. Prompting for API Key...');
    finalApiKey = await promptForApiKey();
    saveConfig(finalApiKey, baseURL, model);
    console.log('Configuration saved.');
  }

  const openai = new OpenAI({
    apiKey: finalApiKey,
    baseURL: baseURL || config?.baseURL
  });

  const fetchOpenAIResponse = async (message, temperature = 0.7) => {
    try {
      const response = await openai.chat.completions.create({
        model: model || config?.model,
        messages: [{ role: 'user', content: message }],
        temperature
      });
      return response.choices[0].message.content;
    } catch (error) {
      console.error('Error fetching response from OpenAI:', error);
      return 'Error: Unable to fetch response';
    }
  };

  if (url) {
    urlContent = await fetchFromUrl(url);
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const chatMode = async (temperature) => {
    console.log('Starting OpenAI CLI Chat App in chat mode. Type your message and press Enter to chat.');

    rl.on('line', async (input) => {
      if (input.trim()) {
        let message = input;
        if (urlContent || additionalMessage) {
          message = `${urlContent}\n${additionalMessage}\n=====================\n${input}`;
        }
        console.log(`You: ${input}`);
        const reply = await fetchOpenAIResponse(message, temperature);
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

    const fullMessage = [urlContent, additionalMessage, input].filter(Boolean).join('\n=====================\n');

    if (fullMessage.trim()) {
      const reply = await fetchOpenAIResponse(fullMessage, args.temperature || 0.7);
      console.log(reply);
      exit(0);
    }
  };

  if (chatModeEnabled) {
    await chatMode(temperature);
  } else if ((argv._.length > 0 || urlContent || additionalMessage) && process.stdin.isTTY) {
    await commandLineInputMode(argv);
  } else if (process.stdin.isTTY) {
    // If stdin is TTY and no arguments provided, exit
    console.log('No arguments provided. Exiting.');
    exit(0);
  } else {
    // If no arguments and stdin is not TTY, start pipe mode
    await pipeMode(temperature, urlContent, additionalMessage);
  }
};

initOpenAI();

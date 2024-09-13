node index.js  --message "I'm in a very good mood today\! Reply with smiles:) And let's chat\!" --chat
node index.js  --message "You should respond in JSON format only, strict\!\! Also analyze the information from the website" --url "https://website.com" --chat
cat data.json | node index.js  --message "You should respond in JSON format only, strict\!\! Also, include the information from the website and reply accordingly" --url "https://website.com" --temperature 0.1
node index.js  --message "You should respond in JSON format only, strict\!\!" --url "https://website.com" --chat --api-key $(cat /path/to/key) --base-url "https://altaopenai.com/v1" --model-name "gpt-4o-mini"

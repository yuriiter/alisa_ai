alisa  --message "I'm in a very good mood today\! Reply with smiles:) And let's chat\!" --chat
alisa  --message "You should respond in JSON format only, strict\!\! Also analyze the information from the website" --url "https://website.com" --chat
cat data.json | alisa  --message "You should respond in JSON format only, strict\!\! Also, include the information from the website and reply accordingly" --url "https://website.com" --temperature 0.1
alisa  --message "You should respond in JSON format only, strict\!\!" --url "https://website.com" --chat --api-key $(cat /path/to/key) --base-url "https://altaopenai.com/v1" --model-name "gpt-4o-mini"
alisa "What's a field in mathematics?"
cat data.json | alisa --message "Explain the data please"

const OpenAI = require('openai');

class AIService {
  constructor(apiKey) {
    this.client = new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY });
    this.defaultModel = process.env.OPENAI_AUX_MODEL || 'gpt-4o-mini';
  }

  async callJsonChatCompletion({
    system,
    developer,
    user,
    model = this.defaultModel,
    temperature = 0.5,
    responseFormat = 'json_object'
  }) {
    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    if (developer) messages.push({ role: 'developer', content: developer });
    if (user) messages.push({ role: 'user', content: user });

    const payload = {
      model,
      messages,
      temperature
    };

    if (responseFormat === 'json_object') {
      payload.response_format = { type: 'json_object' };
    }

    const completion = await this.client.chat.completions.create(payload);
    return completion.choices?.[0]?.message?.content || '{}';
  }
}

module.exports = AIService;

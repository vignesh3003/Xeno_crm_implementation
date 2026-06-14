const axios = require('axios');

// Helper to clean markdown json wrapping from LLM content
const cleanJsonString = (str) => {
  if (!str) return '';
  let cleaned = str.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  }
  return cleaned;
};

// Get Groq API Key
const getGroqApiKey = () => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.warn('WARNING: GROQ_API_KEY environment variable is not set. AI features will use mock data.');
    return null;
  }
  return apiKey;
};

// Reusable chat completions helper using llama-3.3-70b-versatile
const getGroqChatCompletion = async (prompt) => {
  const apiKey = getGroqApiKey();
  if (!apiKey) return null;

  try {
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' }
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000 // 15s timeout
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    const details = error.response ? JSON.stringify(error.response.data) : error.message;
    console.error('Groq SDK Error:', details);
    throw new Error('Groq completion failed: ' + details);
  }
};

// Generates insights for a specific customer segment
const getSegmentInsights = async (segmentName, count, stats) => {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    return getMockSegmentInsights(segmentName, count);
  }

  try {
    const prompt = `You are an AI growth marketer for Xeno, a marketing automation platform. 
Generate insights for the customer segment: "${segmentName}".
Current count of customers in this segment: ${count}
Segment metadata/context: ${JSON.stringify(stats)}

Provide your response in EXACTLY the following JSON format:
{
  "summary": "Short 1-2 sentence summary of this segment based on the data.",
  "observations": ["Observation 1", "Observation 2", "Observation 3"],
  "opportunity": "The main marketing/revenue opportunity for this segment.",
  "action": "Recommended marketing action to take.",
  "channel": "WhatsApp" | "Email" | "SMS",
  "conversionProbability": 15
}
Ensure the conversionProbability is a number representing percentage (e.g. 15 for 15%). Return ONLY the JSON object.`;

    const content = await getGroqChatCompletion(prompt);
    try {
      return JSON.parse(cleanJsonString(content));
    } catch (parseErr) {
      console.warn('Failed parsing segment insights JSON, using fallback:', parseErr);
      return getMockSegmentInsights(segmentName, count);
    }
  } catch (error) {
    console.error('Error generating AI Insights with Groq:', error.message);
    return getMockSegmentInsights(segmentName, count);
  }
};

// Generates a campaign plan based on a business goal
const getCampaignGeneration = async (goal, segmentsSummary) => {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    return getMockCampaign(goal);
  }

  try {
    const prompt = `You are an AI campaign generator for Xeno.
A marketer has entered this business goal: "${goal}".
Available customer segments and counts: ${JSON.stringify(segmentsSummary)}

Generate a complete marketing campaign details targeted to achieve this goal.
Provide your response in EXACTLY the following JSON format:
{
  "name": "Campaign Name",
  "targetSegment": "One of the available segments that best fits the goal",
  "objective": "Clear description of campaign objective",
  "channel": "Email" | "WhatsApp" | "SMS",
  "subject": "Email Subject Line or message headline",
  "messageTemplate": "Personalized message template (use {{name}} for customer name personalization)",
  "callToAction": "Clear call to action string",
  "expectedConversion": 12
}
Ensure expectedConversion is a number representing percentage. Return ONLY the JSON object.`;

    const content = await getGroqChatCompletion(prompt);
    try {
      return JSON.parse(cleanJsonString(content));
    } catch (parseErr) {
      console.warn('Failed parsing campaign generation JSON, using fallback:', parseErr);
      return getMockCampaign(goal);
    }
  } catch (error) {
    console.error('Error generating Campaign with Groq:', error.message);
    return getMockCampaign(goal);
  }
};

// Marketing Copilot Chatbot logic
const getCopilotChatResponse = async (message, crmData, chatHistory = []) => {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    return getMockCopilotResponse(message, crmData);
  }

  try {
    const prompt = `You are Xeno AI, an AI growth assistant for Xeno CRM.
You ONLY help marketers with:
- Customer segmentation
- Campaign optimization
- Analytics explanation
- Audience targeting
- Revenue insights
- Campaign recommendations
- Timing suggestions

If the user asks unrelated questions, respond briefly and redirect them back to marketing. For example, if they say "How are you?", respond "I'm ready to optimize your campaigns. What would you like to analyze today?"

You have access to current CRM analytics and segment data:
- Analytics Summary: ${JSON.stringify(crmData.analytics)}
- Segments and Sizes: ${JSON.stringify(crmData.segments)}

The marketer says: "${message}"

Provide your response in EXACTLY the following JSON format:
{
  "text": "Your helpful response to the marketer, analyzing their request, providing tips, and suggesting campaigns using their segments. If the question is unrelated, a brief response redirecting to marketing.",
  "expectedRevenue": 25000,
  "suggestedCampaign": {
    "goal": "Reactivate dormant users",
    "name": "Suggested campaign name",
    "targetSegment": "Dormant Shoppers",
    "channel": "WhatsApp",
    "subject": "We miss you",
    "messageTemplate": "Hi {{name}}...",
    "callToAction": "Shop Now"
  }
}
If no campaign suggestion makes sense or if the user question is unrelated, set "suggestedCampaign" to null.
Ensure expectedRevenue is a number in Indian Rupees (₹). Return ONLY the JSON.`;

    const content = await getGroqChatCompletion(prompt);
    try {
      return JSON.parse(cleanJsonString(content));
    } catch (parseErr) {
      console.warn('Failed parsing copilot response JSON, using fallback:', parseErr);
      return getMockCopilotResponse(message, crmData);
    }
  } catch (error) {
    console.error('Error in Copilot Chat with Groq:', error.message);
    return getMockCopilotResponse(message, crmData);
  }
};

// Fallback Mock Implementations in case API Key is missing or error occurs
const getMockSegmentInsights = (segmentName, count) => {
  const mockInsights = {
    'New Shoppers': {
      summary: `We have ${count} customers who placed their first order within the last 30 days.`,
      observations: [
        'High initial interest but vulnerable to churning if not engaged.',
        'Majority of purchases are in apparel and accessories categories.',
        'Average order value is around ₹1,800.'
      ],
      opportunity: 'Convert first-time shoppers into repeat loyal customers.',
      action: 'Send a welcoming onboarding campaign with a 10% discount on their second order.',
      channel: 'Email',
      conversionProbability: 18
    },
    'Repeat Buyers': {
      summary: `We have ${count} repeat buyers who have placed multiple orders.`,
      observations: [
        'Highly loyal segment showing consistent interest.',
        'Strong preference for mid-to-high ticket electronics.',
        'Often purchase during sales and festival periods.'
      ],
      opportunity: 'Increase average order frequency and average order value.',
      action: 'Launch a VIP early-access campaign for upcoming product launches.',
      channel: 'WhatsApp',
      conversionProbability: 25
    },
    'High Value Shoppers': {
      summary: `We have ${count} high value shoppers with a lifetime spend above ₹10,000.`,
      observations: [
        'Responsible for over 40% of total store revenue.',
        'High average order value (> ₹4,000).',
        'Responsive to personalized and premium customer support.'
      ],
      opportunity: 'Maintain loyalty and cross-sell premium products.',
      action: 'Provide a dedicated customer support line and invite to an exclusive loyalty program.',
      channel: 'WhatsApp',
      conversionProbability: 30
    },
    'Dormant Shoppers': {
      summary: `We have ${count} customers who have not made any purchase in the last 180 days.`,
      observations: [
        'Significant risk of lifetime customer churn.',
        'Most of them only bought a single item on discount.',
        'Low open rates on email campaigns.'
      ],
      opportunity: 'Re-engage and reactivate dormant customers before they completely churn.',
      action: 'Offer a high-discount win-back offer (e.g. ₹500 voucher) via WhatsApp.',
      channel: 'WhatsApp',
      conversionProbability: 12
    },
    'Festival Buyers': {
      summary: `We have ${count} festival buyers who buy primarily during Indian holidays.`,
      observations: [
        'Purchases spike massively around Diwali, Holi, and Dussehra.',
        'High interest in traditional wear and home decor.',
        'Sensitive to festival-themed marketing creatives.'
      ],
      opportunity: 'Capitalize on seasonal and holiday shopping rushes.',
      action: 'Pre-schedule festival themed catalogs and offers ahead of the next holiday.',
      channel: 'Email',
      conversionProbability: 22
    },
    'Cart Abandoners': {
      summary: `We have ${count} customers who left products in their carts without checking out.`,
      observations: [
        'Extremely high purchase intent showing immediate need.',
        'Often abandon due to shipping charges or payment distractions.',
        'Fast engagement leads to higher conversion.'
      ],
      opportunity: 'Recover lost sales immediately.',
      action: 'Send an automated cart reminder within 24 hours offering free delivery.',
      channel: 'WhatsApp',
      conversionProbability: 35
    },
    'Discount Seekers': {
      summary: `We have ${count} discount seekers who primarily buy products that are on sale.`,
      observations: [
        'Extremely price-sensitive segment.',
        'Unlikely to purchase items at full price.',
        'Responsive to flash sales and promo codes.'
      ],
      opportunity: 'Clear slow-moving inventory by offering clearance coupons.',
      action: 'Send targeted coupon codes for clearance or discounted stock items.',
      channel: 'SMS',
      conversionProbability: 15
    },
    'Premium Buyers': {
      summary: `We have ${count} premium buyers with average order value above ₹2,500.`,
      observations: [
        'Appreciate high quality and premium branding.',
        'Less sensitive to price changes or discount size.',
        'Value convenience and express delivery.'
      ],
      opportunity: 'Up-sell premium categories and subscription/care packages.',
      action: 'Pitch premium accessories and product insurance packages at checkout.',
      channel: 'Email',
      conversionProbability: 20
    }
  };

  return mockInsights[segmentName] || {
    summary: `${count} customers classified in ${segmentName}.`,
    observations: ['Regular shopping pattern observed.', 'Responsive to marketing outreach.'],
    opportunity: 'Engage with targeted messaging.',
    action: 'Send a segment-specific newsletter.',
    channel: 'Email',
    conversionProbability: 15
  };
};

const getMockCampaign = (goal) => {
  const goalLower = goal.toLowerCase();
  
  if (goalLower.includes('dormant') || goalLower.includes('win back') || goalLower.includes('inactive')) {
    return {
      name: 'Dormant Customer Win-back',
      targetSegment: 'Dormant Shoppers',
      objective: 'Reactivate customers inactive for > 180 days',
      channel: 'WhatsApp',
      subject: 'We miss you!',
      messageTemplate: 'Hi {{name}}, it has been a while since your last purchase. Here is a special 20% discount code just for you: WELCOMEBACK20. We hope to see you soon!',
      callToAction: 'Claim Discount',
      expectedConversion: 12
    };
  }
  
  if (goalLower.includes('sales') || goalLower.includes('revenue') || goalLower.includes('boost')) {
    return {
      name: 'High Value VIP Sale',
      targetSegment: 'High Value Shoppers',
      objective: 'Boost overall revenue by targeting high spenders',
      channel: 'WhatsApp',
      subject: 'Exclusive VIP Sale',
      messageTemplate: 'Hi {{name}}, as one of our VIP customers, we are giving you early access to our exclusive Premium collection. Use code VIPACCESS for ₹1000 off!',
      callToAction: 'Shop VIP Collection',
      expectedConversion: 25
    };
  }

  if (goalLower.includes('cart') || goalLower.includes('abandon')) {
    return {
      name: 'Cart Recovery Campaign',
      targetSegment: 'Cart Abandoners',
      objective: 'Recover abandoned checkout items',
      channel: 'WhatsApp',
      subject: 'Did you forget something?',
      messageTemplate: 'Hey {{name}}, we noticed you left some amazing items in your cart. Complete your order in the next 2 hours and get free shipping!',
      callToAction: 'Complete Checkout',
      expectedConversion: 35
    };
  }

  return {
    name: 'Generic Sales Boost',
    targetSegment: 'New Shoppers',
    objective: 'Drive sales engagement',
    channel: 'Email',
    subject: 'Special Offer inside!',
    messageTemplate: 'Hi {{name}}, enjoy this exclusive offer from Xeno on your favorite categories. Shop today!',
    callToAction: 'Shop Now',
    expectedConversion: 10
  };
};

const getMockCopilotResponse = (message, crmData) => {
  const msgLower = message.toLowerCase();
  
  const dormantCount = crmData.segments['Dormant Shoppers'] || 180;
  const premiumCount = crmData.segments['Premium Buyers'] || 90;

  // Keywords indicating marketing context
  const marketingKeywords = ['sale', 'revenue', 'campaign', 'segment', 'analytics', 'timing', 'click', 'convert', 'target', 'customer', 'dormant', 'active', 'buyer', 'spent', 'order', 'aov', 'optimiz', 'suggest', 'recommend', 'lead'];
  const isMarketingRelated = marketingKeywords.some(kw => msgLower.includes(kw));

  if (!isMarketingRelated) {
    if (msgLower.includes('how are you') || msgLower.includes('hello') || msgLower.includes('hi')) {
      return {
        text: "I'm ready to optimize your campaigns. What would you like to analyze today?",
        expectedRevenue: 0,
        suggestedCampaign: null
      };
    }
    return {
      text: "I am Xeno AI. I can only assist you with customer segmentation, campaign optimization, analytics explanations, audience targeting, revenue insights, campaign recommendations, and timing suggestions. Please let me know what marketing campaigns or metrics you would like to analyze today.",
      expectedRevenue: 0,
      suggestedCampaign: null
    };
  }

  if (msgLower.includes('sales') || msgLower.includes('revenue') || msgLower.includes('increase')) {
    return {
      text: `Based on your database, I found **${dormantCount} dormant customers** and **${premiumCount} premium customers**. I recommend launching a high-converting WhatsApp campaign targeting these dormant shoppers to win them back, along with an exclusive premium collection campaign to drive high-basket orders.`,
      expectedRevenue: 35000,
      suggestedCampaign: {
        goal: 'Increase sales this week',
        name: 'Dormant Customer Reactivation',
        targetSegment: 'Dormant Shoppers',
        channel: 'WhatsApp',
        subject: 'We miss you!',
        messageTemplate: 'Hi {{name}}, it has been a while since your last purchase. Here is a special 20% discount code just for you: WELCOMEBACK20. We hope to see you soon!',
        callToAction: 'Claim Discount'
      }
    };
  }

  if (msgLower.includes('cart') || msgLower.includes('abandon')) {
    const abandonCount = crmData.segments['Cart Abandoners'] || 45;
    return {
      text: `We have **${abandonCount} Cart Abandoners** who left items in their cart without checking out. Generating a cart recovery campaign on WhatsApp with a free shipping offer has an expected conversion rate of 35%.`,
      expectedRevenue: 15000,
      suggestedCampaign: {
        goal: 'Recover abandoned carts',
        name: 'Cart Recovery Reminder',
        targetSegment: 'Cart Abandoners',
        channel: 'WhatsApp',
        subject: 'Did you forget something?',
        messageTemplate: 'Hi {{name}}, you left some items in your cart. Complete your purchase now for free shipping!',
        callToAction: 'Complete Order'
      }
    };
  }

  return {
    text: `Hello! I am your Xeno Copilot. I have access to your CRM statistics, including your customer segment breakdown. Try asking me something like "How can I increase sales this week?" or "How many cart abandoners do we have?"`,
    expectedRevenue: 0,
    suggestedCampaign: null
  };
};

// AI Campaign explanation generator
const getCampaignExplanationAI = async (campaign, stats) => {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    return getMockCampaignExplanation(campaign, stats);
  }

  try {
    const prompt = `You are an AI growth marketer for Xeno CRM.
Analyze this campaign performance:
- Campaign Name: "${campaign.name}"
- Goal: "${campaign.goal}"
- Segment: "${campaign.targetSegment}"
- Channel: "${campaign.channel}"
- Stats: ${JSON.stringify(stats)}

Generate a detailed explanation and recommendations for this campaign.
Provide your response in EXACTLY the following JSON format:
{
  "explanation": "Summary explaining the performance based on stats (e.g. low open rate, weak CTA, etc.)",
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}
Return ONLY the JSON object.`;

    const content = await getGroqChatCompletion(prompt);
    try {
      return JSON.parse(cleanJsonString(content));
    } catch (parseErr) {
      console.warn('Failed parsing campaign explanation JSON, using fallback:', parseErr);
      return getMockCampaignExplanation(campaign, stats);
    }
  } catch (error) {
    console.error('Error generating AI campaign explanation:', error.message);
    return getMockCampaignExplanation(campaign, stats);
  }
};

const getMockCampaignExplanation = (campaign, stats) => {
  if (stats.status === 'Success') {
    return {
      explanation: 'Excellent campaign performance! The campaign achieved a strong conversion rate of ' + stats.conversionRate.toFixed(1) + '% due to highly receptive target segment (' + campaign.targetSegment + ') and engaging message copy.',
      recommendations: [
        'Continue targeting this segment with high-value previews.',
        'Experiment with SMS channel to check if open rates increase further.',
        'A/B test subject lines to maximize the open rate.'
      ]
    };
  } else if (stats.status === 'Failed') {
    return {
      explanation: 'Low conversion rate of ' + stats.conversionRate.toFixed(1) + '% observed. This is likely due to a poor open rate (' + stats.openRate.toFixed(1) + '%) or high message delivery failure rate (' + stats.failedRate.toFixed(1) + '%). The copy or CTA was not persuasive enough.',
      recommendations: [
        'Review and optimize segment filters to ensure high-intent targeting.',
        'Create a stronger, more action-oriented call to action (CTA).',
        'Verify channel status (WhatsApp templates/SMS gateways) to reduce failure rate.'
      ]
    };
  } else {
    return {
      explanation: 'Mixed performance metrics. While the open rate was decent (' + stats.openRate.toFixed(1) + '%), the conversion rate was moderate (' + stats.conversionRate.toFixed(1) + '%). Users clicked but did not purchase at checkout.',
      recommendations: [
        'Offer dynamic promo codes (like DISCOUNT10) to convert cart clicks.',
        'Refine the message template to add personalization like {last_order}.',
        'Try sending the campaign at a different time (e.g., late afternoon).'
      ]
    };
  }
};

// AI Proactive recommendations generator
const getAIProactiveRecommendations = async (crmData) => {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    return getMockAIRecommendations(crmData);
  }

  try {
    const prompt = `You are an AI growth assistant for Xeno CRM.
Review these metrics:
${JSON.stringify(crmData)}

Proactively suggest:
1. A timing recommendation (e.g. "Send at 5 PM on weekdays")
2. A channel recommendation (e.g. "WhatsApp is converting 15% better than SMS")
3. A segment recommendation (e.g. "Target festival buyers during holidays")
4. A message improvement (e.g. "Personalize AOV pitches with spent variables")

Provide your response in EXACTLY the following JSON format:
{
  "timing": "Timing suggestion string",
  "channel": "Channel suggestion string",
  "segment": "Segment suggestion string",
  "message": "Message improvement string"
}
Return ONLY the JSON object.`;

    const content = await getGroqChatCompletion(prompt);
    try {
      return JSON.parse(cleanJsonString(content));
    } catch (parseErr) {
      console.warn('Failed parsing proactive recommendations JSON, using fallback:', parseErr);
      return getMockAIRecommendations(crmData);
    }
  } catch (error) {
    console.error('Error generating AI recommendations:', error.message);
    return getMockAIRecommendations(crmData);
  }
};

const getMockAIRecommendations = (crmData) => {
  return {
    timing: 'Best time: Send between 5 PM - 7 PM to boost click rate by 8%',
    channel: 'Top Channel: WhatsApp conversions are 12% higher than Email this week',
    segment: 'Target Tip: Run campaigns for Discount Seekers to clear seasonal stock',
    message: 'Copy Tip: Add {last_order} variable to win back dormant shoppers'
  };
};

module.exports = {
  getSegmentInsights,
  getCampaignGeneration,
  getCopilotChatResponse,
  getCampaignExplanationAI,
  getAIProactiveRecommendations
};

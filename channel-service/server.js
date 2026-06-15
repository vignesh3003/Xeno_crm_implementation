require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;
const CRM_CALLBACK_URL = process.env.CRM_CALLBACK_URL || 'http://localhost:3000/api/receipt';

// Simulated random delay between min and max ms
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// @desc    Simulate message processing
// @route   POST /send
// @access  Public
app.post('/send', async (req, res) => {
  const { recipient, message, channel, communicationId, callbackUrl } = req.body;

  if (!recipient || !message || !channel || !communicationId) {
    return res.status(400).json({ message: 'Missing recipient, message, channel, or communicationId' });
  }

  // Respond immediately to avoid blocking CRM
  res.json({ success: true, message: 'Message queued for simulation' });

  // Run the simulation asynchronously
  simulateInteraction(communicationId, channel, recipient, callbackUrl);
});

// Simulated behavior
async function simulateInteraction(communicationId, channel, recipient, callbackUrl) {
  try {
    // 1. Initial State: Sent is already recorded. We wait 1 second to transition to Delivered or Failed.
    await delay(1000);
    
    const isFailed = Math.random() < 0.08; // 8% chance of failure
    if (isFailed) {
      await sendCallback(communicationId, 'Failed', callbackUrl);
      return;
    }

    await sendCallback(communicationId, 'Delivered', callbackUrl);

    // 2. Opened: channel specific rates
    // WhatsApp has higher open rates than email/sms
    let openRate = 0.6; // SMS
    if (channel === 'WhatsApp') openRate = 0.85;
    if (channel === 'Email') openRate = 0.5;

    await delay(1500);
    const isOpened = Math.random() < openRate;
    if (!isOpened) return; // Stays at Delivered

    await sendCallback(communicationId, 'Opened', callbackUrl);

    // 3. Clicked: Click rates
    let clickRate = 0.2; // SMS
    if (channel === 'WhatsApp') clickRate = 0.35;
    if (channel === 'Email') clickRate = 0.15;

    await delay(1500);
    const isClicked = Math.random() < clickRate;
    if (!isClicked) return; // Stays at Opened

    await sendCallback(communicationId, 'Clicked', callbackUrl);

    // 4. Converted: Purchase rates
    let conversionRate = 0.08; // SMS
    if (channel === 'WhatsApp') conversionRate = 0.15;
    if (channel === 'Email') conversionRate = 0.05;

    await delay(2000);
    const isConverted = Math.random() < conversionRate;
    if (!isConverted) return; // Stays at Clicked

    await sendCallback(communicationId, 'Converted', callbackUrl);

  } catch (error) {
    console.error(`Simulation failed for communicationId ${communicationId}:`, error.message);
  }
}

async function sendCallback(communicationId, status, callbackUrl) {
  const maxAttempts = 3;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const targetUrl = callbackUrl || CRM_CALLBACK_URL;
      await axios.post(targetUrl, {
        communicationId,
        status
      });
      console.log(`[Success] Callback sent to CRM: ${communicationId} -> ${status} (Attempt ${attempt})`);
      return; // Success, exit retry loop
    } catch (error) {
      console.error(`[Attempt ${attempt} Failed] to send callback to CRM for ${communicationId} -> ${status}: ${error.message}`);
      
      if (attempt < maxAttempts) {
        const backoffMs = Math.pow(2, attempt) * 1000; // Attempt 1 fails -> wait 2s; Attempt 2 fails -> wait 4s
        console.log(`[Retry] Scheduling attempt ${attempt + 1} in ${backoffMs}ms...`);
        await delay(backoffMs);
      } else {
        console.error(`[Permanent Failure] Callback failed permanently after ${maxAttempts} attempts for ${communicationId} -> ${status}`);
      }
    }
  }
}

app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'channel-service', timestamp: new Date() });
});

app.listen(PORT, () => {
  console.log(`Channel Simulation Service running on port ${PORT}`);
});

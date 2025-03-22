console.log("✅ Background script запущено");
let historicalPrices = {};
chrome.runtime.onInstalled.addListener(() => {
	console.log("Extension Installed");
});

self.fetchSignals = fetchSignals;
globalThis.fetchSignals = fetchSignals;

async function fetchSignals() {
const apiKey = "8I7i6dn7E4DRq7do33qhkNfCHpnomd6r4SM72bXRiRBQ1GvFDDBQgEctM3AeSusu";
const apiSecret = "7LnyAFFfE15EmWd9d6fBk9usqsGU23j8PqTS8elNQJfW2sN12TkyVRB8LgBC3zeY";
const url = "https://fapi.binance.com/fapi/v1/ticker/price";

try {
	const response = await fetch(url);
	const data = await response.json();
	console.log("🔍 Binance API Response:", data);


	let signals = [];

	for (const asset of data) {
		const symbol = asset.symbol;
		const price = parseFloat(asset.price);
	
		// Ініціалізація історичних даних для активу
		if (!historicalPrices[symbol] || historicalPrices[symbol].length === 0) {
			historicalPrices[symbol] = Array(15).fill(price);
		} else {
			if (!historicalPrices[symbol]) {
				historicalPrices[symbol] = [];
			}
			if (historicalPrices[symbol][historicalPrices[symbol].length - 1] !== price) {
				historicalPrices[symbol].push(price);
				if (historicalPrices[symbol].length > 30) {
					historicalPrices[symbol].shift();
				}
			}
		}
	
		console.log(`🕒 ${symbol} - Last 5 Prices:`, historicalPrices[symbol].slice(-5));
	
		// Отримуємо RSI та Stochastic у реальному часі
		const rsi = await fetchRSI(symbol);
		const stochastic = await fetchStochastic(symbol);
		if (stochastic === null) continue;
	
		console.log(`📊 ${symbol} - Price: ${price}, RSI: ${rsi}, Stochastic: ${stochastic}`);
	
		let direction = null;
		let takeProfit = null;
		let leverage = "x5";
	
		const confidence = ((100 - Math.abs(rsi - 50)) + (100 - Math.abs(stochastic - 50))) / 2;
	
		if (confidence >= 80) {
			direction = rsi < 50 ? "BUY" : "SELL";
			takeProfit = (price * (direction === "BUY" ? 1.5 : 0.5)).toFixed(2);
		}
		
	
		if (direction) {
			signals.push({
				symbol: symbol,
				price: price,
				direction: direction,
				confidence: `${confidence.toFixed(2)}%`,
				takeProfit: `${takeProfit} USDT`,
				leverage: leverage
			});
		}
	}
	

	console.log("Signals updated:", signals);
	
	// Зберігаємо сигнали в локальне сховище
	chrome.storage.local.set({ signals: signals });

} catch (error) {
	console.error("Error fetching signals:", error);
}
}

// Функція для розрахунку RSI
async function fetchRSI(symbol, period = 14) {
	const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=15m&limit=${period}`;


	try {
			const response = await fetch(url);
		const data = await response.json();
		if (!Array.isArray(data) || data.length < period || !Array.isArray(data[0])) {

			console.error(`❌ Binance API повернуло некоректні дані для RSI:`, data);
			return 50; // Значення за замовчуванням
	}

			let gains = 0, losses = 0;
			for (let i = 1; i < data.length; i++) {
					let diff = parseFloat(data[i][4]) - parseFloat(data[i - 1][4]);
					if (diff > 0) gains += diff;
					else losses += Math.abs(diff);

			}

			let avgGain = gains / period;
			let avgLoss = losses / period;

			let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
			let rsi = 100 - (100 / (1 + rs));

			return rsi.toFixed(2);
	} catch (error) {
			console.error(`❌ Помилка отримання RSI для ${symbol}:`, error);
			return 50; // Значення за замовчуванням
	}
}



// Функція для розрахунку Stochastic
async function fetchStochastic(symbol, period = 14) {
	const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=15m&limit=${period}`;

	
	try {
		const response = await fetch(url);
		const data = await response.json();

		if (!Array.isArray(data) || data.length < period || !Array.isArray(data[0])) {

			console.error(`❌ Недостатньо даних для ${symbol}:`, data);
			return null;
		}

		let highs = data.map(candle => parseFloat(candle[2])); // High
		let lows = data.map(candle => parseFloat(candle[3]));  // Low
		let closes = data.map(candle => parseFloat(candle[4])); // Close

		let highestHigh = Math.max(...highs);
		let lowestLow = Math.min(...lows);
		let currentClose = closes[closes.length - 1];

		if (highestHigh === lowestLow) return 50;

		let stochastic = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
		return Math.min(Math.max(stochastic, 0), 100); // обмеження [0-100]

	} catch (error) {
		console.error(`❌ Помилка при запиті Stochastic для ${symbol}:`, error);
		return null;
	}
}


			// Отримання сигналів у popup.js
			chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
				if (request.action === "getSignals") {
					chrome.storage.local.get("signals", data => {
						sendResponse(data.signals || []);
					});
					return true;
				}
			});

			// Додатковий збір сигналів раз на 10 хвилин
			setInterval(fetchSignals, 60000);

			fetchSignals();
		

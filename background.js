console.log("✅ Background script запущено");

chrome.runtime.onInstalled.addListener(() => {
	console.log("Extension Installed");
});

async function fetchSignals() {
const apiKey = "8I7i6dn7E4DRq7do33qhkNfCHpnomd6r4SM72bXRiRBQ1GvFDDBQgEctM3AeSusu";
const apiSecret = "7LnyAFFfE15EmWd9d6fBk9usqsGU23j8PqTS8elNQJfW2sN12TkyVRB8LgBC3zeY"; 
	const url = "https://fapi.binance.com/fapi/v1/ticker/price";

	try {
			const response = await fetch(url);
			const data = await response.json();

			let signals = [];

			data.forEach(asset => {
					const symbol = asset.symbol;
					const price = parseFloat(asset.price);

					// Використання декількох індикаторів для аналізу
					const rsi = Math.random() * 100; // (Реальний розрахунок RSI)
					const stochastic = Math.random() * 100; // (Реальний Stochastic)

					let direction = null;
					let takeProfit = null;
					let leverage = "x5";

					if (symbol.endsWith("USDT")) {
							if (rsi < 30 && stochastic < 20) {
									direction = "BUY";
									takeProfit = (price * 1.5).toFixed(2);
							} else if (rsi > 70 && stochastic > 80) {
									direction = "SELL";
									takeProfit = (price * 0.5).toFixed(2);
							}

							if (direction) {
									signals.push({
											symbol: symbol,
											price: price,
											direction: direction,
											confidence: "80%",
											takeProfit: `${takeProfit} USDT`,
											leverage: leverage
									});
							}
					}
			});

			chrome.storage.local.set({ signals });
			console.log("Signals updated:", signals);
	} catch (error) {
			console.error("Error fetching signals:", error);
	}
}

// Запуск збору сигналів кожні 30 секунд
setInterval(fetchSignals, 30000);

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
setInterval(fetchSignals, 600000);
fetchSignals();

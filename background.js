console.log("✅ Background script запущено");
let historicalPrices = {};

async function fetchVolume(symbol, interval = "1h") {
  const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=2`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!Array.isArray(data) || data.length < 2) return null;

    const volume = parseFloat(data[1][5]); // обсяг з останньої свічки
    return volume;
  } catch (err) {
    console.error(`❌ Volume error for ${symbol}:`, err);
    return null;
  }
}

const MIN_VOLUME = 10; // debug режим


async function getAllFuturesSymbols() {
	const url = "https://fapi.binance.com/fapi/v1/exchangeInfo";

	try {
		const response = await fetch(url);
		const contentType = response.headers.get("content-type");

		if (!contentType || !contentType.includes("application/json")) {
			throw new Error("Невірний формат відповіді Binance: " + contentType);
		}

		const data = await response.json();

		if (!data.symbols || !Array.isArray(data.symbols)) return [];

		const filteredSymbols = data.symbols
			.filter(s =>
				s.contractType === "PERPETUAL" &&
				s.quoteAsset === "USDT" &&
				s.status === "TRADING" &&
				!s.symbol.includes("1000") &&  // Наприклад: уникнути 1000LUNC/1000PEPE
				!s.symbol.includes("DOWN") &&
				!s.symbol.includes("UP"),
				!s.symbol.includes("TEST") && !s.symbol.includes("1000") &&
!s.symbol.includes("UP") && !s.symbol.includes("DOWN")

			)
			.map(s => s.symbol);

		console.log(`📦 Потенційні символи для аналізу: ${filteredSymbols.length}`);

		// Додатково фільтруємо за обсягом
		const volumeFiltered = [];
		for (const symbol of filteredSymbols) {
			const volume = await fetchVolume(symbol, "1h");
			if (volume && volume >= MIN_VOLUME) {
				volumeFiltered.push(symbol);
			} else {
				console.log(`⚠️ ${symbol} → Відсіяно через обсяг: ${volume}`);
			}
		}

		console.log(`✅ Залишилось після фільтрації: ${volumeFiltered.length}`);
		return volumeFiltered;
	} catch (error) {
		console.error("❌ Не вдалося отримати список монет:", error);
		return [];
	}
}


const tradeDuration = 1;


function calcrsi1h(prices, period = 14) {
	if (prices.length < period + 1) return 50;

	let gains = 0, losses = 0;
	for (let i = 1; i <= period; i++) {
		let diff = prices[prices.length - i] - prices[prices.length - i - 1];
		if (diff > 0) gains += diff;
		else losses += Math.abs(diff);
	}

	let avgGain = gains / period;
	let avgLoss = losses / period;
	if (avgLoss === 0) return 100;

	let rs = avgGain / avgLoss;
	let rsi1h = 100 - (100 / (1 + rs));
	return parseFloat(rsi1h.toFixed(2));
}

function calcEMA(prices, period = 14) {
	if (prices.length < period) return null;

	const k = 2 / (period + 1);
	let ema1h = prices[prices.length - period];

	for (let i = prices.length - period + 1; i < prices.length; i++) {
		ema1h = prices[i] * k + ema1h * (1 - k); // 🔁 виправлено на ema1h
	}

	return parseFloat(ema1h.toFixed(2));
}



function calcstochastic1h(prices, period = 14) {
	if (prices.length < period) return null;

	const recent = prices.slice(-period);
	const high = Math.max(...recent);
	const low = Math.min(...recent);
	const close = prices[prices.length - 1];

	if (high === low) return 50;

	const stochastic1h = ((close - low) / (high - low)) * 100;
	return Math.min(Math.max(stochastic1h, 0), 100);
}

function calcATR(prices, period = 14) {
	if (prices.length < period + 1) return null;

	let trs = [];
	for (let i = prices.length - period; i < prices.length; i++) {
		const current = prices[i];
		const previous = prices[i - 1];
		const tr = Math.abs(current - previous);
		trs.push(tr);
	}

	const atr1h = trs.reduce((sum, val) => sum + val, 0) / period;
	return parseFloat(atr1h.toFixed(4));
}
function calcMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
	if (prices.length < slowPeriod + signalPeriod) return null;

	// EMA для fast і slow
	function getEMA(data, period) {
		const k = 2 / (period + 1);
		let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
		for (let i = period; i < data.length; i++) {
			ema = data[i] * k + ema * (1 - k);
		}
		return ema;
	}
	

	const macdLineArray = [];

	for (let i = slowPeriod; i <= prices.length; i++) {
		const slice = prices.slice(i - slowPeriod, i);
		const fastEMA = getEMA(slice.slice(-fastPeriod), fastPeriod);
const slowEMA = getEMA(slice, slowPeriod);
macdLineArray.push(fastEMA - slowEMA);

	}

	const signalLine = getEMA(macdLineArray.slice(-signalPeriod), signalPeriod);
	const macdLine = macdLineArray[macdLineArray.length - 1];
	const histogram = macdLine - signalLine;

	return {
		macd: parseFloat(macdLine.toFixed(4)),
		signal: parseFloat(signalLine.toFixed(4)),
		histogram: parseFloat(histogram.toFixed(4)),
	};
}

async function analyzeAndGenerateSignal(symbol, history) {
  if (history.length < 15) return;

  // Визначаємо останню ціну з історії
  const price = history[history.length - 1];

  // Перевірки на наявність необхідних значень
  if (!price) {
    console.warn(`❌ Невірне значення ціни для ${symbol}`);
    return;
  }

  const rsi1h = calcrsi1h(history);
  const stochastic1h = calcstochastic1h(history);
  const ema1h = calcEMA(history);
  const atr1h = calcATR(history);
  const macdData = calcMACD(history);

  if (!macdData) return;

  // Визначаємо напрямок
  let rawDirection = rsi1h < 50 ? "BUY" : "SELL";
  let direction = null; // оголошуємо direction локально в межах цієї функції

  // Перевірка на необхідні дані
  if (!price || !ema1h || stochastic1h === null || !atr1h || atr1h === 0) {
    console.warn(`⚠️ Пропуск ${symbol} → price=${price}, ema1h=${ema1h}, stochastic1h=${stochastic1h}, atr1h=${atr}`);
    return;
  }

  let confidence = ((100 - Math.abs(rsi1h - 50)) + (100 - Math.abs(stochastic1h - 50))) / 2;


  // Розрахунок Take Profit
  let takeProfit = null;
  let atrMultiplier = 8; // для 1-денної угоди
  takeProfit = (direction === "BUY")
    ? (price + atr1h * atrMultiplier).toFixed(4)
    : (price - atr1h * atrMultiplier).toFixed(4);

  console.log(`✅ ${symbol} → Dir: ${direction}, rsi1h: ${rsi1h}, Stoch: ${stochastic1h}, ema1h: ${ema1h}, ATR: ${atr}, MACD: ${macdData.macd}, Signal: ${macdData.signal}, Hist: ${macdData.histogram}, TP: ${takeProfit}`);

  const signal = {
    symbol,
    price,
    direction,
    confidence: `${confidence.toFixed(2)}%`,
    takeProfit: `${takeProfit} USDT`,
    expectedTime: "1 day",
    macd: macdData.macd,
    macdSignal: macdData.signal,
    macdHistogram: macdData.histogram
  };

  // Збереження сигналів
  chrome.storage.local.get("signals", (data) => {
    const updated = Array.isArray(data.signals) ? data.signals.filter(s => s.symbol !== symbol) : [];
    updated.push(signal);
    chrome.storage.local.set({ signals: updated });
  });
}



chrome.runtime.onInstalled.addListener(() => {
	console.log("Extension Installed");
});

self.fetchSignals = fetchSignals;
globalThis.fetchSignals = fetchSignals;



async function fetchSignals() {
	const url = "https://fapi.binance.com/fapi/v1/ticker/price";
	
	
	try {
		const response = await fetch(url);
		const data = await response.json();
		console.log("🔍 Binance API Response:", data);
		if (!Array.isArray(data)) {
			console.error("❌ Binance API повернув не масив:", JSON.stringify(data, null, 2));
			return;
		}

		let signals = [];
		let rawDirection = null;
		let direction = null;
		
		for (const asset of data) {
			const symbol = asset.symbol;
			const price = parseFloat(asset.price);
			const volume = await fetchVolume(symbol, "1h");
if (!volume || volume < 10) {
  console.log(`⚠️ ${symbol} → Низький обсяг: ${volume}`);
  continue;
}
if (!symbol || !/^[A-Z]{3,15}USDT$/.test(symbol)) {
	console.warn(`⛔️ Пропущено недійсний символ: ${symbol}`);
	continue;
}

	if (!symbol || !/^[A-Z]{3,15}USDT$/.test(symbol)) {
		console.warn(`⛔️ Пропущено недійсний символ: ${symbol}`);
		continue;
	}

		// Ініціалізація історії
		if (!historicalPrices[symbol]) {
			// Завантажити історію цін одразу
			const historyData = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=1h&limit=50`);
			const candles = await historyData.json();
			const closePrices = candles.map(c => parseFloat(c[4]));
		
			historicalPrices[symbol] = closePrices;
		} else {
				if (historicalPrices[symbol][historicalPrices[symbol].length - 1] !== price) {
					historicalPrices[symbol].push(price);
					if (historicalPrices[symbol].length > 30) {
						historicalPrices[symbol].shift();
					}
				}
			}
			const history = historicalPrices[symbol] || [];
if (history.length < 35) continue;

const macd = calcMACD(history);
			if (!macd) continue;


			console.log(`🕒 ${symbol} - Last 5 Prices:`, historicalPrices[symbol].slice(-5));

			// Отримуємо індикатори
			const rsi1h = (await fetchRSI(symbol, 14, "1h")) ?? 50;
			const rsi4h = await fetchRSI(symbol, 14, "4h");
			
			const stochastic1h = (await fetchStochastic(symbol, 14, "1h")) ?? 50;
			const stochastic4h = await fetchStochastic(symbol, 14, "4h");
			
			const ema1h = await fetchEMA(symbol, 14, "1h");
			const ema4h = await fetchEMA(symbol, 14, "4h");
			
			const atr1h = await fetchATR(symbol, 14, "1h");
			const atr4h = await fetchATR(symbol, 14, "4h");
			rawDirection = rsi1h < 50 ? "BUY" : "SELL";

if (rawDirection === "BUY" && price > ema1h && price > ema4h && macd.macd > macd.signal) {
	direction = "BUY";
}
if (rawDirection === "SELL" && price < ema1h && price < ema4h && macd.macd < macd.signal) {
	direction = "SELL";
}

			
			let confidence = ((100 - Math.abs(rsi1h - 50)) + (100 - Math.abs(stochastic1h - 50))) / 2;
			if (confidence < 50 ) {
				console.log(`⚠️ ${symbol} → Confidence занизький: ${confidence.toFixed(2)}%`);
				//continue;
			}
			if (!ema1h || !atr1h || stochastic1h === null || typeof rsi1h === "undefined") {
				console.warn(`⚠️ ${symbol} → Пропущено через: ema1h=${ema1h}, atr1h=${atr1h}, stochastic1h=${stochastic1h}, rsi1h=${rsi1h}`);
				continue;
			}
		

			// Розрахунок confidence
			confidence = ((100 - Math.abs(rsi1h - 50)) + (100 - Math.abs(stochastic1h - 50))) / 2;

			

			console.log(`📊 ${symbol} - Price: ${price}, rsi1h: ${rsi1h}, stochastic1h: ${stochastic1h}, ema1h: ${ema1h}, atr1h: ${atr1h}, Confidence: ${confidence}`);

			let tradeDuration = 1;

			await new Promise(resolve => {
				chrome.storage.local.get(["tradeDuration"], (data) => {
					if (data.tradeDuration && (data.tradeDuration === "1" || data.tradeDuration === "2")) {
						tradeDuration = parseInt(data.tradeDuration);
					}
					resolve();
				});
			});

			

			// Пошук рівня підтримки / супротиву
			const levels1h = await getCachedSupportResistance(symbol, "1h", 100, 3);
			const levels4h = await getCachedSupportResistance(symbol, "4h", 100, 3);
			

const supportResistance = [...levels1h, ...levels4h];

			let nearestLevel = null;

			if (direction === "BUY") {
				const resistanceLevels = supportResistance
					.filter(lvl => lvl.type === "resistance" && lvl.price > price)
					.sort((a, b) => a.price - b.price);
				if (resistanceLevels.length > 0) nearestLevel = resistanceLevels[0];
			} else if (direction === "SELL") {
				const supportLevels = supportResistance
					.filter(lvl => lvl.type === "support" && lvl.price < price)
					.sort((a, b) => b.price - a.price);
				if (supportLevels.length > 0) nearestLevel = supportLevels[0];
			}

			// Розрахунок Take Profit
			let atrMultiplier = tradeDuration === 1 ? 8 : 12;
			let takeProfit = null;
			let tpSource = "atr1h";

			// Початково direction undefined
direction = null;

// Спершу перевіримо повну відповідність сигналам
if ((rawDirection === "BUY" && price > ema1h && macd.macd > macd.signal) ||
    (rawDirection === "SELL" && price < ema1h && macd.macd < macd.signal)) {
	direction = rawDirection;
	console.log(`📈 ${symbol} → Direction підтверджено за MACD`);
} else {
	// fallback: встановлюємо напрямок хоча б на основі RSI
	direction = rawDirection;
	console.log(`⚠️ ${symbol} → Direction fallback до rawDirection: ${rawDirection}`);
}

			const atrBasedTP = (direction === "BUY")
  ? price + atr1h * atrMultiplier
  : price - atr1h * atrMultiplier;

if (nearestLevel) {
  const levelTP = nearestLevel.price;
  const levelProfit = direction === "BUY"
    ? ((levelTP - price) / price) * 100
    : ((price - levelTP) / price) * 100;

  if (levelProfit >= 50) {
    takeProfit = levelTP.toFixed(4);
    tpSource = "S/R";
  } else {
    takeProfit = atrBasedTP.toFixed(4);
    tpSource = "ATR fallback";
  }
} else {
  takeProfit = atrBasedTP.toFixed(4);
  tpSource = "ATR only";
}


			const targetPrice = parseFloat(takeProfit);
			const targetMove = Math.abs(price - targetPrice);
			const maxMoveIn2Days = atr1h * 192;

			const barsToTarget = Math.ceil(targetMove / atr1h);
			const expectedHours = (barsToTarget * 15) / 60;
			const expectedDays = (expectedHours / 24).toFixed(1);

			const profitPercent = direction === "BUY"
				? ((targetPrice - price) / price) * 100
				: ((price - targetPrice) / price) * 100;
				if (profitPercent < 1) {
					console.log(`⛔️ ${symbol} → Недостатній прибуток: ${profitPercent.toFixed(2)}%`);
					//continue;
				}
				

			//if (profitPercent < 40) {
				//console.log(`⚠️ ${symbol} → Недостатній потенціал: ${profitPercent.toFixed(2)}%`);
				//continue;
			//}

				if (targetMove <= maxMoveIn2Days) {
					console.log(`✅ ${symbol} → Dir: ${direction}, Profit: ${profitPercent.toFixed(2)}%, TP: ${takeProfit}, Source: ${tpSource}, RSI: ${rsi1h}/${rsi4h}, EMA: ${ema1h}/${ema4h}, MACD: ${macd.macd}/${macd.signal}`);

					if (!direction) {
						console.warn(`⚠️ ${symbol} → Direction undefined, сигнал не буде додано`);
						continue;
					}
					
				signals.push({
					symbol: symbol,
					price: price,
					direction: direction,
					confidence: `${confidence.toFixed(2)}%`,
					takeProfit: `${takeProfit} USDT`,
					expectedTime: `${expectedDays} days`,
				  macd: macd.macd,
					macdSignal: macd.signal,
					macdHistogram: macd.histogram
					});
			}
		}
		if (!signals.length) {
			console.warn("⚠️ Немає сигналів для збереження!");
		} else {
			console.log("💾 Збереження сигналів у storage:", signals);
		}
		
			chrome.storage.local.set({ signals });
			console.log("💾 Збережені сигнали:", signals);
			console.log("✅ Сформовано сигналів:", signals.length);

		// Збереження сигналів
		console.log("✅ Сформовані сигнали:", signals);
		console.log("📦 Сигнали перед збереженням:", signals);

		chrome.storage.local.get("signals", data => {
			console.log("📥 Перевірка сигналів після збереження:", data.signals);
		});
		
		chrome.storage.local.get("signals", data => {
			console.log("✅ Збережені сигнали:", data.signals);
		});
		
	} catch (error) {
		console.error("❌ Error fetching signals:", error);
		chrome.storage.local.set({ signals: [] });
	}
}



chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.action === "manualRefresh") {
		console.log("🔁 Отримано запит на ручне оновлення");
		fetchSignals().then(() => {
			chrome.storage.local.get("signals", (data) => {
				sendResponse({ success: true, signals: data.signals || [] });
			});
		});
		return true; // залишаємо канал відкритим для async sendResponse
	}
});
	


	async function fetchEMA(symbol, period = 14, interval = "1h") {
		const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${period + 1}`;
  
		try {
			const response = await fetch(url);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
			const data = await response.json();
			if (!Array.isArray(data) || data.length < period + 1) {
				console.error(`⚠️ Некоректні дані EMA для ${symbol}:`, data);
				return null;
			}

			const closes = data.map(candle => parseFloat(candle[4]));
			const k = 2 / (period + 1);
			let ema = closes[0];

			for (let i = 1; i < closes.length; i++) {
				ema = closes[i] * k + ema * (1 - k);
			}

			return parseFloat(ema.toFixed(2));
		} catch (error) {
			console.error(`❌ Помилка отримання EMA для ${symbol}:`, error.message);
			return null;
		}
	}
	

async function fetchATR(symbol, period = 14, interval = "1h") {
  const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${period + 1}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (!Array.isArray(data) || data.length < period) {
      console.error(`⚠️ Некоректна довжина даних для ATR для ${symbol}`);
      return null;
    }

    let trList = [];
    for (let i = 1; i < data.length; i++) {
      const high = parseFloat(data[i][2]);
      const low = parseFloat(data[i][3]);
      const prevClose = parseFloat(data[i - 1][4]);
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trList.push(tr);
    }

    const atr1h = trList.reduce((sum, val) => sum + val, 0) / period;
    return atr1h;
  } catch (error) {
    console.error(`❌ ATR error for ${symbol}:`, error);
    return null;
  }
}

	
	

// Функція для розрахунку rsi1h
async function fetchRSI(symbol, period = 14, interval = "1h") {
  const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${period + 1}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    if (!Array.isArray(data) || data.length < period + 1) {
      console.error(`⚠️ Некоректні дані RSI для ${symbol}:`, data);
      return 50;
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
    return parseFloat(rsi.toFixed(2));
  } catch (error) {
    console.error(`❌ Помилка отримання RSI для ${symbol}:`, error.message);
    return 50;
  }
}

	

	
	// Функція для розрахунку Stochastic
	async function fetchStochastic(symbol, period = 14, interval = "1h") {
		const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${period}`;
		
		try {
			const response = await fetch(url);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			
			const data = await response.json();
			if (!Array.isArray(data) || data.length < period) {
				console.error(`⚠️ Некоректні дані Stochastic для ${symbol}:`, data);
				return 50;
			}
	
			let highs = data.map(candle => parseFloat(candle[2]));
			let lows = data.map(candle => parseFloat(candle[3]));
			let closes = data.map(candle => parseFloat(candle[4]));
	
			let highestHigh = Math.max(...highs);
			let lowestLow = Math.min(...lows);
			let currentClose = closes[closes.length - 1];
	
			if (highestHigh === lowestLow) return 50;
	
			let stochastic = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
			return Math.min(Math.max(stochastic, 0), 100);
		} catch (error) {
			console.error(`❌ Помилка отримання Stochastic для ${symbol}:`, error.message);
			return 50;
		}
	}
	
	

async function fetchSupportResistance(symbol, interval = "1h", limit = 100, range = 3) {
	const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;

	try {
		const response = await fetch(url);
		const data = await response.json();

		if (!Array.isArray(data) || data.length < limit) {
			console.info(`ℹ️ Пропускаємо ${symbol} — недостатньо історії для рівнів`);
			return [];
		}
		

		const levels = [];

		for (let i = range; i < data.length - range; i++) {
			const slice = data.slice(i - range, i + range + 1);

			const low = parseFloat(data[i][3]);
			const high = parseFloat(data[i][2]);

			const isSupport = slice.every(c => low <= parseFloat(c[3]));
			const isResistance = slice.every(c => high >= parseFloat(c[2]));

			if (isSupport) levels.push({ type: "support", price: low });
			if (isResistance) levels.push({ type: "resistance", price: high });
		}

		// Фільтрація близьких рівнів (кластеризація)
		const filteredLevels = [];
		const distanceThreshold = 0.003; // 0.3%

		for (const level of levels) {
			const isNear = filteredLevels.some(existing =>
				Math.abs(existing.price - level.price) / level.price < distanceThreshold
			);
			if (!isNear) filteredLevels.push(level);
		}

		return filteredLevels;
	} catch (error) {
		console.error(`❌ Support/Resistance error for ${symbol}:`, error);
		return [];
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
	
		if (request.action === "manualRefresh") {
			console.log("🔁 Отримано запит на ручне оновлення");
			fetchSignals().then(() => {
				sendResponse({ success: true });
			});
			return true;
		}
	
		if (request.action === "fetchBinanceData") {
			const symbol = request.symbol;
			console.log("🔎 Запит даних Binance для", symbol);
			fetch(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`)
				.then(response => response.json())
				.then(data => {
					sendResponse({ success: true, data });
				})
				.catch(error => {
					console.error("❌ Помилка Binance API для", symbol, error);
					sendResponse({ success: false, error: error.message });
				});
			return true;
		}
	});

	
	async function getCachedSupportResistance(symbol, interval = "1h", limit = 100, range = 3) {
		const cacheKey = `sr_${symbol}_${interval}`;
		const cacheTTL = 60 * 60 * 1000; // 1 година
	
		return new Promise(resolve => {
			chrome.storage.local.get([cacheKey], async (data) => {
				const cached = data[cacheKey];
	
				if (cached && (Date.now() - cached.timestamp < cacheTTL)) {
					console.log(`📦 Використано кеш S/R для ${symbol} (${interval})`);
					resolve(cached.levels);
				} else {
					const levels = await fetchSupportResistance(symbol, interval, limit, range);
					chrome.storage.local.set({
						[cacheKey]: {
							timestamp: Date.now(),
							levels: levels
						}
					});
					resolve(levels);
				}
			});
		});
	};
	
	// Додатковий збір сигналів раз на 10 хвилин
	setInterval(fetchSignals, 10 * 60 * 1000); // 10 хвилин

	fetchSignals();

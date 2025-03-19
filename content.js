console.log("Content script loaded.");

// Функція отримання даних Binance
function fetchBinanceData(symbol = "BTCUSDT") {
    chrome.runtime.sendMessage(
        { action: "fetchBinanceData", symbol: symbol },
        function (response) {
            if (chrome.runtime.lastError) {
                console.error("❌ Chrome runtime error:", chrome.runtime.lastError.message);
                return;
            }

            if (response && response.success) {
                console.log(`✅ Отримано дані Binance для ${symbol}:`, response.data);
            } else {
                console.error(`❌ Помилка Binance API для ${symbol}:`, response ? response.error : "Невідома помилка");
            }
        }
    );
}

// Викликаємо функцію для отримання даних
fetchBinanceData("BTCUSDT");
fetchBinanceData("ETHUSDT"); // Можеш додавати більше пар

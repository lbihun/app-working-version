document.addEventListener("DOMContentLoaded", () => {
	const signalsContainer = document.getElementById("signals-list");
	const filterSelect = document.getElementById("filter");
	const refreshButton = document.getElementById("refresh");

	// Рендер сигналів на основі фільтра
	function renderSignals(signals, filter) {
		signalsContainer.innerHTML = "";
		console.log("🔎 Активний фільтр:", filter);

		const cleaned = signals.filter(s => s.direction === "BUY" || s.direction === "SELL");

const filtered = filter === "all"
	? cleaned
	: cleaned.filter(signal => signal.direction === filter);
	console.log("🧮 Відфільтровані сигнали:", filtered);
	



		if (filtered.length === 0) {
			signalsContainer.textContent = "Немає сигналів за обраним фільтром";
			return;
		}

		filtered.forEach(signal => {
			const signalElement = document.createElement("div");
			signalElement.className = `signal-card ${signal.direction.toLowerCase()}`;
			signalElement.innerHTML = `
				<strong>${signal.symbol}</strong> - ${signal.direction}
				<br><strong>Take Profit:</strong> ${signal.takeProfit}
				<br><strong>Confidence:</strong> ${signal.confidence}
				${signal.expectedTime ? `<br><strong>Очікуваний час:</strong> ${signal.expectedTime}` : ""}
			`;
			signalsContainer.appendChild(signalElement);
		});
	}

	// Отримання сигналів із storage
	function loadSignals() {
		chrome.storage.local.get("signals", (data) => {
			const allSignals = data.signals || [];
			console.log("📥 Завантажено сигнали в popup:", allSignals);
			renderSignals(allSignals, filterSelect.value);
		});
	}

	// Слухач фільтру
	filterSelect.addEventListener("change", loadSignals);

	// Кнопка "Оновити сигнали"
	refreshButton.addEventListener("click", () => {
		chrome.runtime.sendMessage({ action: "manualRefresh" }, (response) => {
			if (chrome.runtime.lastError) {
				console.warn("⚠️ Не вдалося звʼязатися з background.js:", chrome.runtime.lastError.message);
				signalsContainer.textContent = "❌ Немає зʼєднання з бекграундом";
				return;
			}
			console.log("✅ Відповідь на ручне оновлення:", response);
			loadSignals();
		});
		
	});

	loadSignals(); // Запуск при відкритті popup
});

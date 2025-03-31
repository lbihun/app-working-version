document.addEventListener("DOMContentLoaded", () => {
	const signalsContainer = document.getElementById("signals-list");
	const filterSelect = document.getElementById("filter");
	const refreshButton = document.getElementById("refresh");
	const debugToggle = document.getElementById("debugToggle");

	// Рендер сигналів на основі фільтра
	function renderSignals(signals, filter) {
		signalsContainer.innerHTML = "";
		console.log("🔎 Активний фільтр:", filter);

		const debugMode = debugToggle.checked;
		const cleaned = signals.filter(s =>
			s.direction?.toUpperCase() === "BUY" || s.direction?.toUpperCase() === "SELL"
		);

		console.log("🧪 Всі сигнали:", signals);
		console.log("🧼 Cleaned сигнали:", cleaned.map(s => s.direction));

		const normalizedFilter = filter.toUpperCase();
		const filtered = normalizedFilter === "УСІ"
			? cleaned
			: cleaned.filter(signal => signal.direction?.toUpperCase() === normalizedFilter);

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
				${debugMode ? `
					<br><small>
						Price: ${signal.price} | TP: ${signal.takeProfit}<br>
						MACD: ${signal.macd ?? "?"}, Signal: ${signal.macdSignal ?? "?"}, Hist: ${signal.macdHistogram ?? "?"}
					</small>` : ""}
			`;

			signalsContainer.appendChild(signalElement);
		});
	}

	// Завантаження сигналів із chrome.storage
	function loadSignals() {
		chrome.storage.local.get("signals", (data) => {
			const allSignals = data.signals || [];
			console.log("📦 Отримано збережені сигнали:", allSignals);
			renderSignals(allSignals, filterSelect.value);
		});
	}

	// Обробники подій
	filterSelect.addEventListener("change", loadSignals);
	debugToggle.addEventListener("change", loadSignals);
	refreshButton.addEventListener("click", () => {
		chrome.runtime.sendMessage({ action: "manualRefresh" }, (response) => {
			if (chrome.runtime.lastError) {
				console.warn("⚠️ Не вдалося звʼязатися з background.js:", chrome.runtime.lastError.message);
				signalsContainer.textContent = "❌ Немає зʼєднання з бекграундом";
				return;
			}
			console.log("🔄 Сигнали оновлено вручну:", response?.signals || []);
			renderSignals(response.signals || [], filterSelect.value);
		});
	});

	// Початкове завантаження
	loadSignals();
});

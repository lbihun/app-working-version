document.addEventListener("DOMContentLoaded", () => {
	const signalsContainer = document.getElementById("signals-list");
	const filterSelect = document.getElementById("filter");

	function renderSignals(signals, filter) {
			signalsContainer.innerHTML = "";

			const filtered = filter === "all"
					? signals
					: signals.filter(signal => signal.direction === filter);

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
							<br><strong>Leverage:</strong> ${signal.leverage}
					`;
					signalsContainer.appendChild(signalElement);
			});
	}

	chrome.storage.local.get("signals", (data) => {
			const allSignals = data.signals || [];
			renderSignals(allSignals, filterSelect.value);

			filterSelect.addEventListener("change", () => {
					renderSignals(allSignals, filterSelect.value);
			});
	});
});
